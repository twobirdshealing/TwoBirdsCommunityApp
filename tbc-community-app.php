<?php
/**
 * Plugin Name: TBC - Community App
 * Plugin URI: https://twobirdschurch.com
 * Description: Support plugin for the Two Birds Community mobile app. Provides web sessions for WebView and app-specific styling.
 * Version: 2.0.0
 * Author: Two Birds Church
 * Author URI: https://twobirdschurch.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: tbc-ca
 *
 * CHANGELOG:
 * v2.0.0 - Migrated to JWT authentication (uses JWT Authentication for WP REST API plugin)
 *        - Removed app password creation (no longer needed)
 *        - Removed /login endpoint (now using /wp-json/jwt-auth/v1/token)
 *        - Kept web session, cart, and app view styling features
 * v1.3.0 - Added app view mode (hide header/footer in WebView)
 * v1.2.0 - Fixed permission callback for Basic Auth compatibility
 * v1.1.0 - Added web session and cart endpoints
 * v1.0.0 - Initial release
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Plugin constants
define('TBC_CA_VERSION', '2.0.0');
define('TBC_CA_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('TBC_CA_PLUGIN_URL', plugin_dir_url(__FILE__));
define('TBC_CA_REST_NAMESPACE', 'tbc-ca/v1');
define('TBC_CA_APP_USER_AGENT', 'TBCCommunityApp');

// =============================================================================
// APP VIEW MODE - Hide header/footer when viewing in app WebView
// =============================================================================

/**
 * Check if request is from our app's WebView
 */
function tbc_ca_is_app_view() {
    $user_agent = $_SERVER['HTTP_USER_AGENT'] ?? '';
    return strpos($user_agent, TBC_CA_APP_USER_AGENT) !== false;
}

/**
 * Add body class for app view
 */
add_filter('body_class', 'tbc_ca_add_app_body_class');

function tbc_ca_add_app_body_class($classes) {
    if (tbc_ca_is_app_view()) {
        $classes[] = 'tbc-app-view';
    }
    return $classes;
}

/**
 * Output CSS to hide header/footer in app view
 * Uses universal selectors that work with most themes
 */
add_action('wp_head', 'tbc_ca_app_view_styles', 999);

function tbc_ca_app_view_styles() {
    if (!tbc_ca_is_app_view()) {
        return;
    }
    ?>
    <style id="tbc-app-view-styles">
        /* =================================================================
         * TBC Community App - App View Mode
         * Hides header/footer when viewing in mobile app WebView
         * ================================================================= */

        /* Universal HTML5 semantic elements */
        body.tbc-app-view > header,
        body.tbc-app-view > footer,
        body.tbc-app-view header.site-header,
        body.tbc-app-view footer.site-footer,
        body.tbc-app-view .site-header,
        body.tbc-app-view .site-footer {
            display: none !important;
        }

        /* Common theme selectors */
        body.tbc-app-view #masthead,
        body.tbc-app-view #colophon,
        body.tbc-app-view #site-header,
        body.tbc-app-view #site-footer,
        body.tbc-app-view .ast-header-sticked,
        body.tbc-app-view .header-wrapper,
        body.tbc-app-view .footer-wrapper {
            display: none !important;
        }

        /* Kadence theme */
        body.tbc-app-view .kadence-header,
        body.tbc-app-view .kadence-footer {
            display: none !important;
        }

        /* Astra theme */
        body.tbc-app-view .ast-header,
        body.tbc-app-view .ast-footer {
            display: none !important;
        }

        /* GeneratePress theme */
        body.tbc-app-view .generate-header,
        body.tbc-app-view .generate-footer {
            display: none !important;
        }

        /* BuddyBoss theme */
        body.tbc-app-view .bb-header,
        body.tbc-app-view .bb-footer,
        body.tbc-app-view #bb-header,
        body.tbc-app-view #bb-footer {
            display: none !important;
        }

        /* Elementor headers/footers */
        body.tbc-app-view .elementor-location-header,
        body.tbc-app-view .elementor-location-footer {
            display: none !important;
        }

        /* WordPress admin bar (should be hidden anyway but just in case) */
        body.tbc-app-view #wpadminbar {
            display: none !important;
        }

        /* Adjust body to remove any header spacing */
        body.tbc-app-view {
            padding-top: 0 !important;
            margin-top: 0 !important;
        }

        /* Make main content full height */
        body.tbc-app-view .site-content,
        body.tbc-app-view .content-area,
        body.tbc-app-view #content,
        body.tbc-app-view main {
            min-height: 100vh;
        }
    </style>
    <?php
}

// =============================================================================
// REST API ROUTES
// =============================================================================

add_action('rest_api_init', 'tbc_ca_register_routes');

