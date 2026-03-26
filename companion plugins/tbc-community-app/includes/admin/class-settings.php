<?php
/**
 * Admin Settings class - handles the settings page
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_Admin_Settings {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('admin_init', [$this, 'register_settings']);
    }

    /**
     * Register settings
     */
    public function register_settings() {
        register_setting('tbc_ca_settings', 'tbc_ca_settings', [
            'sanitize_callback' => [$this, 'sanitize_settings'],
        ]);
    }

    /**
     * Sanitize settings before save
     */
    public function sanitize_settings($input) {
        $sanitized = [];

        // Notification types
        $sanitized['notification_types'] = [];
        if (isset($input['notification_types']) && is_array($input['notification_types'])) {
            foreach ($input['notification_types'] as $type_id => $type_settings) {
                $sanitized['notification_types'][sanitize_key($type_id)] = [
                    'enabled' => !empty($type_settings['enabled']),
                    'default' => !empty($type_settings['default']),
                    'user_configurable' => !empty($type_settings['user_configurable']),
                ];
            }
        }

        // Maintenance mode
        $sanitized['maintenance_mode'] = [
            'enabled' => !empty($input['maintenance_mode']['enabled']),
            'message' => sanitize_textarea_field($input['maintenance_mode']['message'] ?? ''),
        ];

        // Maintenance bypass roles (admin always bypasses — enforced in API, not here)
        $sanitized['maintenance_bypass_roles'] = [];
        if (isset($input['maintenance_bypass_roles']) && is_array($input['maintenance_bypass_roles'])) {
            $sanitized['maintenance_bypass_roles'] = array_map('sanitize_key', $input['maintenance_bypass_roles']);
        }

        // Min app version (semver string, empty = no enforcement)
        $sanitized['min_app_version'] = sanitize_text_field($input['min_app_version'] ?? '');

        // Store URLs
        $sanitized['store_urls'] = [
            'ios'     => esc_url_raw($input['store_urls']['ios'] ?? ''),
            'android' => esc_url_raw($input['store_urls']['android'] ?? ''),
        ];

        // Custom visibility elements (sanitize before ui_visibility so keys are available)
        $sanitized['custom_visibility_elements'] = [];
        if (isset($input['custom_visibility_elements']) && is_array($input['custom_visibility_elements'])) {
            foreach ($input['custom_visibility_elements'] as $el) {
                $key   = sanitize_key($el['key'] ?? '');
                $label = sanitize_text_field($el['label'] ?? '');
                if ($key && $label) {
                    $sanitized['custom_visibility_elements'][] = [
                        'key'   => $key,
                        'label' => $label,
                    ];
                }
            }
        }

        // UI visibility: store per-element rules directly (mode + roles)
        $sanitized['visibility_rules'] = [];
        $core_elements = ['courses', 'bookmarks', 'directory', 'notification_settings', 'privacy'];
        $custom_keys = array_column($sanitized['custom_visibility_elements'], 'key');
        $allowed_elements = array_merge($core_elements, $custom_keys);
        $all_roles = array_keys(wp_roles()->role_names);

        if (isset($input['visibility_rules']) && is_array($input['visibility_rules'])) {
            foreach ($input['visibility_rules'] as $el_key => $rule) {
                $el_key = sanitize_key($el_key);
                if (!in_array($el_key, $allowed_elements, true)) continue;

                $mode = sanitize_key($rule['mode'] ?? 'everyone');
                $selected_roles = array_map('sanitize_key', (array) ($rule['roles'] ?? []));
                $selected_roles = array_values(array_intersect($selected_roles, $all_roles));

                if (($mode === 'only' || $mode === 'except') && !empty($selected_roles)) {
                    $sanitized['visibility_rules'][$el_key] = [
                        'mode'  => $mode,
                        'roles' => $selected_roles,
                    ];
                }
                // 'everyone' = no rule needed (visible to all)
            }
        }

        // Deep Linking
        $sanitized['bundle_id']            = sanitize_text_field($input['bundle_id'] ?? '');
        $sanitized['package_name']         = sanitize_text_field($input['package_name'] ?? '');
        $sanitized['url_scheme']           = sanitize_text_field($input['url_scheme'] ?? '');
        $sanitized['app_name']             = sanitize_text_field($input['app_name'] ?? '');
        $sanitized['apple_team_id']        = sanitize_text_field($input['apple_team_id'] ?? '');
        $sanitized['android_sha256']       = sanitize_text_field($input['android_sha256'] ?? '');
        $sanitized['app_store_id']         = sanitize_text_field($input['app_store_id'] ?? '');
        $sanitized['smart_banner_enabled'] = !empty($input['smart_banner_enabled']);

        // Feature flags
        $sanitized['features'] = [
            'dark_mode'          => !empty($input['features']['dark_mode']),
            'push_notifications' => !empty($input['features']['push_notifications']),
            'messaging'          => !empty($input['features']['messaging']),
            'courses'            => !empty($input['features']['courses']),
            'profile_tabs'       => [
                'posts'    => !empty($input['features']['profile_tabs']['posts']),
                'spaces'   => !empty($input['features']['profile_tabs']['spaces']),
                'comments' => !empty($input['features']['profile_tabs']['comments']),
            ],
        ];

        // Data management
        $sanitized['delete_data_on_uninstall'] = !empty($input['delete_data_on_uninstall']);

        return $sanitized;
    }

    /**
     * Render settings page
     */
    public function render() {
        if (!current_user_can('manage_options')) {
            return;
        }

        // Handle form submission
        if (isset($_POST['submit']) && check_admin_referer('tbc_ca_settings_nonce')) {
            $this->handle_save();
        }

        // Handle manual push submission
        TBC_CA_Push_Manual::get_instance()->handle_submit();

        // Handle tool actions
        $this->handle_tools();

        $settings = TBC_CA_Core::get_settings();
        $registry = TBC_CA_Push_Registry::get_instance();
        $types_by_category = $registry->get_by_category();

        // Get all WordPress roles for the visibility/bypass sections
        $wp_roles = wp_roles()->role_names; // ['administrator' => 'Administrator', ...]
        $maint = $settings['maintenance_mode'] ?? [];
        $bypass_roles = $settings['maintenance_bypass_roles'] ?? [];
        $min_app_version = $settings['min_app_version'] ?? '';
        $store_urls = $settings['store_urls'] ?? [];
        $features = $settings['features'] ?? [];

        // Core elements (hardcoded isHidden() checks in app UI, not from modules)
        $hideable_elements = [
            'courses'               => __('Courses (menu)', 'tbc-ca'),
            'bookmarks'             => __('Bookmarks (menu)', 'tbc-ca'),
            'directory'             => __('Directory (menu)', 'tbc-ca'),
            'notification_settings' => __('Notification Settings (menu)', 'tbc-ca'),
            'privacy'               => __('Privacy Policy (menu)', 'tbc-ca'),
        ];

        // Merge custom elements added by admin
        $custom_elements = $settings['custom_visibility_elements'] ?? [];
        foreach ($custom_elements as $el) {
            $key   = $el['key'] ?? '';
            $label = $el['label'] ?? '';
            if ($key && $label && !isset($hideable_elements[$key])) {
                $hideable_elements[$key] = esc_html($label);
            }
        }
        $current_tab = isset($_GET['tab']) ? sanitize_key($_GET['tab']) : 'general';
        ?>
        <div class="wrap tbc-ca-admin">
            <h1><?php _e('TBC Community App Settings', 'tbc-ca'); ?></h1>

            <nav class="nav-tab-wrapper tbc-ca-tabs">
                <a href="#general" class="nav-tab<?php echo $current_tab === 'general' ? ' nav-tab-active' : ''; ?>" data-tab="general">
                    <?php _e('General', 'tbc-ca'); ?>
                    <?php if (!empty($maint['enabled'])): ?>
                        <span class="tbc-ca-tab-dot tbc-ca-tab-dot--warning" title="<?php esc_attr_e('Maintenance mode active', 'tbc-ca'); ?>"></span>
                    <?php endif; ?>
                </a>
                <a href="#features" class="nav-tab<?php echo $current_tab === 'features' ? ' nav-tab-active' : ''; ?>" data-tab="features">
                    <?php _e('Features', 'tbc-ca'); ?>
                </a>
                <a href="#visibility" class="nav-tab<?php echo $current_tab === 'visibility' ? ' nav-tab-active' : ''; ?>" data-tab="visibility">
                    <?php _e('UI Visibility', 'tbc-ca'); ?>
                </a>
                <a href="#notifications" class="nav-tab<?php echo $current_tab === 'notifications' ? ' nav-tab-active' : ''; ?>" data-tab="notifications">
                    <?php _e('Notifications', 'tbc-ca'); ?>
                </a>
                <a href="#push-log" class="nav-tab<?php echo $current_tab === 'push-log' ? ' nav-tab-active' : ''; ?>" data-tab="push-log">
                    <?php _e('Push Log', 'tbc-ca'); ?>
                </a>
                <a href="#statistics" class="nav-tab<?php echo $current_tab === 'statistics' ? ' nav-tab-active' : ''; ?>" data-tab="statistics">
                    <?php _e('Statistics', 'tbc-ca'); ?>
                </a>
                <a href="#tools" class="nav-tab<?php echo $current_tab === 'tools' ? ' nav-tab-active' : ''; ?>" data-tab="tools">
                    <?php _e('Tools', 'tbc-ca'); ?>
                </a>
            </nav>

            <form method="post" action="">
                <?php wp_nonce_field('tbc_ca_settings_nonce'); ?>
                <input type="hidden" name="tbc_ca_active_tab" id="tbc-ca-active-tab" value="<?php echo esc_attr($current_tab); ?>" />

                <!-- Tab: General -->
                <div class="tbc-ca-tab-panel<?php echo $current_tab === 'general' ? ' tbc-ca-tab-panel--active' : ''; ?>" data-panel="general">

                <!-- App Version Control -->
                <div class="tbc-ca-section">
                    <h2><?php _e('App Version Control', 'tbc-ca'); ?></h2>
                    <p class="description"><?php _e('Enforce a minimum app version. Users running an older version will see a mandatory update screen and cannot use the app until they update.', 'tbc-ca'); ?></p>

                    <table class="form-table">
                        <tr>
                            <th scope="row"><?php _e('Minimum App Version', 'tbc-ca'); ?></th>
                            <td>
                                <input type="text"
                                       name="tbc_ca_settings[min_app_version]"
                                       value="<?php echo esc_attr($min_app_version); ?>"
                                       class="regular-text"
                                       placeholder="<?php esc_attr_e('e.g. 1.2.0', 'tbc-ca'); ?>" />
                                <p class="description"><?php _e('Users below this version see a mandatory update screen. Leave empty to disable.', 'tbc-ca'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php _e('iOS App Store URL', 'tbc-ca'); ?></th>
                            <td>
                                <input type="url"
                                       name="tbc_ca_settings[store_urls][ios]"
                                       value="<?php echo esc_attr($store_urls['ios'] ?? ''); ?>"
                                       class="large-text"
                                       placeholder="<?php esc_attr_e('https://apps.apple.com/app/...', 'tbc-ca'); ?>" />
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php _e('Android Play Store URL', 'tbc-ca'); ?></th>
                            <td>
                                <input type="url"
                                       name="tbc_ca_settings[store_urls][android]"
                                       value="<?php echo esc_attr($store_urls['android'] ?? ''); ?>"
                                       class="large-text"
                                       placeholder="<?php esc_attr_e('https://play.google.com/store/apps/...', 'tbc-ca'); ?>" />
                                <p class="description"><?php _e('Store links shown on the update screen. Leave empty if not yet published.', 'tbc-ca'); ?></p>
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- Maintenance Mode -->
                <div class="tbc-ca-section<?php echo !empty($maint['enabled']) ? ' tbc-ca-maintenance-active' : ''; ?>">
                    <h2><?php _e('Maintenance / Coming Soon Mode', 'tbc-ca'); ?></h2>
                    <p class="description"><?php _e('When enabled, the app shows a blocking screen with your message. Users can still log in — only roles with bypass access will get through.', 'tbc-ca'); ?></p>

                    <table class="form-table">
                        <tr>
                            <th scope="row"><?php _e('Enable', 'tbc-ca'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox"
                                           name="tbc_ca_settings[maintenance_mode][enabled]"
                                           value="1"
                                           <?php checked(!empty($maint['enabled'])); ?> />
                                    <?php _e('Activate maintenance / coming soon mode', 'tbc-ca'); ?>
                                </label>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php _e('Message', 'tbc-ca'); ?></th>
                            <td>
                                <textarea name="tbc_ca_settings[maintenance_mode][message]"
                                          rows="3"
                                          class="large-text"
                                          placeholder="<?php esc_attr_e('We are performing scheduled maintenance. Please check back shortly.', 'tbc-ca'); ?>"
                                ><?php echo esc_textarea($maint['message'] ?? ''); ?></textarea>
                                <p class="description"><?php _e('This message is shown to users on the maintenance/coming soon screen.', 'tbc-ca'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php _e('Bypass Roles', 'tbc-ca'); ?></th>
                            <td>
                                <?php foreach ($wp_roles as $role_slug => $role_name):
                                    $is_admin = ($role_slug === 'administrator');
                                    $is_checked = $is_admin || in_array($role_slug, $bypass_roles, true);
                                ?>
                                    <label style="display: block; margin-bottom: 4px;">
                                        <input type="checkbox"
                                               name="tbc_ca_settings[maintenance_bypass_roles][]"
                                               value="<?php echo esc_attr($role_slug); ?>"
                                               <?php checked($is_checked); ?>
                                               <?php disabled($is_admin); ?> />
                                        <?php echo esc_html($role_name); ?>
                                        <?php if ($is_admin): ?>
                                            <em style="color: #666;"><?php _e('(always bypasses)', 'tbc-ca'); ?></em>
                                        <?php endif; ?>
                                    </label>
                                <?php endforeach; ?>
                                <p class="description"><?php _e('Selected roles can access the app during maintenance. Administrators always bypass.', 'tbc-ca'); ?></p>
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- Deep Linking -->
                <div class="tbc-ca-section">
                    <h2><?php _e('Deep Linking', 'tbc-ca'); ?></h2>
                    <p class="description"><?php _e('Configure Universal Links (iOS) and App Links (Android) so website URLs open directly in the app. Also controls the Smart App Banner shown to website visitors.', 'tbc-ca'); ?></p>

                    <table class="form-table">
                        <tr>
                            <th scope="row"><?php _e('App Name', 'tbc-ca'); ?></th>
                            <td>
                                <input type="text"
                                       name="tbc_ca_settings[app_name]"
                                       value="<?php echo esc_attr($settings['app_name'] ?? ''); ?>"
                                       class="regular-text"
                                       placeholder="<?php esc_attr_e('e.g. My Community', 'tbc-ca'); ?>" />
                                <p class="description"><?php _e('Display name shown in the Smart App Banner. Should match your app name.', 'tbc-ca'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php _e('Bundle Identifier (iOS)', 'tbc-ca'); ?></th>
                            <td>
                                <input type="text"
                                       name="tbc_ca_settings[bundle_id]"
                                       value="<?php echo esc_attr($settings['bundle_id'] ?? ''); ?>"
                                       class="regular-text"
                                       placeholder="<?php esc_attr_e('e.g. com.example.community', 'tbc-ca'); ?>" />
                                <p class="description"><?php _e('iOS bundle identifier from app.json. Used in the AASA file for Universal Links.', 'tbc-ca'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php _e('Package Name (Android)', 'tbc-ca'); ?></th>
                            <td>
                                <input type="text"
                                       name="tbc_ca_settings[package_name]"
                                       value="<?php echo esc_attr($settings['package_name'] ?? ''); ?>"
                                       class="regular-text"
                                       placeholder="<?php esc_attr_e('e.g. com.example.community', 'tbc-ca'); ?>" />
                                <p class="description"><?php _e('Android package name from app.json. Used in the Asset Links file for App Links.', 'tbc-ca'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php _e('URL Scheme', 'tbc-ca'); ?></th>
                            <td>
                                <input type="text"
                                       name="tbc_ca_settings[url_scheme]"
                                       value="<?php echo esc_attr($settings['url_scheme'] ?? ''); ?>"
                                       class="regular-text"
                                       placeholder="<?php esc_attr_e('e.g. mycommunity', 'tbc-ca'); ?>" />
                                <p class="description"><?php _e('Custom URL scheme (without ://) from app.json. Used by the Smart App Banner to open the app directly.', 'tbc-ca'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php _e('Apple Team ID', 'tbc-ca'); ?></th>
                            <td>
                                <input type="text"
                                       name="tbc_ca_settings[apple_team_id]"
                                       value="<?php echo esc_attr($settings['apple_team_id'] ?? ''); ?>"
                                       class="regular-text"
                                       placeholder="<?php esc_attr_e('e.g. A1B2C3D4E5', 'tbc-ca'); ?>" />
                                <p class="description"><?php _e('From Apple Developer account. Required for iOS Universal Links.', 'tbc-ca'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php _e('Android SHA256 Fingerprint', 'tbc-ca'); ?></th>
                            <td>
                                <input type="text"
                                       name="tbc_ca_settings[android_sha256]"
                                       value="<?php echo esc_attr($settings['android_sha256'] ?? ''); ?>"
                                       class="large-text"
                                       placeholder="<?php esc_attr_e('AA:BB:CC:DD:...', 'tbc-ca'); ?>" />
                                <p class="description"><?php _e('From your Android signing key. Required for Android App Links.', 'tbc-ca'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php _e('App Store ID', 'tbc-ca'); ?></th>
                            <td>
                                <input type="text"
                                       name="tbc_ca_settings[app_store_id]"
                                       value="<?php echo esc_attr($settings['app_store_id'] ?? ''); ?>"
                                       class="regular-text"
                                       placeholder="<?php esc_attr_e('e.g. 123456789', 'tbc-ca'); ?>" />
                                <p class="description"><?php _e('Apple numeric app ID (from App Store Connect). Used for the iOS Smart App Banner.', 'tbc-ca'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php _e('Smart App Banner', 'tbc-ca'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox"
                                           name="tbc_ca_settings[smart_banner_enabled]"
                                           value="1"
                                           <?php checked(!empty($settings['smart_banner_enabled'])); ?> />
                                    <?php _e('Show "Open in App" banner on community pages', 'tbc-ca'); ?>
                                </label>
                                <p class="description"><?php _e('iOS uses the native Smart App Banner. Android shows a custom bottom banner on Chrome.', 'tbc-ca'); ?></p>
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- Data Management -->
                <div class="tbc-ca-section">
                    <h2><?php _e('Data Management', 'tbc-ca'); ?></h2>
                    <table class="form-table">
                        <tr>
                            <th scope="row"><?php _e('Uninstall Behavior', 'tbc-ca'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox"
                                           name="tbc_ca_settings[delete_data_on_uninstall]"
                                           value="1"
                                           <?php checked(!empty($settings['delete_data_on_uninstall'])); ?> />
                                    <?php _e('Delete all plugin data when uninstalled', 'tbc-ca'); ?>
                                </label>
                                <p class="description"><?php _e('When enabled, uninstalling this plugin will permanently remove all settings, device tokens, push logs, JWT secrets, and database tables. Leave unchecked to preserve data if reinstalling later.', 'tbc-ca'); ?></p>
                            </td>
                        </tr>
                    </table>
                </div>

                </div><!-- /.tbc-ca-tab-panel general -->

                <!-- Tab: Features -->
                <div class="tbc-ca-tab-panel<?php echo $current_tab === 'features' ? ' tbc-ca-tab-panel--active' : ''; ?>" data-panel="features">

                <div class="tbc-ca-section">
                    <h2><?php _e('App Feature Flags', 'tbc-ca'); ?></h2>
                    <p class="description"><?php _e('Toggle app features on or off. Changes take effect the next time the app is launched. Features with missing dependencies are automatically disabled regardless of this setting.', 'tbc-ca'); ?></p>

                    <table class="form-table">
                        <tr>
                            <th scope="row"><?php _e('Dark Mode', 'tbc-ca'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox"
                                           name="tbc_ca_settings[features][dark_mode]"
                                           value="1"
                                           <?php checked(!empty($features['dark_mode'])); ?> />
                                    <?php _e('Enable dark mode support', 'tbc-ca'); ?>
                                </label>
                                <p class="description"><?php _e('Dark mode colors are synced from your Fluent Community theme settings.', 'tbc-ca'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php _e('Push Notifications', 'tbc-ca'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox"
                                           name="tbc_ca_settings[features][push_notifications]"
                                           value="1"
                                           <?php checked(!empty($features['push_notifications'])); ?> />
                                    <?php _e('Enable push notifications', 'tbc-ca'); ?>
                                </label>
                                <p class="description"><?php _e('Requires Firebase configuration in the app. When disabled, no push tokens are registered and no notifications are sent.', 'tbc-ca'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php _e('Messaging', 'tbc-ca'); ?></th>
                            <td>
                                <?php $messaging_available = class_exists('FluentMessaging\App\Services\PusherHelper'); ?>
                                <label>
                                    <input type="checkbox"
                                           name="tbc_ca_settings[features][messaging]"
                                           value="1"
                                           <?php checked(!empty($features['messaging'])); ?>
                                           <?php disabled(!$messaging_available); ?> />
                                    <?php _e('Enable direct messaging', 'tbc-ca'); ?>
                                </label>
                                <?php if (!$messaging_available): ?>
                                    <span class="tbc-ca-feature-badge"><?php _e('NOT AVAILABLE', 'tbc-ca'); ?></span>
                                    <p class="description" style="color: #b32d2e;"><?php _e('Requires Fluent Community Pro with Fluent Messaging enabled. Automatically disabled.', 'tbc-ca'); ?></p>
                                <?php else: ?>
                                    <p class="description"><?php _e('Direct messaging via Fluent Community Pro with Fluent Messaging.', 'tbc-ca'); ?></p>
                                <?php endif; ?>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php _e('Courses', 'tbc-ca'); ?></th>
                            <td>
                                <?php $courses_available = class_exists('FluentCommunity\Modules\Course\Model\Course'); ?>
                                <label>
                                    <input type="checkbox"
                                           name="tbc_ca_settings[features][courses]"
                                           value="1"
                                           <?php checked(!empty($features['courses'])); ?>
                                           <?php disabled(!$courses_available); ?> />
                                    <?php _e('Enable courses', 'tbc-ca'); ?>
                                </label>
                                <?php if (!$courses_available): ?>
                                    <span class="tbc-ca-feature-badge"><?php _e('NOT AVAILABLE', 'tbc-ca'); ?></span>
                                    <p class="description" style="color: #b32d2e;"><?php _e('Requires Fluent Community Pro with Course module enabled. Automatically disabled.', 'tbc-ca'); ?></p>
                                <?php else: ?>
                                    <p class="description"><?php _e('Course enrollment via Fluent Community Pro with Course module.', 'tbc-ca'); ?></p>
                                <?php endif; ?>
                            </td>
                        </tr>
                    </table>
                </div>

                <div class="tbc-ca-section">
                    <h2><?php _e('Profile Tabs', 'tbc-ca'); ?></h2>
                    <p class="description"><?php _e('Extra tabs shown on user profile pages. The About tab is always visible.', 'tbc-ca'); ?></p>

                    <table class="form-table">
                        <tr>
                            <th scope="row"><?php _e('Posts', 'tbc-ca'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox"
                                           name="tbc_ca_settings[features][profile_tabs][posts]"
                                           value="1"
                                           <?php checked(!empty($features['profile_tabs']['posts'])); ?> />
                                    <?php _e('Show user posts feed on their profile', 'tbc-ca'); ?>
                                </label>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php _e('Spaces', 'tbc-ca'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox"
                                           name="tbc_ca_settings[features][profile_tabs][spaces]"
                                           value="1"
                                           <?php checked(!empty($features['profile_tabs']['spaces'])); ?> />
                                    <?php _e('Show user joined spaces on their profile', 'tbc-ca'); ?>
                                </label>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php _e('Comments', 'tbc-ca'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox"
                                           name="tbc_ca_settings[features][profile_tabs][comments]"
                                           value="1"
                                           <?php checked(!empty($features['profile_tabs']['comments'])); ?> />
                                    <?php _e('Show user comments on their profile', 'tbc-ca'); ?>
                                </label>
                            </td>
                        </tr>
                    </table>
                </div>

                </div><!-- /.tbc-ca-tab-panel features -->

                <!-- Tab: UI Visibility -->
                <div class="tbc-ca-tab-panel<?php echo $current_tab === 'visibility' ? ' tbc-ca-tab-panel--active' : ''; ?>" data-panel="visibility">

                <?php
                // ── Read per-element visibility rules ──
                $all_role_slugs = array_keys($wp_roles);
                $custom_keys_list = array_column($custom_elements, 'key');
                $vis_rules = $settings['visibility_rules'] ?? [];

                // Build element_modes from stored rules (direct — no conversion needed)
                $element_modes = [];
                foreach ($hideable_elements as $el_key => $el_label) {
                    $element_modes[$el_key] = $vis_rules[$el_key] ?? ['mode' => 'everyone', 'roles' => []];
                }

                $core_element_keys = ['courses', 'bookmarks', 'directory', 'notification_settings', 'privacy'];

                // Helper: render a visibility card (used for both core and custom)
                $render_vis_card = function($el_key, $el_label, $is_custom, $custom_idx = null) use ($element_modes, $wp_roles, $all_role_slugs) {
                    $mode_data = $element_modes[$el_key] ?? ['mode' => 'everyone', 'roles' => []];
                    $mode = $mode_data['mode'];
                    $selected_roles = $mode_data['roles'];

                    if ($mode === 'everyone') {
                        $summary = __('Visible to all', 'tbc-ca');
                        $summary_class = 'tbc-ca-summary--all';
                    } elseif ($mode === 'only') {
                        $names = array_map(function($s) use ($wp_roles) { return $wp_roles[$s] ?? $s; }, $selected_roles);
                        $summary = __('Only:', 'tbc-ca') . ' ' . implode(', ', $names);
                        $summary_class = 'tbc-ca-summary--only';
                    } else {
                        $names = array_map(function($s) use ($wp_roles) { return $wp_roles[$s] ?? $s; }, $selected_roles);
                        $summary = __('Hidden from:', 'tbc-ca') . ' ' . implode(', ', $names);
                        $summary_class = 'tbc-ca-summary--except';
                    }
                    ?>
                    <div class="tbc-vis-card<?php echo $is_custom ? ' tbc-vis-card--custom' : ''; ?>" data-element="<?php echo esc_attr($el_key); ?>">
                        <?php if ($is_custom): ?>
                            <input type="hidden" name="tbc_ca_settings[custom_visibility_elements][<?php echo $custom_idx; ?>][key]" value="<?php echo esc_attr($el_key); ?>" />
                            <input type="hidden" name="tbc_ca_settings[custom_visibility_elements][<?php echo $custom_idx; ?>][label]" value="<?php echo esc_attr($el_label); ?>" />
                        <?php endif; ?>

                        <!-- Collapsed header -->
                        <div class="tbc-vis-card__header" onclick="tbcVis.toggle(this);">
                            <div class="tbc-vis-card__header-left">
                                <span class="tbc-vis-card__arrow dashicons dashicons-arrow-right-alt2"></span>
                                <div class="tbc-vis-card__identity">
                                    <span class="tbc-vis-card__label"><?php echo esc_html($el_label); ?></span>
                                    <?php if ($is_custom): ?>
                                        <span class="tbc-vis-card__key-badge"><?php echo esc_html($el_key); ?></span>
                                    <?php endif; ?>
                                </div>
                                <span class="tbc-vis-card__type-badge tbc-vis-card__type-badge--<?php echo $is_custom ? 'custom' : 'core'; ?>">
                                    <?php echo $is_custom ? __('Custom', 'tbc-ca') : __('Core', 'tbc-ca'); ?>
                                </span>
                            </div>
                            <div class="tbc-vis-card__header-right">
                                <span class="tbc-vis-card__summary <?php echo esc_attr($summary_class); ?>"><?php echo esc_html($summary); ?></span>
                                <?php if ($is_custom): ?>
                                    <button type="button" class="tbc-vis-card__delete" onclick="tbcVis.removeElement(event, this);" title="<?php esc_attr_e('Remove element', 'tbc-ca'); ?>">
                                        <span class="dashicons dashicons-trash"></span>
                                    </button>
                                <?php endif; ?>
                            </div>
                        </div>

                        <!-- Expanded body -->
                        <div class="tbc-vis-card__body" style="display: none;">
                            <div class="tbc-vis-card__modes">
                                <label class="tbc-vis-mode <?php echo $mode === 'everyone' ? 'tbc-vis-mode--active' : ''; ?>">
                                    <input type="radio"
                                           name="tbc_ca_settings[visibility_rules][<?php echo esc_attr($el_key); ?>][mode]"
                                           value="everyone"
                                           <?php checked($mode, 'everyone'); ?>
                                           onchange="tbcVis.modeChange(this);" />
                                    <span class="dashicons dashicons-visibility"></span>
                                    <span class="tbc-vis-mode__text">
                                        <strong><?php _e('Everyone', 'tbc-ca'); ?></strong>
                                        <small><?php _e('Visible to all roles', 'tbc-ca'); ?></small>
                                    </span>
                                </label>
                                <label class="tbc-vis-mode <?php echo $mode === 'only' ? 'tbc-vis-mode--active' : ''; ?>">
                                    <input type="radio"
                                           name="tbc_ca_settings[visibility_rules][<?php echo esc_attr($el_key); ?>][mode]"
                                           value="only"
                                           <?php checked($mode, 'only'); ?>
                                           onchange="tbcVis.modeChange(this);" />
                                    <span class="dashicons dashicons-lock"></span>
                                    <span class="tbc-vis-mode__text">
                                        <strong><?php _e('Only these roles', 'tbc-ca'); ?></strong>
                                        <small><?php _e('Hidden from everyone else', 'tbc-ca'); ?></small>
                                    </span>
                                </label>
                                <label class="tbc-vis-mode <?php echo $mode === 'except' ? 'tbc-vis-mode--active' : ''; ?>">
                                    <input type="radio"
                                           name="tbc_ca_settings[visibility_rules][<?php echo esc_attr($el_key); ?>][mode]"
                                           value="except"
                                           <?php checked($mode, 'except'); ?>
                                           onchange="tbcVis.modeChange(this);" />
                                    <span class="dashicons dashicons-hidden"></span>
                                    <span class="tbc-vis-mode__text">
                                        <strong><?php _e('Everyone except', 'tbc-ca'); ?></strong>
                                        <small><?php _e('Hidden from selected roles', 'tbc-ca'); ?></small>
                                    </span>
                                </label>
                            </div>

                            <div class="tbc-vis-card__roles" style="<?php echo $mode === 'everyone' ? 'display:none;' : ''; ?>">
                                <div class="tbc-vis-pills">
                                    <?php foreach ($selected_roles as $role_slug):
                                        $role_name = $wp_roles[$role_slug] ?? $role_slug;
                                    ?>
                                    <span class="tbc-vis-pill" data-role="<?php echo esc_attr($role_slug); ?>">
                                        <?php echo esc_html($role_name); ?>
                                        <button type="button" class="tbc-vis-pill__x" onclick="tbcVis.removeRole(this);">&times;</button>
                                        <input type="hidden"
                                               name="tbc_ca_settings[visibility_rules][<?php echo esc_attr($el_key); ?>][roles][]"
                                               value="<?php echo esc_attr($role_slug); ?>" />
                                    </span>
                                    <?php endforeach; ?>
                                </div>
                                <select class="tbc-vis-role-select" onchange="tbcVis.addRole(this);">
                                    <option value=""><?php _e('— Add a role —', 'tbc-ca'); ?></option>
                                    <?php foreach ($wp_roles as $role_slug => $role_name): ?>
                                        <option value="<?php echo esc_attr($role_slug); ?>"
                                                <?php echo in_array($role_slug, $selected_roles, true) ? 'disabled' : ''; ?>>
                                            <?php echo esc_html($role_name); ?>
                                        </option>
                                    <?php endforeach; ?>
                                </select>
                            </div>
                        </div>
                    </div>
                    <?php
                };
                ?>

                <!-- Core Elements -->
                <div class="tbc-ca-section">
                    <h2><?php _e('Core Elements', 'tbc-ca'); ?></h2>
                    <p class="description"><?php _e('Built-in app UI elements. Click to configure visibility by role.', 'tbc-ca'); ?></p>

                    <div class="tbc-vis-list">
                        <?php foreach ($core_element_keys as $el_key):
                            if (!isset($hideable_elements[$el_key])) continue;
                            $render_vis_card($el_key, $hideable_elements[$el_key], false);
                        endforeach; ?>
                    </div>
                </div>

                <!-- Custom Elements -->
                <div class="tbc-ca-section">
                    <h2><?php _e('Custom Elements', 'tbc-ca'); ?></h2>
                    <p class="description"><?php _e('Elements from your app modules. The key must match the <code>hideMenuKey</code> in the module manifest.', 'tbc-ca'); ?></p>

                    <div class="tbc-vis-list" id="tbc-vis-custom-list">
                        <?php
                        $idx = 0;
                        foreach ($custom_elements as $el):
                            $key   = $el['key'] ?? '';
                            $label = $el['label'] ?? '';
                            if (!$key || !$label) { $idx++; continue; }
                            $render_vis_card($key, $label, true, $idx);
                            $idx++;
                        endforeach;
                        ?>

                        <!-- Add element card -->
                        <div class="tbc-vis-card tbc-vis-card--add" id="tbc-vis-add-card" onclick="tbcVis.showAddForm();">
                            <div class="tbc-vis-card--add__inner">
                                <span class="tbc-vis-card--add__icon">+</span>
                                <span class="tbc-vis-card--add__text"><?php _e('Add Custom Element', 'tbc-ca'); ?></span>
                                <span class="tbc-vis-card--add__hint"><?php _e('Register a new module element for visibility control', 'tbc-ca'); ?></span>
                            </div>
                        </div>

                        <!-- Inline add form -->
                        <div class="tbc-vis-card tbc-vis-card--form" id="tbc-vis-add-form" style="display: none;">
                            <div class="tbc-vis-add-form__inner">
                                <h4><?php _e('New Custom Element', 'tbc-ca'); ?></h4>
                                <div class="tbc-vis-add-form__fields">
                                    <label class="tbc-vis-add-form__field">
                                        <span><?php _e('Key', 'tbc-ca'); ?></span>
                                        <input type="text" id="tbc-vis-new-key" placeholder="my_module" />
                                        <small><?php _e('Must match hideMenuKey in module', 'tbc-ca'); ?></small>
                                    </label>
                                    <label class="tbc-vis-add-form__field">
                                        <span><?php _e('Label', 'tbc-ca'); ?></span>
                                        <input type="text" id="tbc-vis-new-label" placeholder="My Module (tab)" />
                                        <small><?php _e('Display name for this element', 'tbc-ca'); ?></small>
                                    </label>
                                </div>
                                <div class="tbc-vis-add-form__actions">
                                    <button type="button" class="button button-primary" onclick="tbcVis.confirmAdd();"><?php _e('Add Element', 'tbc-ca'); ?></button>
                                    <button type="button" class="button" onclick="tbcVis.cancelAdd();"><?php _e('Cancel', 'tbc-ca'); ?></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Visibility JS -->
                <script>
                (function() {
                    var roles = <?php echo json_encode($wp_roles); ?>;

                    window.tbcVis = {
                        // ── Toggle card — only one open at a time ──
                        toggle: function(header) {
                            var card = header.closest('.tbc-vis-card');
                            var body = card.querySelector('.tbc-vis-card__body');
                            var isOpen = body.style.display !== 'none';

                            // Close all other open cards
                            document.querySelectorAll('.tbc-vis-card--open').forEach(function(c) {
                                if (c !== card) {
                                    c.classList.remove('tbc-vis-card--open');
                                    c.querySelector('.tbc-vis-card__body').style.display = 'none';
                                }
                            });

                            body.style.display = isOpen ? 'none' : 'block';
                            card.classList.toggle('tbc-vis-card--open', !isOpen);
                        },

                        // ── Mode change ──
                        modeChange: function(radio) {
                            var card = radio.closest('.tbc-vis-card');
                            var rolesSection = card.querySelector('.tbc-vis-card__roles');
                            var modes = card.querySelectorAll('.tbc-vis-mode');
                            modes.forEach(function(m) { m.classList.remove('tbc-vis-mode--active'); });
                            radio.closest('.tbc-vis-mode').classList.add('tbc-vis-mode--active');
                            rolesSection.style.display = radio.value === 'everyone' ? 'none' : '';
                            this._updateSummary(card);
                        },

                        // ── Add role ──
                        addRole: function(select) {
                            var slug = select.value;
                            if (!slug) return;
                            var name = select.options[select.selectedIndex].text;
                            var card = select.closest('.tbc-vis-card');
                            var elKey = card.dataset.element;
                            var pills = card.querySelector('.tbc-vis-pills');

                            var pill = document.createElement('span');
                            pill.className = 'tbc-vis-pill';
                            pill.dataset.role = slug;
                            pill.innerHTML = name +
                                '<button type="button" class="tbc-vis-pill__x" onclick="tbcVis.removeRole(this);">&times;</button>' +
                                '<input type="hidden" name="tbc_ca_settings[visibility_rules][' + elKey + '][roles][]" value="' + slug + '" />';
                            pills.appendChild(pill);

                            select.options[select.selectedIndex].disabled = true;
                            select.value = '';
                            this._updateSummary(card);
                        },

                        // ── Remove role ──
                        removeRole: function(btn) {
                            var pill = btn.closest('.tbc-vis-pill');
                            var card = pill.closest('.tbc-vis-card');
                            var slug = pill.dataset.role;
                            var select = card.querySelector('.tbc-vis-role-select');
                            for (var i = 0; i < select.options.length; i++) {
                                if (select.options[i].value === slug) { select.options[i].disabled = false; break; }
                            }
                            pill.remove();
                            this._updateSummary(card);
                        },

                        // ── Update summary badge ──
                        _updateSummary: function(card) {
                            var el = card.querySelector('.tbc-vis-card__summary');
                            var mode = card.querySelector('input[type="radio"]:checked').value;
                            var pills = card.querySelectorAll('.tbc-vis-pill');
                            var names = [];
                            pills.forEach(function(p) { names.push(p.textContent.replace('×', '').trim()); });

                            el.className = 'tbc-vis-card__summary';
                            if (mode === 'everyone') {
                                el.textContent = '<?php echo esc_js(__('Visible to all', 'tbc-ca')); ?>';
                                el.classList.add('tbc-ca-summary--all');
                            } else if (mode === 'only') {
                                el.textContent = names.length ? '<?php echo esc_js(__('Only:', 'tbc-ca')); ?> ' + names.join(', ') : '<?php echo esc_js(__('Only: (none selected)', 'tbc-ca')); ?>';
                                el.classList.add('tbc-ca-summary--only');
                            } else {
                                el.textContent = names.length ? '<?php echo esc_js(__('Hidden from:', 'tbc-ca')); ?> ' + names.join(', ') : '<?php echo esc_js(__('Hidden from: (none selected)', 'tbc-ca')); ?>';
                                el.classList.add('tbc-ca-summary--except');
                            }
                        },

                        // ── Show add form ──
                        showAddForm: function() {
                            document.getElementById('tbc-vis-add-card').style.display = 'none';
                            document.getElementById('tbc-vis-add-form').style.display = '';
                            document.getElementById('tbc-vis-new-key').focus();
                        },

                        cancelAdd: function() {
                            document.getElementById('tbc-vis-new-key').value = '';
                            document.getElementById('tbc-vis-new-label').value = '';
                            document.getElementById('tbc-vis-add-form').style.display = 'none';
                            document.getElementById('tbc-vis-add-card').style.display = '';
                        },

                        // ── Confirm add ──
                        confirmAdd: function() {
                            var key = document.getElementById('tbc-vis-new-key').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
                            var label = document.getElementById('tbc-vis-new-label').value.trim();
                            if (!key || !label) { alert('<?php echo esc_js(__('Both key and label are required.', 'tbc-ca')); ?>'); return; }

                            // Duplicate check
                            var all = document.querySelectorAll('.tbc-vis-card[data-element]');
                            for (var i = 0; i < all.length; i++) {
                                if (all[i].dataset.element === key) { alert('<?php echo esc_js(__('An element with this key already exists.', 'tbc-ca')); ?>'); return; }
                            }

                            var list = document.getElementById('tbc-vis-custom-list');
                            var addCard = document.getElementById('tbc-vis-add-card');
                            var idx = list.querySelectorAll('.tbc-vis-card--custom').length;

                            // Build role options
                            var opts = '<option value=""><?php echo esc_js(__('— Add a role —', 'tbc-ca')); ?></option>';
                            for (var slug in roles) { opts += '<option value="' + slug + '">' + roles[slug] + '</option>'; }

                            var html =
                                '<div class="tbc-vis-card tbc-vis-card--custom" data-element="' + key + '">' +
                                    '<input type="hidden" name="tbc_ca_settings[custom_visibility_elements][' + idx + '][key]" value="' + key + '" />' +
                                    '<input type="hidden" name="tbc_ca_settings[custom_visibility_elements][' + idx + '][label]" value="' + label + '" />' +
                                    '<div class="tbc-vis-card__header" onclick="tbcVis.toggle(this);">' +
                                        '<div class="tbc-vis-card__header-left">' +
                                            '<span class="tbc-vis-card__arrow dashicons dashicons-arrow-right-alt2"></span>' +
                                            '<div class="tbc-vis-card__identity">' +
                                                '<span class="tbc-vis-card__label">' + label + '</span>' +
                                                '<span class="tbc-vis-card__key-badge">' + key + '</span>' +
                                            '</div>' +
                                            '<span class="tbc-vis-card__type-badge tbc-vis-card__type-badge--custom"><?php echo esc_js(__('Custom', 'tbc-ca')); ?></span>' +
                                        '</div>' +
                                        '<div class="tbc-vis-card__header-right">' +
                                            '<span class="tbc-vis-card__summary tbc-ca-summary--all"><?php echo esc_js(__('Visible to all', 'tbc-ca')); ?></span>' +
                                            '<button type="button" class="tbc-vis-card__delete" onclick="tbcVis.removeElement(event, this);" title="<?php echo esc_js(__('Remove element', 'tbc-ca')); ?>">' +
                                                '<span class="dashicons dashicons-trash"></span>' +
                                            '</button>' +
                                        '</div>' +
                                    '</div>' +
                                    '<div class="tbc-vis-card__body" style="display: none;">' +
                                        '<div class="tbc-vis-card__modes">' +
                                            '<label class="tbc-vis-mode tbc-vis-mode--active">' +
                                                '<input type="radio" name="tbc_ca_settings[visibility_rules][' + key + '][mode]" value="everyone" checked onchange="tbcVis.modeChange(this);" />' +
                                                '<span class="dashicons dashicons-visibility"></span>' +
                                                '<span class="tbc-vis-mode__text"><strong><?php echo esc_js(__('Everyone', 'tbc-ca')); ?></strong><small><?php echo esc_js(__('Visible to all roles', 'tbc-ca')); ?></small></span>' +
                                            '</label>' +
                                            '<label class="tbc-vis-mode">' +
                                                '<input type="radio" name="tbc_ca_settings[visibility_rules][' + key + '][mode]" value="only" onchange="tbcVis.modeChange(this);" />' +
                                                '<span class="dashicons dashicons-lock"></span>' +
                                                '<span class="tbc-vis-mode__text"><strong><?php echo esc_js(__('Only these roles', 'tbc-ca')); ?></strong><small><?php echo esc_js(__('Hidden from everyone else', 'tbc-ca')); ?></small></span>' +
                                            '</label>' +
                                            '<label class="tbc-vis-mode">' +
                                                '<input type="radio" name="tbc_ca_settings[visibility_rules][' + key + '][mode]" value="except" onchange="tbcVis.modeChange(this);" />' +
                                                '<span class="dashicons dashicons-hidden"></span>' +
                                                '<span class="tbc-vis-mode__text"><strong><?php echo esc_js(__('Everyone except', 'tbc-ca')); ?></strong><small><?php echo esc_js(__('Hidden from selected roles', 'tbc-ca')); ?></small></span>' +
                                            '</label>' +
                                        '</div>' +
                                        '<div class="tbc-vis-card__roles" style="display:none;">' +
                                            '<div class="tbc-vis-pills"></div>' +
                                            '<select class="tbc-vis-role-select" onchange="tbcVis.addRole(this);">' + opts + '</select>' +
                                        '</div>' +
                                    '</div>' +
                                '</div>';

                            addCard.insertAdjacentHTML('beforebegin', html);

                            // Reset
                            document.getElementById('tbc-vis-new-key').value = '';
                            document.getElementById('tbc-vis-new-label').value = '';
                            document.getElementById('tbc-vis-add-form').style.display = 'none';
                            addCard.style.display = '';
                        },

                        // ── Remove custom element ──
                        removeElement: function(event, btn) {
                            event.stopPropagation();
                            var card = btn.closest('.tbc-vis-card');
                            if (confirm('<?php echo esc_js(__('Remove this element? Its visibility rules will be deleted.', 'tbc-ca')); ?>')) {
                                card.remove();
                            }
                        }
                    };
                })();
                </script>

                </div><!-- /.tbc-ca-tab-panel visibility -->

                <!-- Tab: Notifications -->
                <div class="tbc-ca-tab-panel<?php echo $current_tab === 'notifications' ? ' tbc-ca-tab-panel--active' : ''; ?>" data-panel="notifications">

                <!-- Push Notification Types -->
                <div class="tbc-ca-section">
                    <h2><?php _e('Push Notification Types', 'tbc-ca'); ?></h2>
                    <p class="description"><?php _e('Control which notifications are available in the app. Disabled types will not appear in user settings.', 'tbc-ca'); ?></p>
                    <p class="description" style="margin-top: 5px;">
                        <strong><?php _e('Push Service:', 'tbc-ca'); ?></strong> Expo Push API (no configuration required)
                    </p>

                    <?php foreach ($types_by_category as $category => $types): ?>
                        <div class="tbc-ca-category">
                            <h3><?php echo esc_html(ucfirst($category)); ?></h3>
                            <table class="widefat tbc-ca-types-table">
                                <thead>
                                    <tr>
                                        <th class="check-column"><?php _e('Enabled', 'tbc-ca'); ?></th>
                                        <th><?php _e('Notification Type', 'tbc-ca'); ?></th>
                                        <th><?php _e('Default', 'tbc-ca'); ?></th>
                                        <th class="check-column"><?php _e('User Visible', 'tbc-ca'); ?></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php foreach ($types as $type_id => $type):
                                        $type_settings = $settings['notification_types'][$type_id] ?? [];
                                        $is_enabled = isset($type_settings['enabled']) ? $type_settings['enabled'] : true;
                                        $is_default = isset($type_settings['default']) ? $type_settings['default'] : $type['default'];
                                        $is_user_configurable = isset($type_settings['user_configurable'])
                                            ? $type_settings['user_configurable']
                                            : $type['user_configurable'];
                                        $feature_active = $registry->is_feature_active($type_id);
                                    ?>
                                    <tr<?php if (!$feature_active) echo ' class="tbc-ca-feature-disabled"'; ?>>
                                        <td class="check-column">
                                            <?php if ($feature_active): ?>
                                                <input type="checkbox"
                                                       name="tbc_ca_settings[notification_types][<?php echo esc_attr($type_id); ?>][enabled]"
                                                       value="1"
                                                       <?php checked($is_enabled); ?> />
                                            <?php else: ?>
                                                <input type="checkbox" disabled <?php checked($is_enabled); ?> />
                                                <?php if ($is_enabled): ?>
                                                    <input type="hidden" name="tbc_ca_settings[notification_types][<?php echo esc_attr($type_id); ?>][enabled]" value="1" />
                                                <?php endif; ?>
                                            <?php endif; ?>
                                        </td>
                                        <td>
                                            <strong><?php echo esc_html($type['label']); ?></strong>
                                            <?php if (!empty($type['requires_pro'])): ?>
                                                <span class="tbc-ca-pro-badge">PRO</span>
                                            <?php endif; ?>
                                            <?php if (!$feature_active): ?>
                                                <span class="tbc-ca-feature-badge">FEATURE DISABLED</span>
                                            <?php endif; ?>
                                            <p class="description">
                                                <?php echo esc_html($type['description']); ?>
                                                <?php if (!$feature_active): ?>
                                                    <br><em><?php _e('This notification requires a Fluent Community feature that is currently disabled.', 'tbc-ca'); ?></em>
                                                <?php endif; ?>
                                            </p>
                                        </td>
                                        <td>
                                            <?php if ($feature_active): ?>
                                                <select name="tbc_ca_settings[notification_types][<?php echo esc_attr($type_id); ?>][default]">
                                                    <option value="1" <?php selected($is_default, true); ?>><?php _e('ON', 'tbc-ca'); ?></option>
                                                    <option value="0" <?php selected($is_default, false); ?>><?php _e('OFF', 'tbc-ca'); ?></option>
                                                </select>
                                            <?php else: ?>
                                                <select disabled>
                                                    <option><?php echo $is_default ? __('ON', 'tbc-ca') : __('OFF', 'tbc-ca'); ?></option>
                                                </select>
                                                <input type="hidden" name="tbc_ca_settings[notification_types][<?php echo esc_attr($type_id); ?>][default]" value="<?php echo $is_default ? '1' : '0'; ?>" />
                                            <?php endif; ?>
                                        </td>
                                        <td class="check-column">
                                            <input type="checkbox"
                                                   name="tbc_ca_settings[notification_types][<?php echo esc_attr($type_id); ?>][user_configurable]"
                                                   value="1"
                                                   <?php checked($is_user_configurable); ?> />
                                        </td>
                                    </tr>
                                    <?php endforeach; ?>
                                </tbody>
                            </table>
                        </div>
                    <?php endforeach; ?>
                </div>

                </div><!-- /.tbc-ca-tab-panel notifications -->

                <?php submit_button(__('Save Settings', 'tbc-ca')); ?>
            </form>

            <!-- Tab: Push Log (outside form — read-only) -->
            <div class="tbc-ca-tab-panel<?php echo $current_tab === 'push-log' ? ' tbc-ca-tab-panel--active' : ''; ?>" data-panel="push-log">
                <div class="tbc-ca-section">
                    <h2><?php _e('Push Notification Log', 'tbc-ca'); ?></h2>
                    <?php $this->render_push_log(); ?>
                </div>
            </div><!-- /.tbc-ca-tab-panel push-log -->

            <!-- Tab: Statistics (outside form — read-only) -->
            <div class="tbc-ca-tab-panel<?php echo $current_tab === 'statistics' ? ' tbc-ca-tab-panel--active' : ''; ?>" data-panel="statistics">
                <div class="tbc-ca-section tbc-ca-stats">
                    <h2><?php _e('Statistics', 'tbc-ca'); ?></h2>
                    <?php $this->render_stats(); ?>
                </div>
            </div><!-- /.tbc-ca-tab-panel statistics -->

            <!-- Tab: Tools (outside form — action-based) -->
            <div class="tbc-ca-tab-panel<?php echo $current_tab === 'tools' ? ' tbc-ca-tab-panel--active' : ''; ?>" data-panel="tools">
                <div class="tbc-ca-section">
                    <h2><?php _e('Session Management', 'tbc-ca'); ?></h2>
                    <?php $this->render_tools(); ?>
                </div>
                <div class="tbc-ca-section">
                    <?php TBC_CA_Push_Manual::get_instance()->render_form(); ?>
                </div>
            </div><!-- /.tbc-ca-tab-panel tools -->
        </div>
        <?php
    }

    /**
     * Handle form save
     */
    private function handle_save() {
        if (!isset($_POST['tbc_ca_settings'])) {
            return;
        }

        $settings = $this->sanitize_settings(wp_unslash($_POST['tbc_ca_settings']));
        TBC_CA_Core::update_settings($settings);

        add_settings_error(
            'tbc_ca_settings',
            'settings_saved',
            __('Settings saved.', 'tbc-ca'),
            'success'
        );
    }

    /**
     * Render statistics
     */
    private function render_stats() {
        global $wpdb;

        // --- Push Notification Devices ---
        $table_name = $wpdb->prefix . 'tbc_ca_device_tokens';
        $table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$table_name}'") === $table_name;

        echo '<h3>' . esc_html__('Push Notification Devices', 'tbc-ca') . '</h3>';

        if (!$table_exists) {
            echo '<p>' . esc_html__('Device tokens table not created. Please deactivate and reactivate the plugin.', 'tbc-ca') . '</p>';
        } else {
            $total_devices = $wpdb->get_var("SELECT COUNT(*) FROM {$table_name}");
            $ios_devices = $wpdb->get_var("SELECT COUNT(*) FROM {$table_name} WHERE platform = 'ios'");
            $android_devices = $wpdb->get_var("SELECT COUNT(*) FROM {$table_name} WHERE platform = 'android'");
            $unique_device_users = $wpdb->get_var("SELECT COUNT(DISTINCT user_id) FROM {$table_name}");
            ?>
            <table class="widefat" style="max-width: 400px;">
                <tbody>
                    <tr>
                        <td><?php _e('Total Registered Devices', 'tbc-ca'); ?></td>
                        <td><strong><?php echo intval($total_devices); ?></strong></td>
                    </tr>
                    <tr>
                        <td><?php _e('iOS Devices', 'tbc-ca'); ?></td>
                        <td><?php echo intval($ios_devices); ?></td>
                    </tr>
                    <tr>
                        <td><?php _e('Android Devices', 'tbc-ca'); ?></td>
                        <td><?php echo intval($android_devices); ?></td>
                    </tr>
                    <tr>
                        <td><?php _e('Unique Users with Devices', 'tbc-ca'); ?></td>
                        <td><?php echo intval($unique_device_users); ?></td>
                    </tr>
                </tbody>
            </table>
            <?php
        }

        // --- JWT Auth Sessions ---
        echo '<h3 style="margin-top: 20px;">' . esc_html__('JWT Auth Sessions', 'tbc-ca') . '</h3>';

        $meta_key = TBC_CA_Auth::SESSION_META_KEY;
        $now = time();

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT user_id, meta_value FROM {$wpdb->usermeta} WHERE meta_key = %s",
            $meta_key
        ));

        $active_sessions = 0;
        $expired_sessions = 0;
        $users_with_sessions = 0;

        foreach ($rows as $row) {
            $sessions = maybe_unserialize($row->meta_value);
            if (!is_array($sessions) || empty($sessions)) {
                continue;
            }
            $has_active = false;
            foreach ($sessions as $session) {
                if (($session['expires_at'] ?? 0) > $now) {
                    $active_sessions++;
                    $has_active = true;
                } else {
                    $expired_sessions++;
                }
            }
            if ($has_active) {
                $users_with_sessions++;
            }
        }
        ?>
        <table class="widefat" style="max-width: 400px;">
            <tbody>
                <tr>
                    <td><?php _e('Active Sessions', 'tbc-ca'); ?></td>
                    <td><strong><?php echo intval($active_sessions); ?></strong></td>
                </tr>
                <tr>
                    <td><?php _e('Expired (pending cleanup)', 'tbc-ca'); ?></td>
                    <td><?php echo intval($expired_sessions); ?></td>
                </tr>
                <tr>
                    <td><?php _e('Users with Active Sessions', 'tbc-ca'); ?></td>
                    <td><?php echo intval($users_with_sessions); ?></td>
                </tr>
            </tbody>
        </table>
        <p class="description"><?php _e('Sessions are cleaned up automatically when tokens are refreshed or on next login. Max 3 sessions per user.', 'tbc-ca'); ?></p>
        <?php
    }

    /**
     * Render push notification log table in Statistics tab
     */
    private function render_push_log() {
        global $wpdb;
        $log = TBC_CA_Push_Log::get_instance();
        $log_table = $wpdb->prefix . 'tbc_ca_push_log';
        $table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$log_table}'") === $log_table;

        if (!$table_exists) {
            echo '<p>' . esc_html__('Push log table not created. Please deactivate and reactivate the plugin.', 'tbc-ca') . '</p>';
            return;
        }

        // 30-day summary
        echo '<h3>' . esc_html__('Last 30 Days', 'tbc-ca') . '</h3>';
        $stats = $log->get_stats(30);
        $totals = $stats['totals'];
        ?>
        <table class="widefat" style="max-width: 400px; margin-bottom: 15px;">
            <tbody>
                <tr>
                    <td><?php _e('Batches Sent (30 days)', 'tbc-ca'); ?></td>
                    <td><strong><?php echo intval($totals->total_batches); ?></strong></td>
                </tr>
                <tr>
                    <td><?php _e('Total Recipients', 'tbc-ca'); ?></td>
                    <td><?php echo intval($totals->total_recipients); ?></td>
                </tr>
                <tr>
                    <td><?php _e('Delivered', 'tbc-ca'); ?></td>
                    <td><?php echo intval($totals->total_sent); ?></td>
                </tr>
                <tr>
                    <td><?php _e('Failed', 'tbc-ca'); ?></td>
                    <td><?php echo intval($totals->total_failed); ?></td>
                </tr>
            </tbody>
        </table>

        <h3><?php _e('Recent Activity', 'tbc-ca'); ?></h3>
        <?php
        $entries = $log->get_recent(50);

        if (empty($entries)) {
            echo '<p>' . esc_html__('No push notifications logged yet.', 'tbc-ca') . '</p>';
            return;
        }

        $registry = TBC_CA_Push_Registry::get_instance();
        ?>
        <table class="widefat">
            <thead>
                <tr>
                    <th><?php _e('Type', 'tbc-ca'); ?></th>
                    <th><?php _e('Title', 'tbc-ca'); ?></th>
                    <th><?php _e('Recipients', 'tbc-ca'); ?></th>
                    <th><?php _e('Sent', 'tbc-ca'); ?></th>
                    <th><?php _e('Failed', 'tbc-ca'); ?></th>
                    <th><?php _e('Source', 'tbc-ca'); ?></th>
                    <th><?php _e('Date', 'tbc-ca'); ?></th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($entries as $entry):
                    $type_info = $registry->get($entry->type);
                    $type_label = $type_info ? $type_info['label'] : $entry->type;
                ?>
                <tr>
                    <td><?php echo esc_html($type_label); ?></td>
                    <td>
                        <strong><?php echo esc_html($entry->title); ?></strong>
                        <?php if (!empty($entry->body)): ?>
                            <br><small><?php echo esc_html(wp_trim_words($entry->body, 10)); ?></small>
                        <?php endif; ?>
                    </td>
                    <td><?php echo intval($entry->recipients); ?></td>
                    <td><?php echo intval($entry->sent); ?></td>
                    <td><?php echo intval($entry->failed) > 0 ? '<span style="color: #b32d2e;">' . intval($entry->failed) . '</span>' : '0'; ?></td>
                    <td>
                        <?php if ($entry->source === 'manual'): ?>
                            <span class="tbc-ca-pro-badge" style="background: #2271b1;"><?php _e('Manual', 'tbc-ca'); ?></span>
                        <?php else: ?>
                            <?php _e('Auto', 'tbc-ca'); ?>
                        <?php endif; ?>
                    </td>
                    <td><?php echo esc_html($entry->created_at); ?></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        <?php
    }

    /**
     * Handle tool actions (purge all, revoke user)
     */
    private function handle_tools() {
        if (!current_user_can('manage_options')) {
            return;
        }

        // Purge all sessions
        if (isset($_POST['tbc_ca_tool_purge_all']) && check_admin_referer('tbc_ca_tools_nonce')) {
            global $wpdb;
            $meta_key = TBC_CA_Auth::SESSION_META_KEY;
            $deleted = $wpdb->query($wpdb->prepare(
                "DELETE FROM {$wpdb->usermeta} WHERE meta_key = %s",
                $meta_key
            ));
            add_settings_error('tbc_ca_settings', 'sessions_purged',
                sprintf(__('All sessions purged. %d user(s) logged out.', 'tbc-ca'), intval($deleted)),
                'success'
            );
        }

        // Revoke single user sessions
        if (isset($_POST['tbc_ca_tool_revoke_user']) && check_admin_referer('tbc_ca_tools_nonce')) {
            $user_id = intval($_POST['tbc_ca_tool_revoke_user']);
            $user = get_userdata($user_id);
            if ($user) {
                $auth = TBC_CA_Auth::get_instance();
                $auth->revoke_all_sessions($user_id);
                add_settings_error('tbc_ca_settings', 'user_revoked',
                    sprintf(__('All sessions revoked for %s.', 'tbc-ca'), esc_html($user->display_name)),
                    'success'
                );
            }
        }
    }

    /**
     * Render tools tab content
     */
    private function render_tools() {
        global $wpdb;

        $meta_key = TBC_CA_Auth::SESSION_META_KEY;
        $now = time();

        // Bulk purge button
        ?>
        <form method="post" style="margin-bottom: 20px;" onsubmit="return confirm('<?php esc_attr_e('This will log out ALL app users. Continue?', 'tbc-ca'); ?>');">
            <?php wp_nonce_field('tbc_ca_tools_nonce'); ?>
            <input type="hidden" name="tbc_ca_active_tab" value="tools" />
            <button type="submit" name="tbc_ca_tool_purge_all" value="1" class="button button-secondary" style="color: #b32d2e;">
                <?php _e('Purge All Sessions', 'tbc-ca'); ?>
            </button>
            <span class="description" style="margin-left: 8px;"><?php _e('Logs out every app user. They will need to log in again.', 'tbc-ca'); ?></span>
        </form>

        <h3><?php _e('Active Sessions by User', 'tbc-ca'); ?></h3>
        <?php

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT user_id, meta_value FROM {$wpdb->usermeta} WHERE meta_key = %s",
            $meta_key
        ));

        $user_sessions = [];
        foreach ($rows as $row) {
            $sessions = maybe_unserialize($row->meta_value);
            if (!is_array($sessions)) {
                continue;
            }
            $active_count = 0;
            foreach ($sessions as $session) {
                if (($session['expires_at'] ?? 0) > $now) {
                    $active_count++;
                }
            }
            if ($active_count > 0) {
                $user_sessions[] = [
                    'user_id' => intval($row->user_id),
                    'active'  => $active_count,
                ];
            }
        }

        if (empty($user_sessions)) {
            echo '<p>' . esc_html__('No active sessions.', 'tbc-ca') . '</p>';
            return;
        }
        ?>
        <table class="widefat" style="max-width: 600px;">
            <thead>
                <tr>
                    <th><?php _e('User', 'tbc-ca'); ?></th>
                    <th><?php _e('Display Name', 'tbc-ca'); ?></th>
                    <th><?php _e('Active Sessions', 'tbc-ca'); ?></th>
                    <th><?php _e('Actions', 'tbc-ca'); ?></th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($user_sessions as $entry):
                    $user = get_userdata($entry['user_id']);
                    if (!$user) continue;
                ?>
                <tr>
                    <td><?php echo esc_html($user->user_login); ?> <small>(#<?php echo intval($entry['user_id']); ?>)</small></td>
                    <td><?php echo esc_html($user->display_name); ?></td>
                    <td><strong><?php echo intval($entry['active']); ?></strong></td>
                    <td>
                        <form method="post" style="display: inline;" onsubmit="return confirm('<?php echo esc_attr(sprintf(__('Log out %s from all devices?', 'tbc-ca'), $user->display_name)); ?>');">
                            <?php wp_nonce_field('tbc_ca_tools_nonce'); ?>
                            <input type="hidden" name="tbc_ca_active_tab" value="tools" />
                            <button type="submit" name="tbc_ca_tool_revoke_user" value="<?php echo intval($entry['user_id']); ?>" class="button button-small">
                                <?php _e('Log Out', 'tbc-ca'); ?>
                            </button>
                        </form>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        <?php
    }
}
