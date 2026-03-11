# TBC Messaging Center API Integration Guide

## Overview
Your BuddyBoss TBC Messaging Center is structured as an API that external plugins can leverage for SMS/MMS functionality, scheduling, logging, and Twilio integration.

---

## Prerequisites

### 1. Check if TBC Messaging Center is Active
```php
if (!function_exists('tbc_mc_send_sms_batch')) {
    // TBC Messaging Center not active
    return;
}
```

### 2. Ensure Dependencies
The SMS plugin must be loaded before your plugin. Add this to your plugin header:
```php
/**
 * Plugin Name: Your Plugin Name
 * Depends: TBC - Messaging Center
 */
```

---

## Core API Functions

### 1. Send Immediate SMS/MMS

#### `tbc_mc_send_sms_batch($message, $recipients, $mediaUrl = '', $send_as_mms = false)`

**Location:** `/includes/sms-twilio-functions.php`

**Parameters:**
- `$message` (string) - Message body. Use `{name}` merge tag for personalization
- `$recipients` (array) - Array of recipient objects with 'name' and 'phone' keys
- `$mediaUrl` (string) - Optional media URL for MMS
- `$send_as_mms` (bool) - Force send as MMS even without media

**Returns:** Array of feedback messages with 'type' and 'message' keys

**Example:**
```php
$recipients = [
    ['name' => 'John Doe', 'phone' => '+15551234567'],
    ['name' => 'Jane Smith', 'phone' => '555-987-6543']
];

$message = "Hello {name}, this is a test message!";
$media_url = 'https://example.com/image.jpg'; // Optional

$results = tbc_mc_send_sms_batch($message, $recipients, $media_url, false);

foreach ($results as $result) {
    if ($result['type'] === 'success') {
        error_log($result['message']);
    } else {
        error_log('ERROR: ' . $result['message']);
    }
}
```

---

### 2. Schedule SMS Messages

#### `tbc_mc_schedule_sms($message_data, $schedule_time = null, $cron_expression = null)`

**Location:** `/includes/scheduler-functions.php`

**Parameters:**
- `$message_data` (array) - Complete message configuration
- `$schedule_time` (int|null) - Unix timestamp for future send (null = immediate)
- `$cron_expression` (string|null) - Cron expression for recurring messages

**Message Data Structure:**
```php
$message_data = [
    'message'          => 'Your message text with {name} merge tag',
    'message_title'    => 'Optional title for logging',
    'recipients'       => $recipients_array, // Same format as tbc_mc_send_sms_batch
    'media_url'        => '', // Optional MMS media URL
    'send_as_mms'      => false, // Force MMS
    'include_opt_out'  => true, // Append opt-out text
    'opt_out_message'  => 'Reply NOTXT to opt out',
    'include_in_log'   => true // Log in message center
];
```

**Examples:**

**Immediate Send:**
```php
$message_data = [
    'message' => 'Hello {name}!',
    'recipients' => $recipients,
    'include_opt_out' => true
];

$parent_id = tbc_mc_schedule_sms($message_data);
// Returns parent_id for tracking all chunks
```

**Scheduled Send (Future):**
```php
$send_time = strtotime('+1 hour'); // Send in 1 hour

$parent_id = tbc_mc_schedule_sms($message_data, $send_time);
```

**Recurring Send (Cron):**
```php
// Send every day at 9 AM
$cron = '0 9 * * *';

$parent_id = tbc_mc_schedule_sms($message_data, null, $cron);
```

**Cron Expression Examples:**
- `*/5 * * * *` - Every 5 minutes
- `0 9 * * *` - Daily at 9 AM
- `0 9 * * 1` - Every Monday at 9 AM
- `0 0 1 * *` - First day of every month at midnight

---

## Helper Functions

### Phone Number Formatting

#### `tbc_mc_format_phone($phone_number, $clean_html = false)`

**Location:** `/includes/helper-sms.php`

Converts any phone format to E.164 format (+15551234567).

```php
$formatted = tbc_mc_format_phone('(555) 123-4567');
// Returns: +15551234567

$formatted = tbc_mc_format_phone('5551234567');
// Returns: +15551234567
```

**Use `$clean_html = true` for BuddyBoss profile data:**
```php
$phone = tbc_mc_get_phone_from_profile($user_id);
```

---

### User Lookup

#### `tbc_mc_get_user_by_phone($phone_number)`

