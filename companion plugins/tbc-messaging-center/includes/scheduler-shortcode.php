<?php
/**
 * Two Birds Church - Message Scheduler Handlers
 * Groups scheduled chunks by parent_id and provides AJAX handlers
 *
 * NOTE: Legacy [tbc_mc_scheduler] shortcode removed - now part of unified Message Center
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Group individual chunk actions by parent_id
 */
function tbc_mc_group_chunks($scheduled_chunks) {
    $grouped = [];
    
    foreach ($scheduled_chunks as $chunk) {
        $parent_id = $chunk['parent_id'] ?? 'unknown';
        
        if (!isset($grouped[$parent_id])) {
            $grouped[$parent_id] = [
                'chunks' => [],
                'total_recipients' => 0,
                'message' => $chunk['message'],
                'message_title' => $chunk['message_title'],
                'media_url' => $chunk['media_url'],
                'send_as_mms' => $chunk['send_as_mms'],
                'include_opt_out' => $chunk['include_opt_out'],
                'include_in_log' => $chunk['include_in_log'],
                'schedule_type' => $chunk['schedule_type'],
                'next_run' => $chunk['next_run'],
                'created_date' => $chunk['created_date'],
                'processed_at' => null,
                'total_chunks' => $chunk['total_chunks'] ?? 1,
                'status' => $chunk['status'] ?? 'pending',
                'action_scheduler_id' => $chunk['action_scheduler_id'] ?? null,
            ];
        }
        
        $grouped[$parent_id]['chunks'][] = $chunk;
        $grouped[$parent_id]['total_recipients'] += $chunk['recipient_count'];
        
        // Track the latest processed_at time for completed groups
        if ($chunk['status'] === 'completed' && !empty($chunk['processed_at'])) {
            if (empty($grouped[$parent_id]['processed_at']) || 
                strtotime($chunk['processed_at']) > strtotime($grouped[$parent_id]['processed_at'])) {
                $grouped[$parent_id]['processed_at'] = $chunk['processed_at'];
            }
        }
    }
    
    return $grouped;
}

/**
 * Generate view for a grouped message (all chunks of one blast)
 */
