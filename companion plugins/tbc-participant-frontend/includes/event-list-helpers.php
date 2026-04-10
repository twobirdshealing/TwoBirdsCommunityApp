<?php
/**
 * Event List Helpers
 * 
 * Business logic for event list sorting and validation.
 * 
 * @package TBC_Participant_Frontend
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Sort events by date
 * 
 * @param array $events Event data array
 * @param string $status_type 'current' or 'past'
 * @return array Sorted events
 */
function tbc_pf_sort_events($events, $status_type) {
    usort($events, function($a, $b) use ($status_type) {
        if ($status_type === 'current') {
            return strcmp($a['date'], $b['date']);
        }
        return strcmp($b['date'], $a['date']);
    });
    
    return $events;
}

// ============================================================================
// UNIFIED ALERT SYSTEM
// ============================================================================

/**
 * Get unified alert summary for an event
 * 
 * Returns counts of all alert types for display on event list and detail pages.
 * 
 * @param int $product_id Product ID
 * @param string $event_date Event date in Y-m-d format
 * @return array ['medical_count' => int, 'team_count' => int]
 */
function tbc_pf_get_event_alert_summary($product_id, $event_date) {
    $medical_count = tbc_pf_count_overdue_followups($product_id, $event_date);
    $team_count = tbc_pf_count_team_issues($product_id, $event_date);
    
    return [
        'medical_count' => $medical_count,
        'team_count' => $team_count
    ];
}

/**
 * Count participants with overdue medical follow-ups
 * 
 * @param int $product_id Product ID
 * @param string $event_date Event date in Y-m-d format
 * @return int Count of participants with overdue follow-ups
 */
function tbc_pf_count_overdue_followups($product_id, $event_date) {
    global $wpdb;
    
    if (empty($event_date)) {
        return 0;
    }
    
    $query = "
        SELECT order_items.order_id
        FROM {$wpdb->prefix}woocommerce_order_items as order_items
        JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_product
            ON order_items.order_item_id = meta_product.order_item_id
        JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_date
            ON order_items.order_item_id = meta_date.order_item_id
        WHERE meta_product.meta_key = '_product_id'
        AND meta_product.meta_value = %d
        AND meta_date.meta_key = '_tbc_wc_event_start_date'
        AND meta_date.meta_value = %s
    ";
    
    $order_ids = $wpdb->get_col($wpdb->prepare($query, $product_id, $event_date));
    
    if (empty($order_ids)) {
        return 0;
    }
    
    $current_time = time();
    $overdue_count = 0;
    
    foreach ($order_ids as $order_id) {
        $order = wc_get_order($order_id);
        if (!$order) {
            continue;
        }
        
        $user_id = $order->get_user_id();
        if (!$user_id) {
            continue;
        }
        
        $search_criteria = [
            'field_filters' => [
                ['key' => 'created_by', 'value' => $user_id]
            ]
        ];
        $entries = GFAPI::get_entries(1, $search_criteria);
        
        if (empty($entries)) {
            continue;
        }
        
        $entry = $entries[0];
        
        if (empty($entry[18])) {
            continue;
        }
        
        $followups_json = isset($entry[56]) ? $entry[56] : '';
        if (empty($followups_json)) {
            continue;
        }
        
        $followups = json_decode($followups_json, true);
        if (!is_array($followups)) {
            continue;
        }
        
        foreach ($followups as $followup) {
            if ($followup['status'] !== 'pending') {
                continue;
            }
            
            $followup_time = strtotime($followup['followup_date']);
            if ($followup_time && $followup_time <= $current_time) {
                $overdue_count++;
                break;
            }
        }
    }
    
    return $overdue_count;
}

/**
 * Count orders with team setting issues
 * 
 * @param int $product_id Product ID
 * @param string $event_date Event date in Y-m-d format
 * @return int Count of orders with team issues
 */
function tbc_pf_count_team_issues($product_id, $event_date) {
    $results = tbc_pf_calculate_income_and_donors($product_id, $event_date);
    $order_ids = $results['order_ids'] ?? [];
    
    if (empty($order_ids)) {
        return 0;
    }
    
    $current_group_id = tbc_pf_tm_get_common_group_id($order_ids, $product_id, $event_date);
    $current_facilitators = (array)(TBC_PF_Event_Team_Members::get_instance()->get_common_facilitators($order_ids, $product_id, $event_date) ?? []);
    
    $issue_count = 0;
    
    foreach ($order_ids as $order_id) {
        $order = wc_get_order($order_id);
        if (!$order) {
            continue;
        }
        
        $order_data = [
            'facilitators' => tbc_pf_tm_get_line_item_meta($order, $product_id, $event_date, '_tbc_pf_event_facilitators'),
            'group' => tbc_pf_tm_get_line_item_meta($order, $product_id, $event_date, '_tbc_pf_event_group')
        ];
        
        $issues = tbc_pf_tm_get_order_issues($order_data, $current_facilitators, $current_group_id);
        
        if (!empty($issues)) {
            $issue_count++;
        }
    }
    
    return $issue_count;
}

