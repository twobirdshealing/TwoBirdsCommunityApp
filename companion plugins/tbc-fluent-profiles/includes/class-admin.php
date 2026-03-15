<?php
/**
 * Admin Class
 * WordPress admin page for managing custom profile fields.
 *
 * @package TBC_Fluent_Profiles
 */

namespace TBCFluentProfiles;

defined('ABSPATH') || exit;

class Admin {

    private $fields;

    public function __construct($fields = null) {
        $this->fields = $fields ?: new Fields();
        add_action('wp_ajax_tbc_fp_save_uninstall_pref', [$this, 'ajax_save_uninstall_pref']);
    }

    /**
     * AJAX handler: save uninstall data preference
     */
    public function ajax_save_uninstall_pref() {
        check_ajax_referer('tbc_fp_data_mgmt');

        if (!current_user_can('manage_options')) {
            wp_send_json_error('Unauthorized', 403);
        }

        $value = isset($_POST['value']) && $_POST['value'] === '1';
        update_option('tbc_fp_delete_data_on_uninstall', $value);
        wp_send_json_success();
    }

    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        if (defined('TBC_CA_PLUGIN_DIR')) {
            add_submenu_page(
                'tbc-community-app',
                __('Fluent Profiles', 'tbc-fluent-profiles'),
                __('Fluent Profiles', 'tbc-fluent-profiles'),
                'manage_options',
                'tbc-fluent-profiles',
                [$this, 'admin_page']
            );
        } else {
            add_menu_page(
                __('TBC Fluent Profiles', 'tbc-fluent-profiles'),
                __('TBC Fluent Profiles', 'tbc-fluent-profiles'),
                'manage_options',
                'tbc-fluent-profiles',
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
        register_setting('tbc_fp_settings', Fields::OPTION_KEY, [
            'sanitize_callback' => [$this, 'sanitize_settings'],
        ]);

        self::initialize_default_settings();

        // OTP settings
        $otp_options = [
            'twilio_sid', 'twilio_token', 'verify_service_sid',
            'enable_registration_verification', 'enable_password_recovery',
            'enable_profile_verification', 'enable_voice_fallback',
            'enable_email_verification', 'disable_rate_limit',
            'restrict_duplicates', 'blocked_numbers', 'phone_meta_key', 'phone_meta_key_custom',
            'sms_optin_field', 'sms_optin_value',
        ];

        foreach ($otp_options as $key) {
            register_setting('tbc_fp_settings_otp', 'tbc_fp_' . $key);
        }

        // Profile completion settings
        $pc_options = [
            'profile_completion_enabled', 'profile_completion_require_bio',
            'profile_completion_require_avatar', 'disable_fc_onboarding',
        ];

        foreach ($pc_options as $key) {
            register_setting('tbc_fp_settings_profile_completion', 'tbc_fp_' . $key);
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
        if ($option_page === 'tbc_fp_settings_otp') {
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
                $option_name = 'tbc_fp_' . $key;
                // phpcs:ignore WordPress.Security.NonceVerification.Missing
                if (!isset($_POST[$option_name])) {
                    update_option($option_name, '0');
                }
            }
        }

        // Profile completion tab checkboxes
        if ($option_page === 'tbc_fp_settings_profile_completion') {
            $pc_checkboxes = [
                'profile_completion_enabled',
                'profile_completion_require_bio',
                'profile_completion_require_avatar',
                'disable_fc_onboarding',
            ];

            foreach ($pc_checkboxes as $key) {
                $option_name = 'tbc_fp_' . $key;
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
        if (strpos($hook, 'tbc-fluent-profiles') === false) {
            return;
        }

        wp_enqueue_script('jquery-ui-sortable');

        wp_enqueue_style(
            'tbc-fp-admin',
            TBC_FP_URL . 'assets/css/admin.css',
            [],
            TBC_FP_VERSION
        );

        wp_enqueue_script(
            'tbc-fp-admin',
            TBC_FP_URL . 'assets/js/admin.js',
            ['jquery', 'jquery-ui-sortable'],
            TBC_FP_VERSION,
            true
        );

        wp_localize_script('tbc-fp-admin', 'tbcFpAdmin', [
            'optionKey'        => Fields::OPTION_KEY,
            'typeRegistry'     => Fields::get_type_registry(),
            'visibilityLevels' => Visibility::get_level_labels(),
        ]);
    }

    /**
     * Render admin page
     */
    public function admin_page() {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have sufficient permissions.', 'tbc-fluent-profiles'));
        }

        // Handle manual save
        if (isset($_POST['submit']) && isset($_POST[Fields::OPTION_KEY]) && check_admin_referer('tbc_fp_settings-options')) {
            $sanitized = $this->sanitize_settings(wp_unslash($_POST[Fields::OPTION_KEY])); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Sanitized in sanitize_settings().
            update_option(Fields::OPTION_KEY, $sanitized);
            add_settings_error(Fields::OPTION_KEY, 'settings_updated', __('Fields saved.', 'tbc-fluent-profiles'), 'updated');
        }

        $fields = $this->fields->get_fields();
        $type_registry = Fields::get_type_registry();
        $visibility_levels = Visibility::get_level_labels();
        require_once TBC_FP_DIR . 'views/admin-fields.php';
    }

    /**
     * Sanitize the full settings array on save
     *
     * @param mixed $input Raw form data.
     * @return array Sanitized fields.
     */
    public function sanitize_settings($input) {
        if (!is_array($input)) {
            return [];
        }

        $sanitized = [];

        foreach ($input as $key => $field_data) {
            if (!is_array($field_data)) {
                continue;
            }

            $field_key = sanitize_key($key);
            if (empty($field_key)) {
                continue;
            }

            $field_data['key'] = $field_key;
            $sanitized[$field_key] = Fields::sanitize_field_definition($field_data);
        }

        return $sanitized;
    }

    /**
     * Get a visual icon character for a field type (used in admin cards).
     *
     * @param string $type
     * @return string
     */
    public function get_type_icon($type) {
        $icons = [
            'text'        => 'T',
            'phone'       => '#',
            'number'      => '#',
            'date'        => 'D',
            'textarea'    => 'P',
            'select'      => 'v',
            'radio'       => 'o',
            'checkbox'    => 'x',
            'multiselect' => 'M',
            'gender'      => 'G',
            'url'         => '@',
        ];
        return $icons[$type] ?? 'T';
    }

    /**
     * Initialize default settings on activation
     */
    public static function initialize_default_settings() {
        $fields = get_option(Fields::OPTION_KEY, false);

        if ($fields === false) {
            add_option(Fields::OPTION_KEY, [], '', 'yes');
        }
    }
}
