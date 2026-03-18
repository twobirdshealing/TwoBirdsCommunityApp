<?php
/**
 * Admin Class
 * WordPress admin page for OTP, profile completion, and SMS role settings.
 *
 * Profile fields are now managed natively by Fluent Community Pro.
 *
 * @package TBC_Registration
 */

namespace TBCRegistration;

defined('ABSPATH') || exit;

class Admin {

    public function __construct() {
        add_action('wp_ajax_tbc_reg_save_uninstall_pref', [$this, 'ajax_save_uninstall_pref']);
    }

    /**
     * AJAX handler: save uninstall data preference
     */
    public function ajax_save_uninstall_pref() {
        check_ajax_referer('tbc_reg_data_mgmt');

        if (!current_user_can('manage_options')) {
            wp_send_json_error('Unauthorized', 403);
        }

        $value = isset($_POST['value']) && $_POST['value'] === '1';
        update_option('tbc_reg_delete_data_on_uninstall', $value);
        wp_send_json_success();
    }

    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        if (defined('TBC_CA_PLUGIN_DIR')) {
            add_submenu_page(
                'tbc-community-app',
                __('Registration', 'tbc-registration'),
                __('Registration', 'tbc-registration'),
                'manage_options',
                'tbc-registration',
                [$this, 'admin_page']
            );
        } else {
            add_menu_page(
                __('TBC Registration', 'tbc-registration'),
                __('TBC Registration', 'tbc-registration'),
                'manage_options',
                'tbc-registration',
                [$this, 'admin_page'],
                'dashicons-admin-users',
                31
            );
        }
    }

    /**
     * Register settings
     */
    public function register_settings() {
        // OTP settings
        $otp_options = [
            'twilio_sid', 'twilio_token', 'verify_service_sid',
            'enable_registration_verification', 'enable_password_recovery',
            'enable_profile_verification', 'enable_voice_fallback',
            'enable_email_verification', 'disable_rate_limit',
            'restrict_duplicates', 'blocked_numbers', 'phone_field_slug',
            'sms_optin_field', 'sms_optin_value',
        ];

        foreach ($otp_options as $key) {
            register_setting('tbc_reg_settings_otp', 'tbc_reg_' . $key);
        }

        // Profile completion settings
        $pc_options = [
            'profile_completion_enabled', 'profile_completion_require_bio',
            'profile_completion_require_avatar', 'disable_fc_onboarding',
        ];

        foreach ($pc_options as $key) {
            register_setting('tbc_reg_settings_profile_completion', 'tbc_reg_' . $key);
        }

        // Fix unchecked checkboxes: browsers don't send them, so WordPress
        // never updates the option to false. We catch this on save.
        add_action('admin_init', [$this, 'fix_checkbox_saves'], 99);
    }

    /**
     * Fix checkbox options not saving when unchecked.
     * Browsers don't include unchecked checkboxes in POST data, so WordPress
     * never calls update_option for them. We detect the form submission
     * and explicitly set missing checkbox options to '0'.
     */
    public function fix_checkbox_saves() {
        // phpcs:ignore WordPress.Security.NonceVerification.Missing
        $option_page = $_POST['option_page'] ?? '';

        // OTP tab checkboxes
        if ($option_page === 'tbc_reg_settings_otp') {
            $otp_checkboxes = [
                'enable_registration_verification',
                'enable_password_recovery',
                'enable_profile_verification',
                'enable_voice_fallback',
                'enable_email_verification',
                'disable_rate_limit',
                'restrict_duplicates',
            ];

            foreach ($otp_checkboxes as $key) {
                $option_name = 'tbc_reg_' . $key;
                // phpcs:ignore WordPress.Security.NonceVerification.Missing
                if (!isset($_POST[$option_name])) {
                    update_option($option_name, '0');
                }
            }
        }

        // Profile completion tab checkboxes
        if ($option_page === 'tbc_reg_settings_profile_completion') {
            $pc_checkboxes = [
                'profile_completion_enabled',
                'profile_completion_require_bio',
                'profile_completion_require_avatar',
                'disable_fc_onboarding',
            ];

            foreach ($pc_checkboxes as $key) {
                $option_name = 'tbc_reg_' . $key;
                // phpcs:ignore WordPress.Security.NonceVerification.Missing
                if (!isset($_POST[$option_name])) {
                    update_option($option_name, '0');
                }
            }
        }

    }

    /**
     * Enqueue admin assets
     */
    public function admin_assets($hook) {
        if (strpos($hook, 'tbc-registration') === false) {
            return;
        }

        wp_enqueue_style(
            'tbc-reg-admin',
            TBC_REG_URL . 'assets/css/admin.css',
            [],
            TBC_REG_VERSION
        );

        wp_enqueue_script(
            'tbc-reg-admin',
            TBC_REG_URL . 'assets/js/admin.js',
            ['jquery'],
            TBC_REG_VERSION,
            true
        );
    }

    /**
     * Render admin page
     */
    public function admin_page() {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have sufficient permissions.', 'tbc-registration'));
        }

        require_once TBC_REG_DIR . 'views/admin-fields.php';
    }
}
