<?php
/**
 * Team Management Helpers
 * 
 * Business logic for facilitator and chat group management.
 * Meta is stored on LINE ITEMS (not orders) to support multiple events per order.
 * 
 * @package TBC_Participant_Frontend
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Check if Fluent Community Spaces is available
 * Delegates to centralized check in add-group.php
 */
function tbc_pf_tm_is_groups_active() {
    return tbc_pf_is_groups_active();
}

/**
 * Get all available Fluent Community spaces
 * Delegates to centralized function in add-group.php
 */
function tbc_pf_tm_get_available_groups() {
    return tbc_pf_get_available_groups();
}

/**
 * Get line item from order matching product_id and event_date
 * 
 * @param WC_Order $order Order object
 * @param int $product_id Product ID
 * @param string $event_date Event date (Y-m-d)
 * @return WC_Order_Item_Product|null Line item or null if not found
 */
function tbc_pf_tm_get_line_item($order, $product_id, $event_date) {
    foreach ($order->get_items() as $item) {
        if ($item->get_product_id() == $product_id) {
            $item_date = $item->get_meta('_tbc_wc_event_start_date', true);
            if ($item_date === $event_date) {
                return $item;
            }
        }
    }
    return null;
}

/**
 * Get line item meta (group or facilitators)
 * 
 * @param WC_Order $order Order object
 * @param int $product_id Product ID
 * @param string $event_date Event date (Y-m-d)
 * @param string $meta_key Meta key to retrieve
 * @return mixed Meta value or empty string
 */
function tbc_pf_tm_get_line_item_meta($order, $product_id, $event_date, $meta_key) {
    $item = tbc_pf_tm_get_line_item($order, $product_id, $event_date);
    if (!$item) {
        return '';
    }
    return $item->get_meta($meta_key, true);
}

/**
 * Set line item meta (group or facilitators)
 * 
 * @param WC_Order $order Order object
 * @param int $product_id Product ID
 * @param string $event_date Event date (Y-m-d)
 * @param string $meta_key Meta key to set
 * @param mixed $meta_value Value to store
 * @return bool True if updated, false if line item not found
 */
function tbc_pf_tm_set_line_item_meta($order, $product_id, $event_date, $meta_key, $meta_value) {
    $item = tbc_pf_tm_get_line_item($order, $product_id, $event_date);
    if (!$item) {
        return false;
    }
    $item->update_meta_data($meta_key, $meta_value);
    $item->save();
    return true;
}

/**
 * Find most common group ID among order line items for a specific event
 * 
 * @param array $order_ids Array of order IDs
 * @param int $product_id Product ID
 * @param string $event_date Event date (Y-m-d)
 * @return string Group ID or empty string
 */
function tbc_pf_tm_get_common_group_id($order_ids, $product_id = 0, $event_date = '') {
    if (empty($order_ids)) {
        return '';
    }
    
    $groups = [];
    foreach ($order_ids as $order_id) {
        $order = wc_get_order($order_id);
        if (!$order) {
            continue;
        }
        
        // Get group from line item if product_id and event_date provided
        if ($product_id && $event_date) {
            $group_id = tbc_pf_tm_get_line_item_meta($order, $product_id, $event_date, '_tbc_pf_event_group');
        } else {
            // Fallback: get from first line item with group set
            $group_id = '';
            foreach ($order->get_items() as $item) {
                $item_group = $item->get_meta('_tbc_pf_event_group', true);
                if (!empty($item_group)) {
                    $group_id = $item_group;
                    break;
                }
            }
        }
        
        if (!empty($group_id) && is_scalar($group_id)) {
            $groups[$group_id] = ($groups[$group_id] ?? 0) + 1;
        }
    }
    
    if (empty($groups)) {
        return '';
    }
    
    arsort($groups);
    return key($groups);
}

/**
 * Detect mismatches between order settings and common values
 */
function tbc_pf_tm_get_order_issues($order_data, $current_facilitators, $current_group_id) {
    if (empty($current_facilitators) && empty($current_group_id)) {
        return [];
    }
    
    $issues = [];
    
    $order_facilitators = is_array($order_data['facilitators']) 
        ? $order_data['facilitators'] 
        : ($order_data['facilitators'] ? [$order_data['facilitators']] : []);
    
    if (!empty($current_facilitators) && empty($order_facilitators)) {
        $issues[] = 'Missing facilitators';
    } elseif (!empty($current_facilitators) && !empty($order_facilitators)) {
        $curr_sorted = array_map('strval', $current_facilitators);
        $ord_sorted = array_map('strval', $order_facilitators);
        
        sort($curr_sorted);
        sort($ord_sorted);
        
        if ($curr_sorted !== $ord_sorted) {
            $issues[] = 'Facilitators mismatch';
        }
    }
    
    if (!empty($current_group_id) && empty($order_data['group'])) {
        $issues[] = 'Missing chat group';
    } elseif (!empty($current_group_id) && !empty($order_data['group']) && $current_group_id != $order_data['group']) {
        $issues[] = 'Chat group mismatch';
    }
    
    return $issues;
}

/**
 * Format team member IDs to readable names
 */
function tbc_pf_tm_format_team_members($members) {
    if (empty($members)) {
        return 'None';
    }
    
    $members = (array) $members;
    $names = array_map('tbc_pf_get_user_name_by_id', $members);
    
    return implode(', ', $names);
}

/**
 * AJAX: Update event team settings for selected orders
 * 
 * Updates line item meta (not order meta) to support multiple events per order.
 */
function tbc_pf_ajax_update_event_team_settings() {
    if (!isset($_POST['product_id'], $_POST['event_date'])) {
        wp_send_json_error(['message' => 'Missing required parameters']);
    }
    
    $product_id = intval($_POST['product_id']);
    $event_date = sanitize_text_field($_POST['event_date']);
    $group_id = !empty($_POST['group_id']) ? sanitize_text_field($_POST['group_id']) : '';
    $facilitator_ids = isset($_POST['facilitator_ids']) ? array_map('intval', (array) $_POST['facilitator_ids']) : [];
    
    if (empty($_POST['order_ids'])) {
        wp_send_json_error(['message' => 'No orders selected']);
    }
    
    $order_ids = array_map('intval', (array) $_POST['order_ids']);
    $updated_count = 0;
    
    foreach ($order_ids as $order_id) {
        $order = wc_get_order($order_id);
        if (!$order) {
            continue;
        }
        
        // Update line item meta instead of order meta
        $group_updated = tbc_pf_tm_set_line_item_meta($order, $product_id, $event_date, '_tbc_pf_event_group', $group_id);
        $facilitators_updated = tbc_pf_tm_set_line_item_meta($order, $product_id, $event_date, '_tbc_pf_event_facilitators', $facilitator_ids);
        
        if ($group_updated || $facilitators_updated) {
            $updated_count++;
        }
    }
    
    $plural = $updated_count !== 1 ? 's' : '';
    wp_send_json_success([
        'message' => "Updated {$updated_count} order{$plural}",
        'updated_count' => $updated_count
    ]);
}
add_action('wp_ajax_tbc_pf_update_event_team_settings', 'tbc_pf_ajax_update_event_team_settings');