**Location:** `/includes/helper-sms.php`

Find WordPress user ID by phone number.

```php
$user_id = tbc_mc_get_user_by_phone('+15551234567');

if ($user_id) {
    $user = get_user_by('id', $user_id);
    echo "Found: " . $user->display_name;
}
```

---

### BuddyBoss Phone Retrieval

#### `tbc_mc_get_phone_from_profile($user_id)`

**Location:** `/includes/helper-sms.php`

Get formatted phone from BuddyBoss profile field #4.

```php
$phone = tbc_mc_get_phone_from_profile($user_id);

if (!empty($phone)) {
    // Phone is already in E.164 format
    $recipients[] = [
        'name' => $user->display_name,
        'phone' => $phone
    ];
}
```

---

### Feedback System

#### `tbc_mc_feedback_html($type, $message)`

**Location:** `/includes/helper-sms.php`

Generate BuddyBoss-styled feedback HTML.

```php
echo tbc_mc_feedback_html('success', 'Message sent!');
echo tbc_mc_feedback_html('error', 'Failed to send');
echo tbc_mc_feedback_html('notice', 'Please wait...');
```

#### `tbc_mc_ajax_feedback($type, $message, $data = null)`

**Location:** `/includes/helper-sms.php`

Send AJAX response with BuddyBoss styling.

```php
add_action('wp_ajax_my_action', 'my_ajax_handler');

function my_ajax_handler() {
    // Process request
    
    if ($success) {
        tbc_mc_ajax_feedback('success', 'Action completed!', ['id' => 123]);
    } else {
        tbc_mc_ajax_feedback('error', 'Something went wrong');
    }
}
```

---

## Twilio Configuration

### Access Twilio Credentials

**Location:** `/includes/sms-twilio-functions.php`

```php
// Direct access to constants
$sid = TWILIO_SID;
$token = TWILIO_TOKEN;
$messaging_service_sid = TWILIO_MESSAGING_SERVICE_SID;

// Get configured Twilio client
$client = tbc_mc_get_twilio_client();

// Use client for custom Twilio operations
try {
    $message = $client->messages->create(
        '+15551234567',
        [
            'from' => '+15559876543',
            'body' => 'Custom message'
        ]
    );
} catch (Exception $e) {
    error_log('Twilio error: ' . $e->getMessage());
}
```

---

## Database Access

### Message Center Table

**Table:** `{$wpdb->prefix}tbc_mc_messages`

**Structure:**
```sql
id (mediumint)
type (varchar) - 'sms' or 'voicemail'
sender_number (varchar) - E.164 format
content (text) - Message body or transcription
date_created (datetime)
media_url (text) - Comma-separated URLs
notes (text)
marked (tinyint) - 0 or 1
is_read (tinyint) - 0 or 1
is_reply (tinyint) - 0 or 1
```

**Query Examples:**

**Get Recent SMS:**
```php
global $wpdb;
$table = $wpdb->prefix . 'tbc_mc_messages';

$messages = $wpdb->get_results("
    SELECT * FROM $table 
    WHERE type = 'sms' 
    ORDER BY date_created DESC 
    LIMIT 50
");
```

**Insert SMS Log:**
```php
global $wpdb;
$table = $wpdb->prefix . 'tbc_mc_messages';

$wpdb->insert($table, [
    'type'          => 'sms',
    'sender_number' => '+15551234567',
    'content'       => 'Message text',
    'date_created'  => current_time('mysql'),
    'media_url'     => '',
    'is_read'       => 0,
    'is_reply'      => 1
]);

$message_id = $wpdb->insert_id;
```

---

### Scheduler Batches Table

**Table:** `{$wpdb->prefix}tbc_mc_scheduler_batches`

**Structure:**
```sql
batch_id (varchar) - UUID
parent_id (varchar) - Groups related chunks
chunk_index (int) - Chunk number (0-based)
total_chunks (int) - Total chunks for this parent
message (text)
message_title (varchar)
recipients (longtext) - JSON array
media_url (text)
send_as_mms (tinyint)
include_opt_out (tinyint)
opt_out_message (text)
include_in_log (tinyint)
created_date (datetime)
status (varchar) - 'pending', 'completed', 'failed'
processed_at (datetime)
error_message (text)
schedule_type (varchar) - 'immediate', 'scheduled', 'recurring'
cron_expression (varchar)
action_scheduler_id (bigint) - Links to Action Scheduler
```

