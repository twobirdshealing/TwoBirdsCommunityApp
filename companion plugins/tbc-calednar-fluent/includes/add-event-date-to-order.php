<?php
/**
 * TBC WooCommerce Calendar - Order Date Integration
 * 
 * Handles adding event dates to cart, displaying in cart/orders, and admin editing.
 * 
 * @package TBC_WC_Calendar
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Add the selected date as a hidden input field in the add to cart form
 */
function tbc_wc_add_selected_date_to_cart() {
    if (!is_product()) {
        return;
    }
    
    global $product;
    
    if (!$product instanceof WC_Product) {
        return;
    }
    
    if ($product->is_type('external')) {
        return;
    }
    
    if (!tbc_wc_is_event_product($product)) {
        return;
    }
    
    $current_event = $GLOBALS['tbc_wc_current_event'] ?? null;
    
    if (!$current_event) {
        return;
    }
    
    $selected_date = $current_event['start'];
    $selected_end_date = $current_event['end'];
    
    if ($current_event['status'] === 'closed' || $current_event['status'] === 'booked') {
        return;
    }
    
    echo '<input type="hidden" name="tbc_wc_display_date" value="' . esc_attr($selected_date) . '" />';
    echo '<input type="hidden" name="tbc_wc_display_end_date" value="' . esc_attr($selected_end_date) . '" />';
}

/**
 * Add custom data to cart item when product is added to cart
 * 
 * @param array $cart_item_data Cart item data
 * @param int $product_id Product ID
 * @param int $variation_id Variation ID
 * @return array Modified cart item data
 */
function tbc_wc_add_event_date_to_cart($cart_item_data, $product_id, $variation_id) {
    if (isset($_POST['tbc_wc_display_date']) && !empty($_POST['tbc_wc_display_date'])) {
        $event_date = sanitize_text_field($_POST['tbc_wc_display_date']);
        $event_end_date = isset($_POST['tbc_wc_display_end_date']) ? sanitize_text_field($_POST['tbc_wc_display_end_date']) : '';
        
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $event_date)) {
            $cart_item_data['tbc_wc_event_date'] = $event_date;
            
            if (!empty($event_end_date) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $event_end_date)) {
                $cart_item_data['tbc_wc_event_end_date'] = $event_end_date;
            }
            
            $cart_item_data['unique_key'] = md5($product_id . $event_date);
        }
    }
    
    return $cart_item_data;
}

/**
 * Display the event date in the cart
 * 
 * @param array $item_data Item data
 * @param array $cart_item Cart item
 * @return array Modified item data
 */
function tbc_wc_display_event_date_in_cart($item_data, $cart_item) {
    if (isset($cart_item['tbc_wc_event_date'])) {
        $event_date = $cart_item['tbc_wc_event_date'];
        $event_end_date = isset($cart_item['tbc_wc_event_end_date']) ? $cart_item['tbc_wc_event_end_date'] : '';
        
        $formatted_date = date('F j, Y', strtotime($event_date));
        
        if (!empty($event_end_date) && $event_end_date !== $event_date) {
            $formatted_end_date = date('F j, Y', strtotime($event_end_date));
            $formatted_date .= ' - ' . $formatted_end_date;
        }
        
        $item_data[] = [
            'key' => __('Event Date', 'tbc-wc-calendar'),
            'value' => $formatted_date,
            'display' => $formatted_date
        ];
    }
    
    return $item_data;
}

/**
 * Add event date to order items
 * 
 * @param WC_Order_Item_Product $item Order item
 * @param string $cart_item_key Cart item key
 * @param array $values Cart item values
 * @param WC_Order $order Order object
 */
function tbc_wc_add_event_date_to_order($item, $cart_item_key, $values, $order) {
    if (isset($values['tbc_wc_event_date'])) {
        $event_date = $values['tbc_wc_event_date'];
        $event_end_date = isset($values['tbc_wc_event_end_date']) ? $values['tbc_wc_event_end_date'] : '';
        
        $formatted_date = date_i18n(get_option('date_format'), strtotime($event_date));
        
        if (!empty($event_end_date) && $event_end_date !== $event_date) {
            $formatted_end_date = date_i18n(get_option('date_format'), strtotime($event_end_date));
            $formatted_date .= ' - ' . $formatted_end_date;
        }
        
        $item->add_meta_data(__('Event Date', 'tbc-wc-calendar'), $formatted_date);
        $item->add_meta_data('_tbc_wc_event_start_date', $event_date, true);
        
        if (!empty($event_end_date)) {
            $item->add_meta_data('_tbc_wc_event_end_date', $event_end_date, true);
        }
    }
}

/**
 * Display event date in order emails and admin
 * 
 * @param int $item_id Item ID
 * @param WC_Order_Item $item Order item
 * @param WC_Order $order Order object
 * @param bool $plain_text Whether plain text
 */
function tbc_wc_display_event_date_in_order_meta($item_id, $item, $order, $plain_text) {
    $event_date = $item->get_meta('Event Date');
    
    if ($event_date) {
        if ($plain_text) {
            echo "\n" . __('Event Date: ', 'tbc-wc-calendar') . $event_date;
        } else {
            echo '<p><strong>' . __('Event Date: ', 'tbc-wc-calendar') . '</strong>' . $event_date . '</p>';
        }
    }
}

