<?php
/**
 * Fluent Community Space Management
 *
 * Space is stored on LINE ITEMS (not orders) to support multiple events per order.
 * Migrated from BuddyBoss Groups in v4.0.0.
 *
 * @package TBC_Participant_Frontend
 * @since 4.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

use FluentCommunity\App\Models\Space;
use FluentCommunity\App\Models\BaseSpace;
use FluentCommunity\App\Services\Helper as FCHelper;

/**
 * Check if Fluent Community Spaces is available
 */
function tbc_pf_is_groups_active() {
    return tbc_pf_is_fluent_active()
        && class_exists('FluentCommunity\App\Models\Space');
}

/**
 * Get available Fluent Community spaces for dropdown
 */
function tbc_pf_get_available_groups() {
    if (!tbc_pf_is_groups_active()) {
        return [];
    }

    $spaces = Space::orderBy('title', 'ASC')->get();

    $options = [];
    foreach ($spaces as $space) {
        $suffix = $space->privacy === 'secret' ? ' (Secret)' : ($space->privacy === 'private' ? ' (Private)' : '');
        $options[$space->id] = $space->title . $suffix;
    }

    return $options;
}

/**
 * Display space selector for each line item in admin
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
    echo '<p><strong>' . esc_html__('Event Chat Space', 'tbc-participant-frontend') . ':</strong></p>';
    echo '<select name="' . esc_attr($field_name) . '" class="wc-enhanced-select" style="width:100%;">';
    echo '<option value="">' . esc_html__('Select a space...', 'tbc-participant-frontend') . '</option>';

    foreach ($groups as $id => $name) {
        $selected = ($event_group == $id) ? ' selected' : '';
        echo '<option value="' . esc_attr($id) . '"' . $selected . '>' . esc_html($name) . '</option>';
    }

    echo '</select>';
    echo '</div>';
}
add_action('woocommerce_after_order_itemmeta', 'tbc_pf_display_line_item_group', 10, 3);

/**
 * Save space selection to line item meta
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
 * AJAX: Join or leave a Fluent Community space
 */
function tbc_pf_ajax_join_or_leave_group() {
    if (!isset($_POST['user_id'], $_POST['group_id'], $_POST['action'])) {
        wp_send_json_error('Missing required parameters');
    }

    $user_id = intval($_POST['user_id']);
    $space_id = intval($_POST['group_id']);
    $action = $_POST['action'];

    if ($action === 'tbc_pf_join_group') {
        if (FCHelper::addToSpace($space_id, $user_id, 'member', 'by_admin')) {
            wp_send_json_success('User joined the space');
        } else {
            wp_send_json_error('Failed to join the space');
        }
    } elseif ($action === 'tbc_pf_leave_group') {
        if (FCHelper::removeFromSpace($space_id, $user_id, 'by_admin')) {
            wp_send_json_success('User removed from the space');
        } else {
            wp_send_json_error('Failed to remove user from the space');
        }
    } else {
        wp_send_json_error('Invalid action');
    }
}
add_action('wp_ajax_tbc_pf_join_group', 'tbc_pf_ajax_join_or_leave_group');
add_action('wp_ajax_tbc_pf_leave_group', 'tbc_pf_ajax_join_or_leave_group');

/**
 * AJAX: Auto-generate a new chat space for an event
 */
function tbc_pf_ajax_auto_generate_chat_group() {
    if (!tbc_pf_is_groups_active()) {
        wp_send_json_error(['message' => 'Fluent Community Spaces not available']);
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
    $space_name = sanitize_text_field($product_name . ' | ' . $formatted_date);
    $space_description = sanitize_textarea_field('Chat space for participants of our ' . $product_name . ' | ' . $formatted_date);
    $image_id = $product->get_image_id();
    $featured_url = $image_id ? wp_get_attachment_url($image_id) : false;

    $fill_data = [
        'created_by'  => get_current_user_id(),
        'title'       => $space_name,
        'slug'        => sanitize_title(preg_replace('/[\x{10000}-\x{10FFFF}]/u', '', $space_name)),
        'description' => $space_description,
        'privacy'     => 'secret',
        'status'      => 'published',
        'type'        => 'community',
        'parent_id'   => TBC_PF_CEREMONY_SPACE_PARENT,
        'settings'    => serialize(['ceremony_chat' => true]),
    ];

    if ($featured_url) {
        $fill_data['logo'] = $featured_url;
        $fill_data['cover_photo'] = $featured_url;
    }

    $space = new Space();
    $space->fill($fill_data);
    $space->save();

    if (!$space->id) {
        wp_send_json_error(['message' => 'Failed to create chat space']);
    }

    // Add creator as admin (matches native Fluent behavior)
    FCHelper::addToSpace($space->id, get_current_user_id(), 'admin', 'by_admin');

    // Fire creation hook so other plugins are notified
    do_action('fluent_community/space/created', $space, $fill_data);

    // Add default moderators
    $default_moderators = [168, 2606];
    foreach ($default_moderators as $mod_user_id) {
        FCHelper::addToSpace($space, $mod_user_id, 'moderator', 'by_admin');
    }

    // Auto-assign space to all line items for this event
    $metrics = tbc_pf_calculate_income_and_donors($product_id, $event_date);
    foreach ($metrics['order_ids'] as $order_id) {
        $order = wc_get_order($order_id);
        if ($order) {
            tbc_pf_tm_set_line_item_meta($order, $product_id, $event_date, '_tbc_pf_event_group', $space->id);
        }
    }

    // Schedule event posts
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

    tbc_pf_schedule_event_posts_dynamic($space->id, $product_id, $event_date, $event_end_date);

    wp_send_json_success([
        'message' => 'Chat space created successfully',
        'group_id' => $space->id,
        'group_name' => $space_name
    ]);
}
add_action('wp_ajax_tbc_pf_auto_generate_chat_group', 'tbc_pf_ajax_auto_generate_chat_group');
