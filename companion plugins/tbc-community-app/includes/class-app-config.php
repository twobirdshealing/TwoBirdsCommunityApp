<?php
/**
 * App Config API - Exposes app configuration for the mobile app
 *
 * Replaces the former /theme/colors endpoint with a broader /app-config
 * endpoint that returns theme colors, enabled social link providers, and
 * any future dynamic settings in a single call.
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_App_Config {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('rest_api_init', [$this, 'register_routes']);
    }

    /**
     * Register REST routes
     */
    public function register_routes() {
        // GET /wp-json/tbc-ca/v1/app-config
        register_rest_route(TBC_CA_REST_NAMESPACE, '/app-config', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_config'],
            'permission_callback' => '__return_true', // Public — no sensitive data
        ]);
    }

    /**
     * GET /app-config - Return theme colors, social providers, maintenance status,
     * and (when authenticated) role-based UI visibility flags
     */
    public function get_config(WP_REST_Request $request) {
        $response = [
            'success' => true,
        ];

        // ─── Theme colors ────────────────────────────────────────────────
        $response['theme'] = $this->get_theme_data();

        // ─── Social link providers ───────────────────────────────────────
        $response['social_providers'] = $this->get_social_providers();

        // ─── App version control (public) ────────────────────────────────
        $response['update'] = $this->get_update_config();

        // ─── Portal slug (for deep linking) ────────────────────────────────
        $response['portal_slug'] = $this->get_portal_slug();

        // ─── Branding (public — site name + logo from Fluent) ──────────────
        $response['branding'] = $this->get_branding();

        // ─── Maintenance mode (public — always returned) ─────────────────
        $response['maintenance'] = $this->get_maintenance_status();

        // ─── Auth-aware: bypass + visibility (only when JWT is present) ──
        $user_id = get_current_user_id();
        if ($user_id) {
            $user = get_userdata($user_id);
            $user_roles = !empty($user->roles) ? array_values($user->roles) : [];

            // Maintenance bypass: admins always bypass + configurable roles
            $settings = TBC_CA_Core::get_settings();
            $bypass_roles = $settings['maintenance_bypass_roles'] ?? [];
            $response['maintenance']['can_bypass'] =
                user_can($user_id, 'manage_options') ||
                !empty(array_intersect($user_roles, $bypass_roles));

            // UI visibility flags based on all of user's roles
            $response['visibility'] = $this->get_visibility_flags($user_roles, $settings);
        }

        return new WP_REST_Response($response, 200);
    }

    // =========================================================================
    // App Version Control
    // =========================================================================

    /**
     * Get update config (public). Returns null when no min version is set.
     */
    private function get_update_config() {
        $settings = TBC_CA_Core::get_settings();
        $min_ver  = $settings['min_app_version'] ?? '';

        if (empty($min_ver)) {
            return null;
        }

        $urls = $settings['store_urls'] ?? [];

        return [
            'min_version'       => $min_ver,
            'ios_store_url'     => $urls['ios'] ?? '',
            'android_store_url' => $urls['android'] ?? '',
        ];
    }

    // =========================================================================
    // Maintenance Mode
    // =========================================================================

    /**
     * Get maintenance mode status (public — no sensitive data)
     */
    private function get_maintenance_status() {
        $settings = TBC_CA_Core::get_settings();
        $maint    = $settings['maintenance_mode'] ?? [];

        return [
            'enabled' => !empty($maint['enabled']),
            'message' => $maint['message'] ?? 'We are performing scheduled maintenance. Please check back shortly.',
        ];
    }

    // =========================================================================
    // Role-Based UI Visibility
    // =========================================================================

    /**
     * Get visibility flags for a specific user role
     */
    private function get_visibility_flags($user_roles, $settings) {
        $visibility = $settings['ui_visibility'] ?? [];

        // Merge hidden elements across ALL of the user's roles
        $hidden = [];
        foreach ($user_roles as $role) {
            if (isset($visibility[$role])) {
                $hidden = array_merge($hidden, (array) $visibility[$role]);
            }
        }
        $hidden = array_unique($hidden);

        // Remove 'cart' (returned separately as hide_cart boolean) — pass everything else
        $menu_hidden = array_values(array_filter($hidden, function ($key) {
            return $key !== 'cart';
        }));

        return [
            'hide_cart' => in_array('cart', $hidden, true),
            'hide_menu' => $menu_hidden,
        ];
    }

    // =========================================================================
    // Branding (site name + logo from Fluent Community)
    // =========================================================================

    /**
     * Get branding data — site name from Fluent Community (falls back to WP),
     * logo + dark logo from Fluent general settings
     */
    private function get_branding() {
        $branding = [
            'site_name'    => get_option('blogname', ''),
            'site_tagline' => get_option('blogdescription', ''),
            'logo'         => '',
            'logo_dark'    => '',
        ];

        if (class_exists('FluentCommunity\App\Services\Helper')) {
            $general = \FluentCommunity\App\Services\Helper::generalSettings();

            if (!empty($general['site_title'])) {
                $branding['site_name'] = $general['site_title'];
            }
            if (!empty($general['logo'])) {
                $branding['logo'] = $general['logo'];
            }
            if (!empty($general['white_logo'])) {
                $branding['logo_dark'] = $general['white_logo'];
            }
        }

        return $branding;
    }

    // =========================================================================
    // Theme Colors (moved from class-theme-colors.php)
    // =========================================================================

    /**
     * Build theme color data (light + dark schemas)
     */
    private function get_theme_data() {
        if (!class_exists('FluentCommunity\App\Functions\Utility')) {
            return [
                'dark_mode_enabled' => false,
                'light'             => null,
                'dark'              => null,
            ];
        }

        $utility = 'FluentCommunity\App\Functions\Utility';

        $config   = $utility::getColorConfig();
        $schemas  = $utility::getColorSchemas();
        $settings = $utility::getCustomizationSettings();

        $dark_mode_enabled = isset($settings['dark_mode']) && $settings['dark_mode'] === 'yes';

        $light_name = isset($config['light_schema']) ? $config['light_schema'] : 'default';
        $dark_name  = isset($config['dark_schema']) ? $config['dark_schema'] : 'default';

        $light = null;
        if (isset($schemas['lightSkins'][$light_name]['selectors'])) {
            $selectors = $schemas['lightSkins'][$light_name]['selectors'];
            $light = $this->format_selectors($selectors, $config, 'light_config');
        }

        $dark = null;
        if (isset($schemas['darkSkins'][$dark_name]['selectors'])) {
            $selectors = $schemas['darkSkins'][$dark_name]['selectors'];
            $dark = $this->format_selectors($selectors, $config, 'dark_config');
        }

        return [
            'dark_mode_enabled' => $dark_mode_enabled,
            'light_schema'      => $light_name,
            'dark_schema'       => $dark_name,
            'light'             => $light,
            'dark'              => $dark,
        ];
    }

    /**
     * Format selector colors, merging custom overrides on top
     */
    private function format_selectors($selectors, $config, $config_key) {
        $result = [];

        $selector_map = [
            'body'          => 'body',
            'fcom_top_menu' => 'header',
            'spaces'        => 'sidebar',
        ];

        foreach ($selector_map as $internal => $clean) {
            $colors = isset($selectors[$internal]) ? $selectors[$internal] : [];

            if (isset($config[$config_key][$internal]) && is_array($config[$config_key][$internal])) {
                $overrides = $config[$config_key][$internal];
                foreach ($overrides as $key => $value) {
                    if (!empty($value)) {
                        $colors[$key] = $value;
                    }
                }
            }

            $result[$clean] = $colors;
        }

        return $result;
    }

    // =========================================================================
    // Social Link Providers
    // =========================================================================

    /**
     * Get admin-enabled social link providers (key, title, placeholder, domain)
     */
    private function get_social_providers() {
        if (!class_exists('FluentCommunity\App\Services\ProfileHelper')) {
            return [];
        }

        $providers = \FluentCommunity\App\Services\ProfileHelper::socialLinkProviders(true);
        $result = [];

        foreach ($providers as $key => $provider) {
            $result[] = [
                'key'         => $key,
                'title'       => $provider['title'],
                'placeholder' => $provider['placeholder'],
                'domain'      => $provider['domain'],
            ];
        }

        return $result;
    }

    // =========================================================================
    // Portal Slug
    // =========================================================================

    /**
     * Get Fluent Community portal slug (used for deep linking URL mapping)
     */
    private function get_portal_slug() {
        if (class_exists('FluentCommunity\App\Services\Helper')) {
            return \FluentCommunity\App\Services\Helper::getPortalSlug();
        }
        return 'portal';
    }
}
