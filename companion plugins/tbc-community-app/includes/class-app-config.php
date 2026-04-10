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

        // ─── Socket config (real-time messaging) ─────────────────────────
        $response['socket'] = $this->get_socket_config();

        // ─── Registration capabilities ────────────────────────────────────
        $response['registration'] = $this->get_registration_config();

        // ─── Feature flags (admin-controlled) ──────────────────────────────
        $response['features'] = $this->get_features_config();

        // ─── Time format (WordPress general setting) ─────────────────────
        $response['time_format'] = get_option('time_format', 'g:i a');

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
        $rules = $settings['visibility_rules'] ?? [];

        $hidden = [];
        foreach ($rules as $el_key => $rule) {
            $mode  = $rule['mode'] ?? 'everyone';
            $roles = (array) ($rule['roles'] ?? []);

            if ($mode === 'only') {
                // Visible only to these roles — hidden if user has NONE of them
                if (!array_intersect($user_roles, $roles)) {
                    $hidden[] = $el_key;
                }
            } elseif ($mode === 'except') {
                // Visible to everyone except these roles — hidden if user has ANY of them
                if (array_intersect($user_roles, $roles)) {
                    $hidden[] = $el_key;
                }
            }
        }

        return [
            'hide_menu' => array_values($hidden),
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
    // Socket Config (real-time messaging via Pusher / Fluent Socket / Soketi)
    // =========================================================================

    /**
     * Get public socket config for the mobile app.
     * Mirrors the approach in Fluent Messaging's ChatAppHandler::loadChatComponents()
     * which builds window.fcomChatVars.socket for the web frontend.
     *
     * Returns null if Fluent Messaging is not active.
     * Never exposes the app secret — only the public key and connection options.
     */
    private function get_socket_config() {
        if (!class_exists('FluentMessaging\App\Services\PusherHelper')) {
            return null;
        }

        $config = \FluentMessaging\App\Services\PusherHelper::getSocketConfig(); // $public=true (default)

        if (!$config || empty($config['key'])) {
            return null;
        }

        $isCustomHost = ($config['provider'] ?? 'pusher') !== 'pusher';

        $options = [
            'cluster' => $config['cluster'] ?? 'mt1',
        ];

        // Fluent Socket / custom Soketi need explicit WebSocket host options
        if ($isCustomHost && !empty($config['options']['host'])) {
            $options['wsHost']            = $config['options']['host'];
            $options['wsPort']            = (int) ($config['options']['port'] ?? 443);
            $options['wssPort']           = (int) ($config['options']['port'] ?? 443);
            $options['forceTLS']          = false;
            $options['enabledTransports'] = ['ws', 'wss'];
        }

        return [
            'enabled'       => true,
            'api_key'       => $config['key'],
            'auth_endpoint' => '/chat/broadcast/auth',
            'options'       => $options,
        ];
    }

    // =========================================================================
    // Registration Capabilities
    // =========================================================================

    /**
     * Get registration capabilities — base config from FC, extended by add-on plugins.
     * Add-on plugins (tbc-otp, tbc-profile-completion) hook tbc_ca_registration_config
     * to advertise their features.
     */
    private function get_registration_config() {
        $config = [
            'enabled'            => false,
            'email_verification' => false,
            'otp'                => null,
            'profile_completion' => null,
        ];

        if (!class_exists('FluentCommunity\Modules\Auth\AuthHelper')) {
            return $config;
        }

        $auth_helper = 'FluentCommunity\Modules\Auth\AuthHelper';
        $config['enabled']            = $auth_helper::isRegistrationEnabled();
        $config['email_verification'] = (bool) $auth_helper::isTwoFactorEnabled();

        /**
         * Filter registration capabilities.
         * Add-on plugins inject their config here:
         *
         * tbc-otp sets: $config['otp'] = ['required' => true, 'voice_fallback' => false]
         * tbc-profile-completion sets: $config['profile_completion'] = ['enabled' => true, ...]
         *
         * @param array $config Registration config.
         */
        $config = apply_filters('tbc_ca_registration_config', $config);

        return $config;
    }

    // =========================================================================
    // Feature Flags (admin-controlled, with auto-detection)
    // =========================================================================

    /**
     * Detect FC module availability. Returns an array of feature definitions,
     * each with key, label, description, and active status.
     * Used by both the API (get_features_config) and admin settings UI.
     */
    public static function get_detected_features() {
        // FC modules use Helper::isFeatureEnabled() to check actual module state.
        // Fluent Messaging is a separate plugin (not an FC module), so it uses
        // class_exists() — there is no isFeatureEnabled key for it.
        // Dark mode is a customization setting, not a module — checked via Utility.
        $hasHelper = class_exists('FluentCommunity\App\Services\Helper');
        $isEnabled = function ($key) use ($hasHelper) {
            return $hasHelper && \FluentCommunity\App\Services\Helper::isFeatureEnabled($key);
        };

        // Dark mode lives in FC's customization settings, not module flags
        $darkModeEnabled = false;
        if (class_exists('FluentCommunity\App\Functions\Utility')) {
            $custSettings = \FluentCommunity\App\Functions\Utility::getCustomizationSettings();
            $darkModeEnabled = isset($custSettings['dark_mode']) && $custSettings['dark_mode'] === 'yes';
        }

        return [
            [
                'key'         => 'dark_mode',
                'label'       => __('Dark Mode', 'tbc-ca'),
                'description' => __('Enable switching between dark and light themes. Controlled in Fluent Community → Appearance.', 'tbc-ca'),
                'active'      => $darkModeEnabled,
            ],
            [
                'key'         => 'messaging',
                'label'       => __('Direct Messaging', 'tbc-ca'),
                'description' => __('Direct messaging via Fluent Community Pro with Fluent Messaging.', 'tbc-ca'),
                'active'      => class_exists('FluentMessaging\App\Services\PusherHelper'),
            ],
            [
                'key'         => 'courses',
                'label'       => __('Courses', 'tbc-ca'),
                'description' => __('Course enrollment via Fluent Community Pro with Course module.', 'tbc-ca'),
                'active'      => $isEnabled('course_module'),
            ],
            [
                'key'         => 'followers',
                'label'       => __('Followers', 'tbc-ca'),
                'description' => __('Let users follow each other and filter posts by their followings.', 'tbc-ca'),
                'active'      => $isEnabled('followers_module'),
            ],
            [
                'key'         => 'giphy',
                'label'       => __('Giphy / GIF Picker', 'tbc-ca'),
                'description' => __('Allow users to attach GIFs when creating posts and comments.', 'tbc-ca'),
                'active'      => $isEnabled('giphy_module'),
            ],
            [
                'key'         => 'emoji',
                'label'       => __('Emoji Reactions', 'tbc-ca'),
                'description' => __('Add emoji reactions to posts and comments.', 'tbc-ca'),
                'active'      => $isEnabled('emoji_module'),
            ],
            [
                'key'         => 'badges',
                'label'       => __('User Badges', 'tbc-ca'),
                'description' => __('Display customized badges on user profiles beside their names.', 'tbc-ca'),
                'active'      => $isEnabled('user_badge'),
            ],
            [
                'key'         => 'custom_fields',
                'label'       => __('Custom Profile Fields', 'tbc-ca'),
                'description' => __('Custom fields on member profiles like gender, designation, and more.', 'tbc-ca'),
                'active'      => $isEnabled('custom_profile_fields'),
            ],
        ];
    }

    /**
     * Get feature flags from plugin settings with dependency auto-detection.
     * Flags are set by admin in wp-admin → TBC Community App → Features tab.
     * Dependencies are checked at runtime — if a required plugin/module is not
     * active, the flag is forced off regardless of the admin setting.
     */
    private function get_features_config() {
        $settings = TBC_CA_Core::get_settings();
        $features = $settings['features'] ?? [];

        // Auto-detect: FC module/plugin availability (read-only — overrides stored settings)
        foreach (self::get_detected_features() as $df) {
            $features[$df['key']] = $df['active'];
        }

        /**
         * Filter feature flags before sending to the app.
         * Add-on plugins can modify flags here.
         *
         * @param array $features Feature flags array.
         */
        $features = apply_filters('tbc_ca_features_config', $features);

        return $features;
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