function tbc_mc_generate_message_view($parent_id, $group) {
    $display_title = esc_html($group['message_title'] ?: 'Untitled Message');
    $chunk_count = count($group['chunks']);
    $total_recipients = $group['total_recipients'];
    
    // Format schedule information
    $next_run_formatted = '';
    $schedule_description = '';
    $schedule_label = '';
    $created_date_display = '';
    
    // Use created_date since we're storing in database now
    if ($group['created_date']) {
        // current_time('mysql') stores datetime in site's local timezone
        // Parse it as a local datetime, not UTC
        $timezone = wp_timezone();
        $created_datetime = new DateTime($group['created_date'], $timezone);
        $formatted_time = $created_datetime->format('M j, Y \a\t g:i A');
        
        // Determine label and time based on status and schedule type
        if ($group['status'] === 'completed' && !empty($group['processed_at'])) {
            $schedule_label = 'Sent on:';
            // Use processed_at for completed messages (actual send time)
            $processed_datetime = new DateTime($group['processed_at'], $timezone);
            $formatted_time = $processed_datetime->format('M j, Y \a\t g:i A');
            $next_run_formatted = $formatted_time;
        } elseif ($group['schedule_type'] === 'recurring') {
            $schedule_label = 'Next Run:';
            
            // Get next run from Action Scheduler
            if (!empty($group['action_scheduler_id'])) {
                try {
                    $store = ActionScheduler::store();
                    $action = $store->fetch_action($group['action_scheduler_id']);
                    if ($action && method_exists($action, 'get_schedule')) {
                        // Action Scheduler expects DateTime object, not timestamp
                        $after_datetime = new DateTime('now', wp_timezone());
                        $next_datetime = $action->get_schedule()->get_next($after_datetime);
                        if ($next_datetime) {
                            // Convert to site timezone
                            $next_datetime->setTimezone(wp_timezone());
                            $next_run_formatted = $next_datetime->format('M j, Y \a\t g:i A');
                        } else {
                            $next_run_formatted = 'No future runs';
                        }
                    } else {
                        $next_run_formatted = 'Unknown';
                    }
                } catch (Exception $e) {
                    $next_run_formatted = 'Unknown';
                    error_log('Error getting next run for action ' . $group['action_scheduler_id'] . ': ' . $e->getMessage());
                }
            } else {
                $next_run_formatted = 'Unknown';
            }
        } elseif ($group['schedule_type'] === 'scheduled') {
            $schedule_label = 'Scheduled for:';
            
            // Get actual scheduled time from Action Scheduler
            if (!empty($group['action_scheduler_id'])) {
                try {
                    $store = ActionScheduler::store();
                    $action = $store->fetch_action($group['action_scheduler_id']);
                    if ($action && method_exists($action, 'get_schedule')) {
                        $schedule_datetime = $action->get_schedule()->get_date();
                        if ($schedule_datetime) {
                            // Convert UTC to site timezone
                            $schedule_datetime->setTimezone(wp_timezone());
                            $next_run_formatted = $schedule_datetime->format('M j, Y \a\t g:i A');
                        } else {
                            $next_run_formatted = 'Unknown';
                        }
                    } else {
                        $next_run_formatted = 'Unknown';
                    }
                } catch (Exception $e) {
                    $next_run_formatted = 'Unknown';
                    error_log('Error getting scheduled time for action ' . $group['action_scheduler_id'] . ': ' . $e->getMessage());
                }
            } else {
                $next_run_formatted = 'Unknown';
            }
        } else {
            $schedule_label = 'Send Time:';
            $next_run_formatted = $formatted_time;
        }
        
        switch ($group['schedule_type']) {
            case 'immediate':
                $schedule_description = 'Send Immediately';
                break;
            case 'scheduled':
                $schedule_description = 'Send Once';
                break;
            case 'recurring':
                $schedule_description = 'Recurring Message';
                break;
            default:
                $schedule_description = 'Scheduled';
        }
        
        // Format created date for display
        // current_time('mysql') stores in site timezone, interpret as local time
        $timezone = wp_timezone();
        $created_datetime = new DateTime($group['created_date'], $timezone);
        $created_date_display = $created_datetime->format('M j, Y \a\t g:i A');
    }

    ob_start();
    ?>
    <div class="tbc-mc-scheduled-message-group" data-parent-id="<?php echo esc_attr($parent_id); ?>">
        <div class="tbc-mc-group-header">
            <div class="tbc-mc-group-title">
                <h4><?php echo $display_title; ?></h4>
                
                <!-- Status Badge First (Most Important) -->
                <span class="tbc-mc-batch-status-<?php echo esc_attr($group['status']); ?>">
                    <?php echo esc_html(ucfirst($group['status'])); ?>
                </span>
                
                <!-- Schedule Type Badge -->
                <span class="tbc-mc-schedule-type-badge <?php echo esc_attr($group['schedule_type']); ?>">
                    <?php echo esc_html($schedule_description); ?>
                </span>
                
                <!-- Recipients Badge -->
                <span class="tbc-mc-recipients-badge">
                    <?php echo esc_html("{$total_recipients} recipients"); ?>
                </span>
            </div>
            <div class="tbc-mc-group-actions">
                <?php if (in_array($group['status'], ['pending', 'processing'])): ?>
                    <button class="tbc-mc-cancel-all-btn" data-parent-id="<?php echo esc_attr($parent_id); ?>" title="Cancel entire message blast">
                        <i class="bb-icon-delete-tag"></i> Cancel All
                    </button>
                <?php else: ?>
                    <button class="tbc-mc-delete-all-btn" data-parent-id="<?php echo esc_attr($parent_id); ?>" title="Delete entire message blast from database">
                        <i class="bb-icon-delete"></i> Delete All
                    </button>
                <?php endif; ?>
            </div>
        </div>
        
        <div class="tbc-mc-scheduled-message-details">
            <div class="tbc-mc-message-content-section">
                <div class="tbc-mc-message-preview">
                    <strong>Full Message:</strong>
                    <div class="tbc-mc-message-text-preview">
                        <?php echo nl2br(esc_html($group['message'])); ?>
                    </div>
                </div>
            </div>
            
            <!-- Date Information Section -->
            <div class="tbc-mc-date-information-section">
                <div class="tbc-mc-date-info-grid">
                    <div class="tbc-mc-date-info-item">
                        <strong>Created on:</strong>
                        <span><?php echo esc_html($created_date_display ?: 'Processing...'); ?></span>
                    </div>
                    
                    <div class="tbc-mc-date-info-item">
                        <strong><?php echo esc_html($schedule_label); ?></strong>
                        <span><?php echo esc_html($next_run_formatted ?: 'Processing...'); ?></span>
                    </div>
                </div>
            </div>
            
            <div class="tbc-mc-message-meta-grid">
                <div class="meta-item">
                    <strong>Send as MMS:</strong>
                    <span class="<?php echo $group['send_as_mms'] ? 'yes' : 'no'; ?>">
                        <?php echo $group['send_as_mms'] ? 'Yes' : 'No'; ?>
                    </span>
                </div>
                
                <div class="meta-item">
                    <strong>Include Opt-out:</strong>
                    <span class="<?php echo $group['include_opt_out'] ? 'yes' : 'no'; ?>">
                        <?php echo $group['include_opt_out'] ? 'Yes' : 'No'; ?>
                    </span>
                </div>
                
                <div class="meta-item">
                    <strong>Include in Log:</strong>
                    <span class="<?php echo $group['include_in_log'] ? 'yes' : 'no'; ?>">
                        <?php echo $group['include_in_log'] ? 'Yes' : 'No'; ?>
                    </span>
                </div>
            </div>
            
            <?php if (!empty($group['media_url'])): ?>
                <?php 
                $media_urls = array_map('trim', explode(',', $group['media_url']));
                ?>
                <div class="tbc-mc-message-media-attachments">
                    <strong>Media Attachments:</strong><br>
                    <?php foreach ($media_urls as $media_url): ?>
                        <?php if (preg_match('/\.(jpeg|jpg|png|gif|webp)$/i', $media_url)): ?>
                            <a href="<?php echo esc_url($media_url); ?>" target="_blank" class="tbc-mc-attachment-link">
                                <img src="<?php echo esc_url($media_url); ?>" alt="Media Attachment" class="tbc-mc-attachment-thumbnail"/>
                            </a>
                        <?php else: ?>
                            <a href="<?php echo esc_url($media_url); ?>" target="_blank">View Attachment</a><br>
                        <?php endif; ?>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        </div>
    </div>
    <?php
    
    return ob_get_clean();
}

