<?php
/**
 * MESSAGING CENTER PUBLIC API
 * External interface for other plugins to send SMS through the messaging system
 * 
 * AVAILABLE FUNCTIONS:
 * - tbc_mc_send_sms()          Main sending function (supports immediate, scheduled, recurring)
 * - tbc_mc_generate_cron()     Helper to generate cron expressions from simple patterns
 * - tbc_mc_available()         Check if SMS sending is available
 * 
 * EXAMPLES:
 * 
 * // Send immediately
 * tbc_mc_send_sms(
 *     'Your spot is available for {name}!',
 *     [['phone' => '+12148707107', 'name' => 'John']]
 * );
 * 
 * // Schedule for future
 * tbc_mc_send_sms(
 *     'Event starts in 1 hour!',
 *     $recipients,
 *     ['schedule_time' => strtotime('+1 hour')]
 * );
 * 
 * // Recurring weekly
 * tbc_mc_send_sms(
 *     'Weekly reminder!',
 *     $recipients,
 *     [
 *         'recurring' => 'weekly',
 *         'day' => 1,  // Monday
 *         'time' => '09:00',
 *         'message_title' => 'Waitlist: Weekly Check-In'
 *     ]
 * );
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Send SMS via Messaging Center
 * 
 * @param string $message SMS message content (supports {name} merge tag)
 * @param array $recipients Array of phone numbers OR array of ['phone' => '+1...', 'name' => 'Name']
 * @param array $options Optional configuration
 * 
 * OPTIONS:
 * - send_now: bool (default true) - Send immediately
 * - schedule_time: int|null - Unix timestamp for single future send
 * - cron_expression: string|null - Cron expression for recurring (e.g., '0 9 * * 1')
 * - recurring: string|null - Helper pattern: 'daily', 'weekly', 'monthly_first', 'monthly_fifteenth', 'monthly_last', 'monthly_custom'
 * - day: int|null - Day for weekly (0-6) or monthly_custom (1-31)
 * - time: string - Time in HH:MM format (default '09:00')
 * - send_as_mms: bool|null - Send as MMS (default null = auto-detect based on media_url)
 * - media_url: string - URL to media attachment
 * - include_opt_out: bool (default true) - Include opt-out message
 * - include_in_log: bool (default true) - Save to message center database
 * - message_title: string - Title for scheduler display (recommended: 'Plugin: Event - Action')
 * 
 * @return string|false Parent ID on success, false on failure
 */
function tbc_mc_send_sms($message, $recipients, $options = []) {
    // Validate plugin dependencies
    if (!function_exists('tbc_mc_schedule_sms')) {
        error_log('TBC Messaging Center API: tbc_mc_schedule_sms() function not available. Is the plugin active?');
        return false;
    }
    
    if (!defined('TWILIO_SID') || !defined('TWILIO_TOKEN')) {
        error_log('TBC Messaging Center API: Twilio credentials not configured');
        return false;
    }

    // Ensure Action Scheduler is ready for external calls
    if (class_exists('ActionScheduler')) {
        // Initialize Action Scheduler if it hasn't been yet
        if (!did_action('action_scheduler_init')) {
            do_action('action_scheduler_init');
        }
        
        // Make sure the queue runner is initialized
        if (class_exists('ActionScheduler_QueueRunner')) {
            ActionScheduler_QueueRunner::instance();
        }
        
        // Verify it's actually working
        $test_store = ActionScheduler::store();
        if (!$test_store) {
            error_log('TBC Messaging Center API: Action Scheduler store not available');
            return false;
        }
    }
    
    // Set defaults
    $defaults = [
        // SENDING MODE
        'send_now' => true,              // Send immediately by default
        'schedule_time' => null,         // Unix timestamp for single future send
        'cron_expression' => null,       // Direct cron expression for recurring
        'recurring' => null,             // Helper: 'daily', 'weekly', 'monthly_first', etc.
        'day' => null,                   // Helper: Day number for weekly/monthly
        'time' => '09:00',               // Helper: Time for recurring
        
        // MESSAGE OPTIONS
        'send_as_mms' => null,           // null = auto-detect based on media_url
        'media_url' => '',               // Media attachment URL
        
        // COMPLIANCE & TRACKING
        'include_opt_out' => true,       // Include opt-out message (recommended)
        'include_in_log' => true,        // Save to tbc_mc_messages table
        
        // METADATA
        'message_title' => 'External Plugin Message'  // For scheduler display
    ];
    
    $options = array_merge($defaults, $options);
    
    // Validate message
    if (empty(trim($message))) {
        error_log('TBC Messaging Center API: Empty message provided');
        return false;
    }
    
    // Normalize recipients to expected format
    $normalized_recipients = [];
    
    foreach ((array) $recipients as $recipient) {
        if (is_string($recipient)) {
            // Simple phone number string
            $normalized_recipients[] = [
                'phone' => $recipient,
                'name' => 'Contact'
            ];
        } elseif (is_array($recipient) && isset($recipient['phone'])) {
            // Already formatted array
            $normalized_recipients[] = [
                'phone' => $recipient['phone'],
                'name' => $recipient['name'] ?? 'Contact'
            ];
        } else {
            error_log('TBC Messaging Center API: Invalid recipient format - ' . print_r($recipient, true));
        }
    }
    
    if (empty($normalized_recipients)) {
        error_log('TBC Messaging Center API: No valid recipients provided');
        return false;
    }
    
    // Auto-detect MMS: If media URL provided and send_as_mms not explicitly set
    if ($options['send_as_mms'] === null) {
        $options['send_as_mms'] = !empty($options['media_url']);
    }
    
    // Get global opt-out message from site settings
    $opt_out_message = get_option('tbc_mc_opt_out_message', 
        'Reply NOTXT to stop receiving texts. Reply NOCHURCH to remove your account.');
    
    // Build message data for scheduler
    $message_data = [
        'message' => $message,
        'recipients' => $normalized_recipients,
        'media_url' => $options['media_url'],
        'send_as_mms' => $options['send_as_mms'],
        'include_opt_out' => $options['include_opt_out'],
        'opt_out_message' => $opt_out_message,
        'include_in_log' => $options['include_in_log'],
        'message_title' => $options['message_title']
    ];
    
    // Determine sending mode (immediate, scheduled, or recurring)
    $schedule_time = null;
    $cron_expression = null;
    
    if (!empty($options['cron_expression'])) {
        // Direct cron expression provided
        $cron_expression = $options['cron_expression'];
        
    } elseif (!empty($options['recurring'])) {
        // Use helper to generate cron expression from simple pattern
        $cron_expression = tbc_mc_generate_cron(
            $options['recurring'],
            $options['day'],
            $options['time']
        );
        
        if (!$cron_expression) {
            error_log('TBC Messaging Center API: Invalid recurring pattern - ' . $options['recurring']);
            return false;
        }
        
    } elseif (!$options['send_now'] && !empty($options['schedule_time'])) {
        // Single scheduled send at specific time
        $schedule_time = $options['schedule_time'];
        
        // Validate schedule time is in future
        if ($schedule_time <= time()) {
            error_log('TBC Messaging Center API: schedule_time must be in the future');
            return false;
        }
    }
    // else: send_now = true (immediate send, default behavior)
    
    // Log the API call
    error_log(sprintf(
        'TBC Messaging Center API: Sending message to %d recipients. Title: %s, Mode: %s',
        count($normalized_recipients),
        $options['message_title'],
        $cron_expression ? 'recurring' : ($schedule_time ? 'scheduled' : 'immediate')
    ));
    
    // Call the scheduler
    return tbc_mc_schedule_sms($message_data, $schedule_time, $cron_expression);
}

