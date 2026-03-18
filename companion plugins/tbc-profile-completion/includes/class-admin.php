<?php
/**
 * Admin Class
 * WordPress admin page for profile completion settings.
 *
 * @package TBC_ProfileCompletion
 */

namespace TBCPcom;

defined('ABSPATH') || exit;

class Admin {

    public function __construct() {
        add_action('wp_ajax_tbc_pcom_save_uninstall_pref', [$this, 'ajax_save_uninstall_pref']);
    }

    /**
     * AJAX handler: save uninstall data preference
     */
    public function ajax_save_uninstall_pref() {
        check_ajax_referer('tbc_pcom_data_mgmt');

        if (!current_user_can('manage_options')) {
            wp_send_json_error('Unauthorized', 403);
        }

        $value = isset($_POST['value']) && $_POST['value'] === '1';
        update_option('tbc_pcom_delete_data_on_uninstall', $value);
        wp_send_json_success();
    }

    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        if (defined('TBC_CA_PLUGIN_DIR')) {
            add_submenu_page(
                'tbc-community-app',
                __('Profile Completion', 'tbc-pcom'),
                __('Profile Completion', 'tbc-pcom'),
                'manage_options',
                'tbc-profile-completion',
                [$this, 'admin_page']
            );
        } else {
            add_menu_page(
                __('TBC Profile Completion', 'tbc-pcom'),
                __('TBC Profile', 'tbc-pcom'),
                'manage_options',
                'tbc-profile-completion',
                [$this, 'admin_page'],
                'dashicons-id-alt',
                32
            );
        }
    }

    /**
     * Register settings
     */
    public function register_settings() {
        $options = [
            'enabled',
            'require_bio',
            'require_avatar',
            'disable_fc_onboarding',
        ];

        foreach ($options as $key) {
            register_setting('tbc_pcom_settings', TBC_PCOM_OPTION_PREFIX . $key);
        }

        // Fix unchecked checkboxes
        add_action('admin_init', [$this, 'fix_checkbox_saves'], 99);
    }

    /**
     * Fix checkbox options not saving when unchecked.
     */
    public function fix_checkbox_saves() {
        // phpcs:ignore WordPress.Security.NonceVerification.Missing
        $option_page = $_POST['option_page'] ?? '';

        if ($option_page !== 'tbc_pcom_settings') {
            return;
        }

        $checkboxes = [
            'enabled',
            'require_bio',
            'require_avatar',
            'disable_fc_onboarding',
        ];

        foreach ($checkboxes as $key) {
            $option_name = TBC_PCOM_OPTION_PREFIX . $key;
            // phpcs:ignore WordPress.Security.NonceVerification.Missing
            if (!isset($_POST[$option_name])) {
                update_option($option_name, '0');
            }
        }
    }

    /**
     * Enqueue admin assets
     */
    public function admin_assets($hook) {
        if (strpos($hook, 'tbc-profile-completion') === false) {
            return;
        }

        wp_enqueue_style(
            'tbc-pcom-admin',
            TBC_PCOM_URL . 'assets/css/admin.css',
            [],
            TBC_PCOM_VERSION
        );
    }

    /**
     * Render admin page
     */
    public function admin_page() {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have sufficient permissions.', 'tbc-pcom'));
        }

        require_once TBC_PCOM_DIR . 'views/admin-fields.php';
    }
}
