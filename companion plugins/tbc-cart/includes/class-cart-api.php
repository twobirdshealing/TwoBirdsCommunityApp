<?php
/**
 * Cart API - Exposes WooCommerce cart item count for authenticated users
 *
 * Endpoints:
 *   GET /tbc-cart/v1/count - Returns total item quantity in user's persistent cart
 *
 * Reads from `_woocommerce_persistent_cart_1` user meta directly (no WC session
 * overhead). Works identically on HPOS and non-HPOS sites since persistent cart
 * is always stored in wp_usermeta.
 *
 * @package TBC_Cart
 * @since 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_Cart_API {

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

    // -------------------------------------------------------------------------
    // Routes
    // -------------------------------------------------------------------------

    public function register_routes() {
        register_rest_route(TBC_CART_REST_NAMESPACE, '/count', [
            'methods'             => 'GET',
            'callback'            => [$this, 'handle_count'],
            'permission_callback' => 'is_user_logged_in',
        ]);
    }

    // -------------------------------------------------------------------------
    // Handler
    // -------------------------------------------------------------------------

    /**
     * Return the total item quantity in the user's WooCommerce persistent cart.
     */
    public function handle_count() {
        $count = self::get_cart_count(get_current_user_id());
        return new WP_REST_Response(['count' => $count], 200);
    }

    // -------------------------------------------------------------------------
    // Shared helper (also used by Response Header)
    // -------------------------------------------------------------------------

    /**
     * Read the persistent cart from user meta and sum item quantities.
     *
     * @param int $user_id WordPress user ID.
     * @return int Total item quantity (0 if cart empty).
     */
    public static function get_cart_count($user_id) {
        if (!$user_id) {
            return 0;
        }

        $persistent = get_user_meta($user_id, '_woocommerce_persistent_cart_1', true);

        if (empty($persistent['cart']) || !is_array($persistent['cart'])) {
            return 0;
        }

        $count = 0;
        foreach ($persistent['cart'] as $item) {
            $count += isset($item['quantity']) ? (int) $item['quantity'] : 1;
        }

        return $count;
    }
}
