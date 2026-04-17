<?php
/**
 * Plugin Name: TBC OTP Verification
 * Plugin URI:  https://twobirdscode.com
 * Description: Phone OTP verification via Twilio for Fluent Community registration.
 * Version:     1.0.0
 * Author:      Two Birds Code
 * Author URI:  https://twobirdscode.com
 * Text Domain: tbc-otp
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * License:     GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Requires Plugins: fluent-community
 *
 * @package TBC_OTP
 */

defined('ABSPATH') or die('No direct script access allowed');

// TBC_OTP_VERSION is auto-derived from the plugin header so the header is the
// single source of truth; filemtime() handles asset cache busting.
$tbc_otp_header = get_file_data(__FILE__, ['Version' => 'Version']);
define('TBC_OTP_VERSION', $tbc_otp_header['Version']);
define('TBC_OTP_FILE', __FILE__);
define('TBC_OTP_DIR', plugin_dir_path(__FILE__));
define('TBC_OTP_URL', plugin_dir_url(__FILE__));
define('TBC_OTP_BASENAME', plugin_basename(__FILE__));
define('TBC_OTP_REST_NAMESPACE', 'tbc-otp/v1');
define('TBC_OTP_OPTION_PREFIX', 'tbc_otp_');

/**
 * Initialize plugin
 */
add_action('plugins_loaded', function () {
    if (!class_exists('\FluentCommunity\App\Services\Helper') ||
        !defined('FLUENT_COMMUNITY_PLUGIN_VERSION')) {
        add_action('admin_notices', function () {
            ?>
            <div class="notice notice-error">
                <p><?php esc_html_e('TBC OTP Verification requires Fluent Community to be installed and activated.', 'tbc-otp'); ?></p>
            </div>
            <?php
        });
        return;
    }

    require_once TBC_OTP_DIR . 'includes/class-helpers.php';
    require_once TBC_OTP_DIR . 'includes/class-twilio.php';
    require_once TBC_OTP_DIR . 'includes/class-otp-api.php';
    require_once TBC_OTP_DIR . 'includes/class-registration-hook.php';
    require_once TBC_OTP_DIR . 'includes/class-frontend.php';

    // Initialize OTP REST endpoints
    $twilio = new TBCOTP\Twilio();
    $otp_api = new TBCOTP\OtpApi($twilio);
    add_action('rest_api_init', [$otp_api, 'register_routes']);

    // Hook into tbc-community-app's registration flow
    $reg_hook = new TBCOTP\RegistrationHook($twilio);
    add_filter('tbc_ca_pre_register', [$reg_hook, 'intercept_registration'], 10, 3);

    // Disable FC's email 2FA when phone OTP is active (phone already proves identity)
    add_filter('fluent_auth/verify_signup_email', [$reg_hook, 'maybe_disable_email_verification']);

    // Advertise OTP capability in /app-config
    add_filter('tbc_ca_registration_config', function ($config) {
        $config['otp'] = [
            'required'       => (bool) TBCOTP\Helpers::get_option('enable_registration_verification', true),
            'voice_fallback' => (bool) TBCOTP\Helpers::get_option('enable_voice_fallback', false),
        ];
        return $config;
    });

    // AJAX interception for web registration (FC portal)
    add_action('wp_ajax_nopriv_fcom_user_registration', [$reg_hook, 'intercept_web_registration'], 6);

    // Frontend: inject OTP modal JS/CSS on FC's auth registration page
    $frontend = new TBCOTP\Frontend();
    add_action('wp_enqueue_scripts', [$frontend, 'maybe_enqueue_auth_assets']);

    // Admin
    if (is_admin()) {
        require_once TBC_OTP_DIR . 'includes/class-admin.php';
        $admin = new TBCOTP\Admin();
        add_action('admin_menu', [$admin, 'add_admin_menu']);
        add_action('admin_init', [$admin, 'register_settings']);
        add_action('admin_enqueue_scripts', [$admin, 'admin_assets']);

        // Warn if OTP is enabled but phone field slug is not configured
        $otp_enabled = (bool) TBCOTP\Helpers::get_option('enable_registration_verification', true);
        $phone_slug  = (string) TBCOTP\Helpers::get_option('phone_field_slug', '');
        if ($otp_enabled && empty($phone_slug)) {
            add_action('admin_notices', function () {
                $url = admin_url('admin.php?page=tbc-otp');
                printf(
                    '<div class="notice notice-error"><p><strong>%s</strong> %s <a href="%s">%s</a></p></div>',
                    esc_html__('TBC OTP:', 'tbc-otp'),
                    esc_html__('Phone OTP is enabled but no phone field is selected. OTP verification will be skipped during registration.', 'tbc-otp'),
                    esc_url($url),
                    esc_html__('Configure now &rarr;', 'tbc-otp')
                );
            });
        }
    }
}, 25); // After tbc-community-app (priority 20)

/**
 * Activation hook
 */
register_activation_hook(__FILE__, function () {
    // autoload=yes only for options read on every front-end request.
    // Twilio credentials and blocked-number list are read only during OTP flows.
    $defaults = [
        'twilio_sid'                       => ['', 'no'],
        'twilio_token'                     => ['', 'no'],
        'verify_service_sid'               => ['', 'no'],
        'blocked_numbers'                  => ['', 'no'],
        'enable_registration_verification' => [true, 'yes'],
        'enable_voice_fallback'            => [false, 'yes'],
        'enable_email_2fa'                 => [false, 'yes'],
        'restrict_duplicates'              => [false, 'yes'],
        'phone_field_slug'                 => ['', 'yes'],
    ];

    foreach ($defaults as $key => [$value, $autoload]) {
        $option_name = TBC_OTP_OPTION_PREFIX . $key;
        if (false === get_option($option_name)) {
            add_option($option_name, $value, '', $autoload);
        }
    }
});

/**
 * Deactivation hook
 */
register_deactivation_hook(__FILE__, function () {
    global $wpdb;
    $wpdb->query(
        "DELETE FROM {$wpdb->options}
         WHERE option_name LIKE '_transient_tbc_otp_session_%'
            OR option_name LIKE '_transient_timeout_tbc_otp_session_%'"
    );
});
