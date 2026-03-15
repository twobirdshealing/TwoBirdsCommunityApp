<?php
/**
 * Plugin Name: TBC - Community App
 * Plugin URI: https://twobirdscode.com
 * Description: Support plugin for the Two Birds Community mobile app. Provides web sessions for WebView, app-specific styling, and push notifications.
 * Version: 3.39.0
 * Author: Two Birds Code
 * Author URI: https://twobirdscode.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: tbc-ca
 *
 * @see CHANGELOG.md for version history
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Plugin constants
define('TBC_CA_VERSION', '3.39.0');
define('TBC_CA_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('TBC_CA_PLUGIN_URL', plugin_dir_url(__FILE__));
define('TBC_CA_PLUGIN_FILE', __FILE__);
define('TBC_CA_REST_NAMESPACE', 'tbc-ca/v1');
define('TBC_CA_APP_USER_AGENT', 'TBCCommunityApp');

// Load bundled firebase/php-jwt (if not already loaded by another plugin)
if (!class_exists('\Firebase\JWT\JWT')) {
    $jwt_lib = TBC_CA_PLUGIN_DIR . 'includes/lib/php-jwt/';
    require_once $jwt_lib . 'JWTExceptionWithPayloadInterface.php';
    require_once $jwt_lib . 'BeforeValidException.php';
    require_once $jwt_lib . 'ExpiredException.php';
    require_once $jwt_lib . 'SignatureInvalidException.php';
    require_once $jwt_lib . 'Key.php';
    require_once $jwt_lib . 'JWT.php';
}

// Autoload classes
spl_autoload_register(function ($class) {
    $prefix = 'TBC_CA_';

    if (strpos($class, $prefix) !== 0) {
        return;
    }

    $class_name = substr($class, strlen($prefix));
    $class_name = strtolower(str_replace('_', '-', $class_name));

    // Map class names to file paths
    $class_map = [
        'core' => 'class-core.php',
        'api' => 'class-api.php',
        'password-api' => 'class-password-api.php',
        'web-session' => 'webview/class-web-session.php',
        'app-view' => 'webview/class-app-view.php',
        'cart' => 'cart/class-cart.php',
        'push-registry' => 'push/class-registry.php',
        'push-preferences' => 'push/class-preferences.php',
        'push-devices' => 'push/class-devices.php',
        'push-firebase' => 'push/class-firebase.php',
        'push-api' => 'push/class-api.php',
        'push-hooks' => 'push/class-hooks.php',
        'push-log' => 'push/class-log.php',
        'push-manual' => 'push/class-manual.php',
        'account-api' => 'class-account-api.php',
        'app-config' => 'class-app-config.php',
        'rest-fields' => 'class-rest-fields.php',

        'auth' => 'class-auth.php',
        'auth-api' => 'class-auth-api.php',
        'batch-api' => 'class-batch-api.php',
        'response-headers' => 'class-response-headers.php',
        'deep-links' => 'class-deep-links.php',
        'admin' => 'admin/class-admin.php',
        'admin-settings' => 'admin/class-settings.php',
    ];

    if (isset($class_map[$class_name])) {
        $file = TBC_CA_PLUGIN_DIR . 'includes/' . $class_map[$class_name];
        if (file_exists($file)) {
            require_once $file;
        }
    }
});

// Initialize the plugin
add_action('plugins_loaded', 'tbc_ca_init');

function tbc_ca_init() {
    // Load core
    require_once TBC_CA_PLUGIN_DIR . 'includes/class-core.php';
    TBC_CA_Core::get_instance();
}

// Activation / Deactivation
register_activation_hook(__FILE__, 'tbc_ca_activate');
register_deactivation_hook(__FILE__, 'tbc_ca_deactivate');

function tbc_ca_activate() {
    // Create device tokens table
    global $wpdb;
    $table_name = $wpdb->prefix . 'tbc_ca_device_tokens';
    $charset_collate = $wpdb->get_charset_collate();

    $sql = "CREATE TABLE IF NOT EXISTS $table_name (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        user_id bigint(20) unsigned NOT NULL,
        token varchar(500) NOT NULL,
        platform varchar(20) NOT NULL DEFAULT 'ios',
        created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY token (token(191)),
        KEY user_id (user_id)
    ) $charset_collate;";

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta($sql);

    // Create push log table
    require_once TBC_CA_PLUGIN_DIR . 'includes/push/class-log.php';
    TBC_CA_Push_Log::create_table();

    // Schedule daily cleanup cron
    if (!wp_next_scheduled('tbc_ca_daily_cleanup')) {
        wp_schedule_event(time(), 'daily', 'tbc_ca_daily_cleanup');
    }

    update_option('tbc_ca_version', TBC_CA_VERSION);
    flush_rewrite_rules();
}

function tbc_ca_deactivate() {
    wp_clear_scheduled_hook('tbc_ca_daily_cleanup');
    flush_rewrite_rules();
}

// =============================================================================
// GLOBAL HELPER FUNCTIONS
// =============================================================================

/**
 * Register a push notification type (for use by other plugins)
 */
function tbc_register_push_notification($args) {
    if (class_exists('TBC_CA_Push_Registry')) {
        TBC_CA_Push_Registry::get_instance()->register($args);
    }
}

/**
 * Send a push notification to a single user (synchronous — use tbc_send_push_to_users for async)
 */
function tbc_send_push_notification($user_id, $type, $data) {
    if (class_exists('TBC_CA_Push_Firebase')) {
        return TBC_CA_Push_Firebase::get_instance()->send($user_id, $type, $data);
    }
    return false;
}

/**
 * Send push notifications to multiple users via async Action Scheduler queue.
 * This is the recommended way for external plugins to send push notifications.
 *
 * @param array       $user_ids   Array of user IDs to notify
 * @param string      $type       Notification type ID (must be registered via tbc_ca_register_push_types)
 * @param string      $title      Notification title
 * @param string      $body       Notification body text
 * @param string|null $route      App route to navigate to on tap (optional)
 * @param int|null    $exclude_id User ID to exclude from recipients (optional)
 */
function tbc_send_push_to_users($user_ids, $type, $title, $body, $route = null, $exclude_id = null) {
    if (class_exists('TBC_CA_Push_Hooks')) {
        TBC_CA_Push_Hooks::get_instance()->send_to_users_external($user_ids, $type, $title, $body, $route, $exclude_id);
    }
}
