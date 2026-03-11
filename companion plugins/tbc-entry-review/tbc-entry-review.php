<?php
/**
 * Plugin Name: TBC - Entry Review
 * Plugin URI: https://twobirdschurch.com
 * Description: Admin page for reviewing Gravity Forms entries, managing phone screening status, consultation notes, and approval
 * Version: 1.7.6
 * Author: Two Birds Church
 * Author URI: https://twobirdschurch.com
 * Text Domain: tbc-entry-review
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

define('TBC_ER_VERSION', '1.7.6');
define('TBC_ER_DIR', plugin_dir_path(__FILE__));
define('TBC_ER_URL', plugin_dir_url(__FILE__));

require_once TBC_ER_DIR . 'includes/class-tbc-er-page.php';
require_once TBC_ER_DIR . 'includes/class-tbc-er-ajax.php';

add_action('plugins_loaded', function() {
    if (!class_exists('GFAPI')) {
        add_action('admin_notices', function() {
            echo '<div class="notice notice-error"><p><strong>TBC Entry Review</strong> requires Gravity Forms to be active.</p></div>';
        });
        return;
    }

    if (is_admin()) {
        new TBC_ER_Page();
        new TBC_ER_Ajax();
    }
});
