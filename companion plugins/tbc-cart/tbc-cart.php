<?php
/**
 * Plugin Name: TBC - Cart
 * Plugin URI: https://twobirdscode.com
 * Description: WooCommerce cart count integration for the TBC Community App. Provides cart item count via REST API and response headers.
 * Version: 1.0.0
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

define('TBC_CART_VERSION', '1.0.0');
define('TBC_CART_PLUGIN_DIR', plugin_dir_path(__FILE__));
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

    require_once TBC_CART_PLUGIN_DIR . 'includes/class-cart-api.php';
    require_once TBC_CART_PLUGIN_DIR . 'includes/class-response-header.php';

    TBC_Cart_API::get_instance();
    TBC_Cart_Response_Header::get_instance();
});