/**
 * Cancel all batches for a specific parent_id
 */
function tbc_mc_cancel_blast($parent_id) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'tbc_mc_scheduler_batches';
    
    try {
        // Get all pending/processing batches for this parent_id
        $batches = $wpdb->get_results($wpdb->prepare(
            "SELECT batch_id, action_scheduler_id FROM $table_name WHERE parent_id = %s AND status IN ('pending', 'processing')",
            $parent_id
        ));
        
        $cancelled_count = 0;
        $store = ActionScheduler::store();
        
        foreach ($batches as $batch) {
            // Update database status
            $updated = $wpdb->update(
                $table_name,
                ['status' => 'cancelled', 'processed_at' => current_time('mysql')],
                ['batch_id' => $batch->batch_id]
            );
            
            // Cancel Action Scheduler action if exists
            if ($batch->action_scheduler_id && $updated) {
                try {
                    $store->cancel_action($batch->action_scheduler_id);
                } catch (Exception $e) {
                    // Action might already be processed, log but continue
                    error_log("Could not cancel action {$batch->action_scheduler_id}: " . $e->getMessage());
                }
            }
            
            if ($updated) {
                $cancelled_count++;
            }
        }
        
        tbc_mc_debug_log('BLAST CANCELLED', [
            'parent_id' => $parent_id,
            'cancelled_count' => $cancelled_count
        ]);
        
        return $cancelled_count;
        
    } catch (Exception $e) {
        tbc_mc_debug_log('BLAST CANCEL ERROR', [
            'parent_id' => $parent_id,
            'error' => $e->getMessage()
        ]);
        return 0;
    }
}

/**
 * AJAX: Cancel entire blast by parent_id
 */
add_action('wp_ajax_tbc_mc_cancel_blast', function () {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        tbc_mc_ajax_feedback('error', 'Insufficient permissions');
        return;
    }
    
    $parent_id = sanitize_text_field($_POST['parent_id'] ?? '');
    if (!$parent_id) {
        tbc_mc_ajax_feedback('error', 'Missing parent ID');
        return;
    }
    
    $cancelled_count = tbc_mc_cancel_blast($parent_id);
    
    if ($cancelled_count > 0) {
        tbc_mc_ajax_feedback('success', "Cancelled {$cancelled_count} chunks for this message blast");
    } else {
        tbc_mc_ajax_feedback('error', 'No pending chunks found for this blast');
    }
});

/**
 * Delete all batches for a specific parent_id (for completed/cancelled batches)
 */
