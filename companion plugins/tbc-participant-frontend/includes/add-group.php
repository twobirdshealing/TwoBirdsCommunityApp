<?php
/**
 * BuddyBoss Group Management
 * 
 * Group is stored on LINE ITEMS (not orders) to support multiple events per order.
 * 
 * @package TBC_Participant_Frontend
 * @since 3.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Check if BuddyBoss groups is available
 */
function tbc_pf_is_groups_active() {
    return function_exists('groups_get_groups') 
        && function_exists('bp_is_active') 
        && bp_is_active('groups');
}

/**
 * Get available BuddyBoss groups for dropdown
 */
function tbc_pf_get_available_groups() {
    if (!tbc_pf_is_groups_active()) {
        return [];
    }

    $groups = groups_get_groups([
        'per_page' => -1,
        'orderby' => 'name',
        'order' => 'ASC',
        'show_hidden' => true,
        'update_meta_cache' => false,
        'fields' => 'all'
    ]);

    $options = [];
    if (!empty($groups['groups'])) {
        foreach ($groups['groups'] as $group) {
            $suffix = $group->status === 'hidden' ? ' (Hidden)' : '';
            $options[$group->id] = $group->name . $suffix;
        }
    }
    
    return $options;
}

/**
 * Display group selector for each line item in admin
 */
function tbc_pf_display_line_item_group($item_id, $item, $product) {
    if (!tbc_pf_is_groups_active()) {
        return;
    }
    
    // Only show for line items (products), not shipping/fees
    if (!$item instanceof WC_Order_Item_Product) {
        return;
    }
    
    // Only show for event products (those with event date)
    $event_date = $item->get_meta('_tbc_wc_event_start_date', true);
    if (empty($event_date)) {
        return;
    }

    $event_group = $item->get_meta('_tbc_pf_event_group', true);
    $groups = tbc_pf_get_available_groups();
    $field_name = 'tbc_pf_event_group_' . $item_id;

    echo '<div class="tbc-pf-line-item-group" style="margin-top: 10px;">';
    echo '<p><strong>' . esc_html__('Event Chat Group', 'tbc-participant-frontend') . ':</strong></p>';
    echo '<select name="' . esc_attr($field_name) . '" class="wc-enhanced-select" style="width:100%;">';
    echo '<option value="">' . esc_html__('Select a group...', 'tbc-participant-frontend') . '</option>';
    
    foreach ($groups as $id => $name) {
        $selected = ($event_group == $id) ? ' selected' : '';
        echo '<option value="' . esc_attr($id) . '"' . $selected . '>' . esc_html($name) . '</option>';
    }
    
    echo '</select>';
    echo '</div>';
}
add_action('woocommerce_after_order_itemmeta', 'tbc_pf_display_line_item_group', 10, 3);

/**
 * Save group selection to line item meta
 * 
 * @param int $order_id Order ID
 * @param array $items Items array (passed by woocommerce_saved_order_items)
 */
function tbc_pf_save_line_item_group($order_id, $items = []) {
    $order = wc_get_order($order_id);
    if (!$order) {
        return;
    }
    
    foreach ($order->get_items() as $item_id => $item) {
        $field_name = 'tbc_pf_event_group_' . $item_id;
        
        if (!isset($_POST[$field_name])) {
            continue;
        }
        
        $group_id = intval($_POST[$field_name]);
        
        if ($group_id > 0) {
            $item->update_meta_data('_tbc_pf_event_group', $group_id);
        } else {
            $item->delete_meta_data('_tbc_pf_event_group');
        }
        
        $item->save();
    }
}
add_action('woocommerce_saved_order_items', 'tbc_pf_save_line_item_group', 10, 2);

/**
 * AJAX: Join or leave a BuddyBoss group
 */
function tbc_pf_ajax_join_or_leave_group() {
    if (!isset($_POST['user_id'], $_POST['group_id'], $_POST['action'])) {
        wp_send_json_error('Missing required parameters');
    }

    $user_id = intval($_POST['user_id']);
    $group_id = intval($_POST['group_id']);
    $action = $_POST['action'];

    if ($action === 'tbc_pf_join_group') {
        if (groups_join_group($group_id, $user_id)) {
            wp_send_json_success('User joined the group');
        } else {
            wp_send_json_error('Failed to join the group');
        }
    } elseif ($action === 'tbc_pf_leave_group') {
        if (groups_remove_member($user_id, $group_id)) {
            wp_send_json_success('User removed from the group');
        } else {
            wp_send_json_error('Failed to remove user from the group');
        }
    } else {
        wp_send_json_error('Invalid action');
    }
}
add_action('wp_ajax_tbc_pf_join_group', 'tbc_pf_ajax_join_or_leave_group');
add_action('wp_ajax_tbc_pf_leave_group', 'tbc_pf_ajax_join_or_leave_group');

/**
 * AJAX: Auto-generate a new chat group for an event
 */
function tbc_pf_ajax_auto_generate_chat_group() {
    if (!function_exists('groups_create_group')) {
        wp_send_json_error(['message' => 'BuddyBoss Groups not available']);
    }

    if (!isset($_POST['product_id'], $_POST['event_date'])) {
        wp_send_json_error(['message' => 'Missing required parameters']);
    }

    $product_id = intval($_POST['product_id']);
    $event_date = sanitize_text_field($_POST['event_date']);

    $product = wc_get_product($product_id);
    if (!$product) {
        wp_send_json_error(['message' => 'Product not found']);
    }

    $product_name = $product->get_name();
    $formatted_date = date('F jS Y', strtotime($event_date));
    $group_name = $product_name . ' | ' . $formatted_date;
    $group_description = 'Chat group for participants of our ' . $product_name . ' | ' . $formatted_date;

    $group_id = groups_create_group([
        'creator_id'    => get_current_user_id(),
        'name'          => $group_name,
        'description'   => $group_description,
        'slug'          => sanitize_title($group_name),
        'status'        => 'hidden',
        'enable_forum'  => false,
        'date_created'  => bp_core_current_time()
    ]);

    if (!$group_id) {
        wp_send_json_error(['message' => 'Failed to create chat group']);
    }

    groups_update_groupmeta($group_id, 'invite_status', 'admins');
    bp_groups_set_group_type($group_id, 'ceremony-chat');
    
    $default_moderators = [168, 2606];
    foreach ($default_moderators as $user_id) {
        groups_join_group($group_id, $user_id);
        groups_promote_member($user_id, $group_id, 'mod');
    }
    
    groups_update_groupmeta($group_id, 'sms_permission', 'organizers');
    groups_update_groupmeta($group_id, 'call_permission', 'off');

    $event_end_date = $event_date;
    if (function_exists('tbc_wc_get_events')) {
        $events = tbc_wc_get_events($product_id, [
            'start_date' => $event_date,
            'end_date' => $event_date,
            'limit' => 1
        ]);
        if (!empty($events)) {
            $event_end_date = $events[0]['end'] ?? $event_date;
        }
    }
    
    tbc_pf_schedule_event_posts_dynamic($group_id, $product_id, $event_date, $event_end_date);

    wp_send_json_success([
        'message' => 'Chat group created successfully',
        'group_id' => $group_id,
        'group_name' => $group_name
    ]);
}
add_action('wp_ajax_tbc_pf_auto_generate_chat_group', 'tbc_pf_ajax_auto_generate_chat_group');