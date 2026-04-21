<?php
/**
 * Plugin Name: TBC - Participant Frontend
 * Description: Display WooCommerce event products and attendee management.
 * Version: 1.0.0
 * Author: Two Birds Code
 *
 * @package TBC_Participant_Frontend
 */

if (!defined('ABSPATH')) {
    exit;
}

define('TBC_PF_VERSION', '1.0.0');

/**
 * Cache-busting version for assets.
 * Uses filemtime() when the file exists so small CSS/JS edits bust the browser
 * cache without a plugin version bump. Falls back to TBC_PF_VERSION.
 */
function tbc_pf_asset_ver($rel_path) {
    $full = plugin_dir_path(__FILE__) . ltrim($rel_path, '/');
    return file_exists($full) ? (string) filemtime($full) : TBC_PF_VERSION;
}

// Fluent Community course IDs (configurable via wp_options, with known defaults)
define('TBC_PF_COURSE_SAPO_PRE', intval(get_option('tbc_pf_course_sapo_pre', 116)));
define('TBC_PF_COURSE_CEREMONY_PRE', intval(get_option('tbc_pf_course_ceremony_pre', 114)));
define('TBC_PF_COURSE_CEREMONY_POST', intval(get_option('tbc_pf_course_ceremony_post', 115)));
define('TBC_PF_CEREMONY_SPACE_PARENT', intval(get_option('tbc_pf_ceremony_space_parent', 112)));

/**
 * Check if Fluent Community is active
 */
function tbc_pf_is_fluent_active() {
    return defined('FLUENT_COMMUNITY_PLUGIN_VERSION');
}

class TBC_PF_Plugin {

    private static $instance = null;
    private $shortcode_present = false;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->include_files();
        
