<?php
/**
 * Push Devices - device token management
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_Push_Devices {

    private static $instance = null;
    private $table_name;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        global $wpdb;
        $this->table_name = $wpdb->prefix . 'tbc_ca_device_tokens';
    }

    /**
     * Register a device token for a user
     */
    public function register($user_id, $token, $platform = 'ios') {
        global $wpdb;

        if (empty($token) || empty($user_id)) {
            return false;
        }

        // Check if token already exists
        $existing = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$this->table_name} WHERE token = %s",
            $token
        ));

        if ($existing) {
            // Update existing token (might be different user)
            return $wpdb->update(
                $this->table_name,
                [
                    'user_id' => $user_id,
                    'platform' => $platform,
                    'updated_at' => current_time('mysql'),
                ],
                ['token' => $token],
                ['%d', '%s', '%s'],
                ['%s']
            );
        }

        // Insert new token
        return $wpdb->insert(
            $this->table_name,
            [
                'user_id' => $user_id,
                'token' => $token,
                'platform' => $platform,
                'created_at' => current_time('mysql'),
                'updated_at' => current_time('mysql'),
            ],
            ['%d', '%s', '%s', '%s', '%s']
        );
    }

    /**
     * Unregister a device token
     */
    public function unregister($token) {
        global $wpdb;

        if (empty($token)) {
            return false;
        }

        return $wpdb->delete(
            $this->table_name,
            ['token' => $token],
            ['%s']
        );
    }

    /**
     * Unregister all tokens for a user
     */
    public function unregister_all_for_user($user_id) {
        global $wpdb;

        return $wpdb->delete(
            $this->table_name,
            ['user_id' => $user_id],
            ['%d']
        );
    }

    /**
     * Get all tokens for a user
     */
    public function get_tokens_for_user($user_id) {
        global $wpdb;

        $results = $wpdb->get_results($wpdb->prepare(
            "SELECT token, platform FROM {$this->table_name} WHERE user_id = %d",
            $user_id
        ), ARRAY_A);

        return $results ?: [];
    }

    /**
     * Get token count for a user
     */
    public function get_token_count($user_id) {
        global $wpdb;

        return (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$this->table_name} WHERE user_id = %d",
            $user_id
        ));
    }

    /**
     * Clean up old/invalid tokens
     */
    public function cleanup_old_tokens($days = 90) {
        global $wpdb;

        $cutoff = date('Y-m-d H:i:s', strtotime("-{$days} days"));

        return $wpdb->query($wpdb->prepare(
            "DELETE FROM {$this->table_name} WHERE updated_at < %s",
            $cutoff
        ));
    }

    /**
     * Remove invalid token (called when Firebase returns invalid)
     */
    public function remove_invalid_token($token) {
        return $this->unregister($token);
    }
}
