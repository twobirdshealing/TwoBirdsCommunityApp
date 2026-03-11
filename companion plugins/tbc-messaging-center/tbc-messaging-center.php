<?php
/**
 * Plugin Name: TBC - Messaging Center
 * Plugin URI: https://twobirdschurch.com/
 * Description: Unified messaging system for SMS, calls, voicemail, and scheduling with BuddyBoss integration
 * Version: 3.1.1
 * Author: Two Birds Church
 * Author URI: https://community.twobirdschurch.com/
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('TBC_MC_URL', plugin_dir_url(__FILE__));
define('TBC_MC_VERSION', '3.1.1');
define('TBC_MC_PATH', plugin_dir_path(__FILE__));

// Load Twilio SDK
require_once(TBC_MC_PATH . 'src/Twilio/autoload.php');

// Include helpers FIRST
require TBC_MC_PATH . 'includes/helper-message-center-database.php';
require TBC_MC_PATH . 'includes/helper-sms.php';
require TBC_MC_PATH . 'includes/helper-incoming-messages.php';
require TBC_MC_PATH . 'includes/buddyboss-group-settings.php';

// Feature includes
require TBC_MC_PATH . 'includes/call-group-tabs.php';
require TBC_MC_PATH . 'includes/call-twilio-functions.php';
require TBC_MC_PATH . 'includes/call-center.php';
require TBC_MC_PATH . 'includes/message-center-shortcode.php';
require TBC_MC_PATH . 'includes/sms-group-tabs.php';
require TBC_MC_PATH . 'includes/sms-twilio-functions.php';
require TBC_MC_PATH . 'includes/sms-send-template.php';
require TBC_MC_PATH . 'includes/sms-center-shortcode.php';

// Scheduler includes
require TBC_MC_PATH . 'includes/scheduler-functions.php';
require TBC_MC_PATH . 'includes/scheduler-shortcode.php';

// Public API
require TBC_MC_PATH . 'includes/sms-api.php';

/**
 * Load BuddyBoss notification extension
 */
function tbc_mc_load_notification() {
    require TBC_MC_PATH . 'includes/buddyboss-message-notification.php';
}
add_action('bp_loaded', 'tbc_mc_load_notification');

/**
 * Add AJAX URL to frontend
 */
function tbc_mc_add_ajaxurl() {
    echo "<script type=\"text/javascript\">
           var ajaxurl = '" . admin_url('admin-ajax.php') . "';
         </script>";
}
add_action('wp_head', 'tbc_mc_add_ajaxurl');

/**
 * Plugin activation - create database tables
 */
function tbc_mc_activate() {
    tbc_mc_create_messages_table();
    tbc_mc_create_scheduler_table();
}
register_activation_hook(__FILE__, 'tbc_mc_activate');

/**
 * Enqueue scripts and styles for messaging center
 */
function tbc_mc_enqueue_assets() {
    global $post;

    // Check if message center shortcode is present
    $is_shortcode_in_post = is_a($post, 'WP_Post') &&
        has_shortcode($post->post_content, 'tbc_mc_message_center');

    // Check if on BuddyBoss group messaging tabs
    $is_messaging_tab = function_exists('bp_is_group') && bp_is_group() && 
                       (bp_is_current_action('send-sms') || bp_is_current_action('initiate-call'));

    if ($is_shortcode_in_post || $is_messaging_tab) {

        // Load feedback helpers FIRST - localize tbcMC here so all dependent scripts have access
        wp_enqueue_script('tbc-mc-helpers', TBC_MC_URL . 'js/sms-helpers.js', array('jquery'), TBC_MC_VERSION, true);
        wp_localize_script('tbc-mc-helpers', 'tbcMC', [
            'ajaxurl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('tbc_mc_nonce'),
            'mobileBreakpoint' => 768,
            'searchDebounceMs' => 300,
            'minSearchLength' => 2
        ]);

        // Load EmojiMart from CDN
        wp_enqueue_script('emoji-mart', 'https://cdn.jsdelivr.net/npm/emoji-mart@latest/dist/browser.js', array(), null, true);

        // Load emoji picker
        wp_enqueue_script('tbc-mc-emoji-picker', TBC_MC_URL . 'js/emoji-picker.js', array('emoji-mart', 'jquery'), TBC_MC_VERSION, true);

        // Scheduler
        wp_enqueue_script('tbc-mc-scheduler', TBC_MC_URL . 'js/scheduler.js', array('jquery', 'tbc-mc-helpers'), TBC_MC_VERSION, true);
        wp_enqueue_style('tbc-mc-scheduler', TBC_MC_URL . 'css/scheduler.css', array(), TBC_MC_VERSION);

        // Group messaging
        wp_enqueue_script('tbc-mc-group', TBC_MC_URL . 'js/sms-group.js', array('jquery', 'tbc-mc-helpers'), TBC_MC_VERSION, true);

        // SMS center
        wp_enqueue_script('tbc-mc-sms-center', TBC_MC_URL . 'js/sms-center.js', array('jquery', 'tbc-mc-helpers'), TBC_MC_VERSION, true);
        wp_enqueue_style('tbc-mc-sms-center', TBC_MC_URL . 'css/sms-center.css', array(), TBC_MC_VERSION);

        // Call center
        wp_enqueue_script('jquery-ui-autocomplete');
        wp_enqueue_style('jquery-ui', '//code.jquery.com/ui/1.12.1/themes/base/jquery-ui.css');
        wp_enqueue_script('tbc-mc-call-search', TBC_MC_URL . 'js/call-search.js', array('jquery', 'tbc-mc-helpers', 'jquery-ui-autocomplete'), TBC_MC_VERSION, true);
        wp_enqueue_style('tbc-mc-call-center', TBC_MC_URL . 'css/call-center.css', array(), TBC_MC_VERSION);

        // Templates
        wp_enqueue_script('tbc-mc-templates', TBC_MC_URL . 'js/templates.js', array('jquery'), TBC_MC_VERSION, true);
        wp_enqueue_style('tbc-mc-template', TBC_MC_URL . 'css/sms-template.css', array(), TBC_MC_VERSION);

        // Message center
        wp_enqueue_script('tbc-mc-message-center', TBC_MC_URL . 'js/message-center.js', array('jquery', 'tbc-mc-helpers'), TBC_MC_VERSION, true);
        wp_enqueue_style('tbc-mc-message-center', TBC_MC_URL . 'css/message-center.css', array(), TBC_MC_VERSION);

        // Media uploader and utilities
        wp_enqueue_media();        
        wp_enqueue_script('tbc-mc-media-uploader', TBC_MC_URL . 'js/sms-media-uploader.js', array('jquery'), TBC_MC_VERSION, true);        
        wp_enqueue_script('tbc-mc-char-counter', TBC_MC_URL . 'js/char-counter.js', array('jquery'), TBC_MC_VERSION, true);
        wp_enqueue_script('tbc-mc-checkbox-call', TBC_MC_URL . 'js/checkbox-call.js', array('jquery'), TBC_MC_VERSION, true);
    }
}
add_action('wp_enqueue_scripts', 'tbc_mc_enqueue_assets', 10);