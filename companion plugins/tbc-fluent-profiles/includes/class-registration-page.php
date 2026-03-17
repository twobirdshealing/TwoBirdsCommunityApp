<?php
/**
 * Registration Page Class
 * Renders the [tbc_registration] shortcode — a multi-step registration form
 * that calls the same REST API as the mobile app.
 *
 * Steps:
 *   1. Basic info (name, email, username, password)
 *   2. Custom profile fields + terms
 *   3. Email verification (if FC 2FA enabled)
 *   4. Phone OTP (if enabled)
 *   5. Social links (post-login, optional)
 *   6. Avatar + cover photo (post-login, optional)
 *
 * Uses Fluent Community CSS variables for automatic theme matching.
 *
 * @package TBC_Fluent_Profiles
 */

namespace TBCFluentProfiles;

defined('ABSPATH') || exit;

class RegistrationPage {

    /** @var bool Whether inline styles have been output this request. */
    private $styles_output = false;

    /** @var array Cached XProfile models keyed by user_id (avoids duplicate queries per request). */
    private $xprofile_cache = [];

    /** @var array Cached completion results keyed by user_id. */
    private $completion_cache = [];

    /**
     * Render the [tbc_registration] shortcode.
     *
     * CSS is inlined directly as a <style> tag to guarantee it loads regardless
     * of how the page template handles <head> (FC frame templates, portal pages, etc).
     * JS is loaded via an inline <script> tag for the same reason.
     */
    public function render_shortcode($atts = []) {
        // Inline CSS + JS directly — bulletproof, works on any page template
        $inline_assets = $this->get_inline_assets();

        // Logged in users: hide registration form entirely.
        // If profile is incomplete, [tbc_profile_completion] on the same page handles it.
        if (is_user_logged_in()) {
            if ($this->is_registration_complete()) {
                $community_url = $this->get_community_url();
                return $inline_assets . '<div class="tbc-reg-already-logged-in">'
                    . '<p>' . esc_html__('You are already logged in.', 'tbc-fluent-profiles') . '</p>'
                    . '<a href="' . esc_url($community_url) . '">' . esc_html__('Go to Community', 'tbc-fluent-profiles') . '</a>'
                    . '</div>';
            }
            // Incomplete — render nothing, profile completion shortcode takes over
            return $inline_assets;
        }

        // Build config for the JS app
        $config = [
            'restUrl'      => rest_url(TBC_FP_REST_NAMESPACE . '/'),
            'restNonce'    => wp_create_nonce('wp_rest'),
            'communityUrl' => $this->get_community_url(),
            'loginUrl'     => $this->get_login_url(),
            'privacyUrl'   => get_privacy_policy_url(),
            'siteName'     => get_bloginfo('name'),
            'siteLogoUrl'  => $this->get_site_logo_url(),
        ];

        // Turnstile bot protection
        if ((bool) Helpers::get_option('turnstile_enabled', false)) {
            $site_key = Helpers::get_option('turnstile_site_key', '');
            if (!empty($site_key)) {
                $config['turnstileSiteKey'] = $site_key;
            }
        }

        // Render container — JS takes over from here
        ob_start();
        echo $inline_assets;
        ?>
        <div id="tbc-registration-app" class="tbc-reg" data-config="<?php echo esc_attr(wp_json_encode($config)); ?>">
            <div class="tbc-reg__loading">
                <div class="tbc-reg__spinner"></div>
                <p><?php esc_html_e('Loading registration form...', 'tbc-fluent-profiles'); ?></p>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Render the [tbc_profile_completion] shortcode.
     *
     * Shows a bio + avatar form for logged-in users with incomplete profiles.
     * Renders nothing for guests or users whose profile is already complete.
     */
    public function render_profile_completion_shortcode($atts = []) {
        if (!is_user_logged_in()) {
            return '';
        }

        if ($this->is_registration_complete()) {
            return '';
        }

        $user = wp_get_current_user();

        // Get FC REST URL for profile API calls
        $fc_rest_url = '';
        if (defined('FLUENT_COMMUNITY_PLUGIN_VERSION')) {
            $fc_rest_url = rest_url('fluent-community/v2/');
        }

        // Load existing profile data from XProfile so the form pre-populates
        $existing = [
            'bio'          => '',
            'website'      => '',
            'socialLinks'  => new \stdClass(), // empty object for JS
            'avatar'       => '',
            'coverPhoto'   => '',
        ];

        if (class_exists('\FluentCommunity\App\Models\XProfile')) {
            $xprofile = $this->get_cached_xprofile($user->ID);
            if ($xprofile) {
                $existing['bio']    = $xprofile->short_description ?? '';
                $raw_avatar = $xprofile->avatar ?? '';
                $existing['avatar'] = self::is_placeholder_avatar($raw_avatar) ? '' : $raw_avatar;

                // cover_photo, social_links, website are in the serialized `meta` column
                $meta = $xprofile->meta ?? [];
                if (is_string($meta)) {
                    $meta = maybe_unserialize($meta);
                }
                if (is_array($meta)) {
                    $existing['website']   = $meta['website'] ?? '';
                    $existing['coverPhoto'] = $meta['cover_photo'] ?? '';

                    if (!empty($meta['social_links']) && is_array($meta['social_links'])) {
                        $existing['socialLinks'] = $meta['social_links'];
                    }
                }
            }
        }

        // Get FC's enabled social providers (dynamic — matches FC admin config)
        $social_providers = [];
        if (class_exists('\FluentCommunity\App\Services\ProfileHelper')) {
            $fc_providers = \FluentCommunity\App\Services\ProfileHelper::socialLinkProviders(true);
            if (is_array($fc_providers)) {
                foreach ($fc_providers as $key => $provider) {
                    $social_providers[] = [
                        'key'         => $key,
                        'label'       => $provider['title'] ?? $key,
                        'placeholder' => !empty($provider['domain']) ? $provider['domain'] . 'username' : '',
                    ];
                }
            }
        }

        $config = [
            'restUrl'         => rest_url(TBC_FP_REST_NAMESPACE . '/'),
            'fcRestUrl'       => $fc_rest_url,
            'restNonce'       => wp_create_nonce('wp_rest'),
            'communityUrl'    => $this->get_community_url(),
            'username'        => $user->user_login,
            'firstName'       => $user->first_name,
            'lastName'        => $user->last_name,
            'siteName'        => get_bloginfo('name'),
            'siteLogoUrl'     => $this->get_site_logo_url(),
            'existing'        => $existing,
            'socialProviders' => !empty($social_providers) ? $social_providers : null,
            'requireAvatar'   => (bool) Helpers::get_option('profile_completion_require_avatar', true),
        ];

        $output = '';

        // Inline the same registration CSS (shared styles)
        $output .= $this->get_inline_assets();

        // Profile completion JS
        $js_url = esc_url(TBC_FP_URL . 'assets/js/profile-completion.js?ver=' . TBC_FP_VERSION);
        $output .= '<script src="' . $js_url . '" defer="defer"></script>';

        $output .= '<div id="tbc-profile-completion-app" class="tbc-reg" data-config="' . esc_attr(wp_json_encode($config)) . '">'
            . '<div class="tbc-reg__loading">'
            . '<div class="tbc-reg__spinner"></div>'
            . '<p>' . esc_html__('Loading...', 'tbc-fluent-profiles') . '</p>'
            . '</div>'
            . '</div>';

        return $output;
    }

    /**
     * Get inline <style> and <script> tags.
     * Reads the CSS file from disk and embeds it directly in the page.
     * Guarded to only output once per request.
     */
    private function get_inline_assets() {
        if ($this->styles_output) {
            return '';
        }
        $this->styles_output = true;

        $output = '';

        // Inject Fluent Community CSS color variables so theming works on any page template.
        // Skip if FC already injected them via enqueue_global_assets (FluentCommunity Frame template).
        if (!did_action('fluent_community/enqueue_global_assets')
            && class_exists('\FluentCommunity\App\Functions\Utility')
            && method_exists('\FluentCommunity\App\Functions\Utility', 'getColorCssVariables')
        ) {
            $fcom_vars = \FluentCommunity\App\Functions\Utility::getColorCssVariables();
            if ($fcom_vars) {
                $output .= '<style id="tbc-registration-fcom-vars">' . $fcom_vars . '</style>';
            }
        }

        // Inline CSS from file
        $css_file = TBC_FP_DIR . 'assets/css/registration.css';
        if (file_exists($css_file)) {
            $css = file_get_contents($css_file);
            $output .= '<style id="tbc-registration-css">' . $css . '</style>';
        }

        // JS via inline script tag (defer so it runs after DOM is ready)
        $js_url = esc_url(TBC_FP_URL . 'assets/js/registration.js?ver=' . TBC_FP_VERSION);
        $output .= '<script src="' . $js_url . '" defer="defer"></script>';

        return $output;
    }

    /**
     * Get the Fluent Community portal URL.
     */
    private function get_community_url() {
        if (class_exists('\FluentCommunity\App\Services\Helper')) {
            return \FluentCommunity\App\Services\Helper::baseUrl();
        }
        return home_url('/');
    }

    /**
     * Get the login page URL.
     */
    private function get_login_url() {
        if (class_exists('\FluentCommunity\App\Services\Helper')) {
            return \FluentCommunity\App\Services\Helper::baseUrl() . '?fcom_action=auth&form=login';
        }
        return wp_login_url();
    }

    /**
     * Check whether the current user's profile is complete.
     *
     * Logic:
     *   - Gate disabled in settings → always complete.
     *   - `_tbc_registration_complete` is not '0' (or missing) → complete.
     *   - Flag is '0' → check XProfile for admin-configured required fields.
     *     If all present → auto-mark '1' and return complete.
     *     Otherwise → incomplete.
     *
     * @param int|null $user_id Defaults to current user.
     * @return bool True if profile is complete (or gate is disabled).
     */
    public function is_registration_complete($user_id = null) {
        if (!$user_id) {
            $user_id = get_current_user_id();
        }

        if (!$user_id) {
            return true; // not logged in — gate doesn't apply
        }

        // Return cached result if already checked this request
        if (isset($this->completion_cache[$user_id])) {
            return $this->completion_cache[$user_id];
        }

        // Master toggle
        $gate_enabled = Helpers::get_option('profile_completion_enabled', true);
        if (!$gate_enabled) {
            return $this->completion_cache[$user_id] = true;
        }

        $flag = get_user_meta($user_id, TBC_FP_META_REGISTRATION_COMPLETE, true);

        // Flag is '1' — previously marked complete, trust the cached value.
        if ($flag === '1') {
            return $this->completion_cache[$user_id] = true;
        }

        // Flag is '0' or '' (missing) — check XProfile to verify.
        if (class_exists('\FluentCommunity\App\Models\XProfile')) {
            $xprofile = $this->get_cached_xprofile($user_id);

            if ($xprofile) {
                $missing = self::get_missing_fields($xprofile);

                if (empty($missing)) {
                    // All required fields present — auto-mark complete
                    update_user_meta($user_id, TBC_FP_META_REGISTRATION_COMPLETE, '1');
                    return $this->completion_cache[$user_id] = true;
                }

                // Cache the incomplete result so we don't re-query XProfile every page load
                if ($flag !== '0') {
                    update_user_meta($user_id, TBC_FP_META_REGISTRATION_COMPLETE, '0');
                }
            }
        }

        return $this->completion_cache[$user_id] = false;
    }

    /**
     * Get cached XProfile model for a user (avoids duplicate queries per request).
     */
    public function get_cached_xprofile($user_id) {
        if (!isset($this->xprofile_cache[$user_id])) {
            $this->xprofile_cache[$user_id] = \FluentCommunity\App\Models\XProfile::where('user_id', $user_id)->first();
        }
        return $this->xprofile_cache[$user_id];
    }

    /**
     * Get the list of missing required profile fields.
     *
     * @param \FluentCommunity\App\Models\XProfile $xprofile
     * @param array $overrides Optional override values (e.g. from pre-save $data) keyed by XProfile column name.
     * @return string[] Array of missing field keys (e.g. ['bio', 'avatar']).
     */
    public static function get_missing_fields($xprofile, array $overrides = []) {
        $missing = [];

        $bio    = $overrides['short_description'] ?? ($xprofile->short_description ?? '');
        $avatar = $overrides['avatar'] ?? ($xprofile->avatar ?? '');

        if (Helpers::get_option('profile_completion_require_bio', true) && empty($bio)) {
            $missing[] = 'bio';
        }

        if (Helpers::get_option('profile_completion_require_avatar', true) && self::is_placeholder_avatar($avatar)) {
            $missing[] = 'avatar';
        }

        return $missing;
    }

    /**
     * Check if an avatar URL is empty or Fluent Community's default placeholder.
     * FC stores a placeholder image URL even when the user has never uploaded an avatar.
     */
    public static function is_placeholder_avatar(string $avatar): bool {
        if (empty($avatar)) {
            return true;
        }

        // FC default placeholder: .../fluent-community/assets/images/placeholder.png
        if (str_contains($avatar, 'fluent-community/assets/images/placeholder')) {
            return true;
        }

        return false;
    }

    /**
     * Redirect users with incomplete registration back to the registration page.
     * Only affects users who have `_tbc_registration_complete = '0'` (set during registration).
     * Existing users without this meta are unaffected.
     */
    public function maybe_redirect_incomplete_registration() {

        if (!is_user_logged_in()) {
            return;
        }


        if ($this->is_registration_complete()) {
            return;
        }

        // Don't redirect if already on the registration page
        global $post;
        if ($post && (has_shortcode($post->post_content, 'tbc_registration')
            || has_shortcode($post->post_content, 'tbc_profile_completion'))) {
            return;
        }

        // Don't redirect REST API, AJAX, or admin requests
        if (wp_doing_ajax() || is_admin() || (defined('REST_REQUEST') && REST_REQUEST)) {
            return;
        }

        $reg_url = $this->get_registration_page_url();
        if ($reg_url) {
            wp_safe_redirect($reg_url);
            exit;
        }
    }

    /**
     * Find the URL of the page containing the [tbc_registration] shortcode.
     */
    private function get_registration_page_url() {
        static $url = null;
        if ($url !== null) {
            return $url;
        }

        $pages = get_posts([
            'post_type'      => 'page',
            'post_status'    => 'publish',
            'posts_per_page' => 1,
            's'              => '[tbc_registration]',
        ]);

        $url = !empty($pages) ? get_permalink($pages[0]->ID) : '';
        return $url;
    }

    /**
     * Inject a redirect script into the FC portal for users with incomplete registration.
     * Hooked to `fluent_community/before_js_loaded` — fires when the portal page renders,
     * before the SPA JS initializes. This covers FC SPA pages that template_redirect misses.
     */
    public function maybe_inject_portal_redirect() {

        if (!is_user_logged_in()) {
            return;
        }


        if ($this->is_registration_complete()) {
            return;
        }

        $reg_url = $this->get_registration_page_url();
        if (!$reg_url) {
            return;
        }

        echo '<script>window.location.href = ' . wp_json_encode(esc_url($reg_url)) . ';</script>';
    }

    /**
     * Get the site logo URL. Checks FC portal logo first, falls back to WP Customizer.
     */
    private function get_site_logo_url() {
        // 1. Fluent Community portal logo (same one shown on the FC login page)
        if (class_exists('\FluentCommunity\App\Services\Helper')
            && method_exists('\FluentCommunity\App\Services\Helper', 'generalSettings')
        ) {
            $portal = \FluentCommunity\App\Services\Helper::generalSettings();
            if (!empty($portal['logo'])) {
                return $portal['logo'];
            }
        }

        // 2. WordPress Customizer fallback (Appearance → Customize → Site Identity)
        $custom_logo_id = get_theme_mod('custom_logo');
        if ($custom_logo_id) {
            $logo_url = wp_get_attachment_image_url($custom_logo_id, 'medium');
            if ($logo_url) {
                return $logo_url;
            }
        }

        return '';
    }
}