        add_action('init', [$this, 'init']);
        add_action('wp', [$this, 'check_for_shortcode']);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_scripts']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_select2']);

        // Load notification class when Fluent Community is active
        add_action('init', function() {
            if (tbc_pf_is_fluent_active()) {
                require_once __DIR__ . '/includes/event-notes-notification.php';
            }
        });
    }

    private function include_files() {
        $files = [
            'event-list-helpers.php',
            'participant-details-helpers.php',
            'event-dashboard-helpers.php',
            'team-management-helpers.php',
            'post-management-helpers.php',
            'post-settings-helpers.php',
            'add-team-members.php',
            'add-post.php',
            'add-group.php',
            'event-list-display.php',
            'participant-details-display.php',
            'event-dashboard-display.php',
            'team-management-display.php',
            'post-management-display.php',
            'post-settings-display.php',
            'sms-tab.php'
        ];

        foreach ($files as $file) {
            require_once plugin_dir_path(__FILE__) . 'includes/' . $file;
        }
    }

    public function init() {
        new TBC_PF_Event_List_Display();
    }

    public function check_for_shortcode() {
        global $post;

        if (is_a($post, 'WP_Post') && (
            has_shortcode($post->post_content, 'tbc_pf_participant_list') ||
            is_page('participant-list')
        )) {
            $this->shortcode_present = true;
        }
    }

    public function enqueue_scripts() {
        if (!$this->shortcode_present) {
            return;
        }

        $plugin_url = plugin_dir_url(__FILE__);
        
        wp_enqueue_media();
        
        $styles = [
            'tbc-pf-table' => 'css/front-end-table.css',
            'tbc-pf-dashboard' => 'css/details-dashboard.css',
            'tbc-pf-management-panel' => 'css/management-panel.css',
            'tbc-pf-team-management' => 'css/team-management.css',
            'tbc-pf-post-management' => 'css/post-management.css',
            'tbc-pf-post-settings' => 'css/post-settings.css',
            'tbc-pf-event-list' => 'css/event-date-list.css'
        ];

        foreach ($styles as $handle => $path) {
            wp_enqueue_style($handle, $plugin_url . $path, [], tbc_pf_asset_ver($path));
        }

        // Inject Fluent Community CSS variables so --fcom-* tokens resolve in dark mode
        if (tbc_pf_is_fluent_active() && class_exists('FluentCommunity\\App\\Functions\\Utility')) {
            $fcom_css = \FluentCommunity\App\Functions\Utility::getColorCssVariables();
            if ($fcom_css) {
                wp_add_inline_style('tbc-pf-table', $fcom_css);
            }
        }
        
        // EasyMDE markdown editor (CDN) — only for admins who can access post settings
        if (current_user_can('manage_options')) {
            wp_enqueue_style('easymde', 'https://cdn.jsdelivr.net/npm/easymde@2.18.0/dist/easymde.min.css', [], '2.18.0');
            wp_enqueue_script('easymde', 'https://cdn.jsdelivr.net/npm/easymde@2.18.0/dist/easymde.min.js', [], '2.18.0', true);
        }

        $scripts = [
            'tbc-pf-event-list' => 'js/event-list.js',
            'tbc-pf-participant-details' => 'js/participant-details.js',
            'tbc-pf-management-panel' => 'js/management-panel.js',
            'tbc-pf-team-management' => 'js/team-management.js',
            'tbc-pf-post-management' => 'js/post-management.js',
            'tbc-pf-post-settings' => 'js/post-settings.js'
        ];

        foreach ($scripts as $handle => $path) {
            $deps = ['jquery'];
            if ($handle === 'tbc-pf-post-settings') {
                $deps[] = 'easymde';
            }
            wp_enqueue_script($handle, $plugin_url . $path, $deps, tbc_pf_asset_ver($path), true);
            wp_localize_script($handle, 'tbcPFAjax', [
                'ajaxurl' => admin_url('admin-ajax.php')
            ]);
        }
        
        // Enqueue Select2 for searchable dropdowns on frontend
        wp_enqueue_style('select2', WC()->plugin_url() . '/assets/css/select2.css', [], TBC_PF_VERSION);
        wp_enqueue_script('select2', WC()->plugin_url() . '/assets/js/select2/select2.full.min.js', ['jquery'], TBC_PF_VERSION, true);

        // Enqueue Message Center assets for SMS tab (uses TBC_MC_URL + tbc_mc_asset_ver() from Message Center plugin)
        if (defined('TBC_MC_URL') && function_exists('tbc_mc_render_sms_form') && function_exists('tbc_mc_asset_ver')) {
            wp_enqueue_style('tbc-mc-scheduler', TBC_MC_URL . 'css/scheduler.css', [], tbc_mc_asset_ver('css/scheduler.css'));
            wp_enqueue_style('tbc-mc-sms-center', TBC_MC_URL . 'css/sms-center.css', [], tbc_mc_asset_ver('css/sms-center.css'));
            wp_enqueue_style('tbc-mc-template', TBC_MC_URL . 'css/sms-template.css', [], tbc_mc_asset_ver('css/sms-template.css'));

            wp_enqueue_script('tbc-mc-helpers', TBC_MC_URL . 'js/sms-helpers.js', ['jquery'], tbc_mc_asset_ver('js/sms-helpers.js'), true);
            wp_enqueue_script('tbc-mc-scheduler', TBC_MC_URL . 'js/scheduler.js', ['jquery', 'tbc-mc-helpers'], tbc_mc_asset_ver('js/scheduler.js'), true);
            wp_enqueue_script('tbc-mc-templates', TBC_MC_URL . 'js/templates.js', ['jquery'], tbc_mc_asset_ver('js/templates.js'), true);
            wp_enqueue_script('tbc-mc-char-counter', TBC_MC_URL . 'js/char-counter.js', ['jquery'], tbc_mc_asset_ver('js/char-counter.js'), true);
            wp_enqueue_script('tbc-mc-media-uploader', TBC_MC_URL . 'js/sms-media-uploader.js', ['jquery'], tbc_mc_asset_ver('js/sms-media-uploader.js'), true);
            wp_enqueue_script('tbc-mc-sms-group', TBC_MC_URL . 'js/sms-group.js', ['jquery', 'tbc-mc-helpers', 'tbc-mc-scheduler'], tbc_mc_asset_ver('js/sms-group.js'), true);

            wp_localize_script('tbc-mc-helpers', 'tbcMCAjax', [
                'ajaxurl' => admin_url('admin-ajax.php')
            ]);

            // Provide tbcMC nonce that scheduler.js requires for AJAX calls
            wp_localize_script('tbc-mc-helpers', 'tbcMC', [
                'ajaxurl' => admin_url('admin-ajax.php'),
                'nonce'   => wp_create_nonce('tbc_mc_nonce'),
            ]);
        }
    }

    public function enqueue_select2() {
        wp_enqueue_script('select2');
        wp_enqueue_style('select2');
    }

}

function tbc_pf_init() {
    return TBC_PF_Plugin::get_instance();
}

tbc_pf_init();

register_activation_hook(__FILE__, 'tbc_pf_activate');

function tbc_pf_activate() {
    tbc_pf_ps_create_post_types_table();
}
