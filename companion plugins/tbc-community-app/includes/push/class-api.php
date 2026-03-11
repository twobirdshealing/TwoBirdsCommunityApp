<?php
/**
 * Push API - REST endpoints for push notifications
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_Push_API {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('rest_api_init', [$this, 'register_routes']);
    }

    /**
     * Register REST routes
     */
    public function register_routes() {
        // GET /wp-json/tbc-ca/v1/push/settings
        register_rest_route(TBC_CA_REST_NAMESPACE, '/push/settings', [
            'methods' => 'GET',
            'callback' => [$this, 'get_settings'],
            'permission_callback' => 'is_user_logged_in',
        ]);

        // POST /wp-json/tbc-ca/v1/push/settings
        register_rest_route(TBC_CA_REST_NAMESPACE, '/push/settings', [
            'methods' => 'POST',
            'callback' => [$this, 'update_settings'],
            'permission_callback' => 'is_user_logged_in',
            'args' => [
                'preferences' => [
                    'required' => true,
                    'type' => 'object',
                ],
            ],
        ]);

        // POST /wp-json/tbc-ca/v1/push/device
        register_rest_route(TBC_CA_REST_NAMESPACE, '/push/device', [
            'methods' => 'POST',
            'callback' => [$this, 'register_device'],
            'permission_callback' => 'is_user_logged_in',
            'args' => [
                'token' => [
                    'required' => true,
                    'type' => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                ],
                'platform' => [
                    'required' => false,
                    'type' => 'string',
                    'default' => 'ios',
                    'sanitize_callback' => 'sanitize_text_field',
                ],
            ],
        ]);

        // DELETE /wp-json/tbc-ca/v1/push/device
        register_rest_route(TBC_CA_REST_NAMESPACE, '/push/device', [
            'methods' => 'DELETE',
            'callback' => [$this, 'unregister_device'],
            'permission_callback' => 'is_user_logged_in',
            'args' => [
                'token' => [
                    'required' => false,
                    'type' => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                ],
            ],
        ]);
    }

    /**
     * GET /push/settings - Get notification settings for current user
     */
    public function get_settings(WP_REST_Request $request) {
        $user_id = get_current_user_id();
        $preferences = TBC_CA_Push_Preferences::get_instance();
        $devices = TBC_CA_Push_Devices::get_instance();

        $user_prefs = $preferences->get_all_for_user_grouped($user_id);
        $device_count = $devices->get_token_count($user_id);

        return new WP_REST_Response([
            'success' => true,
            'preferences' => $user_prefs,
            'device_count' => $device_count,
        ], 200);
    }

    /**
     * POST /push/settings - Update notification settings
     */
    public function update_settings(WP_REST_Request $request) {
        $user_id = get_current_user_id();
        $new_prefs = $request->get_param('preferences');

        if (!is_array($new_prefs)) {
            return new WP_Error(
                'invalid_preferences',
                __('Preferences must be an object', 'tbc-ca'),
                ['status' => 400]
            );
        }

        $preferences = TBC_CA_Push_Preferences::get_instance();
        $registry = TBC_CA_Push_Registry::get_instance();
        $enabled_types = $registry->get_enabled();

        // Only update preferences for enabled types
        $sanitized = [];
        foreach ($new_prefs as $type_id => $enabled) {
            if (isset($enabled_types[$type_id])) {
                $sanitized[$type_id] = (bool) $enabled;
            }
        }

        $preferences->update_user_preferences($user_id, $sanitized);

        // Return updated preferences
        $user_prefs = $preferences->get_all_for_user_grouped($user_id);

        return new WP_REST_Response([
            'success' => true,
            'preferences' => $user_prefs,
        ], 200);
    }

    /**
     * POST /push/device - Register a device token
     */
    public function register_device(WP_REST_Request $request) {
        $user_id = get_current_user_id();
        $token = $request->get_param('token');
        $platform = $request->get_param('platform');

        if (empty($token)) {
            return new WP_Error(
                'missing_token',
                __('Device token is required', 'tbc-ca'),
                ['status' => 400]
            );
        }

        // Validate platform
        if (!in_array($platform, ['ios', 'android'])) {
            $platform = 'ios';
        }

        $devices = TBC_CA_Push_Devices::get_instance();
        $result = $devices->register($user_id, $token, $platform);

        if ($result === false) {
            return new WP_Error(
                'registration_failed',
                __('Failed to register device token', 'tbc-ca'),
                ['status' => 500]
            );
        }

        return new WP_REST_Response([
            'success' => true,
            'message' => 'Device registered successfully',
        ], 200);
    }

    /**
     * DELETE /push/device - Unregister a device token
     */
    public function unregister_device(WP_REST_Request $request) {
        $user_id = get_current_user_id();
        $token = $request->get_param('token');

        $devices = TBC_CA_Push_Devices::get_instance();

        if (!empty($token)) {
            // Unregister specific token
            $devices->unregister($token);
        } else {
            // Unregister all tokens for user
            $devices->unregister_all_for_user($user_id);
        }

        return new WP_REST_Response([
            'success' => true,
            'message' => 'Device unregistered successfully',
        ], 200);
    }
}
