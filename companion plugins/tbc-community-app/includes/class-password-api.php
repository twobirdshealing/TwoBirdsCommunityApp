<?php
/**
 * Password Reset REST API
 *
 * Provides REST API endpoints for password reset from the mobile app.
 * Uses WordPress native email reset.
 *
 * Endpoints:
 *   POST /tbc-ca/v1/password/forgot  - Initiate password reset (sends email)
 *   POST /tbc-ca/v1/password/reset   - Set new password with reset token
 *
 * @package TBC_Community_App
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_Password_API {

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
        // POST /password/forgot - Initiate password reset
        register_rest_route(TBC_CA_REST_NAMESPACE, '/password/forgot', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_forgot'],
            'permission_callback' => '__return_true',
        ]);

        // POST /password/reset - Set new password
        register_rest_route(TBC_CA_REST_NAMESPACE, '/password/reset', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_reset'],
            'permission_callback' => '__return_true',
        ]);
    }

    // =========================================================================
    // POST /password/forgot
    // =========================================================================

    /**
     * Initiate password reset via WordPress native email.
     */
    public function handle_forgot(WP_REST_Request $request) {
        // Rate-limit by IP via FluentCommunity's built-in helper, when present.
        // Without this, attackers can spam the endpoint to enumerate accounts
        // and hammer the mail server.
        $rate_limited = self::check_rate_limit();
        if ($rate_limited) {
            return $rate_limited;
        }

        $data = $request->get_json_params();
        if (empty($data)) {
            $data = $request->get_params();
        }

        $login = sanitize_text_field(trim($data['login'] ?? ''));

        if (empty($login)) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Please enter your email or username.',
            ], 422);
        }

        // Find user
        $user = is_email($login)
            ? get_user_by('email', $login)
            : get_user_by('login', $login);

        if (!$user) {
            // Don't reveal whether the user exists — always return generic message
            return new WP_REST_Response([
                'success' => true,
                'email_sent' => true,
                'message' => 'If an account exists with that information, you will receive reset instructions.',
            ], 200);
        }

        $result = retrieve_password($user->user_login);

        if (is_wp_error($result)) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Unable to send reset instructions. Please try again later.',
            ], 500);
        }

        return new WP_REST_Response([
            'success'    => true,
            'email_sent' => true,
            'message'    => 'A password reset link has been sent to your email.',
        ], 200);
    }

    // =========================================================================
    // POST /password/reset
    // =========================================================================

    /**
     * Set new password using a reset token.
     */
    public function handle_reset(WP_REST_Request $request) {
        $rate_limited = self::check_rate_limit();
        if ($rate_limited) {
            return $rate_limited;
        }

        $data = $request->get_json_params();
        if (empty($data)) {
            $data = $request->get_params();
        }

        $reset_token = sanitize_text_field($data['reset_token'] ?? '');
        $login = sanitize_text_field($data['login'] ?? '');
        $new_password = $data['new_password'] ?? '';

        if (empty($reset_token) || empty($login) || empty($new_password)) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Reset token, username, and new password are required.',
            ], 422);
        }

        if (strlen($new_password) < 6) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Password must be at least 6 characters.',
            ], 422);
        }

        // Validate reset key
        $user = check_password_reset_key($reset_token, $login);

        if (is_wp_error($user)) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Reset token is invalid or has expired. Please start over.',
            ], 422);
        }

        // Set new password
        reset_password($user, $new_password);

        return new WP_REST_Response([
            'success' => true,
            'message' => 'Password updated successfully. You can now sign in.',
        ], 200);
    }

    /**
     * Per-IP rate-limit shared between forgot/reset endpoints. Returns a
     * WP_REST_Response on throttle, or null when the request may proceed.
     *
     * Prefers FluentCommunity's AuthHelper::isAuthRateLimit() so the limits
     * stay aligned with the rest of the auth surface. Falls back to a small
     * transient counter when FC isn't available, so the endpoint is never
     * left wide open.
     */
    private static function check_rate_limit() {
        if (class_exists('FluentCommunity\\Modules\\Auth\\AuthHelper')) {
            $helper = 'FluentCommunity\\Modules\\Auth\\AuthHelper';
            $check = $helper::isAuthRateLimit();
            if (is_wp_error($check)) {
                return new WP_REST_Response([
                    'success' => false,
                    'message' => $check->get_error_message(),
                ], 429);
            }
            return null;
        }

        // Fallback: 10 requests per IP per 5 minutes
        $ip = isset($_SERVER['REMOTE_ADDR']) ? preg_replace('/[^0-9a-fA-F:.]/', '', $_SERVER['REMOTE_ADDR']) : '';
        if (empty($ip)) {
            return null;
        }
        $key = 'tbc_ca_pw_rate_' . md5($ip);
        $count = (int) get_transient($key);
        if ($count >= 10) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Too many requests. Please try again in a few minutes.',
            ], 429);
        }
        set_transient($key, $count + 1, 5 * MINUTE_IN_SECONDS);
        return null;
    }
}