**Query Examples:**

**Get Scheduled Messages:**
```php
global $wpdb;
$table = $wpdb->prefix . 'tbc_mc_scheduler_batches';

$scheduled = $wpdb->get_results("
    SELECT * FROM $table 
    WHERE schedule_type = 'scheduled' 
    AND status = 'pending'
    ORDER BY created_date ASC
");
```

**Get Recurring Messages:**
```php
$recurring = $wpdb->get_results("
    SELECT * FROM $table 
    WHERE schedule_type = 'recurring'
    GROUP BY parent_id
");
```

---

## WordPress Hooks

### Available Actions

The plugin uses WordPress Action Scheduler. You can hook into these:

**Before Send:**
```php
add_action('execute_sms_send', 'my_before_sms_send', 5, 1);

function my_before_sms_send($batch_id) {
    $batch = get_sms_batch($batch_id);
    // Modify or log before send
}
```

**After Group Settings Update:**
```php
add_action('bp_group_admin_edit_after', 'my_after_group_update', 20, 1);

function my_after_group_update($group_id) {
    $sms_permission = groups_get_groupmeta($group_id, 'sms_permission');
    // React to permission changes
}
```

---

## REST API Endpoints

### Incoming SMS Webhook

**Endpoint:** `/wp-json/tbc-mc/v1/incoming-sms`  
**Method:** POST  
**Handler:** `handle_incoming_sms()` in `/includes/helper-incoming-messages.php`

**Twilio Configuration:**
Configure in Twilio Console â†’ Phone Numbers â†’ Your Number â†’ Messaging â†’ Webhook URL

**Incoming Data Processing:**
```php
add_action('rest_api_init', function() {
    register_rest_route('my-plugin/v1', '/sms-received', [
        'methods' => 'POST',
        'callback' => 'my_sms_handler',
        'permission_callback' => '__return_true'
    ]);
});

function my_sms_handler(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'tbc_mc_messages';
    
    // Get recent SMS from last 5 minutes
    $recent = $wpdb->get_results($wpdb->prepare("
        SELECT * FROM $table 
        WHERE type = 'sms' 
        AND date_created > %s
        ORDER BY date_created DESC
    ", date('Y-m-d H:i:s', strtotime('-5 minutes'))));
    
    // Process messages
    foreach ($recent as $sms) {
        // Your custom logic
    }
    
    return new WP_REST_Response(['status' => 'processed'], 200);
}
```

---

## Practical Examples

### Example 1: Send Birthday SMS to Group Members

```php
function send_birthday_sms($group_id) {
    // Get group members
    $members = groups_get_group_members([
        'group_id' => $group_id,
        'exclude_admins_mods' => false
    ]);
    
    $recipients = [];
    
    foreach ($members['members'] as $member) {
        $phone = tbc_mc_get_phone_from_profile($member->ID);
        
        if (!empty($phone)) {
            $recipients[] = [
                'name' => $member->display_name,
                'phone' => $phone
            ];
        }
    }
    
    if (empty($recipients)) {
        return false;
    }
    
    $message_data = [
        'message' => 'Happy Birthday {name}! ðŸŽ‰',
        'message_title' => 'Birthday Greetings',
        'recipients' => $recipients,
        'include_opt_out' => true,
        'include_in_log' => true
    ];
    
    return tbc_mc_schedule_sms($message_data);
}
```

---

### Example 2: Weekly Digest (Recurring)

```php
function setup_weekly_digest() {
    $group_id = 123;
    
    // Get all group members
    $members = groups_get_group_members([
        'group_id' => $group_id
    ]);
    
    $recipients = [];
    
    foreach ($members['members'] as $member) {
        $phone = tbc_mc_get_phone_from_profile($member->ID);
        
        if (!empty($phone)) {
            $recipients[] = [
                'name' => $member->display_name,
                'phone' => $phone
            ];
        }
    }
    
    $message_data = [
        'message' => 'Hi {name}! Here\'s your weekly update...',
        'message_title' => 'Weekly Digest',
        'recipients' => $recipients,
        'include_opt_out' => true,
        'include_in_log' => true
    ];
    
    // Send every Monday at 9 AM
    $cron = '0 9 * * 1';
    
    return tbc_mc_schedule_sms($message_data, null, $cron);
}
```

---

### Example 3: Event Reminder (Scheduled)

