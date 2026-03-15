<?php
/**
 * Plugin Name: TBC Multi Reactions
 * Plugin URI: https://twobirdscode.com
 * Description: Enhanced multi-reaction system for Fluent Community with custom uploadable icons (PNG/SVG/GIF/WEBP). Replaces the default heart reaction with a multi-reaction picker on posts and comments. Injects reaction data into API responses for mobile app compatibility.
 * Version: 1.5.5
 * Author: Two Birds Code
 * Author URI: https://twobirdscode.com
 * Text Domain: tbc-multi-reactions
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Requires Plugins: fluent-community
 *
 * @see CHANGELOG.md for version history
 *
 * @package TBC_Multi_Reactions
 */

defined('ABSPATH') or die('No direct script access allowed');

define('TBC_MR_VERSION', '1.5.5');
define('TBC_MR_FILE', __FILE__);
define('TBC_MR_DIR', plugin_dir_path(__FILE__));
define('TBC_MR_URL', plugin_dir_url(__FILE__));
define('TBC_MR_BASENAME', plugin_basename(__FILE__));

/**
 * Check if Fluent Community is active
 */
function tbc_mr_check_dependencies() {
    if (!class_exists('\FluentCommunity\App\Services\Helper') ||
        !class_exists('\FluentCommunity\App\Hooks\Handlers\PortalHandler') ||
        !defined('FLUENT_COMMUNITY_PLUGIN_URL')) {
        add_action('admin_notices', function() {
            ?>
            <div class="notice notice-error">
                <p><?php esc_html_e('TBC Multi Reactions requires Fluent Community to be installed and activated.', 'tbc-multi-reactions'); ?></p>
            </div>
            <?php
        });
        return false;
    }
    return true;
}

/**
 * Initialize plugin
 */
add_action('plugins_loaded', function() {
    if (!tbc_mr_check_dependencies()) {
        return;
    }

    require_once TBC_MR_DIR . 'includes/class-core.php';
    TBCMultiReactions\Core::instance();
}, 20);

/**
 * Activation hook
 */
register_activation_hook(__FILE__, function() {
    require_once TBC_MR_DIR . 'includes/class-database.php';
    require_once TBC_MR_DIR . 'includes/class-admin.php';

    TBCMultiReactions\Database::add_reaction_type_column();
    TBCMultiReactions\Admin::initialize_default_settings();
});

/**
 * Deactivation hook
 */
register_deactivation_hook(__FILE__, function() {
    flush_rewrite_rules();
});
