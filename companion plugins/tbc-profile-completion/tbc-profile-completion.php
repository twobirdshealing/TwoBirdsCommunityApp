<?php
/**
 * Plugin Name: TBC Profile Completion
 * Plugin URI:  https://twobirdscode.com
 * Description: Profile completion gate for Fluent Community registration. Requires bio and avatar before users can access the community. Self-contained: registers its own REST routes under /tbc-pcom/v1.
 * Version:     1.1.0
 * Author:      Two Birds Code
 * Author URI:  https://twobirdscode.com
 * Text Domain: tbc-pcom
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * License:     GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Requires Plugins: fluent-community
 *
 * @package TBC_ProfileCompletion
 */

defined('ABSPATH') or die('No direct script access allowed');

// TBC_PCOM_VERSION is auto-derived from the plugin header so the header is the
// single source of truth; filemtime() handles asset cache busting.
$tbc_pcom_header = get_file_data(__FILE__, ['Version' => 'Version']);
define('TBC_PCOM_VERSION', $tbc_pcom_header['Version']);
define('TBC_PCOM_FILE', __FILE__);
define('TBC_PCOM_DIR', plugin_dir_path(__FILE__));
define('TBC_PCOM_URL', plugin_dir_url(__FILE__));
define('TBC_PCOM_BASENAME', plugin_basename(__FILE__));
define('TBC_PCOM_REST_NAMESPACE', 'tbc-pcom/v1');
define('TBC_PCOM_OPTION_PREFIX', 'tbc_pcom_');
define('TBC_PCOM_META_REGISTRATION_COMPLETE', '_tbc_registration_complete');

/**
 * Initialize plugin
 */
add_action('plugins_loaded', function () {
    if (!class_exists('\FluentCommunity\App\Services\Helper') ||
        !defined('FLUENT_COMMUNITY_PLUGIN_VERSION')) {
        add_action('admin_notices', function () {
            ?>
            <div class="notice notice-error">
                <p><?php esc_html_e('TBC Profile Completion requires Fluent Community to be installed and activated.', 'tbc-pcom'); ?></p>
            </div>
            <?php
        });
        return;
    }

    require_once TBC_PCOM_DIR . 'includes/class-profile-gate.php';
    require_once TBC_PCOM_DIR . 'includes/class-overlay.php';

    $gate = new TBCPcom\ProfileGate();
    $overlay = new TBCPcom\Overlay($gate);

    // ── Advertise profile completion capability in /app-config ────────
    add_filter('tbc_ca_registration_config', function ($config) {
        $config['profile_completion'] = [
            'enabled'        => (bool) TBCPcom\ProfileGate::get_option('enabled', true),
            'require_bio'    => (bool) TBCPcom\ProfileGate::get_option('require_bio', true),
            'require_avatar' => (bool) TBCPcom\ProfileGate::get_option('require_avatar', true),
        ];
        return $config;
    });

    // ── Mark new users as incomplete after registration ───────────────
    add_action('tbc_ca_post_register', [$gate, 'on_registration'], 10, 3);

    // ── Re-evaluate completion on profile save ───────────────────────
    // Filter: catches POST /profile (bio, social links, website)
    add_filter('fluent_community/update_profile_data', [$gate, 'reevaluate_on_profile_update'], 99, 3);

    // Eloquent model event: catches ALL XProfile saves including PUT /profile (avatar, cover)
    if (class_exists('\FluentCommunity\App\Models\XProfile')) {
        \FluentCommunity\App\Models\XProfile::saved([$gate, 'reevaluate_from_model_event']);
    }

    // ── REST routes: GET /tbc-pcom/v1/status, POST /tbc-pcom/v1/complete ─
    add_action('rest_api_init', [$gate, 'register_routes']);

    // ── X-TBC-Profile-Incomplete response header ─────────────────────
    add_filter('rest_post_dispatch', [$gate, 'add_incomplete_header'], 10, 3);

    // ── Overlay: inject on FC portal pages for incomplete users ──────
    add_action('fluent_community/portal_head', [$overlay, 'inject_portal_css']);
    add_action('fluent_community/portal_footer', [$overlay, 'inject_portal_js']);

    // ── Overlay: inject on non-portal FC pages (auth pages) ──────────
    add_action('wp_head', [$overlay, 'maybe_inject_auth_css']);
    add_action('wp_footer', [$overlay, 'maybe_inject_auth_js']);

    // ── Redirect non-FC pages to portal (overlay shows there) ────────
    add_action('template_redirect', [$overlay, 'maybe_redirect_incomplete_registration']);

    // Disable FC's native "Complete your profile (X%)" widget. FC reads
    // auth.compilation_score (sic — their typo); forcing 100 hides the button.
    if (TBCPcom\ProfileGate::get_option('disable_fc_onboarding', true)) {
        add_filter('fluent_community/portal_vars', function ($vars) {
            $vars['features']['is_onboarding_enabled'] = false;
            if (isset($vars['auth'])) {
                $vars['auth']['compilation_score'] = 100;
            }
            return $vars;
        }, 999);
    }

    // ── Admin ─────────────────────────────────────────────────────────
    if (is_admin()) {
        require_once TBC_PCOM_DIR . 'includes/class-admin.php';
        $admin = new TBCPcom\Admin();
        add_action('admin_menu', [$admin, 'add_admin_menu']);
        add_action('admin_init', [$admin, 'register_settings']);
        add_action('admin_enqueue_scripts', [$admin, 'admin_assets']);
    }
}, 25); // After tbc-community-app (priority 20)

/**
 * Activation hook
 */
register_activation_hook(__FILE__, function () {
    $defaults = [
        'enabled'              => true,
        'require_bio'          => true,
        'require_avatar'       => true,
        'disable_fc_onboarding' => true,
    ];

    foreach ($defaults as $key => $value) {
        $option_name = TBC_PCOM_OPTION_PREFIX . $key;
        if (false === get_option($option_name)) {
            add_option($option_name, $value);
        }
    }
});