```php
function send_event_reminder($event_id) {
    $event = get_post($event_id);
    $event_time = get_post_meta($event_id, 'event_datetime', true);
    
    // Send reminder 24 hours before
    $send_time = strtotime($event_time) - (24 * 60 * 60);
    
    // Get attendees
    $attendees = get_post_meta($event_id, 'attendees', true);
    
    $recipients = [];
    
    foreach ($attendees as $user_id) {
        $phone = tbc_mc_get_phone_from_profile($user_id);
        $user = get_user_by('id', $user_id);
        
        if (!empty($phone)) {
            $recipients[] = [
                'name' => $user->display_name,
                'phone' => $phone
            ];
        }
    }
    
    $message_data = [
        'message' => 'Hi {name}! Reminder: ' . $event->post_title . ' is tomorrow!',
        'message_title' => 'Event Reminder: ' . $event->post_title,
        'recipients' => $recipients,
        'include_opt_out' => false, // No opt-out for transactional
        'include_in_log' => true
    ];
    
    return tbc_mc_schedule_sms($message_data, $send_time);
}
```

---

### Example 4: Process Incoming SMS with Keywords

```php
// Hook into incoming message handler
add_action('rest_api_init', function() {
    add_filter('sms_process_incoming_before_save', 'my_keyword_processor', 10, 1);
});

function my_keyword_processor($sms_data) {
    $message_lower = strtolower($sms_data['Body']);
    $from_phone = tbc_mc_format_phone($sms_data['From']);
    
    // Check for custom keywords
    if (strpos($message_lower, 'join') !== false) {
        $user_id = tbc_mc_get_user_by_phone($from_phone);
        
        if ($user_id) {
            // Add to specific group
            groups_join_group(123, $user_id);
            
            // Send confirmation
            $recipients = [[
                'name' => get_user_by('id', $user_id)->display_name,
                'phone' => $from_phone
            ]];
            
            tbc_mc_send_sms_batch(
                'Welcome! You\'ve joined the group.',
                $recipients
            );
        }
    }
    
    return $sms_data; // Must return for processing to continue
}
```

---

### Example 5: Send MMS with Image

```php
function send_mms_with_image($group_id, $attachment_id) {
    $members = groups_get_group_members([
        'group_id' => $group_id
    ]);
    
    $recipients = [];
    
    foreach ($members['members'] as $member) {
        $phone = tbc_mc_get_phone_from_profile($member->ID);
        
        if (!empty($phone)) {
            $recipients[] = [
                'name' => $member->display_name,
                'phone' => $phone
            ];
        }
    }
    
    // Get image URL from attachment
    $media_url = wp_get_attachment_url($attachment_id);
    
    $message = "Check out this photo, {name}!";
    
    // Send immediately
    return tbc_mc_send_sms_batch($message, $recipients, $media_url, true);
}
```

---

## Debugging

### Enable Logging

The plugin uses `error_log()` extensively. Enable WordPress debug logging:

```php
// wp-config.php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);
```

View logs: `/wp-content/debug.log`

---

### Test Scheduled Messages

```php
// Check Action Scheduler queue
if (function_exists('as_get_scheduled_actions')) {
    $scheduled = as_get_scheduled_actions([
        'group' => 'sms_sends',
        'status' => 'pending'
    ]);
    
    foreach ($scheduled as $action) {
        error_log('Scheduled: ' . print_r($action->get_args(), true));
    }
}
```

---

### Verify Batch Status

```php
global $wpdb;
$table = $wpdb->prefix . 'tbc_mc_scheduler_batches';

$batches = $wpdb->get_results("
    SELECT parent_id, status, COUNT(*) as chunk_count
    FROM $table
    WHERE created_date > DATE_SUB(NOW(), INTERVAL 1 DAY)
    GROUP BY parent_id, status
");

foreach ($batches as $batch) {
    error_log("Parent: {$batch->parent_id} - Status: {$batch->status} - Chunks: {$batch->chunk_count}");
}
```

---

## Best Practices

### 1. Always Format Phone Numbers
```php
// GOOD
$phone = tbc_mc_format_phone($user_input);

// BAD
$phone = $user_input; // May not be E.164
```

### 2. Handle Empty Recipients
```php
if (empty($recipients)) {
    error_log('No valid recipients found');
    return false;
}
```

