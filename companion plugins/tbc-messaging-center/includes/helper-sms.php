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
 * Generate feedback HTML
 *
 * @param string $type Feedback type: 'success', 'error', 'notice', 'alert'
 * @param string $message Message to display
 * @return string HTML feedback div
 */
function tbc_mc_feedback_html($type, $message) {
    return '<div class="tbc-mc-feedback ' . esc_attr($type) . '"><p>' . esc_html($message) . '</p></div>';
}

/**
 * Send AJAX feedback response
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
 * Get and clean phone number from user profile
 * Uses tbc-fluent-profiles phone meta key
 *
 * @param int $user_id User ID
 * @return string Formatted phone number in E.164 format (+15551234567)
 */
function tbc_mc_get_phone_from_profile($user_id) {
    if (class_exists('TBCFluentProfiles\Helpers')) {
        $meta_key = \TBCFluentProfiles\Helpers::get_phone_meta_key();
        $phone_raw = get_user_meta($user_id, $meta_key, true);
        return tbc_mc_format_phone($phone_raw, true);
    }
    return '';
}

/**
 * Find user ID by phone number (reverse lookup)
 * Queries wp_usermeta using tbc-fluent-profiles phone meta key
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

    $meta_key = '_tbc_fp_phone';
    if (class_exists('TBCFluentProfiles\Helpers')) {
        $meta_key = \TBCFluentProfiles\Helpers::get_phone_meta_key();
    }

    $users_with_phones = $wpdb->get_results($wpdb->prepare(
        "SELECT user_id, meta_value FROM {$wpdb->usermeta} WHERE meta_key = %s AND meta_value != ''",
        $meta_key
    ));

    foreach ($users_with_phones as $row) {
        $db_phone_formatted = tbc_mc_format_phone($row->meta_value, true);
        if ($db_phone_formatted === $formatted_search_number) {
            return (int) $row->user_id;
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
        
        // Extract phone number from formatted text
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