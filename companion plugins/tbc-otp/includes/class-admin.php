<?php
/**
 * Admin Class
 * WordPress admin page for OTP registration settings.
 *
 * @package TBC_OTP
 */

namespace TBCOTP;

defined('ABSPATH') || exit;

class Admin {

    public function __construct() {
        add_action('wp_ajax_tbc_otp_save_uninstall_pref', [$this, 'ajax_save_uninstall_pref']);
    }

    /**
     * AJAX handler: save uninstall data preference
     */
    public function ajax_save_uninstall_pref() {
        check_ajax_referer('tbc_otp_data_mgmt');

        if (!current_user_can('manage_options')) {
            wp_send_json_error('Unauthorized', 403);
        }

        $value = isset($_POST['value']) && $_POST['value'] === '1';
        update_option('tbc_otp_delete_data_on_uninstall', $value);
        wp_send_json_success();
    }

    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        if (defined('TBC_CA_PLUGIN_DIR')) {
            add_submenu_page(
                'tbc-community-app',
                __('OTP Verification', 'tbc-otp'),
                __('OTP Verification', 'tbc-otp'),
                'manage_options',
                'tbc-otp',
                [$this, 'admin_page']
            );
        } else {
            add_menu_page(
                __('TBC OTP Verification', 'tbc-otp'),
                __('TBC OTP', 'tbc-otp'),
                'manage_options',
                'tbc-otp',
                [$this, 'admin_page'],
                'dashicons-smartphone',
                31
            );
        }
    }

    /**
     * Register settings
     */
    public function register_settings() {
        $options = [
            'twilio_sid', 'twilio_token', 'verify_service_sid',
            'enable_registration_verification', 'enable_voice_fallback',
            'disable_email_verification', 'disable_rate_limit',
            'restrict_duplicates', 'blocked_numbers', 'phone_field_slug',
        ];

        foreach ($options as $key) {
            register_setting('tbc_otp_settings', TBC_OTP_OPTION_PREFIX . $key);
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

        if ($option_page !== 'tbc_otp_settings') {
            return;
        }

        $checkboxes = [
            'enable_registration_verification',
            'enable_voice_fallback',
            'disable_email_verification',
            'disable_rate_limit',
            'restrict_duplicates',
        ];

        foreach ($checkboxes as $key) {
            $option_name = TBC_OTP_OPTION_PREFIX . $key;
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
        if (strpos($hook, 'tbc-otp') === false) {
            return;
        }

        wp_enqueue_style(
            'tbc-otp-admin',
            TBC_OTP_URL . 'assets/css/admin.css',
            [],
            TBC_OTP_VERSION
        );

        wp_enqueue_script(
            'tbc-otp-admin',
            TBC_OTP_URL . 'assets/js/admin.js',
            [],
            TBC_OTP_VERSION,
            true
        );
    }

    /**
     * Render admin page
     */
    public function admin_page() {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have sufficient permissions.', 'tbc-otp'));
        }

        require_once TBC_OTP_DIR . 'views/admin-fields.php';
    }

    /**
     * Get FC native custom field definitions (for phone selector).
     * Reads from FluentCommunity XProfile field config.
     */
    public static function get_fc_field_definitions(): array {
        if (!class_exists('FluentCommunity\App\Functions\Utility')) {
            return [];
        }

        $utility = 'FluentCommunity\App\Functions\Utility';
        $settings = $utility::getCustomizationSettings();
        $fields = $settings['custom_profile_fields'] ?? [];

        if (!is_array($fields)) {
            return [];
        }

        return $fields;
    }
}
