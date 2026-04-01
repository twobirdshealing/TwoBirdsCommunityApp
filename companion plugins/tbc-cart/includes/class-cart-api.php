<?php
/**
 * Cart API - WooCommerce cart endpoints for the TBC Community App
 *
 * Endpoints:
 *   GET  /tbc-cart/v1/count                    - Cart item count (lightweight)
 *   GET  /tbc-cart/v1/cart                     - Full cart contents + totals + settings
 *   PATCH /tbc-cart/v1/cart/items/<key>         - Update item quantity
 *   DELETE /tbc-cart/v1/cart/items/<key>        - Remove item from cart
 *   POST /tbc-cart/v1/cart/coupons             - Apply coupon code
 *   DELETE /tbc-cart/v1/cart/coupons/<code>     - Remove coupon code
 *
 * The count endpoint reads from `_woocommerce_persistent_cart_1` user meta
 * directly (no WC session overhead). All other endpoints initialize the full
 * WC cart session via wc_load_cart().
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
        $ns = TBC_CART_REST_NAMESPACE;

        // Legacy count endpoint (lightweight — no WC session)
        register_rest_route($ns, '/count', [
            'methods'             => 'GET',
            'callback'            => [$this, 'handle_count'],
            'permission_callback' => 'is_user_logged_in',
        ]);

        // Full cart
        register_rest_route($ns, '/cart', [
            'methods'             => 'GET',
            'callback'            => [$this, 'handle_get_cart'],
            'permission_callback' => 'is_user_logged_in',
        ]);

        // Update item quantity
        register_rest_route($ns, '/cart/items/(?P<key>[\\w]+)', [
            'methods'             => 'PATCH',
            'callback'            => [$this, 'handle_update_quantity'],
            'permission_callback' => 'is_user_logged_in',
            'args'                => [
                'key'      => ['required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
                'quantity' => ['required' => true, 'type' => 'integer', 'minimum' => 0],
            ],
        ]);

        // Remove item
        register_rest_route($ns, '/cart/items/(?P<key>[\\w]+)', [
            'methods'             => 'DELETE',
            'callback'            => [$this, 'handle_remove_item'],
            'permission_callback' => 'is_user_logged_in',
            'args'                => [
                'key' => ['required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
            ],
        ]);

        // Apply coupon
        register_rest_route($ns, '/cart/coupons', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_apply_coupon'],
            'permission_callback' => 'is_user_logged_in',
            'args'                => [
                'code' => ['required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
            ],
        ]);

        // Remove coupon
        register_rest_route($ns, '/cart/coupons/(?P<code>[^/]+)', [
            'methods'             => 'DELETE',
            'callback'            => [$this, 'handle_remove_coupon'],
            'permission_callback' => 'is_user_logged_in',
            'args'                => [
                'code' => ['required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
            ],
        ]);
    }

    // -------------------------------------------------------------------------
    // Handlers
    // -------------------------------------------------------------------------

    /**
     * Return the total item quantity (lightweight — no WC session).
     */
    public function handle_count() {
        $count = self::get_cart_count(get_current_user_id());
        return new WP_REST_Response(['count' => $count], 200);
    }

    /**
     * Return full cart contents, totals, coupons, and WC settings.
     */
    public function handle_get_cart() {
        $this->init_cart_for_user();
        return new WP_REST_Response($this->build_cart_response(), 200);
    }

    /**
     * Update the quantity of a cart item.
     */
    public function handle_update_quantity(WP_REST_Request $request) {
        $this->init_cart_for_user();

        $key      = $request->get_param('key');
        $quantity = (int) $request->get_param('quantity');

        $cart_item = WC()->cart->get_cart_item($key);
        if (empty($cart_item)) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Cart item not found.',
            ], 404);
        }

        // Quantity 0 removes the item
        if ($quantity === 0) {
            WC()->cart->remove_cart_item($key);
        } else {
            WC()->cart->set_quantity($key, $quantity);
        }

        return new WP_REST_Response($this->build_cart_response(), 200);
    }

    /**
     * Remove a cart item.
     */
    public function handle_remove_item(WP_REST_Request $request) {
        $this->init_cart_for_user();

        $key = $request->get_param('key');

        $cart_item = WC()->cart->get_cart_item($key);
        if (empty($cart_item)) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Cart item not found.',
            ], 404);
        }

        WC()->cart->remove_cart_item($key);

        return new WP_REST_Response($this->build_cart_response(), 200);
    }

    /**
     * Apply a coupon code.
     */
    public function handle_apply_coupon(WP_REST_Request $request) {
        $this->init_cart_for_user();

        $code = $request->get_param('code');

        // Clear any existing WC notices before applying
        wc_clear_notices();

        $applied = WC()->cart->apply_coupon($code);

        // Collect any error notices WC generated
        $errors  = wc_get_notices('error');
        $message = '';
        if (!empty($errors)) {
            $messages = array_map(function ($notice) {
                return is_array($notice) ? wp_strip_all_tags($notice['notice']) : wp_strip_all_tags($notice);
            }, $errors);
            $message = implode(' ', $messages);
        }
        wc_clear_notices();

        if (!$applied) {
            return new WP_REST_Response([
                'success' => false,
                'message' => $message ?: 'Could not apply coupon.',
                'cart'    => $this->build_cart_response(),
            ], 400);
        }

        return new WP_REST_Response($this->build_cart_response(), 200);
    }

    /**
     * Remove a coupon code.
     */
    public function handle_remove_coupon(WP_REST_Request $request) {
        $this->init_cart_for_user();

        $code = $request->get_param('code');

        if (!WC()->cart->has_discount($code)) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Coupon not applied.',
            ], 404);
        }

        WC()->cart->remove_coupon($code);

        return new WP_REST_Response($this->build_cart_response(), 200);
    }

    // -------------------------------------------------------------------------
    // WC Session initialization
    // -------------------------------------------------------------------------

    /**
     * Initialize WC cart, session, and customer for REST context.
     *
     * In a normal page load WC initializes these automatically, but in REST
     * API context they're not loaded. wc_load_cart() (WC 3.6+) handles this
     * and automatically loads the user's persistent cart.
     */
    private function init_cart_for_user() {
        if (function_exists('wc_load_cart') && !did_action('woocommerce_cart_loaded_from_session')) {
            wc_load_cart();
        }

        // Force cart contents to load from session — without this,
        // get_cart_item() sees an empty array because cart_contents
        // is only populated when get_cart() is called.
        if (WC()->cart) {
            WC()->cart->get_cart();
        }
    }

    // -------------------------------------------------------------------------
    // Response builders
    // -------------------------------------------------------------------------

    /**
     * Build the full cart response payload.
     *
     * @return array Cart data with items, coupons, totals, and settings.
     */
    private function build_cart_response() {
        WC()->cart->calculate_totals();

        return [
            'items'    => $this->build_items(),
            'coupons'  => $this->build_coupons(),
            'fees'     => $this->build_fees(),
            'totals'   => $this->build_totals(),
            'settings' => $this->build_settings(),
        ];
    }

    /**
     * Build cart items array.
     */
    private function build_items() {
        $items = [];

        foreach (WC()->cart->get_cart() as $key => $cart_item) {
            $product    = $cart_item['data'];
            $product_id = $cart_item['product_id'];

            // Get the thumbnail URL
            $image_id  = $product->get_image_id();
            $image_url = $image_id ? wp_get_attachment_image_url($image_id, 'woocommerce_thumbnail') : null;

            // Variation attributes (human-readable labels)
            $variation = [];
            if (!empty($cart_item['variation']) && is_array($cart_item['variation'])) {
                foreach ($cart_item['variation'] as $attr_key => $attr_value) {
                    $taxonomy = str_replace('attribute_', '', $attr_key);
                    $label    = wc_attribute_label($taxonomy, $product);
                    $term     = get_term_by('slug', $attr_value, $taxonomy);
                    $value    = $term ? $term->name : $attr_value;
                    $variation[$label] = $value;
                }
            }

            // Stock constraints
            $max_quantity = null;
            if ($product->managing_stock()) {
                $max_quantity = $product->get_stock_quantity();
            }

            $items[] = [
                'key'          => $key,
                'product_id'   => $product_id,
                'variation_id' => $cart_item['variation_id'] ?? 0,
                'name'         => $product->get_name(),
                'price'        => wc_format_decimal($product->get_price(), wc_get_price_decimals()),
                'quantity'     => $cart_item['quantity'],
                'subtotal'     => wc_format_decimal($cart_item['line_subtotal'], wc_get_price_decimals()),
                'image'        => $image_url,
                'variation'    => $variation,
                'stock_status' => $product->get_stock_status(),
                'max_quantity' => $max_quantity,
            ];
        }

        return $items;
    }

    /**
     * Build applied coupons array.
     */
    private function build_coupons() {
        $coupons = [];

        foreach (WC()->cart->get_applied_coupons() as $code) {
            $discount = WC()->cart->get_coupon_discount_amount($code, false);
            $coupons[] = [
                'code'     => $code,
                'discount' => wc_format_decimal($discount, wc_get_price_decimals()),
                'label'    => sprintf('Coupon: %s', $code),
            ];
        }

        return $coupons;
    }

    /**
     * Build cart fees array.
     */
    private function build_fees() {
        $fees = [];

        foreach (WC()->cart->get_fees() as $fee) {
            $fees[] = [
                'name'   => $fee->name,
                'amount' => wc_format_decimal($fee->total, wc_get_price_decimals()),
                'tax'    => wc_format_decimal($fee->tax, wc_get_price_decimals()),
            ];
        }

        return $fees;
    }

    /**
     * Build cart totals.
     */
    private function build_totals() {
        $totals = WC()->cart->get_totals();

        return [
            'subtotal'   => wc_format_decimal($totals['subtotal'], wc_get_price_decimals()),
            'discount'   => wc_format_decimal($totals['discount_total'], wc_get_price_decimals()),
            'shipping'   => wc_format_decimal($totals['shipping_total'], wc_get_price_decimals()),
            'fee'        => wc_format_decimal($totals['fee_total'], wc_get_price_decimals()),
            'tax'        => wc_format_decimal($totals['total_tax'], wc_get_price_decimals()),
            'total'      => wc_format_decimal($totals['total'], wc_get_price_decimals()),
            'currency'   => html_entity_decode(get_woocommerce_currency_symbol()),
            'item_count' => WC()->cart->get_cart_contents_count(),
        ];
    }

    /**
     * Build WC store settings relevant to the cart UI.
     */
    private function build_settings() {
        return [
            'coupons_enabled'   => wc_coupons_enabled(),
            'tax_enabled'       => wc_tax_enabled(),
            'shipping_enabled'  => wc_shipping_enabled(),
            'currency_symbol'   => html_entity_decode(get_woocommerce_currency_symbol()),
            'currency_position' => get_option('woocommerce_currency_pos', 'left'),
            'price_decimals'    => wc_get_price_decimals(),
        ];
    }

    // -------------------------------------------------------------------------
    // Shared helper (also used by Response Header)
    // -------------------------------------------------------------------------

    /**
     * Read the persistent cart from user meta and sum item quantities.
     * Lightweight — does NOT initialize WC session.
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
