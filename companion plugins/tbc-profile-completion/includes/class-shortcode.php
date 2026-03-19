<?php
/**
 * Overlay Class
 * Injects a persistent profile-completion overlay on FC portal pages
 * for users with incomplete profiles. No shortcode page needed.
 *
 * @package TBC_ProfileCompletion
 */

declare(strict_types=1);

namespace TBCPcom;

defined('ABSPATH') || exit;

class Shortcode {

    /** @var ProfileGate|null */
    private ?ProfileGate $gate = null;

    private function gate(): ProfileGate {
        if (!$this->gate) {
            $this->gate = new ProfileGate();
        }
        return $this->gate;
    }

    /**
     * Check if overlay should show for current user.
     */
    private function should_show_overlay(): bool {
        if (!is_user_logged_in()) {
            return false;
        }

        if ($this->gate()->is_complete()) {
            return false;
        }

        return true;
    }

    /**
     * Inject CSS into the FC portal <head>.
     * Hook: fluent_community/portal_head
     */
    public function inject_portal_css(): void {
        if (!$this->should_show_overlay()) {
            return;
        }

        $css_file = TBC_PCOM_DIR . 'assets/css/profile-completion.css';
        if (file_exists($css_file)) {
            echo '<style id="tbc-pcom-css">' . file_get_contents($css_file) . '</style>';
        }
    }

    /**
     * Inject config + JS into the FC portal footer.
     * Hook: fluent_community/portal_footer
     */
    public function inject_portal_js(): void {
        if (!$this->should_show_overlay()) {
            return;
        }

        $config = $this->build_config();
        ?>
        <script>var tbcPcomConfig = <?php echo wp_json_encode($config); ?>;</script>
        <script src="<?php echo esc_url(TBC_PCOM_URL . 'assets/js/profile-completion.js'); ?>?v=<?php echo esc_attr(TBC_PCOM_VERSION); ?>" defer="defer"></script>
        <?php
    }

    /**
     * Inject CSS on non-portal FC pages via wp_head.
     * Hook: wp_head
     */
    public function maybe_inject_auth_css(): void {
        if (!$this->should_show_overlay()) {
            return;
        }

        // Only on FC-related pages
        if (!$this->is_fc_page()) {
            return;
        }

        $css_file = TBC_PCOM_DIR . 'assets/css/profile-completion.css';
        if (file_exists($css_file)) {
            echo '<style id="tbc-pcom-css">' . file_get_contents($css_file) . '</style>';
        }
    }

    /**
     * Inject config + JS on non-portal FC pages via wp_footer.
     * Hook: wp_footer
     */
    public function maybe_inject_auth_js(): void {
        if (!$this->should_show_overlay()) {
            return;
        }

        if (!$this->is_fc_page()) {
            return;
        }

        $config = $this->build_config();
        ?>
        <script>var tbcPcomConfig = <?php echo wp_json_encode($config); ?>;</script>
        <script src="<?php echo esc_url(TBC_PCOM_URL . 'assets/js/profile-completion.js'); ?>?v=<?php echo esc_attr(TBC_PCOM_VERSION); ?>" defer="defer"></script>
        <?php
    }

    /**
     * Redirect incomplete users away from non-FC pages to the portal.
     * Hook: template_redirect
     */
    public function maybe_redirect_incomplete_registration(): void {
        if (!is_user_logged_in()) {
            return;
        }

        if ($this->gate()->is_complete()) {
            return;
        }

        // Don't redirect REST API, AJAX, or admin requests
        if (wp_doing_ajax() || is_admin() || (defined('REST_REQUEST') && REST_REQUEST)) {
            return;
        }

        // Don't redirect if already on an FC page (overlay will show)
        if ($this->is_fc_page()) {
            return;
        }

        // Don't redirect if on a page with the shortcode (legacy support)
        global $post;
        if ($post && (has_shortcode($post->post_content, 'tbc_registration')
            || has_shortcode($post->post_content, 'tbc_profile_completion'))) {
            return;
        }

        // Redirect to community portal (overlay will show there)
        $community_url = $this->get_community_url();
        if ($community_url) {
            wp_safe_redirect($community_url);
            exit;
        }
    }

