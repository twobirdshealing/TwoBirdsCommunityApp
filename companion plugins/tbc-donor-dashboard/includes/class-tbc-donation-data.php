<?php
/**
 * Donation Data Handler Class
 *
 * @package TwoBirdsChurch
 */

class TBC_Donation_Data {
    
    /**
     * Tax-deductible product category
     */
    private $deductible_category = 'donation';
    
    /**
     * Get all available years for a donor's donations
     *
     * @param int $user_id User ID
     * @return array Array of years
     */
    public function get_donor_years($user_id) {
        $args = array(
            'customer_id' => $user_id,
            'status'      => array('wc-completed'),
            'limit'       => -1,
            'return'      => 'ids',
        );

        $orders = wc_get_orders($args);
        $years = array();

        if (!empty($orders)) {
            foreach ($orders as $order_id) {
                $order = wc_get_order($order_id);
                if ($order) {
                    $year = $order->get_date_created()->format('Y');
                    if (!in_array($year, $years, true)) {
                        $years[] = $year;
                    }
                }
            }
        }

        if (empty($years)) {
            $years[] = date('Y');
        }

        rsort($years);
        return array_map('intval', $years);
    }

    /**
     * Get yearly donations separated by tax-deductible status
     *
     * @param int $user_id User ID
     * @param int $year    Year to fetch donations for
     * @return array       Array with deductible and non_deductible data
     */
    public function get_yearly_donations($user_id, $year) {
        $data_store = \WC_Data_Store::load('order');

        $args = array(
            'customer_id'  => $user_id,
            'status'       => array('wc-completed'),
            'date_created' => "{$year}-01-01...{$year}-12-31",
            'orderby'      => 'date_created',
            'order'        => 'ASC',
            'limit'        => -1,
            'type'         => 'shop_order',
        );

        $orders = $data_store->query($args);
        $deductible_donations = array();
        $non_deductible_donations = array();

        if (!empty($orders)) {
            foreach ($orders as $order_id) {
                $order = wc_get_order($order_id);
                if (!$order || $order->get_total() <= 0) {
                    continue;
                }

                $this->process_order_items($order, $deductible_donations, $non_deductible_donations);
                $this->process_order_fees($order, $deductible_donations);
            }
        }

        return array(
            'deductible' => $this->process_donations($deductible_donations),
            'non_deductible' => $this->process_donations($non_deductible_donations)
        );
    }

    /**
     * Process order line items and categorize by tax-deductible status
     * Only products in "donation" category are tax-deductible
     * All other categories (events, ceremonies, etc.) are non-deductible
     *
     * @param WC_Order $order Order object
     * @param array &$deductible_donations Reference to deductible donations array
     * @param array &$non_deductible_donations Reference to non-deductible donations array
     */
    private function process_order_items($order, &$deductible_donations, &$non_deductible_donations) {
        $items = $order->get_items();
        
        foreach ($items as $item) {
            $product_id = $item->get_product_id();
            $product = wc_get_product($product_id);
            
            if (!$product) {
                continue;
            }

            $item_total = $item->get_total();
            if ($item_total <= 0) {
                continue;
            }

            $donation_data = array(
                'date' => $order->get_date_created()->date('Y-m-d'),
                'order_id' => $order->get_order_number(),
                'description' => $item->get_name(),
                'amount' => wc_price($item_total),
                'raw_amount' => $item_total,
            );

            if ($this->is_product_deductible($product_id)) {
                $deductible_donations[] = $donation_data;
            } else {
                $non_deductible_donations[] = $donation_data;
            }
        }
    }

    /**
     * Process order fees and add "Extra Donation" to deductible donations
     * Note: Extra Donation fees are ALWAYS deductible, regardless of the order's product categories
     *
     * @param WC_Order $order Order object
     * @param array &$deductible_donations Reference to deductible donations array
     */
    private function process_order_fees($order, &$deductible_donations) {
        $fees = $order->get_fees();
        
        foreach ($fees as $fee) {
            $fee_name = $fee->get_name();
            $fee_total = $fee->get_total();
            
            // Include "Extra Donation" fees as tax-deductible (from ANY order)
            if ($fee_name === 'Extra Donation' && $fee_total > 0) {
                $deductible_donations[] = array(
                    'date' => $order->get_date_created()->date('Y-m-d'),
                    'order_id' => $order->get_order_number(),
                    'description' => $fee_name,
                    'amount' => wc_price($fee_total),
                    'raw_amount' => $fee_total,
                );
            }
        }
    }

    /**
     * Check if a product is tax-deductible (only "donation" category is deductible)
     *
     * @param int $product_id Product ID
     * @return bool True if deductible, false if not
     */
    private function is_product_deductible($product_id) {
        $product_categories = wp_get_post_terms($product_id, 'product_cat', array('fields' => 'slugs'));
        
        if (is_wp_error($product_categories)) {
            return false; // Default to non-deductible if we can't determine category
        }

        $category_slugs = is_array($product_categories) ? $product_categories : array();
        
        // Only "donation" category products are tax-deductible
        return in_array($this->deductible_category, $category_slugs, true);
    }

    /**
     * Process donations array to add additional calculations
     *
     * @param array $donations Array of donations
     * @return array Processed donations array
     */
    private function process_donations($donations) {
        if (empty($donations)) {
            return array(
                'donations' => array(),
                'summary' => array(
                    'total_amount' => wc_price(0),
                    'raw_total_amount' => 0,
                    'average_amount' => wc_price(0),
                    'donation_count' => 0,
                    'highest_amount' => wc_price(0),
                    'lowest_amount' => wc_price(0),
                )
            );
        }

        $total = 0;
        $count = count($donations);

        foreach ($donations as &$donation) {
            $total += $donation['raw_amount'];
            $donation['running_total'] = wc_price($total);
        }

        $summary = array(
            'total_amount'      => wc_price($total),
            'raw_total_amount'  => $total,
            'average_amount'    => wc_price($total / $count),
            'donation_count'    => $count,
            'highest_amount'    => wc_price(max(array_column($donations, 'raw_amount'))),
            'lowest_amount'     => wc_price(min(array_column($donations, 'raw_amount'))),
        );

        return array(
            'donations' => $donations,
            'summary'   => $summary,
        );
    }
}