/**
 * Check if event has overdue medical follow-ups (boolean version)
 * 
 * @param int $product_id Product ID
 * @param string $event_date Event date (Y-m-d)
 * @return bool True if overdue follow-ups exist
 */
function tbc_pf_check_event_for_overdue_followups($product_id, $event_date) {
    global $wpdb;
    
    if (empty($event_date)) {
        return false;
    }
    
    $query = "
        SELECT order_items.order_id
        FROM {$wpdb->prefix}woocommerce_order_items as order_items
        JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_product
            ON order_items.order_item_id = meta_product.order_item_id
        JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_date
            ON order_items.order_item_id = meta_date.order_item_id
        WHERE meta_product.meta_key = '_product_id'
        AND meta_product.meta_value = %d
        AND meta_date.meta_key = '_tbc_wc_event_start_date'
        AND meta_date.meta_value = %s
    ";
    
    $order_ids = $wpdb->get_col($wpdb->prepare($query, $product_id, $event_date));
    
    if (empty($order_ids)) {
        return false;
    }
    
    $current_time = time();
    
    foreach ($order_ids as $order_id) {
        $order = wc_get_order($order_id);
        if (!$order) {
            continue;
        }
        
        $user_id = $order->get_user_id();
        if (!$user_id) {
            continue;
        }
        
        $search_criteria = [
            'field_filters' => [
                ['key' => 'created_by', 'value' => $user_id]
            ]
        ];
        $entries = GFAPI::get_entries(1, $search_criteria);
        
        if (empty($entries)) {
            continue;
        }
        
        $entry = $entries[0];
        
        if (empty($entry[18])) {
            continue;
        }
        
        $followups_json = isset($entry[56]) ? $entry[56] : '';
        if (empty($followups_json)) {
            continue;
        }
        
        $followups = json_decode($followups_json, true);
        if (!is_array($followups)) {
            continue;
        }
        
        foreach ($followups as $followup) {
            if ($followup['status'] !== 'pending') {
                continue;
            }
            
            $followup_time = strtotime($followup['followup_date']);
            if ($followup_time && $followup_time <= $current_time) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * AJAX: Get products by status
 */
function tbc_pf_ajax_get_products_by_status() {
    $status = isset($_POST['status']) ? sanitize_text_field($_POST['status']) : 'current';
    $base_url = isset($_POST['base_url']) ? esc_url_raw($_POST['base_url']) : get_home_url();

    $event_list = new TBC_PF_Event_List_Display();

    if ($status === 'settings') {
        if (!current_user_can('manage_options')) {
            echo '<p>You do not have permission to view settings.</p>';
            wp_die();
        }
        echo $event_list->get_settings_html();
        wp_die();
    }

    echo $event_list->get_product_list_html($status, $base_url);
    wp_die();
}
add_action('wp_ajax_tbc_pf_get_products_by_status', 'tbc_pf_ajax_get_products_by_status');
add_action('wp_ajax_nopriv_tbc_pf_get_products_by_status', 'tbc_pf_ajax_get_products_by_status');

/**
 * Get the saved event category term IDs (multi-select).
 *
 * @return int[]
 */
function tbc_pf_get_event_category_ids() {
    $raw = get_option('tbc_pf_event_category_ids', []);
    if (!is_array($raw)) {
        return [];
    }
    return array_values(array_filter(array_map('intval', $raw)));
}

/**
 * Get all WooCommerce product IDs belonging to any of the given product_cat term IDs.
 *
 * @param int[] $category_ids
 * @return int[]
 */
function tbc_pf_get_product_ids_by_categories($category_ids) {
    if (empty($category_ids)) {
        return [];
    }

    $query = new WP_Query([
        'post_type'      => 'product',
        'post_status'    => 'publish',
        'posts_per_page' => -1,
        'fields'         => 'ids',
        'no_found_rows'  => true,
        'tax_query'      => [
            [
                'taxonomy' => 'product_cat',
                'field'    => 'term_id',
                'terms'    => array_map('intval', $category_ids),
                'operator' => 'IN',
            ],
        ],
    ]);

    return array_map('intval', $query->posts);
}

/**
 * AJAX: Save event category selection (admin only).
 */
function tbc_pf_ajax_save_event_settings() {
    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => 'Permission denied.'], 403);
    }

    check_ajax_referer('tbc_pf_event_settings', 'nonce');

    $raw = isset($_POST['category_ids']) ? (array) $_POST['category_ids'] : [];
    $ids = array_values(array_unique(array_filter(array_map('intval', $raw))));

    update_option('tbc_pf_event_category_ids', $ids, false);

    wp_send_json_success([
        'message' => 'Settings saved.',
        'category_ids' => $ids,
    ]);
}
add_action('wp_ajax_tbc_pf_save_event_settings', 'tbc_pf_ajax_save_event_settings');