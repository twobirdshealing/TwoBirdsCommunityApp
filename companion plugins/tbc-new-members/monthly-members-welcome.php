<?php
/*
Plugin Name: Two Birds Church - New Members
Plugin URI: https://twobirdschurch.com
Description: New member tracking dashboard with community stats. Fluent Community native.
Version: 3.0.0
Author: Two Birds Code
License: GPL2
*/

defined('ABSPATH') || exit;

define('TBC_NM_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('TBC_NM_PLUGIN_URL', plugin_dir_url(__FILE__));
define('TBC_NM_VERSION', '3.0.0');

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

        wp_enqueue_style('tbc-nm-dashboard', TBC_NM_PLUGIN_URL . 'css/dashboard.css', array(), TBC_NM_VERSION);
        wp_enqueue_style('tbc-nm-members', TBC_NM_PLUGIN_URL . 'css/members.css', array(), TBC_NM_VERSION);
        wp_enqueue_style('tbc-nm-navigation', TBC_NM_PLUGIN_URL . 'css/navigation.css', array(), TBC_NM_VERSION);

        wp_enqueue_script('tbc-nm-dashboard', TBC_NM_PLUGIN_URL . 'js/dashboard.js', array('jquery', 'chartjs'), TBC_NM_VERSION, true);
        wp_enqueue_script('tbc-nm-members', TBC_NM_PLUGIN_URL . 'js/members.js', array('jquery'), TBC_NM_VERSION, true);
        wp_enqueue_script('tbc-nm-navigation', TBC_NM_PLUGIN_URL . 'js/navigation.js', array('jquery'), TBC_NM_VERSION, true);

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

function tbc_new_members_init() {
    return TBC_New_Members::get_instance();
}

add_action('plugins_loaded', 'tbc_new_members_init');
