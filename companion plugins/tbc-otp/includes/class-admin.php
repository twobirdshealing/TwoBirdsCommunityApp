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
        add_action('wp_ajax_tbc_otp_setup_phone_field', [$this, 'ajax_setup_phone_field']);
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
            'enable_email_2fa', 'restrict_duplicates',
            'blocked_numbers', 'phone_field_slug',
            'delete_data_on_uninstall',
        ];

        foreach ($options as $key) {
            register_setting('tbc_otp_settings', TBC_OTP_OPTION_PREFIX . $key);
        }

        // Validate: phone field slug is required when OTP is enabled
        add_action('pre_update_option_' . TBC_OTP_OPTION_PREFIX . 'enable_registration_verification', [$this, 'validate_otp_requires_phone_slug'], 10, 2);

        // Fix unchecked checkboxes
        add_action('admin_init', [$this, 'fix_checkbox_saves'], 99);
    }

    /**
     * Block enabling OTP without a phone field slug configured.
     *
     * @param mixed $new_value The new option value.
     * @param mixed $old_value The old option value.
     * @return mixed
     */
    public function validate_otp_requires_phone_slug($new_value, $old_value) {
        if (empty($new_value)) {
            return $new_value;
        }

        // Check if phone slug is being set in this same save request
        // phpcs:ignore WordPress.Security.NonceVerification.Missing — runs inside pre_update_option hook; nonce already verified by options.php
        $phone_slug = sanitize_text_field($_POST[TBC_OTP_OPTION_PREFIX . 'phone_field_slug'] ?? '');

        if (empty($phone_slug)) {
            add_settings_error(
                'tbc_otp_settings',
                'phone_slug_required',
                __('Phone OTP cannot be enabled without selecting a Phone Field. Please select one under Phone & Validation.', 'tbc-otp'),
                'error'
            );
            return $old_value; // Revert — don't enable OTP
        }

        return $new_value;
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
            'enable_email_2fa',
            'restrict_duplicates',
            'delete_data_on_uninstall',
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

        $css_path = TBC_OTP_DIR . 'assets/css/admin.css';
        $js_path  = TBC_OTP_DIR . 'assets/js/admin.js';

        wp_enqueue_style(
            'tbc-otp-admin',
            TBC_OTP_URL . 'assets/css/admin.css',
            [],
            file_exists($css_path) ? (string) filemtime($css_path) : TBC_OTP_VERSION
        );

        wp_enqueue_script(
            'tbc-otp-admin',
            TBC_OTP_URL . 'assets/js/admin.js',
            [],
            file_exists($js_path) ? (string) filemtime($js_path) : TBC_OTP_VERSION,
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
     * Queries fcom_meta table for custom_profile_fields config.
     */
    public static function get_fc_field_definitions(): array {
        $config = self::get_fc_profile_fields_config();
        return $config['fields'] ?? [];
    }

    /**
     * Read the raw custom_profile_fields option.
     */
    private static function get_fc_profile_fields_config(): array {
        if (!class_exists('FluentCommunity\App\Models\Meta')) {
            return [];
        }
        $meta = \FluentCommunity\App\Models\Meta::where('object_type', 'option')
            ->where('meta_key', 'custom_profile_fields')
            ->first();
        if (!$meta) {
            return [];
        }
        return is_array($meta->value) ? $meta->value : [];
    }

    /**
     * Is FC's Custom Profile Fields feature enabled?
     * Uses the same detection pattern as tbc-community-app Features tab.
     */
    public static function is_custom_profile_fields_enabled(): bool {
        if (!class_exists('FluentCommunity\App\Services\Helper')) {
            return false;
        }
        return (bool) \FluentCommunity\App\Services\Helper::isFeatureEnabled('custom_profile_fields');
    }

    /**
     * Is Fluent Community Pro active? Custom Profile Fields requires Pro.
     */
    public static function has_fluent_community_pro(): bool {
        return defined('FLUENT_COMMUNITY_PRO') && FLUENT_COMMUNITY_PRO;
    }

    /**
     * AJAX handler: one-click phone field setup.
     *
     * Mirrors exactly what FC Pro's own "Save Custom Profile Fields" admin
     * action does: runs the existing config through FC's native sanitizers,
     * writes via Utility::updateOption, flips the feature flag, and runs
     * migrateCustomFieldsToXProfile when enabling for the first time. We then
     * save the OTP phone_field_slug so verification works immediately.
     *
     * Using FC's own service methods (not hand-built payloads) means the
     * config FC ends up with is identical to what its native UI produces —
     * no drift if FC adds new fields to the schema.
     */
    public function ajax_setup_phone_field() {
        check_ajax_referer('tbc_otp_setup_phone_field', '_wpnonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Unauthorized.', 'tbc-otp')], 403);
        }

        if (!self::has_fluent_community_pro()
            || !class_exists('FluentCommunityPro\App\Services\ProfileFieldsService')
            || !class_exists('FluentCommunity\App\Functions\Utility')) {
            wp_send_json_error([
                'message' => __('Custom Profile Fields requires Fluent Community Pro. Please install and activate Fluent Community Pro and try again.', 'tbc-otp'),
            ], 400);
        }

        $service = '\FluentCommunityPro\App\Services\ProfileFieldsService';
        $utility = '\FluentCommunity\App\Functions\Utility';

        $existing = $service::getConfig(true);
        $groups   = $existing['groups'] ?? [];
        $fields   = $existing['fields'] ?? [];

        $phone_slug = '_phone';
        $has_phone  = false;
        foreach ($fields as $field) {
            if (($field['slug'] ?? '') === $phone_slug) {
                $has_phone = true;
                break;
            }
        }

        if (!$has_phone) {
            $fields[] = [
                'slug'        => $phone_slug,
                'label'       => __('Phone', 'tbc-otp'),
                'type'        => 'text',
                'placeholder' => '+1 214 555 1234',
                'is_required' => true,
                'is_enabled'  => true,
                'privacy'     => 'private',
                'group'       => '_additional_info',
            ];
        }

        // Run groups + fields through FC's own sanitizers — these guarantee the
        // default `_additional_info` system group is present, normalize slugs,
        // and produce a config byte-identical to what FC's native Save produces.
        $formattedGroups = $service::sanitizeProfileFieldGroups($groups);
        $validGroupSlugs = array_column($formattedGroups, 'slug');
        $formattedFields = $service::sanitizeProfileFields($fields, $validGroupSlugs);

        $config = [
            'is_enabled' => 'yes',
            'groups'     => $formattedGroups,
            'fields'     => $formattedFields,
        ];

        $utility::updateOption('custom_profile_fields', $config);

        // Mirror ProAdminController::saveCustomProfileFields: migrate xprofile
        // table only when flipping from disabled → enabled, then write the
        // feature flag back to fluent_community_features.
        $featureConfig   = $utility::getFeaturesConfig();
        $isPrevDisabled  = ($featureConfig['custom_profile_fields'] ?? 'no') !== 'yes';

        if ($isPrevDisabled) {
            $service::migrateCustomFieldsToXProfile();
        }

        $featureConfig['custom_profile_fields'] = 'yes';
        $utility::updateOption('fluent_community_features', $featureConfig);

        Helpers::update_option('phone_field_slug', $phone_slug);

        wp_send_json_success([
            'slug'    => $phone_slug,
            'created' => !$has_phone,
            'message' => $has_phone
                ? __('Phone field already existed — enabled Custom Profile Fields and linked it to OTP.', 'tbc-otp')
                : __('Created Phone field, enabled Custom Profile Fields, and linked it to OTP.', 'tbc-otp'),
        ]);
    }
}
