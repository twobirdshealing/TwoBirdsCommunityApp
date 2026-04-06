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
 * Get and clean phone number from user profile.
 * Reads from FC 2.3.0 native custom_fields JSON via the configured phone field slug.
 * Falls back to old _tbc_fp_phone usermeta if FC lookup fails.
 *
 * @param int $user_id User ID
 * @return string Formatted phone number in E.164 format (+15551234567)
 */
function tbc_mc_get_phone_from_profile($user_id) {
    // Primary: FC native custom_fields
    $slug = get_option('tbc_mc_phone_field_slug', '');
    if ($slug && class_exists('FluentCommunity\App\Models\XProfile')) {
        try {
            $xp = \FluentCommunity\App\Models\XProfile::where('user_id', $user_id)->first();
            if ($xp) {
                $fields = $xp->custom_fields;
                if (is_array($fields) && !empty($fields[$slug])) {
                    return tbc_mc_format_phone($fields[$slug], true);
                }
            }
        } catch (\Exception $e) {
            // fall through to usermeta fallback
        }
    }

    // Fallback: old usermeta (pre-migration)
    $phone_raw = get_user_meta($user_id, '_tbc_fp_phone', true);
    if ($phone_raw) {
        return tbc_mc_format_phone($phone_raw, true);
    }

    return '';
}

/**
 * Find user ID by phone number (reverse lookup).
 * Searches FC 2.3.0 native custom_fields JSON via configured phone field slug.
 * Falls back to old _tbc_fp_phone usermeta if FC lookup fails.
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

    // Primary: FC native custom_fields JSON
    $slug = get_option('tbc_mc_phone_field_slug', '');
    if ($slug && class_exists('FluentCommunity\App\Models\XProfile')) {
        $table     = $wpdb->prefix . 'fcom_xprofile';
        $json_path = '$.' . $slug;

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT user_id, JSON_UNQUOTE(JSON_EXTRACT(custom_fields, %s)) as phone
             FROM {$table}
             WHERE custom_fields IS NOT NULL
               AND JSON_EXTRACT(custom_fields, %s) IS NOT NULL",
            $json_path, $json_path
        ));

        foreach ($rows as $row) {
            $db_phone_formatted = tbc_mc_format_phone($row->phone, true);
            if ($db_phone_formatted === $formatted_search_number) {
                return (int) $row->user_id;
            }
        }
    }

    // Fallback: old usermeta (pre-migration)
    $users_with_phones = $wpdb->get_results($wpdb->prepare(
        "SELECT user_id, meta_value FROM {$wpdb->usermeta} WHERE meta_key = %s AND meta_value != ''",
        '_tbc_fp_phone'
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
 * Get FC native custom field definitions (for settings dropdowns).
 * Queries fcom_meta for custom_profile_fields config.
 *
 * @return array Field definitions
 */
function tbc_mc_get_fc_field_definitions() {
    if (!class_exists('FluentCommunity\App\Models\Meta')) {
        return [];
    }
    $meta = \FluentCommunity\App\Models\Meta::where('object_type', 'option')
        ->where('meta_key', 'custom_profile_fields')
        ->first();
    if (!$meta) {
        return [];
    }
    $config = $meta->value;
    return $config['fields'] ?? [];
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