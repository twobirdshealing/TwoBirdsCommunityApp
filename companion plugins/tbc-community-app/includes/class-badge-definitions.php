<?php
/**
 * Badge Definitions API - Exposes Fluent Community badge definitions for the mobile app
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_Badge_Definitions {

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
        // GET /wp-json/tbc-ca/v1/badge-definitions
        register_rest_route(TBC_CA_REST_NAMESPACE, '/badge-definitions', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_badges'],
            'permission_callback' => '__return_true', // Public — just definitions
        ]);
    }

    /**
     * GET /badge-definitions - Return all badge definitions
     */
    public function get_badges(WP_REST_Request $request) {
        // Check if Fluent Community is active
        if (!class_exists('FluentCommunity\App\Functions\Utility')) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => 'Fluent Community plugin is not active',
                'badges'  => new \stdClass(),
            ], 200);
        }

        $utility = 'FluentCommunity\App\Functions\Utility';
        $badges = $utility::getOption('user_badges', []);

        return new WP_REST_Response([
            'success' => true,
            'badges'  => $badges ?: new \stdClass(),
        ], 200);
    }
}
