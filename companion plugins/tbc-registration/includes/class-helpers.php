<?php
/**
 * Helpers Class
 * Static utility methods for phone formatting, OTP sessions, duplicate checking, and logging.
 *
 * @package TBC_Registration
 */

declare(strict_types=1);

namespace TBCRegistration;

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

        $digits  = preg_replace('/[^0-9]/', '', $phone);
        $last_10 = substr($digits, -10);

        if (strlen($last_10) !== 10) {
            return false;
        }

        $slug  = self::get_phone_slug();
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

    // =========================================================================
    // FC Native Custom Fields (fcom_xprofile.custom_fields JSON)
    // =========================================================================

    /**
     * Get the FC native field slug used for phone storage.
     *
     * Reads from settings. Default: '_phone'.
     */
    public static function get_phone_slug(): string {
        $setting = (string) self::get_option('phone_field_slug', '_phone');
        return !empty($setting) ? $setting : '_phone';
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

    /**
     * Write a single custom field value to fcom_xprofile.custom_fields JSON.
     */
    public static function set_fc_custom_field(int $user_id, string $slug, $value): bool {
        if (!class_exists('FluentCommunity\App\Models\XProfile')) {
            return false;
        }
        $xprofile = \FluentCommunity\App\Models\XProfile::where('user_id', $user_id)->first();
        if (!$xprofile) {
            return false;
        }
        $fields = is_array($xprofile->custom_fields) ? $xprofile->custom_fields : [];
        $fields[$slug] = $value;
        $xprofile->custom_fields = $fields;
        $xprofile->save();
        return true;
    }

    /**
     * Write multiple custom field values to fcom_xprofile.custom_fields JSON.
     * Merges with existing values.
     */
    public static function set_fc_custom_fields(int $user_id, array $values): bool {
        if (!class_exists('FluentCommunity\App\Models\XProfile')) {
            return false;
        }
        $xprofile = \FluentCommunity\App\Models\XProfile::where('user_id', $user_id)->first();
        if (!$xprofile) {
            return false;
        }
        $existing = is_array($xprofile->custom_fields) ? $xprofile->custom_fields : [];
        $xprofile->custom_fields = array_merge($existing, $values);
        $xprofile->save();
        return true;
    }

    /**
     * Get FC native custom profile field definitions.
     *
     * @return array[] Array of field definition arrays (slug, label, type, options, etc.)
     */
    public static function get_fc_field_definitions(): array {
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
     * Get a plugin option.
     *
     * @param mixed $default Default value.
     * @return mixed
     */
    public static function get_option(string $key, $default = false) {
        return get_option('tbc_reg_' . $key, $default);
    }

    /**
     * Update a plugin option.
     *
     * @param mixed $value Value to store.
     */
    public static function update_option(string $key, $value): bool {
        return update_option('tbc_reg_' . $key, $value);
    }

    /**
     * Log a message when WP_DEBUG is enabled.
     */
    public static function log(string $message, string $level = 'info'): void {
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log("[TBC REG][{$level}] {$message}");
        }
    }

    /**
     * Generate a unique session key with the given prefix.
     */
    public static function generate_session_key(string $prefix = 'tbc_reg_session_'): string {
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
