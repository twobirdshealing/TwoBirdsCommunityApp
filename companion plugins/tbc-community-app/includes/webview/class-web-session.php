<?php
/**
 * Web Session class - creates one-time login URLs for WebView
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_Web_Session {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('rest_api_init', [$this, 'register_routes']);
        add_action('init', [$this, 'handle_token'], 1);
    }

    /**
     * Register REST routes
     */
    public function register_routes() {
        // POST /wp-json/tbc-ca/v1/create-web-session
        register_rest_route(TBC_CA_REST_NAMESPACE, '/create-web-session', [
            'methods' => 'POST',
            'callback' => [$this, 'handle_create_session'],
            'permission_callback' => 'is_user_logged_in',
            'args' => [
                'redirect_url' => [
                    'required' => false,
                    'type' => 'string',
                    'sanitize_callback' => 'esc_url_raw',
                ],
            ],
        ]);
    }

    /**
     * Create a one-time web session URL
     */
    public function handle_create_session(WP_REST_Request $request) {
        $user_id = get_current_user_id();
        $redirect_url = $request->get_param('redirect_url') ?: home_url('/calendar/');

        // Validate redirect URL is on same domain
        $home_host = parse_url(home_url(), PHP_URL_HOST);
        $redirect_host = parse_url($redirect_url, PHP_URL_HOST);

        if ($redirect_host && $redirect_host !== $home_host) {
            return new WP_Error(
                'tbc_ca_invalid_redirect',
                __('Redirect URL must be on the same domain.', 'tbc-ca'),
                ['status' => 400]
            );
        }

        // Generate one-time token
        $token = wp_generate_password(64, false, false);
        $expiry = 120; // 2 minutes

        $token_data = [
            'user_id' => $user_id,
            'redirect' => $redirect_url,
            'created' => time(),
            'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
        ];

        set_transient('tbc_ca_login_token_' . $token, $token_data, $expiry);

        $login_url = add_query_arg(['tbc_app_token' => $token], home_url('/'));

        return new WP_REST_Response([
            'success' => true,
            'url' => $login_url,
            'expires_in' => $expiry,
        ], 200);
    }

    /**
     * Handle incoming token requests
     */
    public function handle_token() {
        if (!isset($_GET['tbc_app_token'])) {
            return;
        }

        $token = sanitize_text_field($_GET['tbc_app_token']);

        if (empty($token)) {
            return;
        }

        $token_data = get_transient('tbc_ca_login_token_' . $token);

        if (!$token_data || !isset($token_data['user_id'])) {
            wp_safe_redirect(home_url('/calendar/?app_error=session_expired'));
            exit;
        }

        // Delete token immediately (one-time use)
        delete_transient('tbc_ca_login_token_' . $token);

        $user = get_user_by('ID', $token_data['user_id']);

        if (!$user) {
            wp_safe_redirect(home_url('/calendar/?app_error=user_not_found'));
            exit;
        }

        // Log the user in
        wp_set_current_user($user->ID);
        wp_set_auth_cookie($user->ID, true);
        do_action('wp_login', $user->user_login, $user);

        $redirect = $token_data['redirect'] ?: home_url('/calendar/');
        wp_safe_redirect($redirect);
        exit;
    }
}
