<?php
/**
 * Messaging Center Helper Functions
 * Feedback system, phone formatting, and user lookup utilities
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Generate BuddyBoss feedback HTML
 * 
 * @param string $type Feedback type: 'success', 'error', 'notice', 'alert'
 * @param string $message Message to display
 * @return string HTML feedback div with BuddyBoss styling
 */
function tbc_mc_feedback_html($type, $message) {
    return '<div class="bp-feedback ' . esc_attr($type) . '"><span class="bp-icon" aria-hidden="true"></span><p>' . esc_html($message) . '</p></div>';
}

/**
 * Send AJAX feedback response with BuddyBoss styling
 * 
 * @param string $type Feedback type: 'success', 'error', 'notice', 'alert'
 * @param string $message Message to display
 * @param mixed $data Optional additional data to return
 */
function tbc_mc_ajax_feedback($type, $message, $data = null) {
    wp_send_json_success([
        'html' => tbc_mc_feedback_html($type, $message),
        'data' => $data
    ]);
}

/**
 * Get and clean phone number from BuddyBoss profile
 * 
 * @param int $user_id User ID
 * @return string Formatted phone number in E.164 format (+15551234567)
 */
function tbc_mc_get_phone_from_profile($user_id) {
    if (!function_exists('bp_get_profile_field_data')) {
        return '';
    }
    
    // Get phone from BuddyBoss profile field (field ID 4)
    $phone_raw = bp_get_profile_field_data(array(
        'field' => 4,
        'user_id' => $user_id
    ));
    
    // Format with HTML cleaning enabled for profile data
    return tbc_mc_format_phone($phone_raw, true);
}

/**
 * Find user ID by phone number (reverse lookup)
 * 
 * @param string $phone_number Phone number to search for
 * @return int|null User ID if found, null otherwise
 */
function tbc_mc_get_user_by_phone($phone_number) {
    global $wpdb;
    
    $formatted_search_number = tbc_mc_format_phone($phone_number);
    
    if (empty($formatted_search_number)) {
        return null;
    }
    
    // Query BuddyBoss profile data for Phone field
    $user_query = "
        SELECT b.user_id, b.value as phone_value
        FROM {$wpdb->prefix}bp_xprofile_fields AS a
        JOIN {$wpdb->prefix}bp_xprofile_data AS b ON a.id = b.field_id
        WHERE a.name = 'Phone'
    ";
    
    $users_with_phones = $wpdb->get_results($user_query);
    
    // Compare formatted phone numbers to find match
    foreach ($users_with_phones as $user_phone) {
        $db_phone_formatted = tbc_mc_format_phone($user_phone->phone_value, true);
        if ($db_phone_formatted === $formatted_search_number) {
            return (int) $user_phone->user_id;
        }
    }
    
    return null;
}

/**
 * Format phone number to E.164 format for Twilio
 * Handles all phone formatting needs across the plugin
 *
 * @param string $phone_number Raw phone number
 * @param bool $clean_html Whether to strip HTML and decode (for profile data)
 * @return string Phone number in E.164 format (+15551234567)
 */
function tbc_mc_format_phone($phone_number, $clean_html = false) {
    if (empty($phone_number)) {
        return '';
    }
    
    $phone = $phone_number;
    
    // Enhanced cleaning for profile data that might contain HTML/encoded data
    if ($clean_html) {
        $phone = strip_tags($phone);
        $phone = urldecode($phone);
        
        // Extract phone number from formatted text (handles BuddyBoss profile data)
        preg_match('/\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})/', $phone, $matches);
        if (isset($matches[0])) {
            $phone = $matches[0];
        }
    }
    
    // Remove all non-numeric characters except +
    $phone = preg_replace('/[^0-9+]/', '', trim($phone));
    
    // If it already starts with +, assume it's properly formatted
    if (strpos($phone, '+') === 0) {
        return $phone;
    }
    
    // Handle common US cases (assume US if no country code)
    if (strlen($phone) === 10) {
        // 10 digits = US number without country code
        return '+1' . $phone;
    } elseif (strlen($phone) === 11 && substr($phone, 0, 1) === '1') {
        // 11 digits starting with 1 = US number with country code
        return '+' . $phone;
    } else {
        // Other cases - prepend + if not present
        return '+' . $phone;
    }
}