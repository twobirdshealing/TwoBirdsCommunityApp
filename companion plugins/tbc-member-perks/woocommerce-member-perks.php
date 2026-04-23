<?php
/*
Plugin Name: TBC - Member Perks
Plugin URI: https://twobirdscode.com
Description: Manage member perks for WooCommerce Subscriptions with renewal-based discounts and role management.
Version: 1.0.0
Author: Two Birds Code
Author URI: https://twobirdscode.com
License: GPL v2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html
Text Domain: tbc-member-perks
Requires at least: 5.0
Tested up to: 6.4
Requires PHP: 7.4
*/

if (!defined('ABSPATH')) {
    exit;
}

// Plugin constants
define('WMP_PLUGIN_URL', plugin_dir_url(__FILE__));
define('WMP_PLUGIN_PATH', plugin_dir_path(__FILE__));

/**
 * Cache-busting version for assets. Uses filemtime() so CSS/JS edits invalidate
 * caches without a plugin version bump; returns null (WP omits ?ver=) if missing.
 */
function wmp_asset_ver($rel_path) {
    $full = WMP_PLUGIN_PATH . ltrim($rel_path, '/');
    return file_exists($full) ? (string) filemtime($full) : null;
}

class WMP_Main {
    
    public function __construct() {
        add_action('init', array($this, 'init'));
        add_action('wp_enqueue_scripts', array($this, 'enqueue_frontend_scripts'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
    }

    public function init() {
        // Check dependencies
        if (!$this->check_dependencies()) {
            return;
        }

        // Load plugin components
        $this->load_includes();
    }

public function enqueue_frontend_scripts() {
    global $post;

    // Only load on WooCommerce pages or pages with the member_perks shortcode
    $is_woo = function_exists('is_woocommerce') && (is_woocommerce() || is_cart() || is_checkout());
    $is_shortcode = is_a($post, 'WP_Post') && has_shortcode($post->post_content, 'member_perks');

    if (!$is_woo && !$is_shortcode) {
        return;
    }

    // Load Fluent Community theme variables (light/dark)
    if (did_action('fluent_community/enqueue_global_assets') === 0) {
        do_action('fluent_community/enqueue_global_assets', true);
    }

    // Perk labels CSS (price boxes + sale badges on WooCommerce pages)
    wp_enqueue_style(
        'wmp-perk-labels',
        WMP_PLUGIN_URL . 'css/perk-labels.css',
        array(),
        wmp_asset_ver('css/perk-labels.css')
    );

    // Dashboard styles and scripts only on the shortcode page
    if ($is_shortcode) {
        wp_enqueue_style(
            'wmp-perk-dashboard',
            WMP_PLUGIN_URL . 'css/perk-dashboard.css',
            array(),
            wmp_asset_ver('css/perk-dashboard.css')
        );

        // Load admin scripts for role management functionality
        wp_enqueue_script(
            'wmp-admin-scripts',
            WMP_PLUGIN_URL . 'js/settings.js',
            array('jquery'),
            wmp_asset_ver('js/settings.js'),
            true
        );

        // Localize script for AJAX
        wp_localize_script('wmp-admin-scripts', 'wmp_ajax', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('update_user_role_nonce')
        ));
    }
}
    public function enqueue_admin_scripts($hook) {
        // Load on our admin pages and dashboard
        $member_perks_pages = array(
            'toplevel_page_member-perks-dashboard',
            'member-perks_page_member-perks-settings', 
            'member-perks_page_import-subscribers'
        );
        
        if (strpos($hook, 'member-perks') !== false || in_array($hook, $member_perks_pages)) {
            wp_enqueue_style(
                'wmp-import-css',
                WMP_PLUGIN_URL . 'css/import.css',
                array(),
                wmp_asset_ver('css/import.css')
            );

            wp_enqueue_script(
                'wmp-admin-scripts',
                WMP_PLUGIN_URL . 'js/settings.js',
                array('jquery'),
                wmp_asset_ver('js/settings.js'),
                true
            );

            // Localize script for AJAX
            wp_localize_script('wmp-admin-scripts', 'wmp_ajax', array(
                'ajax_url' => admin_url('admin-ajax.php'),
                'nonce' => wp_create_nonce('update_user_role_nonce')
            ));
        }
    }

    private function check_dependencies() {
        // Check if WooCommerce is active
        if (!class_exists('WooCommerce')) {
            add_action('admin_notices', array($this, 'woocommerce_missing_notice'));
            return false;
        }

        return true;
    }

    public function woocommerce_missing_notice() {
        echo '<div class="notice notice-error"><p>';
        echo '<strong>WooCommerce Member Perks:</strong> ';
        echo 'WooCommerce plugin is required and must be activated.';
        echo '</p></div>';
    }

    private function load_includes() {
        $includes = array(
            'includes/create-database.php',
            'includes/discount.php',
            'includes/member-perks-dashboard.php',
            'includes/subscribers-table.php',
            'includes/member-perks-settings.php',
            'includes/import.php'
        );

        foreach ($includes as $file) {
            $file_path = WMP_PLUGIN_PATH . $file;
            if (file_exists($file_path)) {
                require_once $file_path;
            }
        }
    }

    public function activate() {
        // Flush rewrite rules
        flush_rewrite_rules();
        
        // Create database tables
        if (function_exists('wmp_create_perk_levels_table')) {
            wmp_create_perk_levels_table();
        }
        
        if (function_exists('wmp_create_imported_subscribers_table')) {
            wmp_create_imported_subscribers_table();
        }
    }

    public function deactivate() {
        // Flush rewrite rules
        flush_rewrite_rules();
    }
}

// Initialize the plugin
new WMP_Main();