<?php
/**
 * Post Management Display
 * 
 * Displays the post management interface for scheduled event posts.
 * 
 * @package TBC_Participant_Frontend
 * @since 3.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

function tbc_pf_display_post_management($product_id, $event_date = '') {
    $results = tbc_pf_calculate_income_and_donors($product_id, $event_date);
    $order_ids = $results['order_ids'] ?? [];
    // Pass product_id and event_date to get correct line item data
    $current_group_id = tbc_pf_tm_get_common_group_id($order_ids, $product_id, $event_date);
    
    if (!function_exists('tbc_wc_get_events')) {
        $event_end_date = $event_date;
    } else {
        $date_info = tbc_wc_get_events($product_id, [
            'start_date' => $event_date,
            'end_date' => $event_date,
            'limit' => 1
        ]);
        $event_end_date = !empty($date_info) ? $date_info[0]['end'] : $event_date;
    }
    
    $scheduled_posts = tbc_pf_pm_get_scheduled_posts($product_id, $event_date, $current_group_id);
    
    echo '<div class="tbc-pf-post-management-content">';
    
    if (empty($scheduled_posts)) {
        if (!empty($current_group_id)) {
            echo '<div class="tbc-pf-no-posts-container">';
            echo '<p class="tbc-pf-no-posts-message">No scheduled posts found for this event.</p>';
            echo '<button type="button" id="tbc-pf-schedule-posts-btn" class="tbc-pf-schedule-posts-btn" 
                    data-product-id="' . esc_attr($product_id) . '" 
                    data-event-date="' . esc_attr($event_date) . '" 
                    data-event-end-date="' . esc_attr($event_end_date) . '"
                    data-group-id="' . esc_attr($current_group_id) . '">
                Schedule Posts Now
            </button>';
            echo '</div>';
        } else {
            echo '<p class="tbc-pf-no-posts-message">No scheduled posts found. Assign a chat group to schedule posts.</p>';
        }
    } else {
        echo '<div class="tbc-pf-posts-table-container">';
        echo '<table class="tbc-pf-posts-table">';
        echo '<thead><tr>';
        echo '<th>Post Type</th>';
        echo '<th>Scheduled Date</th>';
        echo '<th>Status</th>';
        echo '<th>Actions</th>';
        echo '</tr></thead>';
        echo '<tbody>';
        
        foreach ($scheduled_posts as $post) {
            $status_class = 'tbc-pf-status-' . strtolower($post['status']);
            $status_label = ucfirst($post['status']);
            
            if ($post['status'] === 'missing') {
                $scheduled_time = '-';
            } elseif (!empty($post['was_async']) && $post['status'] === 'complete') {
                $scheduled_time = 'Sent immediately';
            } else {
                $timezone = new DateTimeZone(wp_timezone_string());
                $display_date = clone $post['scheduled_date'];
                $display_date->setTimezone($timezone);
                $scheduled_time = $display_date->format('M j, Y g:i A T');
            }
            
            $actions_html = '';
            if ($post['status'] === 'missing') {
                $can_schedule = tbc_pf_pm_can_schedule_post($post['post_type_id'], $event_date, $event_end_date);
                
                if ($can_schedule) {
                    $template = tbc_pf_ps_get_post_type($post['post_type_id']);
                    $is_immediate = ($template && $template['schedule_timing'] === 'immediate');
                    
                    $immediate_alert = $is_immediate ? '<span class="tbc-pf-immediate-alert" title="⚠️ This will send immediately">⚠️</span>' : '';
                    
                    $actions_html = '<button type="button" class="tbc-pf-reschedule-post-btn" 
                                        data-post-type-id="' . esc_attr($post['post_type_id']) . '"
                                        data-group-id="' . esc_attr($current_group_id) . '"
                                        data-product-id="' . esc_attr($product_id) . '"
                                        data-event-date="' . esc_attr($event_date) . '"
                                        data-event-end-date="' . esc_attr($event_end_date) . '">Reschedule</button>' . $immediate_alert;
                } else {
                    $actions_html = '<button type="button" class="tbc-pf-unavailable-post-btn" disabled>Unavailable</button>';
                }
            } elseif ($post['status'] === 'pending') {
                $actions_html = '<button type="button" class="tbc-pf-run-post-btn" data-action-id="' . esc_attr($post['action_id']) . '">Run Now</button>';
                $actions_html .= '<button type="button" class="tbc-pf-delete-post-btn" data-action-id="' . esc_attr($post['action_id']) . '">Delete</button>';
            } else {
                $actions_html = '<button type="button" class="tbc-pf-delete-post-btn" data-action-id="' . esc_attr($post['action_id']) . '">Delete</button>';
            }
            
            echo '<tr class="' . $status_class . '">';
            echo '<td>' . esc_html($post['post_name']) . '</td>';
            echo '<td>' . $scheduled_time . '</td>';
            echo '<td><span class="tbc-pf-status-badge ' . $status_class . '">' . $status_label . '</span></td>';
            echo '<td class="tbc-pf-actions-cell">' . $actions_html . '</td>';
            echo '</tr>';
        }
        
        echo '</tbody></table></div>';
    }
    
    echo '</div>';
}