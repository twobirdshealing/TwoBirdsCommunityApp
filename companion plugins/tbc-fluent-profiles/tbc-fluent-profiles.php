<?php
/**
 * Plugin Name: TBC Fluent Profiles
 * Plugin URI:  https://twobirdscode.com
 * Description: Custom profile fields, OTP verification (Twilio), and multi-step registration for Fluent Community. Unified profiles, verification, and registration in one plugin.
 * Version:     2.6.1
 * Author: Two Birds Code
 * Author URI:  https://twobirdscode.com
 * Text Domain: tbc-fluent-profiles
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * License:     GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Requires Plugins: fluent-community
 *
 * @package TBC_Fluent_Profiles
 */

defined('ABSPATH') or die('No direct script access allowed');

// Core plugin constants
define('TBC_FP_VERSION', '2.6.1');
define('TBC_FP_FILE', __FILE__);
define('TBC_FP_DIR', plugin_dir_path(__FILE__));
define('TBC_FP_URL', plugin_dir_url(__FILE__));
define('TBC_FP_BASENAME', plugin_basename(__FILE__));
define('TBC_FP_META_PREFIX', '_tbc_fp_');
define('TBC_FP_META_REGISTRATION_COMPLETE', '_tbc_registration_complete');
define('TBC_FP_REST_NAMESPACE', 'tbc-fp/v1');

/**
 * Check if Fluent Community is active
 */
function tbc_fp_check_dependencies() {
    if (!class_exists('\FluentCommunity\App\Services\Helper') ||
        !defined('FLUENT_COMMUNITY_PLUGIN_VERSION')) {
        add_action('admin_notices', function () {
            ?>
            <div class="notice notice-error">
                <p><?php esc_html_e('TBC Fluent Profiles requires Fluent Community to be installed and activated.', 'tbc-fluent-profiles'); ?></p>
            </div>
            <?php
        });
        return false;
    }
    return true;
}

/**
 * Initialize plugin
 */
add_action('plugins_loaded', function () {
    if (!tbc_fp_check_dependencies()) {
        return;
    }

    // Ensure SMS roles exist (safety net for existing installs that skip activation hook)
    if (!wp_roles()->is_role('sms_in')) {
        add_role('sms_in', 'SMS Opted In');
    }
    if (!wp_roles()->is_role('sms_out')) {
        add_role('sms_out', 'SMS Opted Out');
    }

    require_once TBC_FP_DIR . 'includes/class-core.php';
    TBCFluentProfiles\Core::instance();
}, 20);

/**
 * Activation hook
 */
register_activation_hook(__FILE__, function () {
    require_once TBC_FP_DIR . 'includes/class-fields.php';
    require_once TBC_FP_DIR . 'includes/class-admin.php';
    TBCFluentProfiles\Admin::initialize_default_settings();

    // Ensure SMS roles exist
    add_role('sms_in', 'SMS Opted In');
    add_role('sms_out', 'SMS Opted Out');

    // OTP / verification default options
    $otp_defaults = [
        'twilio_sid'                       => '',
        'twilio_token'                     => '',
        'verify_service_sid'               => '',
        'enable_registration_verification' => true,
        'enable_password_recovery'         => false,
        'enable_profile_verification'      => false,
        'enable_voice_fallback'            => false,
        'enable_email_verification'        => true,
        'restrict_duplicates'              => false,
        'blocked_numbers'                  => '',
        'phone_meta_key'                   => 'auto',
    ];

    foreach ($otp_defaults as $key => $value) {
        $option_name = 'tbc_fp_' . $key;
        if (false === get_option($option_name)) {
            add_option($option_name, $value);
        }
    }

    // SMS role management default options
    $sms_defaults = [
        'sms_optin_field' => '',
        'sms_optin_value' => 'Yes',
    ];

    foreach ($sms_defaults as $key => $value) {
        $option_name = 'tbc_fp_' . $key;
        if (false === get_option($option_name)) {
            add_option($option_name, $value);
        }
    }

    // Profile completion default options
    $pc_defaults = [
        'profile_completion_enabled'        => true,
        'profile_completion_require_bio'    => true,
        'profile_completion_require_avatar' => true,
        'disable_fc_onboarding'             => true,
    ];

    foreach ($pc_defaults as $key => $value) {
        $option_name = 'tbc_fp_' . $key;
        if (false === get_option($option_name)) {
            add_option($option_name, $value);
        }
    }
});

/**
 * Deactivation hook
 */
register_deactivation_hook(__FILE__, function () {
    flush_rewrite_rules();

    // Clean up OTP transient sessions
    global $wpdb;
    $wpdb->query(
        "DELETE FROM {$wpdb->options}
         WHERE option_name LIKE '_transient_tbc_fp_session_%'
            OR option_name LIKE '_transient_timeout_tbc_fp_session_%'
            OR option_name LIKE '_transient_tbc_fp_recovery_%'
            OR option_name LIKE '_transient_timeout_tbc_fp_recovery_%'
            OR option_name LIKE '_transient_tbc_fp_profile_%'
            OR option_name LIKE '_transient_timeout_tbc_fp_profile_%'"
    );
});
