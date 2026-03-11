<?php
/**
 * Plugin Name: TBC - Participant Frontend
 * Description: Display WooCommerce event products and attendee management.
 * Version: 3.0.75
 * Author: Two Birds Church
 * 
 * @package TBC_Participant_Frontend
 */

if (!defined('ABSPATH')) {
    exit;
}

define('TBC_PF_VERSION', '3.0.75');

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
        add_action('bp_loaded', [$this, 'load_buddyboss_notification']);
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
        add_action('template_redirect', [$this, 'handle_template_redirect']);
    }

    public function handle_template_redirect() {
        if (!is_page('participant-list')) {
            return;
        }

        $product_slug = isset($_GET['product_slug']) ? sanitize_text_field($_GET['product_slug']) : '';
        $event_date = isset($_GET['event_date']) ? sanitize_text_field($_GET['event_date']) : '';

        if (!$product_slug) {
            return;
        }

        get_header();
        tbc_pf_display_participant_details_page($product_slug, $event_date);
        get_footer();
        exit;
    }

    public function check_for_shortcode() {
        global $post;
        
        if (is_page('participant-list') && isset($_GET['product_slug'])) {
            $this->shortcode_present = true;
            return;
        }
        
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
            wp_enqueue_style($handle, $plugin_url . $path, [], TBC_PF_VERSION);
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
            wp_enqueue_script($handle, $plugin_url . $path, ['jquery'], TBC_PF_VERSION, true);
            wp_localize_script($handle, 'tbcPFAjax', [
                'ajaxurl' => admin_url('admin-ajax.php')
            ]);
        }
        
        // Enqueue Select2 for searchable dropdowns on frontend
        wp_enqueue_style('select2', WC()->plugin_url() . '/assets/css/select2.css', [], TBC_PF_VERSION);
        wp_enqueue_script('select2', WC()->plugin_url() . '/assets/js/select2/select2.full.min.js', ['jquery'], TBC_PF_VERSION, true);

        // Enqueue Message Center assets for SMS tab (uses TBC_MC_URL constant from Message Center plugin)
        if (defined('TBC_MC_URL') && function_exists('tbc_mc_render_sms_form')) {
            wp_enqueue_style('tbc-mc-scheduler', TBC_MC_URL . 'css/scheduler.css', [], TBC_PF_VERSION);
            wp_enqueue_style('tbc-mc-sms-center', TBC_MC_URL . 'css/sms-center.css', [], TBC_PF_VERSION);
            wp_enqueue_style('tbc-mc-template', TBC_MC_URL . 'css/sms-template.css', [], TBC_PF_VERSION);

            wp_enqueue_script('tbc-mc-helpers', TBC_MC_URL . 'js/sms-helpers.js', ['jquery'], TBC_PF_VERSION, true);
            wp_enqueue_script('tbc-mc-scheduler', TBC_MC_URL . 'js/scheduler.js', ['jquery', 'tbc-mc-helpers'], TBC_PF_VERSION, true);
            wp_enqueue_script('tbc-mc-templates', TBC_MC_URL . 'js/templates.js', ['jquery'], TBC_PF_VERSION, true);
            wp_enqueue_script('tbc-mc-char-counter', TBC_MC_URL . 'js/char-counter.js', ['jquery'], TBC_PF_VERSION, true);
            wp_enqueue_script('tbc-mc-media-uploader', TBC_MC_URL . 'js/sms-media-uploader.js', ['jquery'], TBC_PF_VERSION, true);
            wp_enqueue_script('tbc-mc-sms-group', TBC_MC_URL . 'js/sms-group.js', ['jquery', 'tbc-mc-helpers', 'tbc-mc-scheduler'], TBC_PF_VERSION, true);

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

    public function load_buddyboss_notification() {
        require __DIR__ . '/includes/buddyboss-event-notes-notification.php';
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