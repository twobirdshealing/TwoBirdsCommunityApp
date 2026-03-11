<?php
/**
 * Plugin Name: TBC Fluent Profiles
 * Plugin URI:  https://www.twobirdschurch.com
 * Description: Custom profile fields, OTP verification (Twilio), and multi-step registration for Fluent Community. Unified profiles, verification, and registration in one plugin.
 * Version:     2.4.9
 * Author:      Two Birds Community
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
define('TBC_FP_VERSION', '2.4.9');
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

    // One-time migration: rename tbc_otp_* options to tbc_fp_* (v2.4.1)
    if (!get_option('tbc_fp_prefix_migrated')) {
        $migrate_keys = [
            'twilio_sid', 'twilio_token', 'verify_service_sid',
            'enable_registration_verification', 'enable_password_recovery',
            'enable_profile_verification', 'enable_voice_fallback',
            'enable_email_verification', 'disable_rate_limit',
            'restrict_duplicates', 'blocked_numbers', 'phone_meta_key', 'phone_meta_key_custom',
        ];
        foreach ($migrate_keys as $key) {
            $old_val = get_option('tbc_otp_' . $key);
            if ($old_val !== false) {
                update_option('tbc_fp_' . $key, $old_val);
                delete_option('tbc_otp_' . $key);
            }
        }
        update_option('tbc_fp_prefix_migrated', '1');
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
         WHERE option_name LIKE '_transient_tbc_otp_session_%'
            OR option_name LIKE '_transient_timeout_tbc_otp_session_%'
            OR option_name LIKE '_transient_tbc_otp_recovery_%'
            OR option_name LIKE '_transient_timeout_tbc_otp_recovery_%'
            OR option_name LIKE '_transient_tbc_otp_profile_%'
            OR option_name LIKE '_transient_timeout_tbc_otp_profile_%'"
    );
});
