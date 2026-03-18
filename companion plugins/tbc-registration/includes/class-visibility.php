<?php
/**
 * Visibility Class
 * Evaluates whether a viewer can see a given profile field.
 *
 * Levels: public > members > friends > admins
 *   - public:  anyone (logged in or not)
 *   - members: any logged-in community member
 *   - friends: profile owner's friends + owner + admins
 *   - admins:  site admins + profile owner only
 *
 * Owner and admins always see all fields.
 *
 * @package TBC_Registration
 */

namespace TBCRegistration;

defined('ABSPATH') || exit;

class Visibility {

    const LEVEL_PUBLIC  = 'public';
    const LEVEL_MEMBERS = 'members';
    const LEVEL_FRIENDS = 'friends';
    const LEVEL_ADMINS  = 'admins';

    /**
     * All visibility levels in order from most to least open.
     */
    const LEVELS = [
        self::LEVEL_PUBLIC,
        self::LEVEL_MEMBERS,
        self::LEVEL_FRIENDS,
        self::LEVEL_ADMINS,
    ];

    /**
     * Check if a viewer can see a field on a given profile.
     *
     * @param array $field       Field definition.
     * @param int   $profile_user_id  The user whose profile is being viewed.
     * @param int   $viewer_user_id   The user viewing the profile (0 = guest).
     * @return bool
     */
    public function can_view_field($field, $profile_user_id, $viewer_user_id) {
        // Owner always sees their own fields
        if ($viewer_user_id && $viewer_user_id == $profile_user_id) {
            return true;
        }

        // Admins always see all fields
        if ($viewer_user_id && $this->is_admin($viewer_user_id)) {
            return true;
        }

        $visibility = $this->get_effective_visibility($field, $profile_user_id);

        switch ($visibility) {
            case self::LEVEL_PUBLIC:
                return true;

            case self::LEVEL_MEMBERS:
                return $viewer_user_id > 0;

            case self::LEVEL_FRIENDS:
                return $viewer_user_id > 0 && $this->are_friends($profile_user_id, $viewer_user_id);

            case self::LEVEL_ADMINS:
                return false; // Already handled above

            default:
                return false;
        }
    }

    /**
     * Get the effective visibility for a field on a profile.
     * If the field allows user override, check the user's preference.
     *
     * @param array $field
     * @param int   $profile_user_id
     * @return string Visibility level.
     */
    public function get_effective_visibility($field, $profile_user_id) {
        $default_visibility = $field['visibility'] ?? self::LEVEL_ADMINS;

        if (empty($field['allow_user_override'])) {
            return $default_visibility;
        }

        $user_override = get_user_meta(
            $profile_user_id,
            Fields::meta_key($field['key'] . '_visibility'),
            true
        );

        if ($user_override && in_array($user_override, self::LEVELS, true)) {
            return $user_override;
        }

        return $default_visibility;
    }

    /**
     * Save a user's visibility override for a field.
     *
     * @param int    $user_id
     * @param string $field_key
     * @param string $visibility
     * @return bool
     */
    public function save_user_visibility($user_id, $field_key, $visibility) {
        if (!in_array($visibility, self::LEVELS, true)) {
            return false;
        }

        return update_user_meta(
            $user_id,
            Fields::meta_key($field_key . '_visibility'),
            $visibility
        ) !== false;
    }

    /**
     * Filter an array of fields to only those the viewer can see.
     *
     * @param array $fields          Keyed field definitions.
     * @param int   $profile_user_id
     * @param int   $viewer_user_id
     * @return array Filtered fields.
     */
    public function filter_visible_fields($fields, $profile_user_id, $viewer_user_id) {
        return array_filter($fields, function ($field) use ($profile_user_id, $viewer_user_id) {
            return $this->can_view_field($field, $profile_user_id, $viewer_user_id);
        });
    }

    /**
     * Check if a user is a site admin.
     * Uses FluentCommunity's Helper if available.
     *
     * @param int $user_id
     * @return bool
     */
    public function is_admin($user_id) {
        if (!$user_id) {
            return false;
        }

        if (class_exists('\FluentCommunity\App\Services\Helper')) {
            return \FluentCommunity\App\Services\Helper::isSiteAdmin($user_id);
        }

        return user_can($user_id, 'manage_options');
    }

    /**
     * Check if two users are friends in FluentCommunity.
     *
     * @param int $user_a
     * @param int $user_b
     * @return bool
     */
    private function are_friends($user_a, $user_b) {
        if (!$user_a || !$user_b) {
            return false;
        }

        global $wpdb;
        $table = $wpdb->prefix . 'fcom_followers';

        // Mutual follow = both directions exist with level > 0 (0 = blocked)
        $count = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$table}
             WHERE ((follower_id = %d AND followed_id = %d) OR (follower_id = %d AND followed_id = %d))
             AND level > 0",
            $user_a, $user_b, $user_b, $user_a
        ));

        return intval($count) >= 2;
    }

    /**
     * Get human-readable labels for visibility levels.
     *
     * @return array
     */
    public static function get_level_labels() {
        return [
            self::LEVEL_PUBLIC  => __('Public', 'tbc-registration'),
            self::LEVEL_MEMBERS => __('Members Only', 'tbc-registration'),
            self::LEVEL_FRIENDS => __('Friends Only', 'tbc-registration'),
            self::LEVEL_ADMINS  => __('Admins Only', 'tbc-registration'),
        ];
    }
}
