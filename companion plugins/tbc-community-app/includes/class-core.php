<?php
/**
 * Core class - initializes all plugin components
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_Core {

    private static $instance = null;
    private static $settings_cache = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->load_dependencies();
        $this->init_components();
    }

    private function load_dependencies() {
        // Load all class files
        require_once TBC_CA_PLUGIN_DIR . 'includes/class-api.php';
        require_once TBC_CA_PLUGIN_DIR . 'includes/class-password-api.php';
        require_once TBC_CA_PLUGIN_DIR . 'includes/webview/class-web-session.php';
        require_once TBC_CA_PLUGIN_DIR . 'includes/webview/class-app-view.php';

        require_once TBC_CA_PLUGIN_DIR . 'includes/push/class-registry.php';
        require_once TBC_CA_PLUGIN_DIR . 'includes/push/class-preferences.php';
        require_once TBC_CA_PLUGIN_DIR . 'includes/push/class-devices.php';
        require_once TBC_CA_PLUGIN_DIR . 'includes/push/class-firebase.php';
        require_once TBC_CA_PLUGIN_DIR . 'includes/push/class-api.php';
        require_once TBC_CA_PLUGIN_DIR . 'includes/push/class-hooks.php';
        require_once TBC_CA_PLUGIN_DIR . 'includes/push/class-log.php';
        require_once TBC_CA_PLUGIN_DIR . 'includes/push/class-manual.php';
        require_once TBC_CA_PLUGIN_DIR . 'includes/class-account-api.php';
        require_once TBC_CA_PLUGIN_DIR . 'includes/class-app-config.php';
        require_once TBC_CA_PLUGIN_DIR . 'includes/class-registration-api.php';
        require_once TBC_CA_PLUGIN_DIR . 'includes/class-badge-definitions.php';
        require_once TBC_CA_PLUGIN_DIR . 'includes/class-rest-fields.php';

        require_once TBC_CA_PLUGIN_DIR . 'includes/class-auth.php';
        require_once TBC_CA_PLUGIN_DIR . 'includes/class-auth-api.php';
        require_once TBC_CA_PLUGIN_DIR . 'includes/class-batch-api.php';
        require_once TBC_CA_PLUGIN_DIR . 'includes/class-response-headers.php';
        require_once TBC_CA_PLUGIN_DIR . 'includes/class-deep-links.php';

        // Admin only
        if (is_admin()) {
            require_once TBC_CA_PLUGIN_DIR . 'includes/admin/class-admin.php';
            require_once TBC_CA_PLUGIN_DIR . 'includes/admin/class-settings.php';
        }
    }

    private function init_components() {
        // Initialize JWT Auth (determine_current_user filter — must run early)
        TBC_CA_Auth::get_instance();
        TBC_CA_Auth_API::get_instance();

        // Hook into tbc-registration registration to attach JWT tokens for mobile clients
        add_filter('tbc_reg_registration_response', [$this, 'attach_jwt_to_registration'], 10, 3);

        // Initialize REST API
        TBC_CA_API::get_instance();
        TBC_CA_Password_API::get_instance();

        // Initialize WebView components
        TBC_CA_Web_Session::get_instance();
        TBC_CA_App_View::get_instance();

        // Initialize Push Notification system
        TBC_CA_Push_Registry::get_instance();
        TBC_CA_Push_Preferences::get_instance();
        TBC_CA_Push_Devices::get_instance();
        TBC_CA_Push_Firebase::get_instance();
        TBC_CA_Push_API::get_instance();
        TBC_CA_Push_Hooks::get_instance();
        TBC_CA_Push_Log::get_instance();
        TBC_CA_Push_Manual::get_instance();

        // Initialize Account Management (deactivation + deletion)
        TBC_CA_Account_API::get_instance();

        // Initialize App Config (theme colors + social providers)
        TBC_CA_App_Config::get_instance();

        // Initialize Registration API (base registration — extended by add-on plugins)
        TBC_CA_Registration_API::get_instance();

        // Initialize Badge Definitions
        TBC_CA_Badge_Definitions::get_instance();

        // Initialize REST Fields (Fluent avatar/verified on WP REST API)
        TBC_CA_Rest_Fields::get_instance();

        // Initialize Batch API (combine multiple REST requests into one call)
        TBC_CA_Batch_API::get_instance();

        // Initialize Response Headers (unread counts + maintenance on every response)
        TBC_CA_Response_Headers::get_instance();

        // Initialize Deep Links (.well-known endpoints + smart app banner)
        TBC_CA_Deep_Links::get_instance();

        // Initialize Admin (if in admin)
        if (is_admin()) {
            TBC_CA_Admin::get_instance();
            TBC_CA_Admin_Settings::get_instance();
        }

        // Fix members directory sort: created_at should be DESC (newest first)
        add_action('fluent_community/members_query_ref', function (&$query, $params) {
            $sortBy = $params['sort_by'] ?? 'last_activity';
            if ($sortBy === 'created_at') {
                $query->reorder('created_at', 'DESC');
            }
        }, 10, 2);
    }

    /**
     * Attach JWT tokens to tbc-registration registration response.
     * Only attaches tokens for mobile (non-web) contexts — web uses wp_set_auth_cookie.
     *
     * @param array            $response_data Registration response data.
     * @param int              $user_id       Newly created user ID.
     * @param \WP_REST_Request $request       The registration request.
     * @return array Modified response with JWT tokens.
     */
    public function attach_jwt_to_registration($response_data, $user_id, $request) {
        $data = $request->get_json_params();
        if (empty($data)) {
            $data = $request->get_params();
        }

        $context = sanitize_text_field($data['context'] ?? '');

        // Only generate JWT for mobile (non-web) contexts
        if ($context === 'web') {
            return $response_data;
        }

        $auth = TBC_CA_Auth::get_instance();
        $tokens = $auth->generate_token_pair($user_id);

        if ($tokens) {
            $response_data['access_token']  = $tokens['access_token'];
            $response_data['refresh_token'] = $tokens['refresh_token'];
        }

        return $response_data;
    }

    /**
     * Get plugin settings (cached per request)
     */
    public static function get_settings() {
        if (self::$settings_cache !== null) {
            return self::$settings_cache;
        }

        $defaults = [
            'notification_types'       => [],
            'maintenance_mode'         => [
                'enabled' => false,
                'message' => 'We are performing scheduled maintenance. Please check back shortly.',
            ],
            'maintenance_bypass_roles' => [],
            'ui_visibility'            => [],
            'min_app_version'          => '',
            'store_urls'               => [
                'ios'     => '',
                'android' => '',
            ],
            'apple_team_id'            => '',
            'android_sha256'           => '',
            'app_store_id'             => '',
            'smart_banner_enabled'     => false,
            'features'                 => [
                'dark_mode'          => true,
                'push_notifications' => true,
                'messaging'          => true,
                'courses'            => true,
                'profile_tabs'       => [
                    'posts'    => false,
                    'spaces'   => false,
                    'comments' => false,
                ],
            ],
        ];

        $settings = get_option('tbc_ca_settings', []);
        self::$settings_cache = wp_parse_args($settings, $defaults);
        return self::$settings_cache;
    }

    /**
     * Update plugin settings
     */
    public static function update_settings($settings) {
        self::$settings_cache = null;
        return update_option('tbc_ca_settings', $settings);
    }
}
