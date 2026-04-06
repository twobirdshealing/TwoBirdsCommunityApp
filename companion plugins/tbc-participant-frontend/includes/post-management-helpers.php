<?php
/**
 * Post Management Helpers
 * 
 * Business logic for scheduled post display and actions.
 * 
 * @package TBC_Participant_Frontend
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Calculate scheduled timestamp based on timing and event date
 * 
 * @param string $timing Schedule timing option
 * @param string $event_date Event start date (Y-m-d)
 * @param string $event_end_date Event end date (Y-m-d)
 * @return int|null|false Timestamp, null for immediate, false if passed
 */
function tbc_pf_pm_calculate_schedule_time($timing, $event_date, $event_end_date = '') {
    $timezone = new DateTimeZone(wp_timezone_string());
    $current_time = new DateTime('now', $timezone);
    $event_start = new DateTime($event_date . ' 09:00:00', $timezone);
    
    if (empty($event_end_date)) {
        $event_end_date = $event_date;
    }
    $event_end = new DateTime($event_end_date . ' 09:00:00', $timezone);
    
    $before_timings = [
        '2weeks_before' => '-2 weeks',
        '1week_before' => '-1 week',
        '2days_before' => '-2 days',
        'day_of_event' => null
    ];
    
    $after_timings = [
        '1day_after' => '+1 day',
        '3days_after' => '+3 days',
        '1week_after' => '+1 week',
        '2weeks_after' => '+2 weeks',
        '1month_after' => '+1 month',
        '2months_after' => '+2 months',
        '3months_after' => '+3 months',
        '4months_after' => '+4 months',
        '1year_after' => '+1 year'
    ];
    
    if ($timing === 'immediate') {
        return null;
    }
    
    if ($timing === 'day_of_event') {
        return $event_start > $current_time ? $event_start->getTimestamp() : false;
    }
    
    if (isset($before_timings[$timing])) {
        $scheduled = clone $event_start;
        $scheduled->modify($before_timings[$timing]);
        return $scheduled > $current_time ? $scheduled->getTimestamp() : false;
    }
    
    if (isset($after_timings[$timing])) {
        $scheduled = clone $event_end;
        $scheduled->modify($after_timings[$timing]);
        return $scheduled > $current_time ? $scheduled->getTimestamp() : false;
    }
    
    return null;
}

/**
 * Check if post timing is still valid for scheduling
 */
function tbc_pf_pm_can_schedule_post($post_type_id, $event_date, $event_end_date = '') {
    $template = tbc_pf_ps_get_post_type($post_type_id);
    if (!$template) {
        return false;
    }
    
    $timestamp = tbc_pf_pm_calculate_schedule_time($template['schedule_timing'], $event_date, $event_end_date);
    
    return $timestamp !== false;
}

/**
 * Get scheduled posts for an event
 */
