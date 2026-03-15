<?php
/**
 * Helpers Class
 * Static utility methods for phone formatting, OTP sessions, duplicate checking, and logging.
 *
 * @package TBC_Fluent_Profiles
 */

declare(strict_types=1);

namespace TBCFluentProfiles;

defined('ABSPATH') || exit;

class Helpers {

    /**
     * Format a phone number to E.164 for Twilio.
     *
     * @param string $phone     Raw phone number.
     * @param bool   $clean_html Strip HTML tags and URL-decode first.
     * @return string E.164 formatted phone or empty string on failure.
     */
    public static function format_phone(string $phone, bool $clean_html = false): string {
        if (empty($phone)) {
            return '';
        }

        if ($clean_html) {
            $phone = strip_tags($phone);
            $phone = urldecode($phone);
        }

        // Keep only digits and leading +
        $phone = preg_replace('/[^0-9+]/', '', trim($phone));

        if (empty($phone)) {
            return '';
        }

        // Already E.164
        if (str_starts_with($phone, '+')) {
            return $phone;
        }

        // US: 10-digit -> +1
        if (strlen($phone) === 10) {
            return '+1' . $phone;
        }

        // US: 11-digit starting with 1 -> +
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
     *
     * @param string $phone           E.164 phone number.
     * @param int    $exclude_user_id User ID to exclude (for profile updates).
     */
    public static function is_duplicate(string $phone, int $exclude_user_id = 0): bool {
        if (!self::get_option('restrict_duplicates', false) || empty($phone)) {
            return false;
        }

        global $wpdb;

        $meta_key   = self::get_phone_meta_key();
        $digits     = preg_replace('/[^0-9]/', '', $phone);
        $last_10    = substr($digits, -10);

        if (strlen($last_10) !== 10) {
            return false;
        }

        $query  = "SELECT user_id FROM {$wpdb->usermeta}
                   WHERE meta_key = %s
                     AND meta_value IS NOT NULL
                     AND meta_value != ''
                     AND SUBSTRING(REGEXP_REPLACE(meta_value, '[^0-9]', ''), -10) = %s";
        $params = [$meta_key, $last_10];

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
     * Get the usermeta key used for phone storage.
     *
     * Reads the selected phone field from settings. Values:
     *   - A meta key like '_tbc_fp_phone' — selected from phone fields dropdown.
     *   - 'custom' — use the manual `phone_meta_key_custom` value.
     *   - 'auto' or empty — fallback: first phone-type field from Profile Fields.
     */
    public static function get_phone_meta_key(): string {
        $setting = (string) self::get_option('phone_meta_key', 'auto');

        if ($setting === 'custom') {
            $custom = trim((string) self::get_option('phone_meta_key_custom', ''));
            if ($custom !== '') {
                return $custom;
            }
        }

        // Specific meta key selected from dropdown
        if ($setting !== '' && $setting !== 'auto' && $setting !== 'custom') {
            return $setting;
        }

        // Fallback: first phone-type field
        $phone_fields = self::get_phone_fields();
        return !empty($phone_fields) ? array_key_first($phone_fields) : TBC_FP_META_PREFIX . 'phone';
    }

    /**
     * Get all phone-type fields from Profile Fields.
     *
     * @return array<string, string> Meta key => label pairs.
     */
    public static function get_phone_fields(): array {
        $fields = (new Fields())->get_fields();
        $phone_fields = [];

        foreach ($fields as $key => $field) {
            if (($field['type'] ?? '') === 'phone') {
                $phone_fields[Fields::meta_key($key)] = $field['label'] ?? $key;
            }
        }

        return $phone_fields;
    }

    /**
     * Get a plugin option.
     *
     * @param mixed $default Default value.
     * @return mixed
     */
    public static function get_option(string $key, $default = false) {
        return get_option('tbc_fp_' . $key, $default);
    }

    /**
     * Update a plugin option.
     *
     * @param mixed $value Value to store.
     */
    public static function update_option(string $key, $value): bool {
        return update_option('tbc_fp_' . $key, $value);
    }

    /**
     * Log a message when WP_DEBUG is enabled.
     */
    public static function log(string $message, string $level = 'info'): void {
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log("[TBC FP][{$level}] {$message}");
        }
    }

    /**
     * Generate a unique session key with the given prefix.
     */
    public static function generate_session_key(string $prefix = 'tbc_fp_session_'): string {
        return $prefix . wp_generate_uuid4();
    }

    /**
     * Store an OTP session in a transient.
     *
     * @param array $data Session data.
     */
    public static function store_session(string $key, array $data, int $ttl = 600): void {
        $data['created_at'] = $data['created_at'] ?? time();
        $data['verified']   = $data['verified'] ?? false;
        set_transient($key, $data, $ttl);
        self::log("Session stored: {$key}");
    }

    /**
     * Retrieve an OTP session.
     *
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

    /**
     * Mark a session as verified.
     */
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

    /**
     * Check if a session is verified.
     */
    public static function is_verified(string $key): bool {
        $data = self::get_session($key);
        return is_array($data) && ($data['verified'] ?? false) === true;
    }

    /**
     * Delete a session.
     */
    public static function delete_session(string $key): void {
        delete_transient($key);
        self::log("Session deleted: {$key}");
    }
}