function tbc_mc_delete_blast($parent_id) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'tbc_mc_scheduler_batches';
    
    try {
        // Get all batches for this parent_id to clean up Action Scheduler too
        $batches = $wpdb->get_results($wpdb->prepare(
            "SELECT batch_id, action_scheduler_id FROM $table_name WHERE parent_id = %s",
            $parent_id
        ));
        
        $deleted_count = 0;
        $store = ActionScheduler::store();
        
        foreach ($batches as $batch) {
            // Delete from Action Scheduler if action exists
            if ($batch->action_scheduler_id) {
                try {
                    $store->delete_action($batch->action_scheduler_id);
                } catch (Exception $e) {
                    // Action might already be processed/deleted, continue
                    tbc_mc_debug_log('AS DELETE WARNING', [
                        'action_id' => $batch->action_scheduler_id,
                        'error' => $e->getMessage()
                    ]);
                }
            }
        }
        
        // Delete all batches for this parent_id from our database
        $deleted_count = $wpdb->delete($table_name, [
            'parent_id' => $parent_id
        ]);
        
        tbc_mc_debug_log('BLAST DELETED', [
            'parent_id' => $parent_id,
            'deleted_count' => $deleted_count,
            'action_scheduler_cleaned' => count($batches)
        ]);
        
        return $deleted_count;
        
    } catch (Exception $e) {
        tbc_mc_debug_log('BLAST DELETE ERROR', [
            'parent_id' => $parent_id,
            'error' => $e->getMessage()
        ]);
        return 0;
    }
}

/**
 * AJAX: Delete entire blast by parent_id
 */
add_action('wp_ajax_tbc_mc_delete_blast', function () {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        tbc_mc_ajax_feedback('error', 'Insufficient permissions');
        return;
    }

    $parent_id = sanitize_text_field($_POST['parent_id'] ?? '');
    if (!$parent_id) {
        tbc_mc_ajax_feedback('error', 'Missing parent ID');
        return;
    }

    $deleted_count = tbc_mc_delete_blast($parent_id);

    if ($deleted_count > 0) {
        tbc_mc_ajax_feedback('success', "Deleted {$deleted_count} chunks for this message blast");
    } else {
        tbc_mc_ajax_feedback('error', 'No chunks found to delete');
    }
});

/**
 * AJAX: Bulk delete multiple blasts by parent_id array
 */
add_action('wp_ajax_tbc_mc_bulk_delete_scheduled', function() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        wp_send_json_error('Insufficient permissions');
        return;
    }

    $parent_ids = isset($_POST['parent_ids']) ? array_map('sanitize_text_field', $_POST['parent_ids']) : [];

    if (empty($parent_ids)) {
        wp_send_json_error('No messages selected');
        return;
    }

    $deleted_count = 0;
    foreach ($parent_ids as $parent_id) {
        $result = tbc_mc_delete_blast($parent_id);
        if ($result > 0) $deleted_count++;
    }

    if ($deleted_count > 0) {
        wp_send_json_success(['deleted' => $deleted_count]);
    } else {
        wp_send_json_error('No messages deleted');
    }
});

/**
 * AJAX handler for refreshing the scheduler interface
 */
function tbc_mc_refresh_scheduler() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        tbc_mc_ajax_feedback('error', 'Insufficient permissions');
        return;
    }
    
    $scheduled_chunks = tbc_mc_get_scheduled_messages(200);
    $grouped_messages = tbc_mc_group_chunks($scheduled_chunks);
    
    if (empty($grouped_messages)) {
        $html = '<div class="tbc-mc-no-scheduled-messages"><h3>No Scheduled Messages</h3><p>All scheduled messages have been processed or cancelled.</p></div>';
    } else {
        $html = '<div class="tbc-mc-scheduled-messages-header"><h3>Scheduled Messages (' . count($grouped_messages) . ' groups)</h3></div>';
        $html .= '<div class="tbc-mc-scheduled-messages-list">';
        foreach ($grouped_messages as $parent_id => $group) {
            $html .= tbc_mc_generate_message_view($parent_id, $group);
        }
        $html .= '</div>';
    }
    
    tbc_mc_ajax_feedback('success', 'Interface refreshed', ['html' => $html]);
}
add_action('wp_ajax_tbc_mc_refresh_scheduler', 'tbc_mc_refresh_scheduler');

/**
 * Get scheduler statistics for dashboard widgets
 */
function tbc_mc_get_scheduler_stats() {
    $scheduled_chunks = tbc_mc_get_scheduled_messages(500);
    $grouped_messages = tbc_mc_group_chunks($scheduled_chunks);
    
    $stats = [
        'total_groups' => count($grouped_messages),
        'total_chunks' => count($scheduled_chunks),
        'total_recipients' => 0,
        'immediate' => 0,
        'scheduled' => 0,
        'recurring' => 0,
        'next_24_hours' => 0
    ];
    
    $now = time();
    $next_24_hours = $now + (24 * 60 * 60);
    
    foreach ($grouped_messages as $group) {
        // Count by type
        $stats[$group['schedule_type']]++;
        
        // Count total recipients
        $stats['total_recipients'] += $group['total_recipients'];
        
        // Count groups with messages in next 24 hours
        if ($group['created_date'] && strtotime($group['created_date']) <= $next_24_hours) {
            $stats['next_24_hours']++;
        }
    }
    
    return $stats;
}