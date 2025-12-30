<?php
/**
 * Plugin Name: TBC - Community App
 * Plugin URI: https://twobirdschurch.com
 * Description: REST API endpoints for the Two Birds Community mobile app. Provides authentication and app-specific functionality.
 * Version: 1.3.0
 * Author: Two Birds Church
 * Author URI: https://twobirdschurch.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: tbc-ca
 * 
 * CHANGELOG:
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
define('TBC_CA_VERSION', '1.3.0');
define('TBC_CA_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('TBC_CA_PLUGIN_URL', plugin_dir_url(__FILE__));
define('TBC_CA_REST_NAMESPACE', 'tbc-ca/v1');
define('TBC_CA_APP_ID', 'tbc-community-app');
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
// CUSTOM PERMISSION CALLBACK
// =============================================================================

/**
 * Check if user is authenticated via Basic Auth or regular session
 */
function tbc_ca_user_can_access() {
    if (is_user_logged_in()) {
        return true;
    }
    
    $user_id = tbc_ca_authenticate_from_headers();
    
    if ($user_id) {
        wp_set_current_user($user_id);
        return true;
    }
    
    return false;
}

/**
 * Try to authenticate user from Authorization header
 */
function tbc_ca_authenticate_from_headers() {
    $auth_header = null;
    
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $auth_header = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $auth_header = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } elseif (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (isset($headers['Authorization'])) {
            $auth_header = $headers['Authorization'];
        }
    }
    
    if (!$auth_header || stripos($auth_header, 'Basic ') !== 0) {
        return false;
    }
    
    $encoded = substr($auth_header, 6);
    $decoded = base64_decode($encoded);
    
    if (!$decoded || strpos($decoded, ':') === false) {
        return false;
    }
    
    list($username, $password) = explode(':', $decoded, 2);
    
    $user = wp_authenticate_application_password(null, $username, $password);
    
    if ($user && !is_wp_error($user)) {
        return $user->ID;
    }
    
    return false;
}

// =============================================================================
// REST API ROUTES
// =============================================================================

add_action('rest_api_init', 'tbc_ca_register_routes');

function tbc_ca_register_routes() {
    
    // POST /wp-json/tbc-ca/v1/login
    register_rest_route(TBC_CA_REST_NAMESPACE, '/login', [
        'methods' => 'POST',
        'callback' => 'tbc_ca_handle_login',
        'permission_callback' => '__return_true',
        'args' => [
            'username' => [
                'required' => true,
                'type' => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ],
            'password' => [
                'required' => true,
                'type' => 'string',
            ],
            'device_name' => [
                'required' => false,
                'type' => 'string',
                'default' => 'Two Birds App',
                'sanitize_callback' => 'sanitize_text_field',
            ],
        ],
    ]);
    
    // POST /wp-json/tbc-ca/v1/logout
    register_rest_route(TBC_CA_REST_NAMESPACE, '/logout', [
        'methods' => 'POST',
        'callback' => 'tbc_ca_handle_logout',
        'permission_callback' => 'tbc_ca_user_can_access',
    ]);
    
    // GET /wp-json/tbc-ca/v1/validate
    register_rest_route(TBC_CA_REST_NAMESPACE, '/validate', [
        'methods' => 'GET',
        'callback' => 'tbc_ca_handle_validate',
        'permission_callback' => 'tbc_ca_user_can_access',
    ]);
    
    // GET /wp-json/tbc-ca/v1/me
    register_rest_route(TBC_CA_REST_NAMESPACE, '/me', [
        'methods' => 'GET',
        'callback' => 'tbc_ca_handle_get_me',
        'permission_callback' => 'tbc_ca_user_can_access',
    ]);
    
    // POST /wp-json/tbc-ca/v1/create-web-session
    register_rest_route(TBC_CA_REST_NAMESPACE, '/create-web-session', [
        'methods' => 'POST',
        'callback' => 'tbc_ca_handle_create_web_session',
        'permission_callback' => 'tbc_ca_user_can_access',
        'args' => [
            'redirect_url' => [
                'required' => false,
                'type' => 'string',
                'sanitize_callback' => 'esc_url_raw',
            ],
        ],
    ]);
    
    // GET /wp-json/tbc-ca/v1/cart
    register_rest_route(TBC_CA_REST_NAMESPACE, '/cart', [
        'methods' => 'GET',
        'callback' => 'tbc_ca_handle_get_cart',
        'permission_callback' => 'tbc_ca_user_can_access',
    ]);
    
}

// =============================================================================
// LOGIN HANDLER
// =============================================================================

function tbc_ca_handle_login(WP_REST_Request $request) {
    $username = $request->get_param('username');
    $password = $request->get_param('password');
    $device_name = $request->get_param('device_name');
    
    if (is_email($username)) {
        $user = get_user_by('email', $username);
    } else {
        $user = get_user_by('login', $username);
    }
    
    if (!$user) {
        return new WP_Error(
            'tbc_ca_invalid_credentials',
            __('Invalid username or password.', 'tbc-ca'),
            ['status' => 401]
        );
    }
    
    if (!wp_check_password($password, $user->user_pass, $user->ID)) {
        return new WP_Error(
            'tbc_ca_invalid_credentials',
            __('Invalid username or password.', 'tbc-ca'),
            ['status' => 401]
        );
    }
    
    if ($user->user_status != 0) {
        return new WP_Error(
            'tbc_ca_account_disabled',
            __('Your account has been disabled.', 'tbc-ca'),
            ['status' => 403]
        );
    }
    
    $app_password_result = tbc_ca_create_app_password($user->ID, $device_name);
    
    if (is_wp_error($app_password_result)) {
        return $app_password_result;
    }
    
    $user_data = tbc_ca_get_user_data($user);
    
    return new WP_REST_Response([
        'success' => true,
        'message' => __('Login successful', 'tbc-ca'),
        'user' => $user_data,
        'auth' => [
            'username' => $user->user_login,
            'app_password' => $app_password_result['password'],
            'app_password_uuid' => $app_password_result['uuid'],
            'basic_auth' => base64_encode($user->user_login . ':' . $app_password_result['password']),
        ],
    ], 200);
}

