<?php
/**
 * Plugin Name: TBC WooCommerce Calendar
 * Plugin URI: https://twobirdscode.com
 * Description: Event calendar system - sorts WooCommerce products by event date and displays them in a calendar view.
 * Version: 1.0.0
 * Author: Two Birds Code
 * Author URI: https://twobirdscode.com
 * Text Domain: tbc-wc-calendar
 * 
 * @package TBC_WC_Calendar
 */

if (!defined('ABSPATH')) {
    exit;
}

defined('ABSPATH') || exit;

// Plugin version constant
define('TBC_WC_VERSION', '1.0.0');

/**
 * Cache-busting version for assets.
 *
 * Uses filemtime() when the file exists so small CSS/JS edits bust the browser
 * cache without a plugin version bump. Falls back to TBC_WC_VERSION.
 *
 * @param string $rel_path Asset path relative to the plugin root (e.g. 'css/foo.css').
 * @return string Version string suitable for wp_enqueue_* $ver param.
 */
function tbc_wc_asset_ver($rel_path) {
    $full = plugin_dir_path(__FILE__) . ltrim($rel_path, '/');
    return file_exists($full) ? (string) filemtime($full) : TBC_WC_VERSION;
}

// Include files
require_once plugin_dir_path(__FILE__) . 'includes/add-recurring-dates.php';
require_once plugin_dir_path(__FILE__) . 'includes/add-date-time.php';
require_once plugin_dir_path(__FILE__) . 'includes/add-location.php';
require_once plugin_dir_path(__FILE__) . 'includes/add-excerpt.php';
require_once plugin_dir_path(__FILE__) . 'includes/add-rsvp.php';
require_once plugin_dir_path(__FILE__) . 'includes/add-event-date-to-order.php';
require_once plugin_dir_path(__FILE__) . 'includes/add-progress-goal.php';

require_once plugin_dir_path(__FILE__) . 'includes/calendar-featured-event.php';
require_once plugin_dir_path(__FILE__) . 'includes/calendar-functions.php';
require_once plugin_dir_path(__FILE__) . 'includes/ics-feed.php';
require_once plugin_dir_path(__FILE__) . 'includes/api-rest.php';
require_once plugin_dir_path(__FILE__) . 'includes/calendar-settings.php';
require_once plugin_dir_path(__FILE__) . 'includes/plugin-settings.php';
require_once plugin_dir_path(__FILE__) . 'includes/waitlist.php';
require_once plugin_dir_path(__FILE__) . 'includes/rsvp-functions.php';
require_once plugin_dir_path(__FILE__) . 'includes/progress-functions.php';
require_once plugin_dir_path(__FILE__) . 'includes/product-extra-tabs.php';

// Template Views
require_once plugin_dir_path(__FILE__) . 'includes/template-main-calendar.php';
require_once plugin_dir_path(__FILE__) . 'includes/template-month-calendar.php';
require_once plugin_dir_path(__FILE__) . 'includes/template-event-details.php';
require_once plugin_dir_path(__FILE__) . 'includes/template-series-calendar.php';


/**
 * Frontend scripts and styles
 */