function tbc_pf_pm_get_scheduled_posts($product_id, $event_date, $group_id = 0) {
    if (!class_exists('ActionScheduler_Store') || empty($group_id)) {
        return [];
    }
    
    $as_group = 'tbc_pf_event_' . $product_id . '_' . $event_date . '_group_' . $group_id;
    $store = ActionScheduler_Store::instance();
    $templates = tbc_pf_ps_get_all_post_types();
    
    $posts = [];
    $found_template_ids = [];
    $statuses = ['pending', 'complete', 'failed', 'canceled'];
    
    foreach ($statuses as $status) {
        $action_ids = $store->query_actions([
            'group' => $as_group,
            'status' => $status,
            'per_page' => 50
        ]);
        
        foreach ($action_ids as $action_id) {
            $action = $store->fetch_action($action_id);
            if (!$action) {
                continue;
            }
            
            $args = $action->get_args();
            $post_type_id = $args['post_type_id'] ?? null;
            
            if (!$post_type_id) {
                continue;
            }
            
            $found_template_ids[] = $post_type_id;
            
            $template = null;
            foreach ($templates as $t) {
                if ($t['id'] == $post_type_id) {
                    $template = $t;
                    break;
                }
            }
            
            if (!$template) {
                continue;
            }
            
            $scheduled_date = null;
            $was_async = false;
            
            try {
                $schedule = $action->get_schedule();
                if ($schedule) {
                    $scheduled_date = $schedule->get_date();
                }
            } catch (Exception $e) {
                // No schedule
            }
            
            if (!$scheduled_date) {
                $was_async = true;
                $scheduled_date = new DateTime('now', new DateTimeZone('UTC'));
            }
            
            $posts[] = [
                'action_id' => $action_id,
                'post_type_id' => $post_type_id,
                'post_name' => $template['title'],
                'scheduled_date' => $scheduled_date,
                'status' => $status,
                'was_async' => $was_async
            ];
        }
    }
    
    foreach ($templates as $template) {
        if (!in_array($template['id'], $found_template_ids)) {
            $posts[] = [
                'action_id' => null,
                'post_type_id' => $template['id'],
                'post_name' => $template['title'],
                'scheduled_date' => new DateTime('now', new DateTimeZone('UTC')),
                'status' => 'missing',
                'was_async' => false
            ];
        }
    }
    
    usort($posts, function($a, $b) {
        return $a['scheduled_date']->getTimestamp() - $b['scheduled_date']->getTimestamp();
    });
    
    return $posts;
}

/**
 * AJAX: Delete scheduled post
 */
function tbc_pf_ajax_delete_scheduled_post() {
    if (!isset($_POST['action_id'])) {
        wp_send_json_error(['message' => 'Missing action ID']);
    }
    
    if (!class_exists('ActionScheduler')) {
        wp_send_json_error(['message' => 'Action Scheduler not available']);
    }
    
    $action_id = intval($_POST['action_id']);
    $store = ActionScheduler::store();
    $action = $store->fetch_action($action_id);
    
    if (!$action) {
        wp_send_json_error(['message' => 'Action not found']);
    }
    
    $store->delete_action($action_id);
    wp_send_json_success(['message' => 'Post deleted']);
}
add_action('wp_ajax_tbc_pf_delete_scheduled_post', 'tbc_pf_ajax_delete_scheduled_post');

/**
 * AJAX: Reschedule single missing post
 */
function tbc_pf_ajax_reschedule_single_post() {
    if (!isset($_POST['post_type_id'], $_POST['group_id'], $_POST['product_id'], $_POST['event_date'])) {
        wp_send_json_error(['message' => 'Missing required parameters']);
    }
    
    $post_type_id = intval($_POST['post_type_id']);
    $group_id = intval($_POST['group_id']);
    $product_id = intval($_POST['product_id']);
    $event_date = sanitize_text_field($_POST['event_date']);
    
    if (!function_exists('as_enqueue_async_action') || !function_exists('as_schedule_single_action')) {
        wp_send_json_error(['message' => 'Action Scheduler not available']);
    }
    
    $template = tbc_pf_ps_get_post_type($post_type_id);
    if (!$template) {
        wp_send_json_error(['message' => 'Template not found']);
    }
    
    global $wpdb;
    $query = "
        SELECT meta_end.meta_value as event_end_date
        FROM {$wpdb->prefix}woocommerce_order_items as order_items
        JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_product
            ON order_items.order_item_id = meta_product.order_item_id
        JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_date
            ON order_items.order_item_id = meta_date.order_item_id
        LEFT JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_end
            ON order_items.order_item_id = meta_end.order_item_id
            AND meta_end.meta_key = '_tbc_wc_event_end_date'
        WHERE meta_product.meta_key = '_product_id'
        AND meta_product.meta_value = %d
        AND meta_date.meta_key = '_tbc_wc_event_start_date'
        AND meta_date.meta_value = %s
        LIMIT 1
    ";
    
    $event_end_date = $wpdb->get_var($wpdb->prepare($query, $product_id, $event_date));
    if (empty($event_end_date)) {
        $event_end_date = $event_date;
    }
    
    $as_group = 'tbc_pf_event_' . $product_id . '_' . $event_date . '_group_' . $group_id;
    $timestamp = tbc_pf_pm_calculate_schedule_time($template['schedule_timing'], $event_date, $event_end_date);
    
    if ($timestamp === false) {
        wp_send_json_error(['message' => 'Timing window has passed']);
    }
    
    if ($timestamp === null) {
        as_enqueue_async_action(
            'tbc_pf_send_dynamic_post',
            ['post_type_id' => $post_type_id, 'group_id' => $group_id],
            $as_group
        );
    } else {
        as_schedule_single_action(
            $timestamp,
            'tbc_pf_send_dynamic_post',
            ['post_type_id' => $post_type_id, 'group_id' => $group_id],
            $as_group
        );
    }
    
    wp_send_json_success(['message' => 'Post rescheduled']);
}
add_action('wp_ajax_tbc_pf_reschedule_single_post', 'tbc_pf_ajax_reschedule_single_post');