function tbc_ca_register_routes() {

    // POST /wp-json/tbc-ca/v1/create-web-session
    // Creates a one-time login URL for WebView
    register_rest_route(TBC_CA_REST_NAMESPACE, '/create-web-session', [
        'methods' => 'POST',
        'callback' => 'tbc_ca_handle_create_web_session',
        'permission_callback' => 'is_user_logged_in',
        'args' => [
            'redirect_url' => [
                'required' => false,
                'type' => 'string',
                'sanitize_callback' => 'esc_url_raw',
            ],
        ],
    ]);

    // GET /wp-json/tbc-ca/v1/cart
    // Gets user's WooCommerce cart data
    register_rest_route(TBC_CA_REST_NAMESPACE, '/cart', [
        'methods' => 'GET',
        'callback' => 'tbc_ca_handle_get_cart',
        'permission_callback' => 'is_user_logged_in',
    ]);

    // GET /wp-json/tbc-ca/v1/validate
    // Validates current authentication
    register_rest_route(TBC_CA_REST_NAMESPACE, '/validate', [
        'methods' => 'GET',
        'callback' => 'tbc_ca_handle_validate',
        'permission_callback' => 'is_user_logged_in',
    ]);

}

// =============================================================================
// VALIDATE TOKEN HANDLER
// =============================================================================

function tbc_ca_handle_validate(WP_REST_Request $request) {
    $user = wp_get_current_user();

    return new WP_REST_Response([
        'valid' => true,
        'user_id' => $user->ID,
        'username' => $user->user_login,
    ], 200);
}

// =============================================================================
// CREATE WEB SESSION HANDLER
// =============================================================================

function tbc_ca_handle_create_web_session(WP_REST_Request $request) {
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

// =============================================================================
// WEB SESSION TOKEN HANDLER
// =============================================================================

add_action('init', 'tbc_ca_handle_web_session_token', 1);

function tbc_ca_handle_web_session_token() {
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

// =============================================================================
// GET CART HANDLER
// =============================================================================

function tbc_ca_handle_get_cart(WP_REST_Request $request) {
    if (!class_exists('WooCommerce')) {
        return new WP_REST_Response([
            'success' => true,
            'cart' => [
                'count' => 0,
                'total' => '0.00',
                'items' => [],
            ],
        ], 200);
    }

    $user_id = get_current_user_id();
    $saved_cart = get_user_meta($user_id, '_woocommerce_persistent_cart_' . get_current_blog_id(), true);

    $cart_count = 0;
    $cart_items = [];

    if (!empty($saved_cart['cart'])) {
        foreach ($saved_cart['cart'] as $cart_item_key => $cart_item) {
            $product_id = $cart_item['product_id'] ?? 0;
            $quantity = $cart_item['quantity'] ?? 0;

            if ($product_id && $quantity) {
                $product = wc_get_product($product_id);

                if ($product) {
                    $cart_count += $quantity;

                    $cart_items[] = [
                        'key' => $cart_item_key,
                        'product_id' => $product_id,
                        'name' => $product->get_name(),
                        'quantity' => $quantity,
                        'price' => $product->get_price(),
                        'image' => wp_get_attachment_image_url($product->get_image_id(), 'thumbnail'),
                    ];
                }
            }
        }
    }

    return new WP_REST_Response([
        'success' => true,
        'cart' => [
            'count' => $cart_count,
            'total' => '0.00',
            'items' => $cart_items,
            'cart_url' => wc_get_cart_url(),
            'checkout_url' => wc_get_checkout_url(),
        ],
    ], 200);
}

// =============================================================================
// CORS HEADERS
// =============================================================================

add_action('rest_api_init', 'tbc_ca_setup_cors', 15);

function tbc_ca_setup_cors() {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', 'tbc_ca_send_cors_headers');
}

function tbc_ca_send_cors_headers($value) {
    $request_uri = $_SERVER['REQUEST_URI'] ?? '';
    if (strpos($request_uri, TBC_CA_REST_NAMESPACE) !== false) {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Authorization, Content-Type');
        header('Access-Control-Allow-Credentials: true');
    }
    return $value;
}

add_action('init', 'tbc_ca_handle_preflight');

function tbc_ca_handle_preflight() {
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        $request_uri = $_SERVER['REQUEST_URI'] ?? '';
        if (strpos($request_uri, TBC_CA_REST_NAMESPACE) !== false) {
            header('Access-Control-Allow-Origin: *');
            header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
            header('Access-Control-Allow-Headers: Authorization, Content-Type');
            header('Access-Control-Max-Age: 86400');
            exit(0);
        }
    }
}

// =============================================================================
// ACTIVATION / DEACTIVATION
// =============================================================================

register_activation_hook(__FILE__, 'tbc_ca_activate');
register_deactivation_hook(__FILE__, 'tbc_ca_deactivate');

function tbc_ca_activate() {
    update_option('tbc_ca_version', TBC_CA_VERSION);
    flush_rewrite_rules();
}

function tbc_ca_deactivate() {
    flush_rewrite_rules();
}
