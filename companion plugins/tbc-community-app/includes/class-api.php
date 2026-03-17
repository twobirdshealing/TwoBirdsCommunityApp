<?php
/**
 * REST API base class - handles CORS for all tbc-ca/v1 endpoints
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_API {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('rest_api_init', [$this, 'setup_cors'], 15);
        add_action('init', [$this, 'handle_preflight']);

        // Hide REST API index from unauthenticated users (prevents endpoint discovery)
        add_filter('rest_authentication_errors', [$this, 'block_rest_index']);
    }

    /**
     * Block unauthenticated access to the REST API index (/wp-json/)
     * Prevents bots from discovering custom endpoints.
     */
    public function block_rest_index($result) {
        if ($result !== null) {
            return $result;
        }

        if (!is_user_logged_in()) {
            $request_uri = $_SERVER['REQUEST_URI'] ?? '';
            $path = rtrim(parse_url($request_uri, PHP_URL_PATH), '/');

            // Block /wp-json and /wp-json/ (the index listing)
            if (preg_match('#/wp-json/?$#', $path)) {
                return new \WP_Error(
                    'rest_disabled',
                    'REST API discovery is not available.',
                    ['status' => 403]
                );
            }
        }

        return $result;
    }

    /**
     * Setup CORS headers
     */
    public function setup_cors() {
        remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
        add_filter('rest_pre_serve_request', [$this, 'send_cors_headers']);
    }

    /**
     * Send CORS headers for our namespace
     */
    public function send_cors_headers($value) {
        $request_uri = $_SERVER['REQUEST_URI'] ?? '';
        if (strpos($request_uri, TBC_CA_REST_NAMESPACE) !== false) {
            header('Access-Control-Allow-Origin: *');
            header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
            header('Access-Control-Allow-Headers: Authorization, Content-Type');
            header('Access-Control-Allow-Credentials: true');
        }
        return $value;
    }

    /**
     * Handle OPTIONS preflight requests
     */
    public function handle_preflight() {
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            $request_uri = $_SERVER['REQUEST_URI'] ?? '';
            if (strpos($request_uri, TBC_CA_REST_NAMESPACE) !== false) {
                header('Access-Control-Allow-Origin: *');
                header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
                header('Access-Control-Allow-Headers: Authorization, Content-Type');
                header('Access-Control-Max-Age: 86400');
                exit(0);
            }
        }
    }
}
