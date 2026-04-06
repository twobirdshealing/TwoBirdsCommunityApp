<?php
/**
 * Event Team Members Handler
 * Manages facilitators for events via LINE ITEM meta (not order meta)
 * 
 * @package TBC_Participant_Frontend
 * @since 3.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Event Team Members Class
 */
class TBC_PF_Event_Team_Members {

    private static $instance = null;

    // Team members available for facilitator role
    private $team_users = [
        '1'    => 'Two Birds Church',
        '168'  => 'James Elrod',
        '2606' => 'Christina Titus',
        '1936' => 'Clayton Berger',
    ];

    // Facilitator configuration
    private $facilitator_config = [
        'meta_key'   => '_tbc_pf_event_facilitators',
        'title'      => 'Event Facilitators',
        'field_name' => 'tbc_pf_event_facilitators',
    ];

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->init_hooks();
    }

    private function init_hooks() {
        // Display facilitators per line item in admin
        add_action(
            'woocommerce_after_order_itemmeta',
            [$this, 'display_line_item_facilitators'],
            10,
            3
        );

        // Save facilitators when order items are saved
        add_action(
            'woocommerce_saved_order_items',
            [$this, 'save_line_item_facilitators'],
            10,
            2
        );
    }

    /**
     * Display facilitator selector for each line item in admin
     */
    public function display_line_item_facilitators($item_id, $item, $product) {
        // Only show for line items (products), not shipping/fees
        if (!$item instanceof WC_Order_Item_Product) {
            return;
        }
        
        // Only show for event products (those with event date)
        $event_date = $item->get_meta('_tbc_wc_event_start_date', true);
        if (empty($event_date)) {
            return;
        }
        
        $current_facilitators = $item->get_meta($this->facilitator_config['meta_key'], true);
        
        if (!is_array($current_facilitators)) {
            $current_facilitators = !empty($current_facilitators) ? [$current_facilitators] : [];
        }
        
        $current_facilitators = array_map('intval', $current_facilitators);
        $field_name = $this->facilitator_config['field_name'] . '_' . $item_id;

        echo '<div class="tbc-pf-line-item-facilitators" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">';
        echo '<p><strong>' . esc_html($this->facilitator_config['title']) . ':</strong></p>';
        echo '<select multiple name="' . esc_attr($field_name) . '[]" class="wc-enhanced-select" style="width:100%;">';

        foreach ($this->team_users as $id => $name) {
            $selected = in_array((int)$id, $current_facilitators, true) ? ' selected' : '';
            echo '<option value="' . esc_attr($id) . '"' . $selected . '>' . esc_html($name) . '</option>';
        }

        echo '</select>';
        echo '</div>';
    }

    /**
     * Save facilitators to line item meta
     * 
     * @param int $order_id Order ID
     * @param array $items Items array (passed by woocommerce_saved_order_items)
     */
    public function save_line_item_facilitators($order_id, $items = []) {
        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }
        
        $meta_key = $this->facilitator_config['meta_key'];
        $field_prefix = $this->facilitator_config['field_name'] . '_';

        foreach ($order->get_items() as $item_id => $item) {
            $field_name = $field_prefix . $item_id;
            
            if (!isset($_POST[$field_name])) {
                continue;
            }
            
            $facilitators = array_map('intval', (array)$_POST[$field_name]);
            $item->update_meta_data($meta_key, $facilitators);
            $item->save();
        }
    }

    /**
     * Get all available team users for facilitator role
     */
    public function get_facilitator_options() {
        return $this->team_users;
    }

    /**
     * Get common facilitators from line items for a specific event
     * 
     * @param array $order_ids Array of order IDs
     * @param int $product_id Product ID
     * @param string $event_date Event date (Y-m-d)
     * @return array Common facilitator IDs
     */
    public function get_common_facilitators($order_ids, $product_id = 0, $event_date = '') {
        if (empty($order_ids)) {
            return [];
        }

        $meta_key = $this->facilitator_config['meta_key'];
        $facilitator_counts = [];
        $facilitator_lists = [];

        foreach ($order_ids as $order_id) {
            $order = wc_get_order($order_id);
            if (!$order) {
                continue;
            }
            
            // Get facilitators from matching line item
            $facilitators = [];
            if ($product_id && $event_date) {
                $facilitators = tbc_pf_tm_get_line_item_meta($order, $product_id, $event_date, $meta_key);
            }
            
            if (!is_array($facilitators) || empty($facilitators)) {
                continue;
            }
            
            $facilitator_lists[] = $facilitators;
            foreach ($facilitators as $facilitator_id) {
                if (!is_scalar($facilitator_id)) {
                    continue;
                }
                if (!isset($facilitator_counts[$facilitator_id])) {
                    $facilitator_counts[$facilitator_id] = 0;
                }
                $facilitator_counts[$facilitator_id]++;
            }
        }

        if (empty($facilitator_counts)) {
            return [];
        }

        // Find the most common set of facilitators
        $counts = array_count_values(array_map('serialize', $facilitator_lists));
        arsort($counts);
        $most_common = unserialize(key($counts));

        if (reset($counts) > 1 && is_array($most_common)) {
            return $most_common;
        }

        // Otherwise return facilitators that appear in more than 50% of orders
        $common_facilitators = [];
        $order_count = count($order_ids);
        foreach ($facilitator_counts as $facilitator_id => $count) {
            if ($count > ($order_count / 2)) {
                $common_facilitators[] = $facilitator_id;
            }
        }

        return $common_facilitators;
    }
}

// Initialize the class
TBC_PF_Event_Team_Members::get_instance();