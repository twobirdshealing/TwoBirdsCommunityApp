<?php
/**
 * Push Notifications - sends notifications via Expo Push API
 *
 * Uses Expo Push API to send push notifications to Expo Push Tokens.
 * Expo API: https://exp.host/--/api/v2/push/send
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_Push_Firebase {

    private static $instance = null;
    private $expo_url = 'https://exp.host/--/api/v2/push/send';

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {}

    /**
     * Send push notification to a user
     *
     * @param int    $user_id The user ID
     * @param string $type    Notification type ID
     * @param array  $data    Notification data (title, body, data)
     * @return array Results of send attempts
     */
    public function send($user_id, $type, $data) {
        $preferences = TBC_CA_Push_Preferences::get_instance();
        $devices = TBC_CA_Push_Devices::get_instance();

        $data['badge'] = $this->get_unread_count($user_id);

        if (!$preferences->is_enabled_for_user($user_id, $type)) {
            return ['skipped' => 'user_disabled'];
        }

        $tokens = $devices->get_tokens_for_user($user_id);
        if (empty($tokens)) {
            return ['skipped' => 'no_devices'];
        }

        $results = [];

        foreach ($tokens as $device) {
            $result = $this->send_to_token($device['token'], $data, $device['platform']);
            $results[] = [
                'token' => substr($device['token'], 0, 20) . '...',
                'platform' => $device['platform'],
                'success' => $result['success'],
                'error' => $result['error'] ?? null,
            ];

            if (!$result['success'] && !empty($result['invalid_token'])) {
                $devices->remove_invalid_token($device['token']);
            }
        }

        return $results;
    }

    /**
     * Send notification to a specific token using Expo Push API
     */
    private function send_to_token($token, $data, $platform = 'ios') {
        $title = $data['title'] ?? '';
        $body = $data['body'] ?? '';
        $custom_data = $data['data'] ?? [];

        // Build Expo Push API payload
        $payload = [
            'to' => $token,
            'title' => $title,
            'body' => $body,
            'sound' => 'default',
            'badge' => $data['badge'] ?? 0,
        ];

        // Add data payload if present
        if (!empty($custom_data)) {
            $payload['data'] = $custom_data;
        }

        if ($platform === 'android') {
            $payload['channelId'] = 'default';
            $payload['priority'] = 'high';
        }

        $response = wp_remote_post($this->expo_url, [
            'headers' => [
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ],
            'body' => json_encode($payload),
            'timeout' => 15,
        ]);

        if (is_wp_error($response)) {
            return [
                'success' => false,
                'error' => $response->get_error_message(),
            ];
        }

        $status_code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($status_code === 200 && isset($body['data']['status'])) {
            $push_data = $body['data'];

            if ($push_data['status'] === 'ok') {
                return ['success' => true];
            }

            $error_details = $push_data['details'] ?? null;
            $invalid_token = isset($error_details['error'])
                && in_array($error_details['error'], ['DeviceNotRegistered', 'InvalidCredentials'], true);

            return [
                'success' => false,
                'error' => $push_data['message'] ?? 'Unknown Expo error',
                'invalid_token' => $invalid_token,
            ];
        }

        return [
            'success' => false,
            'error' => 'Unexpected response from Expo',
        ];
    }

    /**
     * Process a queue of notifications using batch Expo API
     *
     * Each queue item: ['user_id' => int, 'type' => string, 'title' => string, 'body' => string, 'route' => string|null]
     *
     * @param array $queue Array of queued notification items
     * @param bool  $force If true, skip user preference check (for manual sends)
     * @return array Results
     */
    public function send_queued_notifications($queue, $force = false) {
        if (empty($queue)) {
            return [];
        }

        $preferences = TBC_CA_Push_Preferences::get_instance();
        $devices = TBC_CA_Push_Devices::get_instance();

        // Build payloads: check preferences, collect tokens, build Expo messages
        $payloads = [];
        $payload_meta = []; // Track token for each payload for invalid token cleanup
        $badge_cache = []; // Cache unread counts per user to avoid duplicate queries

        foreach ($queue as $item) {
            $user_id = $item['user_id'] ?? null;
            $type = $item['type'] ?? '';

            if (!$user_id || !$type) {
                continue;
            }

            // Check preference (skip for forced/manual sends)
            if (!$force && !$preferences->is_enabled_for_user($user_id, $type)) {
                continue;
            }

            // Get device tokens
            $tokens = $devices->get_tokens_for_user($user_id);
            if (empty($tokens)) {
                continue;
            }

            // Build data payload
            $data_payload = [];
            if (!empty($item['route'])) {
                $data_payload['route'] = $item['route'];
            }

            // Get unread count for badge (cached per user)
            if (!isset($badge_cache[$user_id])) {
                $badge_cache[$user_id] = $this->get_unread_count($user_id);
            }

            // One Expo message per device token
            foreach ($tokens as $device) {
                $payload = [
                    'to' => $device['token'],
                    'title' => $item['title'] ?? '',
                    'body' => $item['body'] ?? '',
                    'sound' => 'default',
                    'badge' => $badge_cache[$user_id],
                ];

                if (!empty($data_payload)) {
                    $payload['data'] = $data_payload;
                }

                if ($device['platform'] === 'android') {
                    $payload['channelId'] = 'default';
                    $payload['priority'] = 'high';
                }

                $payloads[] = $payload;
                $payload_meta[] = ['token' => $device['token']];
            }
        }

        if (empty($payloads)) {
            return [];
        }

        // Send in chunks of 100 (Expo limit)
        $all_results = [];
        $chunks = array_chunk($payloads, 100);
        $meta_chunks = array_chunk($payload_meta, 100);

        foreach ($chunks as $chunk_index => $chunk) {
            $meta_chunk = $meta_chunks[$chunk_index];
            $result = $this->send_batch($chunk);

            // Process batch response for invalid tokens
            if (isset($result['results']) && is_array($result['results'])) {
                foreach ($result['results'] as $i => $item_result) {
                    if (!$item_result['success'] && !empty($item_result['invalid_token']) && isset($meta_chunk[$i])) {
                        $devices->remove_invalid_token($meta_chunk[$i]['token']);
                    }
                }
            }

            $all_results[] = $result;
        }

        return $all_results;
    }

    /**
     * Send a batch of Expo push payloads in a single HTTP request
     *
     * @param array $payloads Array of Expo push message objects (max 100)
     * @return array ['success' => bool, 'sent' => int, 'errors' => int, 'results' => array]
     */
    public function send_batch($payloads) {
        if (empty($payloads)) {
            return ['success' => false, 'error' => 'empty_payloads'];
        }

        $response = wp_remote_post($this->expo_url, [
            'headers' => [
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ],
            'body' => json_encode($payloads),
            'timeout' => 30,
        ]);

        if (is_wp_error($response)) {
            return [
                'success' => false,
                'error' => $response->get_error_message(),
            ];
        }

        $status_code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($status_code !== 200 || !isset($body['data'])) {
            return [
                'success' => false,
                'error' => 'Unexpected response from Expo',
            ];
        }

        // Expo returns array of results for batch, one per payload
        $data = $body['data'];
        $results = [];
        $success_count = 0;
        $error_count = 0;

        foreach ($data as $item) {
            $status = $item['status'] ?? 'error';

            if ($status === 'ok') {
                $success_count++;
                $results[] = ['success' => true];
            } else {
                $error_count++;
                $error_details = $item['details'] ?? null;
                $invalid_token = isset($error_details['error'])
                    && in_array($error_details['error'], ['DeviceNotRegistered', 'InvalidCredentials'], true);

                $results[] = [
                    'success' => false,
                    'error' => $item['message'] ?? 'Unknown error',
                    'invalid_token' => $invalid_token,
                ];
            }
        }

        return [
            'success' => $error_count === 0,
            'sent' => $success_count,
            'errors' => $error_count,
            'results' => $results,
        ];
    }

    /**
     * Test Expo Push configuration
     */
    public function test_configuration($token = null) {
        // If no token provided, just confirm Expo API is accessible
        if (empty($token)) {
            // Make a simple request to verify connectivity
            $response = wp_remote_post($this->expo_url, [
                'headers' => [
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                ],
                'body' => json_encode([]),
                'timeout' => 15,
            ]);

            if (is_wp_error($response)) {
                return [
                    'success' => false,
                    'error' => 'Cannot reach Expo Push API: ' . $response->get_error_message(),
                ];
            }

            return [
                'success' => true,
                'message' => 'Expo Push API is reachable. Provide a device token to test push delivery.',
            ];
        }

        // Test send if token provided
        return $this->send_to_token($token, [
            'title' => 'Test Notification',
            'body' => 'This is a test notification from TBC Community App',
            'data' => ['test' => 'true'],
        ]);
    }

    /**
     * Get combined unread count for a user (notifications + message threads)
     * Matches the app-side badge formula: unreadNotifications + unreadMessages
     *
     * @param int $user_id
     * @return int
     */
    private function get_unread_count($user_id) {
        global $wpdb;

        // Unread notifications
        $table = $wpdb->prefix . 'fcom_notification_users';
        $notif_count = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$table} WHERE user_id = %d AND is_read = 0 AND object_type = 'notification'",
            $user_id
        ));

        // Unread message threads
        $msg_count = TBC_CA_Core::get_unread_message_count($user_id);

        return $notif_count + $msg_count;
    }
}
