<?php
/**
 * Two Birds Church - Messaging Center Scheduler Functions
 * Database-backed scheduling with Action Scheduler integration
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Simple logging function
 */
function tbc_mc_debug_log($message, $data = null) {
    $log_entry = "[TBC-MC-SCHEDULER] " . $message;
    if ($data) {
        $log_entry .= " | Data: " . wp_json_encode($data);
    }
    error_log($log_entry);
}

/**
 * Insert batch into database
 */
function tbc_mc_insert_batch($batch_data) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'tbc_mc_scheduler_batches';
    
    $batch_id = wp_generate_uuid4();
    
    $inserted = $wpdb->insert($table_name, [
        'batch_id' => $batch_id,
        'parent_id' => $batch_data['parent_id'],
        'chunk_index' => $batch_data['chunk_index'],
        'total_chunks' => $batch_data['total_chunks'],
        'message' => $batch_data['message'],
        'message_title' => $batch_data['message_title'],
        'recipients' => wp_json_encode($batch_data['recipients']),
        'media_url' => $batch_data['media_url'],
        'send_as_mms' => $batch_data['send_as_mms'] ? 1 : 0,
        'include_opt_out' => $batch_data['include_opt_out'] ? 1 : 0,
        'opt_out_message' => $batch_data['opt_out_message'],
        'include_in_log' => $batch_data['include_in_log'] ? 1 : 0,
        'created_date' => $batch_data['created_date'],
        'status' => 'pending',
        'schedule_type' => $batch_data['schedule_type'],
        'cron_expression' => $batch_data['cron_expression'] ?? '',
    ]);
    
    if ($inserted) {
        return $batch_id;
    }
    
    return false;
}

/**
 * Get batch from database
 */
function tbc_mc_get_batch($batch_id) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'tbc_mc_scheduler_batches';
    
    $batch = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table_name WHERE batch_id = %s", $batch_id));
    
    if ($batch) {
        // Decode recipients JSON
        $batch->recipients = json_decode($batch->recipients, true);
        return $batch;
    }
    
    return null;
}

/**
 * Update batch status
 */
function tbc_mc_update_batch_status($batch_id, $status, $error_message = '') {
    global $wpdb;
    $table_name = $wpdb->prefix . 'tbc_mc_scheduler_batches';
    
    $update_data = [
        'status' => $status,
        'processed_at' => current_time('mysql')
    ];
    
    if (!empty($error_message)) {
        $update_data['error_message'] = $error_message;
    }
    
    return $wpdb->update($table_name, $update_data, ['batch_id' => $batch_id]);
}

/**
 * Unified SMS scheduling function for all message types
 * 
 * @param array $message_data Complete message data
 * @param int|null $schedule_time Unix timestamp for future messages (null = immediate)
 * @param string|null $cron_expression Cron expression for recurring messages
 * @return string Parent ID for grouping related chunks
 */
