<?php
/**
 * Plugin Name: TBC Registration
 * Plugin URI:  https://twobirdscode.com
 * Description: OTP verification (Twilio), multi-step registration, and profile completion gate. Profile fields are managed natively by FC Pro.
 * Version:     4.0.1
 * Author: Two Birds Code
 * Author URI:  https://twobirdscode.com
 * Text Domain: tbc-registration
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * License:     GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Requires Plugins: fluent-community
 *
 * @package TBC_Registration
 */

defined('ABSPATH') or die('No direct script access allowed');

// Core plugin constants
define('TBC_REG_VERSION', '4.0.1');
define('TBC_REG_FILE', __FILE__);
define('TBC_REG_DIR', plugin_dir_path(__FILE__));
define('TBC_REG_URL', plugin_dir_url(__FILE__));
define('TBC_REG_BASENAME', plugin_basename(__FILE__));
define('TBC_REG_META_PREFIX', '_tbc_reg_');
define('TBC_REG_META_REGISTRATION_COMPLETE', '_tbc_registration_complete');
define('TBC_REG_REST_NAMESPACE', 'tbc-reg/v1');

/**
 * Check if Fluent Community is active
 */
function tbc_reg_check_dependencies() {
    if (!class_exists('\FluentCommunity\App\Services\Helper') ||
        !defined('FLUENT_COMMUNITY_PLUGIN_VERSION')) {
        add_action('admin_notices', function () {
            ?>
            <div class="notice notice-error">
                <p><?php esc_html_e('TBC Registration requires Fluent Community to be installed and activated.', 'tbc-registration'); ?></p>
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
    if (!tbc_reg_check_dependencies()) {
        return;
    }

    // Ensure SMS roles exist (safety net for existing installs that skip activation hook)
    if (!wp_roles()->is_role('sms_in')) {
        add_role('sms_in', 'SMS Opted In');
    }
    if (!wp_roles()->is_role('sms_out')) {
        add_role('sms_out', 'SMS Opted Out');
    }

    require_once TBC_REG_DIR . 'includes/class-core.php';
    TBCRegistration\Core::instance();
}, 20);

/**
 * Activation hook
 */
register_activation_hook(__FILE__, function () {
    // --- Migrate from tbc-fluent-profiles (tbc_fp_) if upgrading ---
    if (!get_option('tbc_reg_migrated_from_fp') && get_option('tbc_fp_twilio_sid') !== false) {
        global $wpdb;

        // Rename wp_options: tbc_fp_* → tbc_reg_* (skip if target already exists)
        $wpdb->query(
            "UPDATE {$wpdb->options}
             SET option_name = CONCAT('tbc_reg_', SUBSTRING(option_name, 8))
             WHERE option_name LIKE 'tbc\_fp\_%'
             AND NOT EXISTS (
                 SELECT 1 FROM (SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE 'tbc\_reg\_%') AS existing
                 WHERE existing.option_name = CONCAT('tbc_reg_', SUBSTRING({$wpdb->options}.option_name, 8))
             )"
        );

        // Rename wp_usermeta: _tbc_fp_* → _tbc_reg_*
        $wpdb->query(
            "UPDATE {$wpdb->usermeta}
             SET meta_key = CONCAT('_tbc_reg_', SUBSTRING(meta_key, 9))
             WHERE meta_key LIKE '\\_tbc\\_fp\\_%'"
        ); // 9 = strlen('_tbc_fp_')

        // Rename transients
        $wpdb->query(
            "UPDATE {$wpdb->options}
             SET option_name = REPLACE(option_name, 'tbc_fp_', 'tbc_reg_')
             WHERE option_name LIKE '%tbc\_fp\_session\_%'
                OR option_name LIKE '%tbc\_fp\_recovery\_%'
                OR option_name LIKE '%tbc\_fp\_profile\_%'"
        );

        update_option('tbc_reg_migrated_from_fp', true);
    }

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
        'phone_field_slug'                 => '_phone',
    ];

    foreach ($otp_defaults as $key => $value) {
        $option_name = 'tbc_reg_' . $key;
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
        $option_name = 'tbc_reg_' . $key;
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
        $option_name = 'tbc_reg_' . $key;
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
         WHERE option_name LIKE '_transient_tbc_reg_session_%'
            OR option_name LIKE '_transient_timeout_tbc_reg_session_%'
            OR option_name LIKE '_transient_tbc_reg_recovery_%'
            OR option_name LIKE '_transient_timeout_tbc_reg_recovery_%'
            OR option_name LIKE '_transient_tbc_reg_profile_%'
            OR option_name LIKE '_transient_timeout_tbc_reg_profile_%'"
    );
});
