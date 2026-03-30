<?php
/**
 * Plugin Name: TBC - Cart
 * Plugin URI: https://twobirdscode.com
 * Description: WooCommerce integration for the TBC Community App and Fluent Community. Provides cart count API, response headers, mini cart, WooCommerce page rendering in Fluent frame, and customizer settings.
 * Version: 2.0.2
 * Author: Two Birds Code
 * Author URI: https://twobirdscode.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: tbc-cart
 * Requires Plugins: woocommerce
 *
 * @see CHANGELOG.md for version history
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

define('TBC_CART_VERSION', '2.0.2');
define('TBC_CART_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('TBC_CART_PLUGIN_URL', plugin_dir_url(__FILE__));
define('TBC_CART_REST_NAMESPACE', 'tbc-cart/v1');

/**
 * Initialize the plugin after all plugins are loaded.
 * Checks for WooCommerce before loading components.
 */
add_action('plugins_loaded', function () {
    if (!class_exists('WooCommerce')) {
        add_action('admin_notices', function () {
            echo '<div class="notice notice-error"><p>';
            echo '<strong>TBC - Cart</strong> requires WooCommerce to be installed and active.';
            echo '</p></div>';
        });
        return;
    }

    // --- Core: Cart API + Response Header (always load with WooCommerce) ---
    require_once TBC_CART_PLUGIN_DIR . 'includes/class-cart-api.php';
    require_once TBC_CART_PLUGIN_DIR . 'includes/class-response-header.php';

    TBC_Cart_API::get_instance();
    TBC_Cart_Response_Header::get_instance();

    // --- Settings page (always load — needed even without Fluent Community) ---
    require_once TBC_CART_PLUGIN_DIR . 'includes/class-wc-customizer.php';
    TBC_Cart_WC_Settings::get_instance();

    // --- Fluent Community integration (only if FC is active) ---
    if (tbc_cart_has_fluent_community()) {
        require_once TBC_CART_PLUGIN_DIR . 'includes/class-wc-integration.php';
        require_once TBC_CART_PLUGIN_DIR . 'includes/class-wc-assets.php';

        TBC_Cart_WC_Integration::get_instance();
        TBC_Cart_WC_Assets::get_instance();
    }
});

/**
 * WooCommerce theme support declarations
 *
 * Called from the plugin at a late priority so it doesn't matter
 * whether the theme declares support or not.
 */
add_action('after_setup_theme', function () {
    if (!class_exists('WooCommerce')) {
        return;
    }

    add_theme_support('woocommerce');
    add_theme_support('wc-product-gallery-zoom');
    add_theme_support('wc-product-gallery-lightbox');
    add_theme_support('wc-product-gallery-slider');
}, 99);

/**
 * WooCommerce template routing for Fluent Community frame
 *
 * Forces WooCommerce pages into the Fluent Community frame template
 * when integration is enabled.
 */
add_filter('fluent_community/template_slug', function ($templateSlug) {
    if (!function_exists('is_woocommerce')) {
        return $templateSlug;
    }

    // Customizer helpers are loaded at plugins_loaded — this filter fires later, so they're available
    if (function_exists('tbc_cart_wc_integration_enabled') && tbc_cart_wc_integration_enabled()) {
        if (tbc_cart_is_wc_page()) {
            return tbc_cart_get_wc_template();
        }
    }

    return $templateSlug;
});
