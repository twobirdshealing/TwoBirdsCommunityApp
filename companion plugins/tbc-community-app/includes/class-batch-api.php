<?php
/**
 * Batch API - Combine multiple REST requests into a single HTTP call
 *
 * Accepts an array of REST route paths, dispatches each internally via
 * rest_do_request() (no HTTP overhead), and returns all responses in one
 * payload. The JWT from the batch request is inherited by all sub-requests.
 *
 * Usage:
 *   POST /wp-json/tbc-ca/v1/batch
 *   { "requests": [
 *       { "path": "/fluent-community/v2/notifications/unread" },
 *       { "path": "/tbc-ca/v1/app-config" },
 *       { "path": "/wp/v2/posts?per_page=1&_embed=" }
 *   ]}
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_Batch_API {

    private static $instance = null;

    /** Maximum sub-requests per batch (prevent abuse) */
    const MAX_REQUESTS = 20;

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
        register_rest_route(TBC_CA_REST_NAMESPACE, '/batch', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_batch'],
            'permission_callback' => function () {
                return is_user_logged_in();
            },
            'args'                => [
                'requests' => [
                    'required'          => true,
                    'validate_callback' => [$this, 'validate_requests'],
                ],
            ],
        ]);
    }

    /**
     * Validate the requests parameter
     */
    public function validate_requests($value) {
        if (!is_array($value)) {
            return new WP_Error(
                'invalid_requests',
                'requests must be an array',
                ['status' => 400]
            );
        }

        if (count($value) === 0) {
            return new WP_Error(
                'empty_requests',
                'requests array must not be empty',
                ['status' => 400]
            );
        }

        if (count($value) > self::MAX_REQUESTS) {
            return new WP_Error(
                'too_many_requests',
                sprintf('Maximum %d sub-requests allowed per batch', self::MAX_REQUESTS),
                ['status' => 400]
            );
        }

        foreach ($value as $i => $req) {
            if (!is_array($req) || empty($req['path'])) {
                return new WP_Error(
                    'invalid_request_item',
                    sprintf('Request at index %d must have a "path" property', $i),
                    ['status' => 400]
                );
            }
        }

        return true;
    }

    /**
     * Handle the batch request — dispatch each sub-request internally
     */
    public function handle_batch(WP_REST_Request $request) {
        $requests  = $request->get_param('requests');
        $server    = rest_get_server();
        $responses = [];

        foreach ($requests as $sub) {
            $path   = $sub['path'];
            $method = isset($sub['method']) ? strtoupper($sub['method']) : 'GET';
            $body   = isset($sub['body']) ? $sub['body'] : null;

            // Parse query string from path (e.g. /wp/v2/posts?per_page=1&_embed=)
            $parsed = wp_parse_url($path);
            $route  = isset($parsed['path']) ? $parsed['path'] : $path;

            // Build the internal request (route only — no /wp-json prefix)
            $sub_request = new WP_REST_Request($method, $route);

            // Set query params from URL
            if (!empty($parsed['query'])) {
                parse_str($parsed['query'], $query_params);
                foreach ($query_params as $key => $val) {
                    $sub_request->set_param($key, $val);
                }
            }

            // Set body params for POST/PUT/PATCH
            if ($body && in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
                $sub_request->set_body_params($body);
            }

            // Dispatch through the REST server (inherits current user from JWT)
            $result = $server->dispatch($sub_request);

            $responses[] = [
                'path'    => $path,
                'status'  => $result->get_status(),
                'body'    => $result->get_data(),
                'headers' => $result->get_headers(),
            ];
        }

        return new WP_REST_Response(['responses' => $responses], 200);
    }
}