/**
 * Display editable event date field in admin order edit screen
 * 
 * @param int $item_id Item ID
 * @param WC_Order_Item $item Order item
 * @param WC_Product $product Product object
 */
function tbc_wc_display_event_date_in_admin($item_id, $item, $product) {
    // Only show for line items (products), not shipping/fees
    if (!$item instanceof WC_Order_Item_Product) {
        return;
    }
    
    if (!tbc_wc_is_event_product($product)) {
        return;
    }

    $event_date = $item->get_meta('_tbc_wc_event_start_date', true);
    $event_end_date = $item->get_meta('_tbc_wc_event_end_date', true);
    
    // Match styling from TBC_PF_Event_Team_Members
    echo '<div class="tbc-wc-event-date-edit" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">';
    
    echo '<p><strong>' . __('Event Dates', 'tbc-wc-calendar') . ':</strong></p>';
    
    $start_field_id = 'tbc_wc_event_date_' . $item_id;
    $start_field_name = 'tbc_wc_event_date[' . $item_id . ']';
    
    echo '<label for="' . esc_attr($start_field_id) . '" style="display: block; margin-bottom: 3px;">' . __('Start Date:', 'tbc-wc-calendar') . '</label>';
    echo '<input type="text" class="date-picker" id="' . esc_attr($start_field_id) . '" name="' . esc_attr($start_field_name) . '" value="' . esc_attr($event_date) . '" placeholder="YYYY-MM-DD" style="width: 100%; margin-bottom: 10px;">';
    
    $end_field_id = 'tbc_wc_event_end_date_' . $item_id;
    $end_field_name = 'tbc_wc_event_end_date[' . $item_id . ']';
    
    echo '<label for="' . esc_attr($end_field_id) . '" style="display: block; margin-bottom: 3px;">' . __('End Date:', 'tbc-wc-calendar') . '</label>';
    echo '<input type="text" class="date-picker" id="' . esc_attr($end_field_id) . '" name="' . esc_attr($end_field_name) . '" value="' . esc_attr($event_end_date) . '" placeholder="YYYY-MM-DD" style="width: 100%;">';
    
    echo '</div>';
}

/**
 * Save edited event date when order is updated
 * 
 * @param int $order_id Order ID
 * @param WC_Order $order Order object
 */
function tbc_wc_save_edited_event_date($order_id, $order) {
    $updated_item_ids = [];
    
    if (isset($_POST['tbc_wc_event_date']) && is_array($_POST['tbc_wc_event_date'])) {
        foreach ($_POST['tbc_wc_event_date'] as $item_id => $date) {
            if (empty($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
                continue;
            }
            
            $sanitized_date = sanitize_text_field($date);
            wc_update_order_item_meta($item_id, '_tbc_wc_event_start_date', $sanitized_date);
            $updated_item_ids[$item_id] = true;
        }
    }
    
    if (isset($_POST['tbc_wc_event_end_date']) && is_array($_POST['tbc_wc_event_end_date'])) {
        foreach ($_POST['tbc_wc_event_end_date'] as $item_id => $date) {
            if (empty($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
                continue;
            }
            
            $sanitized_date = sanitize_text_field($date);
            wc_update_order_item_meta($item_id, '_tbc_wc_event_end_date', $sanitized_date);
            $updated_item_ids[$item_id] = true;
        }
    }
    
    if (!empty($updated_item_ids)) {
        foreach (array_keys($updated_item_ids) as $item_id) {
            $start_date = wc_get_order_item_meta($item_id, '_tbc_wc_event_start_date', true);
            $end_date = wc_get_order_item_meta($item_id, '_tbc_wc_event_end_date', true);
            
            if (!empty($start_date)) {
                $formatted_date = date_i18n(get_option('date_format'), strtotime($start_date));
                
                if (!empty($end_date) && $end_date !== $start_date) {
                    $formatted_end_date = date_i18n(get_option('date_format'), strtotime($end_date));
                    $formatted_date .= ' - ' . $formatted_end_date;
                }
                
                wc_update_order_item_meta($item_id, 'Event Date', $formatted_date);
            }
        }
    }
}

/**
 * =============================================================================
 * HOOK REGISTRATIONS
 * =============================================================================
 */

add_action('woocommerce_before_add_to_cart_button', 'tbc_wc_add_selected_date_to_cart');
add_filter('woocommerce_add_cart_item_data', 'tbc_wc_add_event_date_to_cart', 10, 3);
add_filter('woocommerce_get_item_data', 'tbc_wc_display_event_date_in_cart', 10, 2);
add_action('woocommerce_checkout_create_order_line_item', 'tbc_wc_add_event_date_to_order', 10, 4);
add_action('woocommerce_after_order_itemmeta', 'tbc_wc_display_event_date_in_admin', 5, 3);
add_action('woocommerce_saved_order_items', 'tbc_wc_save_edited_event_date', 10, 2);