function tbc_mc_schedule_sms($message_data, $schedule_time = null, $cron_expression = null) {
    $recipients = $message_data['recipients'] ?? [];
    
    if (empty($message_data['message']) || empty($recipients)) {
        tbc_mc_debug_log('SCHEDULE_SMS INVALID', [
            'has_message' => !empty($message_data['message']), 
            'recipient_count' => count($recipients)
        ]);
        return false;
    }

    // Determine schedule type and timing
    if (!empty($cron_expression)) {
        $schedule_type = 'recurring';
        $is_future = false;
        $run_time = time(); // Cron starts immediately
    } elseif ($schedule_time && $schedule_time > time()) {
        $schedule_type = 'scheduled';
        $is_future = true;
        $run_time = $schedule_time;
    } else {
        $schedule_type = 'immediate';
        $is_future = false;
        $run_time = time();
    }

    // Normalize boolean values
    $send_as_mms = isset($message_data['send_as_mms']) ? 
        ($message_data['send_as_mms'] === 'true' || $message_data['send_as_mms'] === true) : false;
    $include_opt_out = isset($message_data['include_opt_out']) ? 
        ($message_data['include_opt_out'] === 'true' || $message_data['include_opt_out'] === true) : true;
    $include_in_log = isset($message_data['include_in_log']) ? 
        ($message_data['include_in_log'] === 'true' || $message_data['include_in_log'] === true) : true;

    // Use same chunking logic for ALL message types
    $parent_id = wp_generate_uuid4();
    $chunks = array_chunk($recipients, 100);
    $total_chunks = count($chunks);

    // Create batches and schedule actions
    foreach ($chunks as $i => $chunk) {
        $batch_data = [
            'parent_id'       => $parent_id,
            'chunk_index'     => $i,
            'total_chunks'    => $total_chunks,
            'message'         => $message_data['message'],
            'message_title'   => $message_data['message_title'] ?? '',
            'recipients'      => $chunk,
            'media_url'       => $message_data['media_url'] ?? '',
            'send_as_mms'     => $send_as_mms,
            'include_opt_out' => $include_opt_out,
            'opt_out_message' => $message_data['opt_out_message'] ?? '',
            'include_in_log'  => $include_in_log,
            'created_date'    => current_time('mysql'),
            'schedule_type'   => $schedule_type,
            'cron_expression' => $cron_expression ?? '',
        ];

        // Insert batch into database
        $batch_id = tbc_mc_insert_batch($batch_data);
        
        if ($batch_id) {
            // Use appropriate Action Scheduler function based on timing
            if (!empty($cron_expression)) {
                // Recurring: run on cron schedule
                $action_id = as_schedule_cron_action(
                    $run_time,
                    $cron_expression,
                    'tbc_mc_execute_send',
                    [$batch_id],
                    'tbc_mc_sends'
                );
            } elseif ($is_future) {
                // Scheduled: run at specific future time
                $action_id = as_schedule_single_action(
                    $run_time,
                    'tbc_mc_execute_send',
                    [$batch_id],
                    'tbc_mc_sends'
                );
            } else {
                // Immediate: run now
                $action_id = as_enqueue_async_action(
                    'tbc_mc_execute_send',
                    [$batch_id],
                    'tbc_mc_sends'
                );
            }
            
            // Store action_scheduler_id for cancellation and next run queries
            if ($action_id) {
                global $wpdb;
                $wpdb->update(
                    $wpdb->prefix . 'tbc_mc_scheduler_batches',
                    ['action_scheduler_id' => $action_id],
                    ['batch_id' => $batch_id]
                );
                
                tbc_mc_debug_log('ACTION SCHEDULED', [
                    'batch_id' => $batch_id,
                    'action_id' => $action_id,
                    'schedule_type' => $schedule_type,
                    'run_time' => $run_time,
                    'chunk' => $i + 1,
                    'total_chunks' => $total_chunks
                ]);
            }
        }
    }

    tbc_mc_debug_log('UNIFIED SCHEDULE COMPLETE', [
        'parent_id' => $parent_id,
        'schedule_type' => $schedule_type,
        'total_recipients' => count($recipients),
        'chunk_count' => $total_chunks,
        'title' => $message_data['message_title'] ?? '',
    ]);

    return $parent_id;
}

/**
 * Execute a single SMS batch - Database lookup version
 * Look up batch by ID, process recipients, update status
 */
add_action('tbc_mc_execute_send', function ($batch_id) {
    try {
        // Basic safety settings
        @ignore_user_abort(true);
        @set_time_limit(120);

        $start_time = microtime(true);

        tbc_mc_debug_log('EXECUTE START', [
            'batch_id' => $batch_id,
            'batch_id_type' => gettype($batch_id),
            'start_time' => $start_time
        ]);

        // Look up batch from database
        $batch = tbc_mc_get_batch($batch_id);
        
        if (!$batch) {
            tbc_mc_debug_log('BATCH NOT FOUND', ['batch_id' => $batch_id]);
            return true;
        }
        
        if ($batch->status !== 'pending') {
            tbc_mc_debug_log('BATCH ALREADY PROCESSED', [
                'batch_id' => $batch_id,
                'status' => $batch->status
            ]);
            return true;
        }

        // Mark as processing
        tbc_mc_update_batch_status($batch_id, 'processing');

        $recipients = $batch->recipients;
        if (empty($recipients)) {
            tbc_mc_update_batch_status($batch_id, 'completed');
            tbc_mc_debug_log('EMPTY BATCH', ['batch_id' => $batch_id]);
            return true;
        }

        // Build the full message
        $full_message = (string) $batch->message;
        if ($batch->include_opt_out && !empty($batch->opt_out_message)) {
            $full_message .= "\n\n" . $batch->opt_out_message;
        }

        // TIME THE SMS SENDING OPERATION
        $sms_start_time = microtime(true);
        
        // Send to this chunk of recipients
        $feedback = tbc_mc_send_sms_batch(
            $full_message,
            $recipients,
            $batch->media_url ?? '',
            (bool) $batch->send_as_mms
        );
        
        $sms_end_time = microtime(true);
        $sms_duration = $sms_end_time - $sms_start_time;

        // Optional: Log to database if requested
        $db_log_start = microtime(true);
        if ($batch->include_in_log) {
            tbc_mc_log_sms($recipients, $full_message, $batch);
        }
        $db_log_duration = microtime(true) - $db_log_start;

        // Mark as completed
        tbc_mc_update_batch_status($batch_id, 'completed');

        $total_duration = microtime(true) - $start_time;

        tbc_mc_debug_log('BATCH COMPLETED WITH TIMING', [
            'batch_id' => $batch_id,
            'parent_id' => $batch->parent_id,
            'chunk' => $batch->chunk_index,
            'recipients' => count($recipients),
            'title' => $batch->message_title,
            'total_duration_seconds' => round($total_duration, 3),
            'sms_sending_duration_seconds' => round($sms_duration, 3),
            'db_logging_duration_seconds' => round($db_log_duration, 3),
            'avg_seconds_per_recipient' => round($sms_duration / count($recipients), 4),
            'estimated_time_for_100_recipients' => round(($sms_duration / count($recipients)) * 100, 2),
            'estimated_time_for_200_recipients' => round(($sms_duration / count($recipients)) * 200, 2)
        ]);

    } catch (\Throwable $e) {
        tbc_mc_update_batch_status($batch_id, 'failed', $e->getMessage());
        tbc_mc_debug_log('BATCH ERROR', [
            'batch_id' => $batch_id,
            'error' => $e->getMessage()
        ]);
    }
    return true;
}, 10, 1);

