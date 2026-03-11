<?php
/**
 * Core Class
 * Singleton orchestrator for TBC Fluent Profiles (unified plugin).
 *
 * Manages: custom profile fields, OTP verification (Twilio), registration API,
 * multi-step registration page, and profile display/edit on the FC portal.
 *
 * @package TBC_Fluent_Profiles
 */

namespace TBCFluentProfiles;

defined('ABSPATH') || exit;

class Core {

    private static $instance = null;

    // Profile fields
    private $fields;
    private $visibility;
    private $admin;
    private $profile_api;
    private $frontend;

    // OTP verification
    private $twilio;
    private $password_recovery;
    private $profile_otp;

    // Registration
    private $registration_api;
    private $otp_api;
    private $registration_page;

    /** @var array User IDs already re-evaluated this request (prevents double work from dual hooks). */
    private $reevaluated_users = [];

    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->load_dependencies();
        $this->init_components();
        $this->init_hooks();
    }

    private function load_dependencies() {
        // Profile fields (existing)
        require_once TBC_FP_DIR . 'includes/class-fields.php';
        require_once TBC_FP_DIR . 'includes/class-visibility.php';
        require_once TBC_FP_DIR . 'includes/class-admin.php';
        require_once TBC_FP_DIR . 'includes/class-profile-api.php';
        require_once TBC_FP_DIR . 'includes/class-frontend.php';

        // OTP verification (Twilio)
        require_once TBC_FP_DIR . 'includes/class-helpers.php';
        require_once TBC_FP_DIR . 'includes/class-twilio.php';
        require_once TBC_FP_DIR . 'includes/class-password-recovery.php';
        require_once TBC_FP_DIR . 'includes/class-profile-otp.php';

        // Registration API + OTP API
        require_once TBC_FP_DIR . 'includes/class-registration-api.php';
        require_once TBC_FP_DIR . 'includes/class-otp-api.php';

        // Registration shortcode page
        require_once TBC_FP_DIR . 'includes/class-registration-page.php';
    }

    private function init_components() {
        // Profile fields
        $this->fields = new Fields();
        $this->visibility = new Visibility();
        $this->admin = new Admin($this->fields);
        $this->profile_api = new ProfileApi($this->fields, $this->visibility);
        $this->frontend = new Frontend($this->fields);

        // OTP
        $this->twilio = new Twilio();
        $this->password_recovery = new PasswordRecovery($this->twilio);
        $this->profile_otp = new ProfileOtp($this->twilio);

        // Registration
        $this->registration_api = new RegistrationApi($this->fields, $this->twilio);
        $this->otp_api = new OtpApi($this->twilio);
        $this->registration_page = new RegistrationPage();
    }

    private function init_hooks() {
        // ── Admin ─────────────────────────────────────────────────────
        add_action('admin_menu', [$this->admin, 'add_admin_menu']);
        add_action('admin_init', [$this->admin, 'register_settings']);
        add_action('admin_enqueue_scripts', [$this->admin, 'admin_assets']);

        // ── Profile API (read + write) ────────────────────────────────
        add_filter('fluent_community/profile_view_data', [$this->profile_api, 'inject_profile_data'], 10, 2);
        add_filter('fluent_community/update_profile_data', [$this->profile_api, 'handle_profile_update'], 10, 3);
        add_action('wp_ajax_tbc_fp_save_fields', [$this->profile_api, 'ajax_save_fields']);

        // ── FC portal frontend (profile view + edit) ──────────────────
        add_action('fluent_community/portal_head', [$this->frontend, 'inject_css']);
        add_action('fluent_community/before_js_loaded', [$this->frontend, 'inject_js_config']);
        add_action('fluent_community/portal_footer', [$this->frontend, 'inject_js']);

        // ── Redirect incomplete registrations from FC portal (SPA) ───
        add_action('fluent_community/before_js_loaded', [$this->registration_page, 'maybe_inject_portal_redirect']);

        // ── REST API endpoints (registration + OTP) ───────────────────
        add_action('rest_api_init', [$this->registration_api, 'register_routes']);
        add_action('rest_api_init', [$this->otp_api, 'register_routes']);

        // ── Password Recovery OTP ─────────────────────────────────────
        add_action('lostpassword_post', [$this->password_recovery, 'intercept_lost_password'], 1);
        add_filter('login_message', [$this->password_recovery, 'show_error_message']);

        // ── Profile Phone OTP ─────────────────────────────────────────
        // Priority 1: before profile API handler
        add_action('wp_ajax_tbc_fp_save_fields', [$this->profile_otp, 'intercept_profile_save'], 1);
        add_filter('fluent_community/update_profile_data', [$this->profile_otp, 'filter_profile_update'], 5, 3);

        // ── Optionally disable FC email 2FA when phone OTP is active ──
        add_filter('fluent_auth/verify_signup_email', [$this, 'maybe_disable_email_verification']);

        // ── Optionally disable FC auth rate limiting (for testing) ──
        if (Helpers::get_option('disable_rate_limit', false)) {
            add_filter('fluent_community/auth/disable_rate_limit', '__return_true');
        }

        // ── OTP frontend assets (portal + auth pages) ─────────────────
        add_action('wp_enqueue_scripts', [$this, 'enqueue_otp_assets']);
        add_action('fluent_community/portal_head', [$this, 'inject_otp_portal_css']);
        add_action('fluent_community/before_js_loaded', [$this, 'inject_otp_portal_config']);
        add_action('fluent_community/portal_footer', [$this, 'inject_otp_portal_js']);

        // ── Registration + profile completion shortcodes ──────────────
        add_shortcode('tbc_registration', [$this->registration_page, 'render_shortcode']);
        add_shortcode('tbc_profile_completion', [$this->registration_page, 'render_profile_completion_shortcode']);

        // ── Redirect incomplete registrations ────────────────────────
        add_action('template_redirect', [$this->registration_page, 'maybe_redirect_incomplete_registration']);

        // ── Disable FC native onboarding widget when our gate is active ──
        if (Helpers::get_option('disable_fc_onboarding', true)) {
            add_filter('fluent_community/portal_vars', function ($vars) {
                $vars['features']['is_onboarding_enabled'] = false;
                return $vars;
            });
        }

        // ── Re-evaluate profile completion on profile save ──────────
        // Filter: catches POST /profile (bio, social links, website) — $data has new values pre-save
        add_filter('fluent_community/update_profile_data', [$this, 'reevaluate_profile_completion'], 99, 3);

        // Eloquent model event: catches ALL XProfile saves including PUT /profile (avatar, cover)
        if (class_exists('\FluentCommunity\App\Models\XProfile')) {
            \FluentCommunity\App\Models\XProfile::saved(function ($xprofile) {
                $this->reevaluate_from_model_event($xprofile);
            });
        }
    }

    /**
     * Re-evaluate the profile completion flag after each profile save.
     * If required fields are now missing, re-gate the user.
     * If all required fields are present, mark complete.
     */
    public function reevaluate_profile_completion($data, $xprofile, $user) {
        if (!$user || !Helpers::get_option('profile_completion_enabled', true)) {
            return $data;
        }

        $user_id = $user->ID;

        // Prevent double work if model event also fires this request
        if (isset($this->reevaluated_users[$user_id])) {
            return $data;
        }
        $this->reevaluated_users[$user_id] = true;

        // $data is what's ABOUT to be saved, $xprofile is the CURRENT state.
        // Merge to get the effective state after save via overrides.
        $overrides = [];
        if (is_array($data)) {
            if (array_key_exists('short_description', $data)) {
                $overrides['short_description'] = $data['short_description'];
            }
            if (array_key_exists('avatar', $data)) {
                $overrides['avatar'] = $data['avatar'];
            }
        }

        $flag = get_user_meta($user_id, TBC_FP_META_REGISTRATION_COMPLETE, true);
        $missing = RegistrationPage::get_missing_fields($xprofile, $overrides);

        if (empty($missing)) {
            if ($flag !== '1') {
                update_user_meta($user_id, TBC_FP_META_REGISTRATION_COMPLETE, '1');
            }
        } else {
            if ($flag !== '0') {
                update_user_meta($user_id, TBC_FP_META_REGISTRATION_COMPLETE, '0');
            }
        }

        return $data;
    }

    /**
     * Eloquent model event handler — fires AFTER XProfile is saved to DB.
     * Catches ALL save paths including PUT /profile (avatar/cover) which
     * doesn't fire the `fluent_community/update_profile_data` filter.
     *
     * @param \FluentCommunity\App\Models\XProfile $xprofile Fresh model state (post-save).
     */
    public function reevaluate_from_model_event($xprofile) {
        if (!Helpers::get_option('profile_completion_enabled', true)) {
            return;
        }

        $user_id = $xprofile->user_id ?? null;
        if (!$user_id) {
            return;
        }

        // Skip if the filter handler already handled this user this request
        if (isset($this->reevaluated_users[$user_id])) {
            return;
        }
        $this->reevaluated_users[$user_id] = true;

        $flag = get_user_meta($user_id, TBC_FP_META_REGISTRATION_COMPLETE, true);
        $missing = RegistrationPage::get_missing_fields($xprofile);

        if (empty($missing) && $flag !== '1') {
            update_user_meta($user_id, TBC_FP_META_REGISTRATION_COMPLETE, '1');
        } elseif (!empty($missing) && $flag !== '0') {
            update_user_meta($user_id, TBC_FP_META_REGISTRATION_COMPLETE, '0');
        }
    }

    // =====================================================================
    // OTP Frontend Assets (profile/recovery contexts — registration uses
    // its own JS via the shortcode page)
    // =====================================================================

    /**
     * Enqueue OTP assets on FC auth pages (lost password) and login page.
     */
    public function enqueue_otp_assets() {
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        $is_auth_page = isset($_GET['fcom_action']) && $_GET['fcom_action'] === 'auth';
        $is_login = in_array($GLOBALS['pagenow'] ?? '', ['wp-login.php'], true);

        if (!$is_auth_page && !$is_login) {
            return;
        }

        wp_enqueue_style(
            'tbc-otp-modal',
            TBC_FP_URL . 'assets/css/otp-modal.css',
            [],
            TBC_FP_VERSION
        );

        wp_enqueue_script(
            'tbc-otp-handler',
            TBC_FP_URL . 'assets/js/otp-handler.js',
            [],
            TBC_FP_VERSION,
            true
        );

        wp_localize_script('tbc-otp-handler', 'tbcOtp', $this->get_otp_frontend_config());
    }

    public function inject_otp_portal_css() {
        ?>
        <link rel="stylesheet"
              href="<?php echo esc_url(TBC_FP_URL . 'assets/css/otp-modal.css'); ?>?v=<?php echo esc_attr(TBC_FP_VERSION); ?>"
              media="screen"/>
        <?php
    }

    public function inject_otp_portal_config() {
        ?>
        <script>
            var tbcOtp = <?php echo wp_json_encode($this->get_otp_frontend_config()); ?>;
        </script>
        <?php
    }

    public function inject_otp_portal_js() {
        ?>
        <script src="<?php echo esc_url(TBC_FP_URL . 'assets/js/otp-handler.js'); ?>?v=<?php echo esc_attr(TBC_FP_VERSION); ?>" defer="defer"></script>
        <?php
    }

    /**
     * OTP frontend config for profile phone change and password recovery.
     */
    private function get_otp_frontend_config() {
        return [
            'rest_url'      => rest_url(TBC_FP_REST_NAMESPACE . '/otp/'),
            'rest_nonce'    => wp_create_nonce('wp_rest'),
            'voice_enabled' => (bool) Helpers::get_option('enable_voice_fallback', false),
            'i18n'          => [
                'verifying'        => __('Verifying...', 'tbc-fluent-profiles'),
                'sending'          => __('Sending...', 'tbc-fluent-profiles'),
                'verified'         => __('Verified!', 'tbc-fluent-profiles'),
                'enter_code'       => __('Enter the 6-digit code sent to', 'tbc-fluent-profiles'),
                'verify_btn'       => __('Verify Code', 'tbc-fluent-profiles'),
                'resend_link'      => __('Resend SMS', 'tbc-fluent-profiles'),
                'voice_link'       => __('Try voice call', 'tbc-fluent-profiles'),
                'back_btn'         => __('Go Back', 'tbc-fluent-profiles'),
                'code_placeholder' => __('000000', 'tbc-fluent-profiles'),
            ],
        ];
    }

    /**
     * Optionally disable FC's built-in email 2FA on registration.
     */
    public function maybe_disable_email_verification($enabled) {
        if (!Helpers::get_option('enable_email_verification', true)) {
            return false;
        }
        return $enabled;
    }

    // =====================================================================
    // Public accessors
    // =====================================================================

    public function fields() {
        return $this->fields;
    }

    public function visibility() {
        return $this->visibility;
    }
}