### 3. Use Descriptive Message Titles
```php
$message_data = [
    'message_title' => 'Event Reminder - ' . $event->post_title, // GOOD
    'message_title' => 'Message', // BAD
    // ...
];
```

### 4. Respect Opt-Out for Marketing
```php
// Marketing message
$message_data = [
    'include_opt_out' => true, // GOOD
    // ...
];

// Transactional message (password reset, order confirmation)
$message_data = [
    'include_opt_out' => false, // GOOD
    // ...
];
```

### 5. Use Scheduling for Large Batches
```php
// For 1000+ recipients, use scheduler (automatic chunking)
tbc_mc_schedule_sms($message_data);

// Don't use direct send for large lists
// tbc_mc_send_sms_batch($message, $huge_list); // BAD
```

---

## Error Handling

### Wrap in Try-Catch
```php
try {
    $parent_id = tbc_mc_schedule_sms($message_data);
    
    if (!$parent_id) {
        throw new Exception('Failed to schedule SMS');
    }
    
    return $parent_id;
    
} catch (Exception $e) {
    error_log('SMS Scheduling Error: ' . $e->getMessage());
    return false;
}
```

### Check Function Existence
```php
if (!function_exists('tbc_mc_schedule_sms')) {
    wp_die('TBC Messaging Center is required for this feature.');
}
```

---

## Security Considerations

### 1. Validate User Permissions
```php
if (!current_user_can('manage_options')) {
    wp_die('Insufficient permissions');
}
```

### 2. Sanitize Inputs
```php
$message = sanitize_textarea_field($_POST['message']);
$phone = sanitize_text_field($_POST['phone']);
```

### 3. Use Nonces
```php
if (!wp_verify_nonce($_POST['nonce'], 'send_sms_action')) {
    wp_die('Invalid nonce');
}
```

### 4. Rate Limiting
```php
$user_id = get_current_user_id();
$sent_today = get_user_meta($user_id, 'sms_sent_today', true);

if ($sent_today >= 50) {
    wp_die('Daily SMS limit reached');
}

update_user_meta($user_id, 'sms_sent_today', $sent_today + 1);
```

---

## Constants Reference

```php
TBC_MC_URL         // Plugin directory URL
TBC_MC_VERSION     // Current version number
TWILIO_SID            // Twilio Account SID
TWILIO_TOKEN          // Twilio Auth Token
TWILIO_MESSAGING_SERVICE_SID // Messaging Service SID
```

---

## Quick Reference Table

| Function | Purpose | Returns |
|----------|---------|---------|
| `tbc_mc_send_sms_batch()` | Send immediate SMS/MMS | Array of results |
| `tbc_mc_schedule_sms()` | Schedule SMS (immediate/future/recurring) | Parent ID (UUID) |
| `tbc_mc_format_phone()` | Convert phone to E.164 | Formatted string |
| `tbc_mc_get_user_by_phone()` | Find user by phone | User ID or null |
| `tbc_mc_get_phone_from_profile()` | Get phone from profile | Formatted phone |
| `tbc_mc_feedback_html()` | Generate feedback HTML | HTML string |
| `tbc_mc_ajax_feedback()` | Send AJAX response | Exits script |
| `tbc_mc_get_twilio_client()` | Get Twilio SDK client | Twilio\Rest\Client |

---

## Support & Troubleshooting

### Common Issues

**Issue: Messages not sending**
- Check Twilio credentials are correct
- Verify phone numbers are in E.164 format
- Check WordPress cron is running: `wp cron test`
- Review debug.log for errors

**Issue: Scheduled messages not processing**
- Verify Action Scheduler is active
- Check WP Cron is working
- Review `wp_actionscheduler_actions` table

**Issue: Incoming SMS not logging**
- Verify Twilio webhook URL is configured
- Check REST API is accessible
- Test endpoint: `curl -X POST https://yoursite.com/wp-json/tbc-mc/v1/incoming-sms`

---

## Version Compatibility

- WordPress: 5.8+
- BuddyBoss Platform: 2.0+
- PHP: 7.4+
- Action Scheduler: Bundled with WooCommerce or install separately

---

## Additional Resources

- Twilio PHP SDK: https://www.twilio.com/docs/libraries/php
- Action Scheduler Docs: https://actionscheduler.org/
- Cron Expression Generator: https://crontab.guru/

---

**Last Updated:** 2025-01-27  
**Plugin Version:** 2.0