/**
 * Helper: Log sent messages to database
 */
function tbc_mc_log_sms($recipients, $full_message, $batch) {
    try {
        global $wpdb;
        $table = $wpdb->prefix . 'tbc_mc_messages';
        $logged = 0;
        
        foreach ($recipients as $recipient) {
            $phone = tbc_mc_format_phone($recipient['phone']);
            $name = $recipient['name'] ?? 'Contact';
            $personalized_message = str_replace('{name}', $name, $full_message);
            
            if ($wpdb->insert($table, [
                'type' => 'sms',
                'sender_number' => $phone,
                'content' => $personalized_message,
                'date_created' => current_time('mysql'),
                'media_url' => $batch->media_url ?? '',
                'notes' => '',
                'marked' => 0,
                'is_read' => 0,
                'is_reply' => 1,
            ])) {
                $logged++;
            }
        }
        
        if ($logged > 0) {
            tbc_mc_debug_log('DATABASE LOGGED', [
                'batch_id' => $batch->batch_id,
                'logged_count' => $logged
            ]);
        }
    } catch (\Throwable $e) {
        tbc_mc_debug_log('DATABASE LOG ERROR', ['error' => $e->getMessage()]);
    }
}

/**
 * AJAX handler for scheduling SMS messages
 */
function tbc_mc_handle_schedule_request() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        tbc_mc_ajax_feedback('error', 'Insufficient permissions');
        return;
    }
    
    $message_data = isset($_POST['message_data']) ? $_POST['message_data'] : [];
    $schedule_time = isset($_POST['schedule_time']) ? intval($_POST['schedule_time']) : null;
    $schedule_type = isset($_POST['schedule_type']) ? sanitize_text_field($_POST['schedule_type']) : 'immediate';
    $cron_expression = isset($_POST['cron_expression']) ? sanitize_text_field($_POST['cron_expression']) : '';
    
    // Validate required data
    if (empty($message_data['message']) || empty($message_data['recipients'])) {
        tbc_mc_ajax_feedback('error', 'Message and recipients are required');
        return;
    }
    
    $total_recipients = count($message_data['recipients']);
    
    try {
        if ($schedule_type === 'recurring' && !empty($cron_expression)) {
            // Recurring message
            $parent_id = tbc_mc_schedule_sms($message_data, null, $cron_expression);
            $message = $parent_id ? 
                "Recurring message scheduled for {$total_recipients} recipients" : 
                'Failed to schedule recurring message';
        } else {
            // Immediate or scheduled message
            $parent_id = tbc_mc_schedule_sms($message_data, $schedule_time);
            
            if ($schedule_time && $schedule_time > time()) {
                $formatted_time = wp_date('M j, Y \a\t g:i A', $schedule_time);
                $message = $parent_id ? 
                    "Message scheduled for {$formatted_time} - {$total_recipients} recipients" : 
                    'Failed to schedule message';
            } else {
                $message = $parent_id ? 
                    "Message queued for immediate sending - {$total_recipients} recipients" : 
                    'Failed to queue message';
            }
        }
        
        $type = $parent_id ? 'success' : 'error';
        tbc_mc_ajax_feedback($type, $message);
        
    } catch (Exception $e) {
        error_log('TBC MC Scheduling Error: ' . $e->getMessage());
        tbc_mc_ajax_feedback('error', 'Failed to schedule message: ' . $e->getMessage());
    }
}
add_action('wp_ajax_tbc_mc_schedule_sms', 'tbc_mc_handle_schedule_request');