/**
 * Generate cron expression from simple recurring pattern
 * Helper function for tbc_mc_send_sms()
 * 
 * @param string $type Recurring type: 'daily', 'weekly', 'monthly_first', 'monthly_fifteenth', 'monthly_last', 'monthly_custom'
 * @param int|null $day Day value (0-6 for weekly, 1-31 for monthly_custom)
 * @param string $time Time in HH:MM format
 * @return string|false Cron expression or false on error
 */
function tbc_mc_generate_cron($type, $day = null, $time = '09:00') {
    // Parse time
    $time_parts = explode(':', $time);
    if (count($time_parts) !== 2) {
        error_log('TBC Messaging Center API: Invalid time format - ' . $time);
        return false;
    }
    
    $hour = intval($time_parts[0]);
    $minute = intval($time_parts[1]);
    
    // Validate hour and minute
    if ($hour < 0 || $hour > 23 || $minute < 0 || $minute > 59) {
        error_log('TBC Messaging Center API: Invalid hour/minute - ' . $time);
        return false;
    }
    
    // Generate cron expression based on type
    switch ($type) {
        case 'daily':
            // Every day at specified time
            return "{$minute} {$hour} * * *";
            
        case 'weekly':
            // Weekly on specified day (0=Sunday, 6=Saturday)
            if ($day === null || $day < 0 || $day > 6) {
                error_log('TBC Messaging Center API: Invalid day for weekly - ' . $day);
                return false;
            }
            return "{$minute} {$hour} * * {$day}";
            
        case 'monthly_first':
            // First day of every month
            return "{$minute} {$hour} 1 * *";
            
        case 'monthly_fifteenth':
            // 15th day of every month
            return "{$minute} {$hour} 15 * *";
            
        case 'monthly_last':
            // Last day of every month
            return "{$minute} {$hour} L * *";
            
        case 'monthly_custom':
            // Custom day of month
            if ($day === null || $day < 1 || $day > 31) {
                error_log('TBC Messaging Center API: Invalid day for monthly_custom - ' . $day);
                return false;
            }
            return "{$minute} {$hour} {$day} * *";
            
        default:
            error_log('TBC Messaging Center API: Unknown recurring type - ' . $type);
            return false;
    }
}

/**
 * Check if SMS sending is available
 * Validates that the Messaging Center plugin is active and configured
 * 
 * @return bool True if SMS can be sent
 */
function tbc_mc_available() {
    return function_exists('tbc_mc_schedule_sms') && 
           defined('TWILIO_SID') && 
           defined('TWILIO_TOKEN') &&
           defined('TWILIO_MESSAGING_SERVICE_SID');
}