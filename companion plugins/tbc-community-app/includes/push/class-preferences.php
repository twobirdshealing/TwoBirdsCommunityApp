<?php
/**
 * Push Preferences - user notification settings stored in user meta
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_Push_Preferences {

    private static $instance = null;
    private $meta_key = '_tbc_ca_push_preferences';

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {}

    /**
     * Get user's notification preferences
     */
    public function get_user_preferences($user_id) {
        $preferences = get_user_meta($user_id, $this->meta_key, true);

        if (!is_array($preferences)) {
            $preferences = [];
        }

        return $preferences;
    }

    /**
     * Update user's notification preferences
     */
    public function update_user_preferences($user_id, $preferences) {
        return update_user_meta($user_id, $this->meta_key, $preferences);
    }

    /**
     * Check if user has notification enabled for a type
     * Falls back to admin default if user hasn't set preference
     */
    public function is_enabled_for_user($user_id, $type_id) {
        $registry = TBC_CA_Push_Registry::get_instance();

        // First check if type is globally enabled by admin
        if (!$registry->is_enabled($type_id)) {
            return false;
        }

        // Check user preference
        $preferences = $this->get_user_preferences($user_id);

        if (isset($preferences[$type_id])) {
            return (bool) $preferences[$type_id];
        }

        // Fall back to admin default
        return $registry->get_default($type_id);
    }

    /**
     * Set user preference for a notification type
     */
    public function set_preference($user_id, $type_id, $enabled) {
        $preferences = $this->get_user_preferences($user_id);
        $preferences[$type_id] = (bool) $enabled;
        return $this->update_user_preferences($user_id, $preferences);
    }

    /**
     * Get all preferences for a user (with defaults applied)
     */
    public function get_all_for_user($user_id) {
        $registry = TBC_CA_Push_Registry::get_instance();
        $enabled_types = $registry->get_enabled();
        $user_prefs = $this->get_user_preferences($user_id);

        $result = [];

        foreach ($enabled_types as $id => $type) {
            // Skip types that are not user-configurable (e.g. manual_notification)
            if (!$registry->is_user_configurable($id)) {
                continue;
            }

            $result[$id] = [
                'id'                => $id,
                'label'             => $type['label'],
                'description'       => $type['description'],
                'category'          => $type['category'],
                'enabled'           => isset($user_prefs[$id])
                    ? (bool) $user_prefs[$id]
                    : $registry->get_default($id),
                'email_key'         => $type['email_key'],
                'group'             => $type['group'],
                'group_label'       => $type['group_label'],
                'group_description' => $type['group_description'],
                'push_label'        => $type['push_label'],
                'note'              => $type['note'],
            ];
        }

        return $result;
    }

    /**
     * Get preferences grouped by category
     */
    public function get_all_for_user_grouped($user_id) {
        $all = $this->get_all_for_user($user_id);
        $grouped = [];

        foreach ($all as $id => $pref) {
            $category = $pref['category'];
            if (!isset($grouped[$category])) {
                $grouped[$category] = [];
            }
            $grouped[$category][] = $pref;
        }

        return $grouped;
    }
}