/**
 * AJAX: Run scheduled post now
 */
function tbc_pf_ajax_run_scheduled_post() {
    if (empty($_POST['action_id'])) {
        wp_send_json_error(['message' => 'Missing action ID']);
    }
    
    if (!class_exists('ActionScheduler')) {
        wp_send_json_error(['message' => 'Action Scheduler not available']);
    }
    
    $id = intval($_POST['action_id']);
    $store = ActionScheduler::store();
    
    if ($store->get_status($id) !== ActionScheduler_Store::STATUS_PENDING) {
        wp_send_json_error(['message' => 'Can only run pending actions']);
    }
    
    try {
        ActionScheduler::runner()->process_action($id, 'Event Dashboard');
        
        $final = $store->get_status($id);
        if ($final === ActionScheduler_Store::STATUS_COMPLETE) {
            wp_send_json_success(['message' => 'Post sent']);
        } else {
            wp_send_json_error(['message' => 'Action did not complete']);
        }
    } catch (Exception $e) {
        wp_send_json_error(['message' => 'Failed: ' . $e->getMessage()]);
    }
}
add_action('wp_ajax_tbc_pf_run_scheduled_post', 'tbc_pf_ajax_run_scheduled_post');

/**
 * AJAX: Schedule posts manually for existing group
 */
function tbc_pf_ajax_schedule_posts_manually() {
    if (!isset($_POST['product_id'], $_POST['event_date'], $_POST['group_id'])) {
        wp_send_json_error(['message' => 'Missing required parameters']);
    }
    
    $product_id = intval($_POST['product_id']);
    $event_date = sanitize_text_field($_POST['event_date']);
    $group_id = intval($_POST['group_id']);
    
    if (!function_exists('tbc_pf_schedule_event_posts_dynamic')) {
        wp_send_json_error(['message' => 'Post scheduling not available']);
    }
    
    global $wpdb;
    $query = "
        SELECT meta_end.meta_value as event_end_date
        FROM {$wpdb->prefix}woocommerce_order_items as order_items
        JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_product
            ON order_items.order_item_id = meta_product.order_item_id
        JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_date
            ON order_items.order_item_id = meta_date.order_item_id
        LEFT JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_end
            ON order_items.order_item_id = meta_end.order_item_id
            AND meta_end.meta_key = '_tbc_wc_event_end_date'
        WHERE meta_product.meta_key = '_product_id'
        AND meta_product.meta_value = %d
        AND meta_date.meta_key = '_tbc_wc_event_start_date'
        AND meta_date.meta_value = %s
        LIMIT 1
    ";
    
    $event_end_date = $wpdb->get_var($wpdb->prepare($query, $product_id, $event_date));
    if (empty($event_end_date)) {
        $event_end_date = $event_date;
    }
    
    tbc_pf_schedule_event_posts_dynamic($group_id, $product_id, $event_date, $event_end_date);
    
    wp_send_json_success(['message' => 'Posts scheduled']);
}
add_action('wp_ajax_tbc_pf_schedule_posts_manually', 'tbc_pf_ajax_schedule_posts_manually');