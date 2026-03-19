<?php
/**
 * Helpers Class
 * Static utility methods for phone formatting, OTP sessions, duplicate checking, and logging.
 *
 * @package TBC_OTP
 */

declare(strict_types=1);

namespace TBCOTP;

defined('ABSPATH') || exit;

class Helpers {

    /**
     * Format a phone number to E.164 for Twilio.
     */
    public static function format_phone(string $phone, bool $clean_html = false): string {
        if (empty($phone)) {
            return '';
        }

        if ($clean_html) {
            $phone = strip_tags($phone);
            $phone = urldecode($phone);
        }

        $phone = preg_replace('/[^0-9+]/', '', trim($phone));

        if (empty($phone)) {
            return '';
        }

        if (str_starts_with($phone, '+')) {
            return $phone;
        }

        if (strlen($phone) === 10) {
            return '+1' . $phone;
        }

        if (strlen($phone) === 11 && str_starts_with($phone, '1')) {
            return '+' . $phone;
        }

        return '+' . $phone;
    }

    /**
     * Mask a phone number for display (e.g. +1214***1234).
     */
    public static function mask_phone(string $phone): string {
        $len = strlen($phone);
        if ($len <= 6) {
            return $phone;
        }
        return substr($phone, 0, 4) . str_repeat('*', $len - 8) . substr($phone, -4);
    }

    /**
     * Check if a phone number is already used by another user.
     */
    public static function is_duplicate(string $phone, int $exclude_user_id = 0): bool {
        if (!self::get_option('restrict_duplicates', false) || empty($phone)) {
            return false;
        }

        global $wpdb;

        $digits  = preg_replace('/[^0-9]/', '', $phone);
        $last_10 = substr($digits, -10);

        if (strlen($last_10) !== 10) {
            return false;
        }

        $slug  = self::get_phone_slug();
        if (empty($slug)) {
            return false;
        }
        $table = $wpdb->prefix . 'fcom_xprofile';

        $query  = "SELECT user_id FROM {$table}
                   WHERE custom_fields IS NOT NULL
                     AND JSON_UNQUOTE(JSON_EXTRACT(custom_fields, %s)) IS NOT NULL
                     AND SUBSTRING(REGEXP_REPLACE(JSON_UNQUOTE(JSON_EXTRACT(custom_fields, %s)), '[^0-9]', ''), -10) = %s";
        $json_path = '$.' . $slug;
        $params = [$json_path, $json_path, $last_10];

        if ($exclude_user_id > 0) {
            $query   .= ' AND user_id != %d';
            $params[] = $exclude_user_id;
        }

        $query .= ' LIMIT 1';

        $existing = $wpdb->get_var($wpdb->prepare($query, $params));

        if ($existing) {
            self::log("Duplicate phone detected: {$phone} (last 10: {$last_10}) used by user #{$existing}");
            return true;
        }

        return false;
    }

    /**
     * Check if a phone number is in the blocked list.
     */
    public static function is_blocked(string $phone): bool {
        if (empty($phone)) {
            return false;
        }

        $blocked_raw = self::get_option('blocked_numbers', '');
        if (empty($blocked_raw)) {
            return false;
        }

        $blocked_list = array_filter(array_map('trim', explode("\n", $blocked_raw)));
        if (empty($blocked_list)) {
            return false;
        }

        $formatted = self::format_phone($phone);

        foreach ($blocked_list as $blocked) {
            if (self::format_phone($blocked) === $formatted) {
                self::log("Blocked phone detected: {$formatted}");
                return true;
            }
        }

        return false;
    }

    /**
     * Get the FC native field slug used for phone storage.
     */
    public static function get_phone_slug(): string {
        return (string) self::get_option('phone_field_slug', '');
    }

    /**
     * Get the wp_usermeta key that stores the phone (for password recovery lookup).
     */
    public static function get_phone_meta_key(): string {
        return '_tbc_otp_phone';
    }

    /**
     * Get a user's phone value from FC native custom fields.
     */
    public static function get_phone_value(int $user_id): string {
        return self::get_fc_custom_field($user_id, self::get_phone_slug());
    }

    /**
     * Read a single custom field value from fcom_xprofile.custom_fields JSON.
     */
    public static function get_fc_custom_field(int $user_id, string $slug): string {
        if (!class_exists('FluentCommunity\App\Models\XProfile')) {
            return '';
        }
        $xprofile = \FluentCommunity\App\Models\XProfile::where('user_id', $user_id)->first();
        if (!$xprofile) {
            return '';
        }
        $fields = $xprofile->custom_fields;
        if (!is_array($fields)) {
            return '';
        }
        return (string) ($fields[$slug] ?? '');
    }

    // =========================================================================
    // Options
    // =========================================================================

    public static function get_option(string $key, $default = false) {
        return get_option(TBC_OTP_OPTION_PREFIX . $key, $default);
    }

    public static function update_option(string $key, $value): bool {
        return update_option(TBC_OTP_OPTION_PREFIX . $key, $value);
    }

    // =========================================================================
    // Logging
    // =========================================================================

    public static function log(string $message, string $level = 'info'): void {
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log("[TBC OTP][{$level}] {$message}");
        }
    }

    // =========================================================================
    // Session Management
    // =========================================================================

    public static function generate_session_key(string $prefix = 'tbc_otp_session_'): string {
        return $prefix . wp_generate_uuid4();
    }

    public static function store_session(string $key, array $data, int $ttl = 600): void {
        $data['created_at'] = $data['created_at'] ?? time();
        $data['verified']   = $data['verified'] ?? false;
        set_transient($key, $data, $ttl);
        self::log("Session stored: {$key}");
    }

    /**
     * @return array<string, mixed>|false
     */
    public static function get_session(string $key) {
        if (empty($key)) {
            return false;
        }
        $data = get_transient($key);
        if ($data === false) {
            self::log("Session expired or missing: {$key}");
            return false;
        }
        return $data;
    }

    public static function mark_verified(string $key, int $ttl = 600): bool {
        $data = self::get_session($key);
        if (!$data) {
            return false;
        }
        $data['verified'] = true;
        set_transient($key, $data, $ttl);
        self::log("Session verified: {$key}");
        return true;
    }

    public static function is_verified(string $key): bool {
        $data = self::get_session($key);
        return is_array($data) && ($data['verified'] ?? false) === true;
    }

    public static function delete_session(string $key): void {
        delete_transient($key);
        self::log("Session deleted: {$key}");
    }
}
