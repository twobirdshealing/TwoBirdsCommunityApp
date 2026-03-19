<?php
/**
 * Response Header - Injects X-TBC-Cart-Count on every authenticated REST response
 *
 * The mobile app reads this header from every API response via a global interceptor
 * (services/api/client.ts), keeping the cart badge count current without dedicated
 * refresh calls.
 *
 * @package TBC_Cart
 * @since 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_Cart_Response_Header {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        // Run after most filters so we don't interfere with response data
        add_filter('rest_post_dispatch', [$this, 'add_cart_header'], 998, 3);
    }

    /**
     * Append X-TBC-Cart-Count header to every authenticated REST response.
     */
    public function add_cart_header($response, $server, $request) {
        $user_id = get_current_user_id();
        if (!$user_id) {
            return $response;
        }

        $count = TBC_Cart_API::get_cart_count($user_id);
        $response->header('X-TBC-Cart-Count', (string) $count);

        return $response;
    }
}