    /**
     * Portal redirect for the SPA.
     * Hook: fluent_community/before_js_loaded
     *
     * Not needed with overlay approach — overlay shows on portal pages directly.
     * Kept as no-op for hook compatibility.
     */
    public function maybe_inject_portal_redirect(): void {
        // Overlay handles this — no redirect needed
    }

    /**
     * Legacy shortcode support — renders the overlay div.
     * Not needed for the overlay approach, but kept for backwards compat.
     */
    public function render_shortcode($atts = []) {
        if (!is_user_logged_in() || $this->gate()->is_complete()) {
            return '';
        }

        $config = $this->build_config();

        $css_file = TBC_PCOM_DIR . 'assets/css/profile-completion.css';
        $output = '';
        if (file_exists($css_file)) {
            $output .= '<style id="tbc-pcom-css">' . file_get_contents($css_file) . '</style>';
        }

        $output .= '<script>var tbcPcomConfig = ' . wp_json_encode($config) . ';</script>';
        $output .= '<script src="' . esc_url(TBC_PCOM_URL . 'assets/js/profile-completion.js?ver=' . TBC_PCOM_VERSION) . '" defer="defer"></script>';

        return $output;
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    /**
     * Build the JS config object.
     */
    private function build_config(): array {
        $user = wp_get_current_user();

        // Get FC REST URL
        $fc_rest_url = '';
        if (defined('FLUENT_COMMUNITY_PLUGIN_VERSION')) {
            $fc_rest_url = rest_url('fluent-community/v2/');
        }

        // Load existing profile data
        $existing = [
            'bio'         => '',
            'avatar'      => '',
            'coverPhoto'  => '',
            'socialLinks' => new \stdClass(),
        ];

        if (class_exists('\FluentCommunity\App\Models\XProfile')) {
            $xprofile = \FluentCommunity\App\Models\XProfile::where('user_id', $user->ID)->first();
            if ($xprofile) {
                $existing['bio'] = $xprofile->short_description ?? '';
                $raw_avatar = $xprofile->avatar ?? '';
                $existing['avatar'] = ProfileGate::is_placeholder_avatar($raw_avatar) ? '' : $raw_avatar;

                $meta = $xprofile->meta ?? [];
                if (is_string($meta)) {
                    $meta = maybe_unserialize($meta);
                }
                if (is_array($meta)) {
                    $existing['coverPhoto'] = $meta['cover_photo'] ?? '';

                    if (!empty($meta['social_links']) && is_array($meta['social_links'])) {
                        $existing['socialLinks'] = $meta['social_links'];
                    }
                }
            }
        }

        // Get FC's enabled social providers
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

        $rest_namespace = defined('TBC_CA_REST_NAMESPACE') ? TBC_CA_REST_NAMESPACE : TBC_PCOM_REST_NAMESPACE;

        return [
            'restUrl'         => rest_url($rest_namespace . '/'),
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
            'requireAvatar'   => (bool) ProfileGate::get_option('require_avatar', true),
        ];
    }

    /**
     * Check if we're on an FC-related page.
     */
    private function is_fc_page(): bool {
        // FC auth pages
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        if (isset($_GET['fcom_action'])) {
            return true;
        }

        // FC portal pages (detected by fluent_community hooks firing)
        if (did_action('fluent_community/portal_head')) {
            return true;
        }

        return false;
    }

    /**
     * Get the Fluent Community portal URL.
     */
    private function get_community_url(): string {
        if (class_exists('\FluentCommunity\App\Services\Helper')) {
            return \FluentCommunity\App\Services\Helper::baseUrl();
        }
        return home_url('/');
    }

    /**
     * Get the site logo URL.
     */
    private function get_site_logo_url(): string {
        if (class_exists('\FluentCommunity\App\Services\Helper')
            && method_exists('\FluentCommunity\App\Services\Helper', 'generalSettings')
        ) {
            $portal = \FluentCommunity\App\Services\Helper::generalSettings();
            if (!empty($portal['logo'])) {
                return $portal['logo'];
            }
        }

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
