<?php
/**
 * Event Dashboard Helpers
 * 
 * Unified metrics calculations for all plugin components.
 * 
 * @package TBC_Participant_Frontend
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Calculate income and donor counts for an event
 * 
 * Used by event list, dashboard, team management, and post management.
 * 
 * @param int $product_id Product ID
 * @param string $event_date Event date (Y-m-d)
 * @return array Metrics data
 */
function tbc_pf_calculate_income_and_donors($product_id, $event_date = '') {
    global $wpdb;
    
    $empty_result = [
        'total_income' => 0,
        'active_quantities' => 0,
        'canceled_quantities' => 0,
        'order_ids' => []
    ];
    
    if (empty($event_date)) {
        return $empty_result;
    }
    
    $query = "
        SELECT order_items.order_id, SUM(order_itemmeta.meta_value) as total_quantity
        FROM {$wpdb->prefix}woocommerce_order_items as order_items
        JOIN {$wpdb->prefix}woocommerce_order_itemmeta as order_itemmeta 
            ON order_items.order_item_id = order_itemmeta.order_item_id
        JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_product
            ON order_items.order_item_id = meta_product.order_item_id
        JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_date
            ON order_items.order_item_id = meta_date.order_item_id
        WHERE order_itemmeta.meta_key = '_qty'
        AND meta_product.meta_key = '_product_id'
        AND meta_product.meta_value = %d
        AND meta_date.meta_key = '_tbc_wc_event_start_date'
        AND meta_date.meta_value = %s
        GROUP BY order_items.order_id
    ";
    
    $results = $wpdb->get_results($wpdb->prepare($query, $product_id, $event_date), ARRAY_A);
    
    if (!$results) {
        return $empty_result;
    }
    
    $total_income = 0;
    $active_quantities = 0;
    $canceled_quantities = 0;
    
    foreach ($results as $result) {
        $order = wc_get_order($result['order_id']);
        if (!$order) {
            continue;
        }
        
        $net_payment = $order->get_total() - $order->get_total_refunded();
        $quantity = intval($result['total_quantity']);
        $status = $order->get_status();
        
        if (in_array($status, ['processing', 'completed'], true)) {
            $total_income += $net_payment;
            $active_quantities += $quantity;
        } elseif ($status === 'cancelled') {
            if ($net_payment > 0) {
                $total_income += $net_payment;
            }
            $canceled_quantities += $quantity;
        }
    }
    
    return [
        'total_income' => $total_income,
        'active_quantities' => $active_quantities,
        'canceled_quantities' => $canceled_quantities,
        'order_ids' => array_column($results, 'order_id')
    ];
}