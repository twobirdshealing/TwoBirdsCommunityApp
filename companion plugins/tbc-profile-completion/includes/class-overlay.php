<?php
/**
 * Overlay Class
 * Injects a persistent profile-completion overlay on FC portal pages
 * for users with incomplete profiles.
 *
 * @package TBC_ProfileCompletion
 */

declare(strict_types=1);

namespace TBCPcom;

defined('ABSPATH') || exit;

class Overlay {

    private ProfileGate $gate;

    public function __construct(ProfileGate $gate) {
        $this->gate = $gate;
    }

    private function should_show_overlay(): bool {
        return is_user_logged_in() && !$this->gate->is_complete();
    }

    private function inject_css(): void {
        echo '<style id="tbc-pcom-css">' . file_get_contents(TBC_PCOM_DIR . 'assets/css/profile-completion.css') . '</style>';
    }

    private function inject_js(): void {
        $config = $this->build_config();
        $js_path = TBC_PCOM_DIR . 'assets/js/profile-completion.js';
        $ver = file_exists($js_path) ? (string) filemtime($js_path) : '';
        ?>
        <script>var tbcPcomConfig = <?php echo wp_json_encode($config); ?>;</script>
        <script src="<?php echo esc_url(TBC_PCOM_URL . 'assets/js/profile-completion.js'); ?><?php echo $ver ? '?v=' . esc_attr($ver) : ''; ?>" defer="defer"></script>
        <?php
    }

    // Hook: fluent_community/portal_head
    public function inject_portal_css(): void {
        if ($this->should_show_overlay()) {
            $this->inject_css();
        }
    }

    // Hook: fluent_community/portal_footer
    public function inject_portal_js(): void {
        if ($this->should_show_overlay()) {
            $this->inject_js();
        }
    }

    // Hook: wp_head — non-portal FC pages (auth)
    public function maybe_inject_auth_css(): void {
        if ($this->should_show_overlay() && $this->is_fc_page()) {
            $this->inject_css();
        }
    }

    // Hook: wp_footer — non-portal FC pages (auth)
    public function maybe_inject_auth_js(): void {
        if ($this->should_show_overlay() && $this->is_fc_page()) {
            $this->inject_js();
        }
    }

    // Hook: template_redirect — send incomplete users to the portal so the overlay shows.
    public function maybe_redirect_incomplete_registration(): void {
        if (!is_user_logged_in()) {
            return;
        }

        if ($this->gate->is_complete()) {
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

        // Redirect to community portal (overlay will show there)
        $community_url = $this->get_community_url();
        if ($community_url) {
            wp_safe_redirect($community_url);
            exit;
        }
    }

    private function build_config(): array {
        $user = wp_get_current_user();

        $fc_rest_url = defined('FLUENT_COMMUNITY_PLUGIN_VERSION') ? rest_url('fluent-community/v2/') : '';

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
                $existing['avatar'] = ProfileGate::uploaded_avatar_url($xprofile);

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

        $social_providers = [];
        if (class_exists('\FluentCommunity\App\Services\ProfileHelper')) {
            $fc_providers = \FluentCommunity\App\Services\ProfileHelper::socialLinkProviders(true);
            if (is_array($fc_providers)) {
                foreach ($fc_providers as $key => $provider) {
                    $social_providers[] = [
                        'key'         => $key,
                        'label'       => $provider['title'] ?? $key,
                        'placeholder' => $provider['placeholder'] ?? '',
                        'domain'      => $provider['domain'] ?? '',
                        'icon_svg'    => $provider['icon_svg'] ?? '',
                    ];
                }
            }
        }

        return [
            'restUrl'         => rest_url(TBC_PCOM_REST_NAMESPACE . '/'),
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

    private function is_fc_page(): bool {
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        if (isset($_GET['fcom_action'])) {
            return true;
        }
        return did_action('fluent_community/portal_head') > 0;
    }

    private function get_community_url(): string {
        if (class_exists('\FluentCommunity\App\Services\Helper')) {
            return \FluentCommunity\App\Services\Helper::baseUrl();
        }
        return home_url('/');
    }

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
