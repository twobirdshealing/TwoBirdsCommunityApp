<?php
/*
Plugin Name: TBC - New Members
Plugin URI: https://twobirdscode.com
Description: New member tracking dashboard with community stats. Fluent Community native.
Version: 1.0.0
Author: Two Birds Code
Author URI: https://twobirdscode.com
License: GPL v2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html
Text Domain: tbc-new-members
*/

defined('ABSPATH') || exit;

define('TBC_NM_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('TBC_NM_PLUGIN_URL', plugin_dir_url(__FILE__));

/**
 * Cache-busting version for assets. Uses filemtime() so CSS/JS edits invalidate
 * caches without a plugin version bump; returns null (WP omits ?ver=) if missing.
 */
function tbc_nm_asset_ver($rel_path) {
    $full = TBC_NM_PLUGIN_DIR . ltrim($rel_path, '/');
    return file_exists($full) ? (string) filemtime($full) : null;
}

require_once TBC_NM_PLUGIN_DIR . 'includes/utilities.php';
require_once TBC_NM_PLUGIN_DIR . 'includes/class-dashboard.php';
require_once TBC_NM_PLUGIN_DIR . 'includes/class-members.php';
require_once TBC_NM_PLUGIN_DIR . 'includes/navigation.php';

class TBC_New_Members {
    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('init', array($this, 'init'));
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
    }

    public function init() {
        TBC_Dashboard::get_instance();
        TBC_Members_List::get_instance();
        add_shortcode('members-dashboard', array($this, 'render_dashboard_page'));
    }

    public function enqueue_scripts() {
        global $post;
        if (!is_a($post, 'WP_Post') || !has_shortcode($post->post_content, 'members-dashboard')) {
            return;
        }

        // Fluent Community theme variables (light/dark)
        if (did_action('fluent_community/enqueue_global_assets') === 0) {
            do_action('fluent_community/enqueue_global_assets', true);
        }

        wp_enqueue_script('chartjs', 'https://cdn.jsdelivr.net/npm/chart.js', array(), '3.7.0', true);

        wp_enqueue_style('tbc-nm-dashboard', TBC_NM_PLUGIN_URL . 'css/dashboard.css', array(), tbc_nm_asset_ver('css/dashboard.css'));
        wp_enqueue_style('tbc-nm-members', TBC_NM_PLUGIN_URL . 'css/members.css', array(), tbc_nm_asset_ver('css/members.css'));
        wp_enqueue_style('tbc-nm-navigation', TBC_NM_PLUGIN_URL . 'css/navigation.css', array(), tbc_nm_asset_ver('css/navigation.css'));

        wp_enqueue_script('tbc-nm-dashboard', TBC_NM_PLUGIN_URL . 'js/dashboard.js', array('jquery', 'chartjs'), tbc_nm_asset_ver('js/dashboard.js'), true);
        wp_enqueue_script('tbc-nm-members', TBC_NM_PLUGIN_URL . 'js/members.js', array('jquery'), tbc_nm_asset_ver('js/members.js'), true);
        wp_enqueue_script('tbc-nm-navigation', TBC_NM_PLUGIN_URL . 'js/navigation.js', array('jquery'), tbc_nm_asset_ver('js/navigation.js'), true);

        wp_localize_script('tbc-nm-dashboard', 'tbcMembers', array(
            'apiUrl' => rest_url('tbc-members/v1/'),
            'nonce' => wp_create_nonce('wp_rest'),
        ));
    }

    public function render_dashboard_page() {
        if (!is_user_logged_in() || !current_user_can('edit_posts')) {
            return '<p>You do not have permission to view this page.</p>';
        }

        ob_start();
        ?>
        <div class="tbc-dashboard-wrapper">
            <?php tbc_nm_render_navigation(); ?>

            <div class="tab-contents">
                <div class="tab-content active" id="dashboard-content">
                    <?php
                    $dashboard = TBC_Dashboard::get_instance();
                    echo $dashboard->render_dashboard();
                    ?>
                </div>

                <div class="tab-content" id="members-content">
                    <?php
                    $members = TBC_Members_List::get_instance();
                    echo $members->render_members_page();
                    ?>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }
}

add_action('plugins_loaded', function () {
    if (!defined('FLUENT_COMMUNITY_PLUGIN_VERSION')) {
        add_action('admin_notices', function () {
            ?>
            <div class="notice notice-error">
                <p><?php esc_html_e('TBC - New Members requires Fluent Community to be installed and activated.', 'tbc-new-members'); ?></p>
            </div>
            <?php
        });
        return;
    }
    TBC_New_Members::get_instance();
});
