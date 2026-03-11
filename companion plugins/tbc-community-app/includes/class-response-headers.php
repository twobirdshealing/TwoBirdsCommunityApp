<?php
/**
 * Response Headers - Attach unread counts + maintenance flag to every
 * authenticated REST API response via custom HTTP headers.
 *
 * Headers added to all authenticated responses (any namespace):
 *   X-TBC-Unread-Notifications: N   (Fluent Community unread count)
 *   X-TBC-Unread-Messages: N        (Fluent Messaging unread thread count)
 *   X-TBC-Cart-Count: N              (WooCommerce persistent cart item quantity)
 *   X-TBC-Maintenance: 0|1          (should user see maintenance screen?)
 *   X-TBC-Profile-Incomplete: 0|1   (should user be gated for profile completion?)
 *   X-TBC-Min-App-Version: x.y.z    (minimum app version, omitted when not set)
 *
 * This eliminates the need for dedicated badge-refresh API calls on app resume.
 * The mobile app reads these headers from every response via a global interceptor
 * in services/api/client.ts.
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_Response_Headers {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        // Run after all other filters so we don't interfere with response data.
        add_filter('rest_post_dispatch', [$this, 'add_headers'], 999, 3);
    }

    /**
     * Append custom headers to every authenticated REST response.
     */
    public function add_headers($response, $server, $request) {
        $user_id = get_current_user_id();
        if (!$user_id) {
            return $response;
        }

        // Unread notifications
        $notif_count = $this->get_unread_notification_count($user_id);
        $response->header('X-TBC-Unread-Notifications', (string) $notif_count);

        // Unread message threads
        $msg_count = $this->get_unread_message_count($user_id);
        $response->header('X-TBC-Unread-Messages', (string) $msg_count);

        // Maintenance (1 = user should see maintenance screen, 0 = normal)
        $maintenance = $this->should_show_maintenance($user_id);
        $response->header('X-TBC-Maintenance', $maintenance ? '1' : '0');

        // Cart item count (WooCommerce persistent cart)
        $cart_count = TBC_CA_Cart::get_cart_count($user_id);
        $response->header('X-TBC-Cart-Count', (string) $cart_count);

        // Profile completion gate (cheap: single meta read, skips settings check for non-gated users)
        $profile_incomplete = $this->is_profile_incomplete($user_id);
        $response->header('X-TBC-Profile-Incomplete', $profile_incomplete ? '1' : '0');

        // Min app version (only sent when configured — lets app detect mid-session changes)
        $settings = TBC_CA_Core::get_settings();
        $min_ver = $settings['min_app_version'] ?? '';
        if (!empty($min_ver)) {
            $response->header('X-TBC-Min-App-Version', $min_ver);
        }

        return $response;
    }

    /**
     * Check if user has an incomplete profile (needs the profile completion gate).
     * Reads _tbc_registration_complete meta — set by tbc-fluent-profiles.
     * Only returns true when the flag is explicitly '0' (gated by tbc-fluent-profiles' re-evaluation hook).
     */
    private function is_profile_incomplete($user_id) {
        // Cheap check first: meta read is object-cached after first hit
        $meta_key = defined('TBC_FP_META_REGISTRATION_COMPLETE') ? TBC_FP_META_REGISTRATION_COMPLETE : '_tbc_registration_complete';
        $flag = get_user_meta($user_id, $meta_key, true);
        // '' (empty/missing) = legacy user (not gated), '1' = complete — fast exit for 99% of users
        if ($flag !== '0') {
            return false;
        }

        // Only check the admin setting when the user IS flagged incomplete
        if (class_exists('\\TBCFluentProfiles\\Helpers')) {
            $enabled = \TBCFluentProfiles\Helpers::get_option('profile_completion_enabled', true);
            if (!$enabled) {
                return false;
            }
        }

        return true;
    }

    /**
     * Count unread notifications via Fluent Community's Notification model.
     * Indexed COUNT query on fcom_notification_subscribers — very fast.
     */
    private function get_unread_notification_count($user_id) {
        if (!class_exists('FluentCommunity\App\Models\Notification')) {
            return 0;
        }
        try {
            return \FluentCommunity\App\Models\Notification::byStatus('unread', $user_id)->count();
        } catch (\Exception $e) {
            return 0;
        }
    }

    /**
     * Count unread message threads via Fluent Messaging's ChatHelper.
     * Uses EXISTS subquery — efficient early exit per thread.
     */
    private function get_unread_message_count($user_id) {
        if (!class_exists('FluentCommunity\Modules\Messaging\Services\ChatHelper')) {
            return 0;
        }
        try {
            return (int) \FluentCommunity\Modules\Messaging\Services\ChatHelper::getUnreadThreadCounts($user_id);
        } catch (\Exception $e) {
            return 0;
        }
    }

    /**
     * Determine if this user should see the maintenance screen.
     * Returns true when maintenance is enabled AND user cannot bypass.
     */
    private function should_show_maintenance($user_id) {
        $settings = TBC_CA_Core::get_settings();
        $maint = $settings['maintenance_mode'] ?? [];

        if (empty($maint['enabled'])) {
            return false;
        }

        // Admin always bypasses
        if (user_can($user_id, 'manage_options')) {
            return false;
        }

        // Check bypass roles
        $bypass_roles = $settings['maintenance_bypass_roles'] ?? [];
        if (!empty($bypass_roles)) {
            $user = get_userdata($user_id);
            $user_roles = !empty($user->roles) ? array_values($user->roles) : [];
            if (!empty(array_intersect($user_roles, $bypass_roles))) {
                return false;
            }
        }

        return true;
    }
}
