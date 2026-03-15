<?php
/**
 * Plugin Name: TBC YouTube
 * Plugin URI: https://twobirdscode.com
 * Description: YouTube channel integration for the TBC Community App. Provides REST API endpoints for fetching channel videos and playlists via YouTube Data API v3 with server-side caching.
 * Version: 1.2.1
 * Author: Two Birds Code
 * Author URI: https://twobirdscode.com
 * Text Domain: tbc-youtube
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 *
 * @see CHANGELOG.md for version history
 *
 * @package TBC_YouTube
 */

defined('ABSPATH') or die('No direct script access allowed');

define('TBC_YT_VERSION', '1.2.1');
define('TBC_YT_FILE', __FILE__);
define('TBC_YT_DIR', plugin_dir_path(__FILE__));
define('TBC_YT_URL', plugin_dir_url(__FILE__));
define('TBC_YT_REST_NAMESPACE', 'tbc-yt/v1');

/**
 * Initialize plugin (after tbc-community-app loads at default priority)
 */
add_action('plugins_loaded', function () {
    require_once TBC_YT_DIR . 'includes/class-youtube-api.php';
    TBC_YT_API::get_instance();

    if (is_admin()) {
        require_once TBC_YT_DIR . 'includes/class-admin.php';
        TBC_YT_Admin::get_instance();
    }
}, 11);

/**
 * Activation hook
 */
register_activation_hook(__FILE__, function () {
    update_option('tbc_yt_version', TBC_YT_VERSION);
});