function tbc_wc_enqueue_frontend_assets() {
    // Featured event styles
    wp_enqueue_style('tbc-wc-featured-styles', plugins_url('css/calendar-featured-event.css', __FILE__), [], tbc_wc_asset_ver('css/calendar-featured-event.css'));

    // Main Calendar Template styles
    wp_enqueue_style('tbc-wc-main-view-styles', plugins_url('css/template-main-view.css', __FILE__), [], tbc_wc_asset_ver('css/template-main-view.css'));
    wp_enqueue_style('tbc-wc-month-view-styles', plugins_url('css/template-month-view.css', __FILE__), [], tbc_wc_asset_ver('css/template-month-view.css'));
    wp_enqueue_style('tbc-wc-event-view-styles', plugins_url('css/template-event-view.css', __FILE__), [], tbc_wc_asset_ver('css/template-event-view.css'));
    wp_enqueue_style('tbc-wc-series-view-styles', plugins_url('css/template-series-view.css', __FILE__), [], tbc_wc_asset_ver('css/template-series-view.css'));

    // Google Maps styles
    wp_enqueue_style('tbc-wc-google-maps-styles', plugins_url('css/google-maps.css', __FILE__), [], tbc_wc_asset_ver('css/google-maps.css'));

    // Progress bar styles
    wp_enqueue_style('tbc-wc-progress-front-styles', plugins_url('css/progress-front.css', __FILE__), [], tbc_wc_asset_ver('css/progress-front.css'));

    // ICS Calendar Subscription styles
    wp_enqueue_style('tbc-wc-ics-subscription-styles', plugins_url('css/ics-subscription.css', __FILE__), [], tbc_wc_asset_ver('css/ics-subscription.css'));

    // Waitlist frontend styles
    if (is_product() || has_shortcode(get_post()->post_content ?? '', 'tbc_wc_waitlist')) {
        wp_enqueue_style('tbc-wc-waitlist-front-styles', plugins_url('css/waitlist-front.css', __FILE__), [], tbc_wc_asset_ver('css/waitlist-front.css'));
        wp_enqueue_script('tbc-wc-waitlist-front-script', plugins_url('js/waitlist-front.js', __FILE__), ['jquery'], tbc_wc_asset_ver('js/waitlist-front.js'), true);
    }

    // FAQ & Tabs frontend — only if the current product has extra tabs configured
    if (is_product() && !empty(get_post_meta(get_the_ID(), '_tbc_wc_product_tabs', true))) {
        wp_enqueue_style('tbc-wc-extra-tabs-front-styles', plugins_url('css/product-extra-tabs-front.css', __FILE__), [], tbc_wc_asset_ver('css/product-extra-tabs-front.css'));
        wp_enqueue_script('tbc-wc-extra-tabs-front-script', plugins_url('js/product-extra-tabs-front.js', __FILE__), ['jquery'], tbc_wc_asset_ver('js/product-extra-tabs-front.js'), true);
    }

    // JavaScript files
    wp_enqueue_script('tbc-wc-dashboard-script', plugins_url('js/event-dashboard.js', __FILE__), ['jquery'], tbc_wc_asset_ver('js/event-dashboard.js'), true);
    wp_enqueue_script('tbc-wc-month-view-script', plugins_url('js/template-month-view.js', __FILE__), ['jquery'], tbc_wc_asset_ver('js/template-month-view.js'), true);

    // ICS Calendar Subscription scripts
    wp_enqueue_script('tbc-wc-ics-subscription-script', plugins_url('js/ics-subscription.js', __FILE__), ['jquery'], tbc_wc_asset_ver('js/ics-subscription.js'), true);

    // Google Maps scripts are inlined directly in the template output (see add-location.php)
    // to ensure they load inside Fluent Community's headless templates where wp_footer() may not fire
}
add_action('wp_enqueue_scripts', 'tbc_wc_enqueue_frontend_assets');

/**
 * Admin scripts and styles
 */
