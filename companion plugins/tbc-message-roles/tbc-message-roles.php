<?php
/**
 * Plugin Name: TBC Message Roles
 * Plugin URI:  https://twobirdscode.com
 * Description: Role-based messaging restrictions for Fluent Community. Control which WordPress roles can initiate DMs and send community chat messages.
 * Version:     1.5.0
 * Author:      Two Birds Code
 * Author URI:  https://twobirdscode.com
 * Text Domain: tbc-msgr
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * License:     GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Requires Plugins: fluent-community
 *
 * @package TBC_Message_Roles
 */

defined('ABSPATH') or die('No direct script access allowed');

define('TBC_MSGR_VERSION', '1.5.0');
define('TBC_MSGR_FILE', __FILE__);
define('TBC_MSGR_DIR', plugin_dir_path(__FILE__));
define('TBC_MSGR_URL', plugin_dir_url(__FILE__));
define('TBC_MSGR_BASENAME', plugin_basename(__FILE__));
define('TBC_MSGR_OPTION_PREFIX', 'tbc_msgr_');

/**
 * Initialize plugin
 */
add_action('plugins_loaded', function () {
    // Require Fluent Community
    if (!defined('FLUENT_COMMUNITY_PLUGIN_VERSION')) {
        add_action('admin_notices', function () {
            ?>
            <div class="notice notice-error">
                <p><?php esc_html_e('TBC Message Roles requires Fluent Community to be installed and activated.', 'tbc-msgr'); ?></p>
            </div>
            <?php
        });
        return;
    }

    // Require Fluent Messaging
    if (!defined('FLUENT_MESSAGING_CHAT_VERSION')) {
        add_action('admin_notices', function () {
            ?>
            <div class="notice notice-error">
                <p><?php esc_html_e('TBC Message Roles requires Fluent Messaging to be active in Fluent Community.', 'tbc-msgr'); ?></p>
            </div>
            <?php
        });
        return;
    }

    require_once TBC_MSGR_DIR . 'includes/class-admin.php';

    // ── Messaging filters ──────────────────────────────────────────────
    $enabled = (bool) get_option(TBC_MSGR_OPTION_PREFIX . 'enabled', false);

    if ($enabled) {
        // Override DM initiation permission
        add_filter('fluent_messaging/can_initiate_message', function ($canSend, $user) {
            return tbc_msgr_check_role($user, 'dm');
        }, 20, 2);

        // Override community chat send permission
        add_filter('fluent_messaging/can_send_community_message', function ($canSend, $user, $space) {
            return tbc_msgr_check_role($user, 'community');
        }, 20, 3);
    }

    // ── Admin ──────────────────────────────────────────────────────────
    if (is_admin()) {
        $admin = new TBCMsgR\Admin();
        add_action('admin_menu', [$admin, 'add_admin_menu']);
        add_action('admin_init', [$admin, 'register_settings']);
        add_action('admin_enqueue_scripts', [$admin, 'admin_assets']);
    }
}, 25); // After tbc-community-app (priority 20)

/**
 * Check if a user's WordPress role is allowed to message.
 *
 * @param object $user  WP_User or Fluent Community user object.
 * @param string $type  'dm' or 'community'.
 * @return bool
 */