/**
 * Cancel scheduled SMS message by batch ID
 */
function tbc_mc_cancel_scheduled() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        tbc_mc_ajax_feedback('error', 'Insufficient permissions');
        return;
    }
    
    $action_id = intval($_POST['action_id']);
    if (!$action_id) {
        tbc_mc_ajax_feedback('error', 'Invalid action ID');
        return;
    }
    
    tbc_mc_debug_log('CANCEL REQUEST', ['action_id' => $action_id]);
    
    try {
        // Find batch by action_scheduler_id
        global $wpdb;
        $batch = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}tbc_mc_scheduler_batches WHERE action_scheduler_id = %d",
            $action_id
        ));
        
        if ($batch) {
            // Check if batch can be cancelled
            if (in_array($batch->status, ['completed', 'failed', 'cancelled'])) {
                tbc_mc_ajax_feedback('error', 'Cannot cancel a batch that has already been processed');
                return;
            }
            
            // Update database status
            tbc_mc_update_batch_status($batch->batch_id, 'cancelled');
        }
        
        // Cancel the Action Scheduler action
        $store = ActionScheduler::store();
        $store->cancel_action($action_id);
        
        tbc_mc_debug_log('ACTION CANCELLED', [
            'action_id' => $action_id,
            'batch_id' => $batch ? $batch->batch_id : 'unknown',
        ]);
        
        tbc_mc_ajax_feedback('success', 'Message cancelled successfully');
        
    } catch (Exception $e) {
        error_log('TBC MC Cancel Error: ' . $e->getMessage());
        tbc_mc_debug_log('CANCEL FAILED', [
            'action_id' => $action_id, 
            'error' => $e->getMessage()
        ]);
        tbc_mc_ajax_feedback('error', 'Failed to cancel message: ' . $e->getMessage());
    }
}
add_action('wp_ajax_tbc_mc_cancel_scheduled', 'tbc_mc_cancel_scheduled');

/**
 * Get all scheduled SMS batches from database
 * Much faster than querying Action Scheduler
 */
function tbc_mc_get_scheduled_messages($limit = 100) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'tbc_mc_scheduler_batches';
    
    try {
        $batches = $wpdb->get_results($wpdb->prepare("
            SELECT * FROM $table_name 
            WHERE status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')
            ORDER BY status = 'pending' DESC, created_date DESC 
            LIMIT %d
        ", $limit));
        
        $formatted_messages = [];
        
        foreach ($batches as $batch) {
            // Decode recipients
            $recipients = json_decode($batch->recipients, true) ?: [];
            
            $formatted_messages[] = [
                'action_id'        => $batch->action_scheduler_id ?: 0,
                'parent_id'        => $batch->parent_id,
                'chunk_index'      => $batch->chunk_index,
                'total_chunks'     => $batch->total_chunks,
                'message'          => $batch->message,
                'message_title'    => $batch->message_title,
                'recipient_count'  => count($recipients),
                'media_url'        => $batch->media_url,
                'send_as_mms'      => (bool) $batch->send_as_mms,
                'include_opt_out'  => (bool) $batch->include_opt_out,
                'include_in_log'   => (bool) $batch->include_in_log,
                'schedule_type'    => $batch->schedule_type,
                'schedule'         => null,
                'next_run'         => null,
                'created_date'     => $batch->created_date,
                'processed_at'     => $batch->processed_at,
                'status'           => $batch->status,
                'action_scheduler_id' => $batch->action_scheduler_id,
            ];
        }
        
        tbc_mc_debug_log('GET SCHEDULED COMPLETE', [
            'total_found' => count($batches),
            'successfully_processed' => count($formatted_messages)
        ]);
        
        return $formatted_messages;
        
    } catch (Exception $e) {
        tbc_mc_debug_log('GET SCHEDULED ERROR', ['error' => $e->getMessage()]);
        return [];
    }
}