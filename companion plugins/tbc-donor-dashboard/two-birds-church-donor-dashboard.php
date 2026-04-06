<?php
/**
 * Plugin Name: TBC - Donor Dashboard
 * Plugin URI: https://twobirdscode.com
 * Description: Enhanced donor dashboard with yearly PDF reports.
 * Version: 1.2.05
 * Author: Two Birds Code
 * Author URI: https://twobirdscode.com
 * Text Domain: tbc-donor-dashboard
 * License: GPL v2 or later
 */

// Prevent direct access
if (!defined('WPINC')) {
    die;
}

// Define plugin constants
define('TBC_DD_VERSION', '1.2.05');
define('TBC_DD_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('TBC_DD_PLUGIN_URL', plugin_dir_url(__FILE__));
define('TBC_DD_PLUGIN_BASENAME', plugin_basename(__FILE__));

// Require core plugin classes
require_once TBC_DD_PLUGIN_DIR . 'includes/class-tbc-donor-dashboard.php';
require_once TBC_DD_PLUGIN_DIR . 'includes/class-tbc-pdf-generator.php';
require_once TBC_DD_PLUGIN_DIR . 'includes/class-tbc-donation-data.php';

/**
 * Initialize the plugin
 */
function tbc_dd_init() {
    $plugin = new TBC_Donor_Dashboard();
    $plugin->init();
}
add_action('plugins_loaded', 'tbc_dd_init');

/**
 * Register activation hook
 */
function tbc_dd_activate() {
    flush_rewrite_rules();
}
register_activation_hook(__FILE__, 'tbc_dd_activate');

/**
 * Register deactivation hook
 */
function tbc_dd_deactivate() {
    flush_rewrite_rules();
}
register_deactivation_hook(__FILE__, 'tbc_dd_deactivate');

/**
 * Enqueue plugin styles and scripts
 */
function tbc_dd_enqueue_scripts() {
    if (is_user_logged_in()) {
        wp_enqueue_style(
            'tbc-donor-dashboard',
            TBC_DD_PLUGIN_URL . 'assets/css/donor-dashboard.css',
            array(),
            TBC_DD_VERSION
        );

        wp_enqueue_script(
            'tbc-donor-dashboard',
            TBC_DD_PLUGIN_URL . 'assets/js/donor-dashboard.js',
            array('jquery'),
            TBC_DD_VERSION,
            true
        );

        wp_localize_script('tbc-donor-dashboard', 'tbcDonorDashboard', array(
            'ajaxurl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('tbc-donor-dashboard-nonce'),
            'loading_text' => __('Generating PDF...', 'tbc-donor-dashboard'),
            'error_text' => __('Error generating PDF. Please try again.', 'tbc-donor-dashboard')
        ));
    }
}
add_action('wp_enqueue_scripts', 'tbc_dd_enqueue_scripts');

/**
 * Add admin tools menu
 */
function tbc_dd_admin_menu() {
    add_management_page(
        __('Cleanup Donor PDFs', 'tbc-donor-dashboard'),
        __('Cleanup Donor PDFs', 'tbc-donor-dashboard'),
        'manage_options',
        'tbc-cleanup-pdfs',
        'tbc_dd_cleanup_page'
    );
}
add_action('admin_menu', 'tbc_dd_admin_menu');

/**
 * Cleanup page content
 */
function tbc_dd_cleanup_page() {
    if (isset($_POST['cleanup_pdfs']) && check_admin_referer('tbc_cleanup_pdfs')) {
        $deleted_count = tbc_dd_cleanup_all_pdfs();
        echo '<div class="notice notice-success"><p>' . 
             sprintf(__('Deleted %d PDF files.', 'tbc-donor-dashboard'), $deleted_count) . 
             '</p></div>';
    }

    $upload_dir = wp_upload_dir();
    $pdf_dir = $upload_dir['basedir'] . '/donation-reports';
    $pdf_count = 0;
    
    if (is_dir($pdf_dir)) {
        $files = glob($pdf_dir . '/*.pdf');
        $pdf_count = count($files);
    }

    ?>
    <div class="wrap">
        <h1><?php esc_html_e('Cleanup Donor PDFs', 'tbc-donor-dashboard'); ?></h1>
        <p><?php printf(__('There are currently %d PDF files in the donation reports folder.', 'tbc-donor-dashboard'), $pdf_count); ?></p>
        
        <?php if ($pdf_count > 0): ?>
            <form method="post" onsubmit="return confirm('<?php esc_attr_e('Are you sure you want to delete all PDF files?', 'tbc-donor-dashboard'); ?>');">
                <?php wp_nonce_field('tbc_cleanup_pdfs'); ?>
                <input type="submit" name="cleanup_pdfs" class="button button-secondary" 
                       value="<?php esc_attr_e('Delete All PDF Files', 'tbc-donor-dashboard'); ?>">
            </form>
        <?php else: ?>
            <p><?php esc_html_e('No PDF files to cleanup.', 'tbc-donor-dashboard'); ?></p>
        <?php endif; ?>
    </div>
    <?php
}

/**
 * Delete all PDF files
 */
function tbc_dd_cleanup_all_pdfs() {
    $upload_dir = wp_upload_dir();
    $pdf_dir = $upload_dir['basedir'] . '/donation-reports';
    $deleted_count = 0;

    if (!is_dir($pdf_dir)) {
        return 0;
    }

    $files = glob($pdf_dir . '/*.pdf');
    foreach ($files as $file) {
        if (unlink($file)) {
            $deleted_count++;
        }
    }

    return $deleted_count;
}