function tbc_wc_enqueue_admin_assets($hook) {
    if (!in_array($hook, ['post.php', 'post-new.php']) || get_post_type() !== 'product') {
        return;
    }

    // jQuery UI datepicker
    wp_enqueue_script('jquery-ui-datepicker');
    wp_enqueue_style('jquery-ui-style', '//ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/themes/smoothness/jquery-ui.css', '', '1.12.1');
    
    // Main admin styles
    wp_enqueue_style('tbc-wc-admin-styles', plugins_url('css/calendar-main-admin.css', __FILE__), [], tbc_wc_asset_ver('css/calendar-main-admin.css'));

    // Recurring dates styles
    wp_enqueue_style('tbc-wc-recurring-dates-styles', plugins_url('css/recurring-dates-admin.css', __FILE__), [], tbc_wc_asset_ver('css/recurring-dates-admin.css'));

    // Recurring summary script
    wp_enqueue_script('tbc-wc-recurring-summary-script', plugins_url('js/recurring-summary.js', __FILE__), ['jquery'], tbc_wc_asset_ver('js/recurring-summary.js'), true);

    // Main dates admin script
    wp_enqueue_script('tbc-wc-main-dates-admin-script', plugins_url('js/main-dates-admin.js', __FILE__), ['jquery', 'jquery-ui-datepicker'], tbc_wc_asset_ver('js/main-dates-admin.js'), true);

    // Recurring dates admin script
    wp_enqueue_script('tbc-wc-recurring-dates-admin-script', plugins_url('js/recurring-dates-admin.js', __FILE__), ['jquery', 'jquery-ui-datepicker', 'jquery-ui-sortable'], tbc_wc_asset_ver('js/recurring-dates-admin.js'), true);

    // Progress bar admin styles
    wp_enqueue_style('tbc-wc-progress-admin-styles', plugins_url('css/progress-admin.css', __FILE__), [], tbc_wc_asset_ver('css/progress-admin.css'));

    // Waitlist admin styles and scripts
    wp_enqueue_style('tbc-wc-waitlist-admin-styles', plugins_url('css/waitlist-admin.css', __FILE__), [], tbc_wc_asset_ver('css/waitlist-admin.css'));
    wp_enqueue_script('tbc-wc-waitlist-admin-script', plugins_url('js/waitlist-admin.js', __FILE__), ['jquery'], tbc_wc_asset_ver('js/waitlist-admin.js'), true);

    // Localize waitlist script
    wp_localize_script('tbc-wc-waitlist-admin-script', 'tbc_wc_waitlist', [
        'ajax_url' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('tbc_wc_waitlist_admin'),
        'confirm_remove' => __('Are you sure you want to remove this user from the waitlist?', 'tbc-wc-calendar')
    ]);

    // FAQ & Tabs admin — load the WP editor module, then our styles + repeater JS
    wp_enqueue_editor();
    wp_enqueue_style('tbc-wc-extra-tabs-admin-styles', plugins_url('css/product-extra-tabs-admin.css', __FILE__), [], tbc_wc_asset_ver('css/product-extra-tabs-admin.css'));
    wp_enqueue_script('tbc-wc-extra-tabs-admin-script', plugins_url('js/product-extra-tabs-admin.js', __FILE__), ['jquery', 'jquery-ui-sortable', 'editor'], tbc_wc_asset_ver('js/product-extra-tabs-admin.js'), true);
}
add_action('admin_enqueue_scripts', 'tbc_wc_enqueue_admin_assets');

/**
 * Remove default WooCommerce shop loop
 */
function tbc_wc_remove_default_shop_loop() {
    add_action('wp', function() {
        remove_all_actions('woocommerce_shop_loop');
        remove_all_actions('woocommerce_after_shop_loop');
        remove_all_actions('woocommerce_before_shop_loop_item');
        remove_all_actions('woocommerce_before_shop_loop_item_title');
        remove_all_actions('woocommerce_shop_loop_item_title');
        remove_all_actions('woocommerce_after_shop_loop_item_title');
        remove_all_actions('woocommerce_after_shop_loop_item');
        
        remove_action('woocommerce_shop_loop', 'wc_setup_loop');
        remove_action('woocommerce_shop_loop', 'woocommerce_product_loop_start', 10);
        remove_action('woocommerce_shop_loop', 'woocommerce_product_loop_end', 10);
        
        remove_action('woocommerce_before_shop_loop', 'woocommerce_result_count', 20);
        remove_action('woocommerce_before_shop_loop', 'woocommerce_catalog_ordering', 30);
    }, 999);
    
    remove_all_filters('woocommerce_product_loop_start');
    remove_all_filters('woocommerce_product_loop_end');
    remove_all_filters('woocommerce_shop_loop_item_title');
}
add_action('init', 'tbc_wc_remove_default_shop_loop');

/**
 * Plugin activation
 */
register_activation_hook(__FILE__, function() {
    tbc_wc_flush_ics_feed_rules();
});

/**
 * Plugin deactivation
 */
register_deactivation_hook(__FILE__, 'flush_rewrite_rules');