// =============================================================================
// LOGOUT HANDLER
// =============================================================================

function tbc_ca_handle_logout(WP_REST_Request $request) {
    $user = wp_get_current_user();
    $uuid = $request->get_param('app_password_uuid');
    
    if ($uuid) {
        WP_Application_Passwords::delete_application_password($user->ID, $uuid);
    }
    
    return new WP_REST_Response([
        'success' => true,
        'message' => __('Logged out successfully', 'tbc-ca'),
    ], 200);
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
// GET CURRENT USER HANDLER
// =============================================================================

function tbc_ca_handle_get_me(WP_REST_Request $request) {
    $user = wp_get_current_user();
    $user_data = tbc_ca_get_user_data($user);
    
    return new WP_REST_Response([
        'success' => true,
        'user' => $user_data,
    ], 200);
}

// =============================================================================
// CREATE WEB SESSION HANDLER
// =============================================================================

function tbc_ca_handle_create_web_session(WP_REST_Request $request) {
    $user_id = get_current_user_id();
    $redirect_url = $request->get_param('redirect_url') ?: home_url('/calendar/');
    
    $home_host = parse_url(home_url(), PHP_URL_HOST);
    $redirect_host = parse_url($redirect_url, PHP_URL_HOST);
    
    if ($redirect_host && $redirect_host !== $home_host) {
        return new WP_Error(
            'tbc_ca_invalid_redirect',
            __('Redirect URL must be on the same domain.', 'tbc-ca'),
            ['status' => 400]
        );
    }
    
    $token = wp_generate_password(64, false, false);
    $expiry = 120;
    
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
    
    delete_transient('tbc_ca_login_token_' . $token);
    
    $user = get_user_by('ID', $token_data['user_id']);
    
    if (!$user) {
        wp_safe_redirect(home_url('/calendar/?app_error=user_not_found'));
        exit;
    }
    
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
// HELPER FUNCTIONS
// =============================================================================

function tbc_ca_create_app_password($user_id, $device_name) {
    if (!class_exists('WP_Application_Passwords')) {
        return new WP_Error(
            'tbc_ca_app_passwords_unavailable',
            __('Application Passwords are not available.', 'tbc-ca'),
            ['status' => 500]
        );
    }
    
    tbc_ca_cleanup_old_passwords($user_id);
    
    $app_name = $device_name . ' - ' . date('M j, Y g:i A');
    
    $result = WP_Application_Passwords::create_new_application_password(
        $user_id,
        [
            'name' => $app_name,
            'app_id' => TBC_CA_APP_ID,
        ]
    );
    
    if (is_wp_error($result)) {
        return new WP_Error(
            'tbc_ca_app_password_failed',
            __('Failed to create app password.', 'tbc-ca'),
            ['status' => 500]
        );
    }
    
    return [
        'password' => $result[0],
        'uuid' => $result[1]['uuid'],
    ];
}

function tbc_ca_get_user_data($user) {
    $avatar_url = get_avatar_url($user->ID, ['size' => 200]);
    
    return [
        'id' => $user->ID,
        'username' => $user->user_login,
        'email' => $user->user_email,
        'display_name' => $user->display_name,
        'first_name' => $user->first_name,
        'last_name' => $user->last_name,
        'avatar' => $avatar_url,
        'registered' => $user->user_registered,
        'roles' => $user->roles,
    ];
}

function tbc_ca_cleanup_old_passwords($user_id, $max_passwords = 5) {
    $passwords = WP_Application_Passwords::get_user_application_passwords($user_id);
    
    if (!$passwords || count($passwords) <= $max_passwords) {
        return;
    }
    
    $our_passwords = array_filter($passwords, function ($pw) {
        return isset($pw['app_id']) && $pw['app_id'] === TBC_CA_APP_ID;
    });
    
    usort($our_passwords, function ($a, $b) {
        return ($a['last_used'] ?? 0) - ($b['last_used'] ?? 0);
    });
    
    $to_remove = array_slice($our_passwords, 0, count($our_passwords) - $max_passwords);
    
    foreach ($to_remove as $pw) {
        WP_Application_Passwords::delete_application_password($user_id, $pw['uuid']);
    }
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

// =============================================================================
// ADMIN NOTICE
// =============================================================================

add_action('admin_notices', 'tbc_ca_admin_notices');

function tbc_ca_admin_notices() {
    if (!class_exists('WP_Application_Passwords')) {
        ?>
        <div class="notice notice-error">
            <p><strong>TBC Community App:</strong> Requires WordPress 5.6+ for Application Passwords.</p>
        </div>
        <?php
    }
}
