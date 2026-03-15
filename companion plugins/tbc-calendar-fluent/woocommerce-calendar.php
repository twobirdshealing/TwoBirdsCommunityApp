<?php
/**
 * Plugin Name: TBC WooCommerce Calendar
 * Plugin URI: https://twobirdscode.com
 * Description: Event calendar system - sorts WooCommerce products by event date and displays them in a calendar view.
 * Version: 5.1.0
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
define('TBC_WC_VERSION', '5.1.0');

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
    wp_enqueue_style('tbc-wc-featured-styles', plugins_url('css/calendar-featured-event.css', __FILE__), [], TBC_WC_VERSION);

    // Main Calendar Template styles
    wp_enqueue_style('tbc-wc-main-view-styles', plugins_url('css/template-main-view.css', __FILE__), [], TBC_WC_VERSION);
    wp_enqueue_style('tbc-wc-month-view-styles', plugins_url('css/template-month-view.css', __FILE__), [], TBC_WC_VERSION);
    wp_enqueue_style('tbc-wc-event-view-styles', plugins_url('css/template-event-view.css', __FILE__), [], TBC_WC_VERSION);
    wp_enqueue_style('tbc-wc-series-view-styles', plugins_url('css/template-series-view.css', __FILE__), [], TBC_WC_VERSION);
        
    // Google Maps styles
    wp_enqueue_style('tbc-wc-google-maps-styles', plugins_url('css/google-maps.css', __FILE__), [], TBC_WC_VERSION);
    
    // Progress bar styles
    wp_enqueue_style('tbc-wc-progress-front-styles', plugins_url('css/progress-front.css', __FILE__), [], TBC_WC_VERSION);
    
    // ICS Calendar Subscription styles
    wp_enqueue_style('tbc-wc-ics-subscription-styles', plugins_url('css/ics-subscription.css', __FILE__), [], TBC_WC_VERSION);
    
    // Waitlist frontend styles
    if (is_product() || has_shortcode(get_post()->post_content ?? '', 'tbc_wc_waitlist')) {
        wp_enqueue_style('tbc-wc-waitlist-front-styles', plugins_url('css/waitlist-front.css', __FILE__), [], TBC_WC_VERSION);        
        wp_enqueue_script('tbc-wc-waitlist-front-script', plugins_url('js/waitlist-front.js', __FILE__), ['jquery'], TBC_WC_VERSION, true);
    }
    
    // JavaScript files
    wp_enqueue_script('tbc-wc-dashboard-script', plugins_url('js/event-dashboard.js', __FILE__), ['jquery'], TBC_WC_VERSION, true);
    wp_enqueue_script('tbc-wc-month-view-script', plugins_url('js/template-month-view.js', __FILE__), ['jquery'], TBC_WC_VERSION, true);
    
    // ICS Calendar Subscription scripts
    wp_enqueue_script('tbc-wc-ics-subscription-script', plugins_url('js/ics-subscription.js', __FILE__), ['jquery'], TBC_WC_VERSION, true);

    // Google Maps - only load if API key is configured
    $api_key = get_option('tbc_wc_google_maps_api_key', '');
    if (!empty($api_key)) {
        wp_register_script('tbc-wc-google-maps-script', plugins_url('js/google-maps.js', __FILE__), ['jquery'], TBC_WC_VERSION, true);
        wp_add_inline_script('tbc-wc-google-maps-script', "
            (g=>{var h,a,k,p='The Google Maps JavaScript API',c='google',l='importLibrary',q='__ib__',m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement('script'));e.set('libraries',[...r]+'');for(k in g)e.set(k.replace(/[A-Z]/g,t=>'_'+t[0].toLowerCase()),g[k]);e.set('callback',c+'.maps.'+q);a.src=`https://maps.googleapis.com/maps/api/js?`+e;d[q]=f;a.onerror=()=>h=n(Error(p+' could not load.'));a.nonce=m.querySelector('script[nonce]')?.nonce||'';m.head.append(a)}));d[l]?console.warn(p+' only loads once. Ignoring:',g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})({
                key: '{$api_key}',
                v: 'weekly',
                libraries: 'places'
            });
        ");
    }
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
    wp_enqueue_style('tbc-wc-admin-styles', plugins_url('css/calendar-main-admin.css', __FILE__), [], TBC_WC_VERSION);
    
    // Recurring dates styles
    wp_enqueue_style('tbc-wc-recurring-dates-styles', plugins_url('css/recurring-dates-admin.css', __FILE__), [], TBC_WC_VERSION);
    
    // Recurring summary script
    wp_enqueue_script('tbc-wc-recurring-summary-script', plugins_url('js/recurring-summary.js', __FILE__), ['jquery'], TBC_WC_VERSION, true);
    
    // Main dates admin script
    wp_enqueue_script('tbc-wc-main-dates-admin-script', plugins_url('js/main-dates-admin.js', __FILE__), ['jquery', 'jquery-ui-datepicker'], TBC_WC_VERSION, true);
    
    // Recurring dates admin script
    wp_enqueue_script('tbc-wc-recurring-dates-admin-script', plugins_url('js/recurring-dates-admin.js', __FILE__), ['jquery', 'jquery-ui-datepicker', 'jquery-ui-sortable'], TBC_WC_VERSION, true);
         
    // Progress bar admin styles
    wp_enqueue_style('tbc-wc-progress-admin-styles', plugins_url('css/progress-admin.css', __FILE__), [], TBC_WC_VERSION);
    
    // Waitlist admin styles and scripts
    wp_enqueue_style('tbc-wc-waitlist-admin-styles', plugins_url('css/waitlist-admin.css', __FILE__), [], TBC_WC_VERSION);
    wp_enqueue_script('tbc-wc-waitlist-admin-script', plugins_url('js/waitlist-admin.js', __FILE__), ['jquery'], TBC_WC_VERSION, true);
    
    // Localize waitlist script
    wp_localize_script('tbc-wc-waitlist-admin-script', 'tbc_wc_waitlist', [
        'ajax_url' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('tbc_wc_waitlist_admin'),
        'confirm_remove' => __('Are you sure you want to remove this user from the waitlist?', 'tbc-wc-calendar')
    ]);
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