function tbc_msgr_check_role($user, $type = 'dm') {
    if (!$user) {
        return false;
    }

    // Admins always pass
    $wp_user = ($user instanceof \WP_User) ? $user : get_userdata($user->ID ?? 0);
    if (!$wp_user) {
        return false;
    }

    if (in_array('administrator', $wp_user->roles, true)) {
        return true;
    }

    // Fluent Community moderators always pass
    if (class_exists('\FluentCommunity\App\Services\Helper') && \FluentCommunity\App\Services\Helper::isModerator($user)) {
        return true;
    }

    // "Always messageable" exception — check if the target user has an always-messageable role
    if ($type === 'dm') {
        $target_user_id = tbc_msgr_get_target_user_id();
        if ($target_user_id) {
            // Check WordPress roles
            $always_wp_roles = get_option(TBC_MSGR_OPTION_PREFIX . 'always_messageable_roles', []);
            if (!empty($always_wp_roles) && is_array($always_wp_roles)) {
                $target_user = get_userdata($target_user_id);
                if ($target_user && !empty(array_intersect($always_wp_roles, $target_user->roles))) {
                    return true;
                }
            }

            // Check Fluent Community global roles
            $always_fc_roles = get_option(TBC_MSGR_OPTION_PREFIX . 'always_messageable_fc_roles', []);
            if (!empty($always_fc_roles) && is_array($always_fc_roles) && class_exists('\FluentCommunity\App\Models\User')) {
                $fc_target = \FluentCommunity\App\Models\User::find($target_user_id);
                if ($fc_target) {
                    $target_fc_roles = (array) $fc_target->getCommunityRoles();
                    if (!empty(array_intersect($always_fc_roles, $target_fc_roles))) {
                        return true;
                    }
                }
            }

            // Check space-level roles (moderator/admin in any space)
            $always_space_roles = get_option(TBC_MSGR_OPTION_PREFIX . 'always_messageable_space_roles', []);
            if (!empty($always_space_roles) && is_array($always_space_roles) && class_exists('\FluentCommunity\App\Models\SpaceUserPivot')) {
                $has_space_role = \FluentCommunity\App\Models\SpaceUserPivot::where('user_id', $target_user_id)
                    ->whereIn('role', $always_space_roles)
                    ->where('status', 'active')
                    ->exists();
                if ($has_space_role) {
                    return true;
                }
            }
        }
    }

    // Check WP role allowlist
    $wp_key = ($type === 'community')
        ? TBC_MSGR_OPTION_PREFIX . 'community_roles'
        : TBC_MSGR_OPTION_PREFIX . 'dm_roles';
    $allowed_wp_roles = get_option($wp_key, []);
    if (!is_array($allowed_wp_roles)) $allowed_wp_roles = [];

    // Check FC global role allowlist
    $fc_key = ($type === 'community')
        ? TBC_MSGR_OPTION_PREFIX . 'community_fc_roles'
        : TBC_MSGR_OPTION_PREFIX . 'dm_fc_roles';
    $allowed_fc_roles = get_option($fc_key, []);
    if (!is_array($allowed_fc_roles)) $allowed_fc_roles = [];

    // Check space-level role allowlist
    $space_key = ($type === 'community')
        ? TBC_MSGR_OPTION_PREFIX . 'community_space_roles'
        : TBC_MSGR_OPTION_PREFIX . 'dm_space_roles';
    $allowed_space_roles = get_option($space_key, []);
    if (!is_array($allowed_space_roles)) $allowed_space_roles = [];

    // No roles configured at all = everyone allowed (fail-open)
    if (empty($allowed_wp_roles) && empty($allowed_fc_roles) && empty($allowed_space_roles)) {
        return true;
    }

    // Check WP roles
    if (!empty($allowed_wp_roles) && !empty(array_intersect($allowed_wp_roles, $wp_user->roles))) {
        return true;
    }

    // Check FC global roles
    if (!empty($allowed_fc_roles) && class_exists('\FluentCommunity\App\Models\User')) {
        $fc_user = \FluentCommunity\App\Models\User::find($wp_user->ID);
        if ($fc_user) {
            $sender_fc_roles = (array) $fc_user->getCommunityRoles();
            if (!empty(array_intersect($allowed_fc_roles, $sender_fc_roles))) {
                return true;
            }
        }
    }

    // Check space-level roles (sender is admin/mod in any space)
    if (!empty($allowed_space_roles) && class_exists('\FluentCommunity\App\Models\SpaceUserPivot')) {
        $has_space_role = \FluentCommunity\App\Models\SpaceUserPivot::where('user_id', $wp_user->ID)
            ->whereIn('role', $allowed_space_roles)
            ->where('status', 'active')
            ->exists();
        if ($has_space_role) {
            return true;
        }
    }

    return false;
}

/**
 * Extract the target user ID from the current request.
 * Fluent Messaging passes intent_id in the POST body when creating a thread.
 *
 * @return int|null
 */
function tbc_msgr_get_target_user_id() {
    static $cached = null;
    if ($cached !== null) {
        return $cached ?: null;
    }

    $result = null;

    // Try $_REQUEST first (covers $_GET, $_POST, and WP REST params)
    if (!empty($_REQUEST['intent_id'])) {
        $result = (int) $_REQUEST['intent_id'];
    }

    // Fallback: parse JSON body (app sends JSON, php://input readable on PHP 7.4+)
    if (!$result) {
        $raw = file_get_contents('php://input');
        if ($raw) {
            $data = json_decode($raw, true);
            if (!empty($data['intent_id'])) {
                $result = (int) $data['intent_id'];
            }
        }
    }

    $cached = $result ?: 0; // 0 sentinel = checked but not found
    return $result;
}

/**
 * Activation hook — set defaults
 */
register_activation_hook(__FILE__, function () {
    $defaults = [
        'enabled'                         => false,
        'dm_roles'                        => [],
        'dm_fc_roles'                     => [],
        'dm_space_roles'                  => [],
        'community_roles'                 => [],
        'community_fc_roles'              => [],
        'community_space_roles'           => [],
        'always_messageable_roles'        => ['administrator'],
        'always_messageable_fc_roles'     => ['admin', 'moderator'],
        'always_messageable_space_roles'  => ['moderator', 'admin'],
    ];

    foreach ($defaults as $key => $value) {
        $option_name = TBC_MSGR_OPTION_PREFIX . $key;
        if (false === get_option($option_name)) {
            add_option($option_name, $value);
        }
    }
});
