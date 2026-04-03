<?php
/**
 * Push Notification Registry - stores all notification types
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_Push_Registry {

    private static $instance = null;
    private $types = [];

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('init', [$this, 'register_default_types'], 5);
    }

    /**
     * Register default notification types
     */
    public function register_default_types() {
        // Admin (not user-configurable — always fires)
        $this->register([
            'id' => 'manual_notification',
            'label' => __('Manual notification', 'tbc-ca'),
            'description' => __('Admin-sent push notifications', 'tbc-ca'),
            'category' => 'admin',
            'default' => true,
            'user_configurable' => false,
        ]);

        // Community (Fluent Community Base) - 10 types
        $this->register([
            'id' => 'comment_on_post',
            'label' => __('Comment on your post', 'tbc-ca'),
            'description' => __('When someone comments on your post', 'tbc-ca'),
            'category' => 'community',
            'default' => true,
            'hook' => 'fluent_community/notification/comment/notifed_to_author',
            'email_key' => 'com_my_post_mail',
        ]);

        $this->register([
            'id' => 'mentioned_in_comment',
            'label' => __('Mentioned in comment', 'tbc-ca'),
            'description' => __('When someone mentions you in a comment', 'tbc-ca'),
            'category' => 'community',
            'default' => true,
            'hook' => 'fluent_community/notification/comment/notifed_to_mentions',
            'email_key' => 'mention_mail',
            'group' => 'mentions',
            'group_label' => __('Mentions', 'tbc-ca'),
            'group_description' => __('When someone mentions you in a post or comment', 'tbc-ca'),
            'push_label' => __('In comments', 'tbc-ca'),
            'note' => __('Email setting also controls announcement emails', 'tbc-ca'),
        ]);

        $this->register([
            'id' => 'reply_to_comment',
            'label' => __('Reply to your comment', 'tbc-ca'),
            'description' => __('When someone replies to your comment', 'tbc-ca'),
            'category' => 'community',
            'default' => true,
            'hook' => 'fluent_community/notification/comment/notifed_to_thread_commetenter',
            'email_key' => 'reply_my_com_mail',
        ]);

        $this->register([
            'id' => 'comment_on_followed_post',
            'label' => __('Comment on post you follow', 'tbc-ca'),
            'description' => __('When someone comments on a post you commented on', 'tbc-ca'),
            'category' => 'community',
            'default' => false,
            'hook' => 'fluent_community/notification/comment/notifed_to_other_users',
        ]);

        $this->register([
            'id' => 'new_space_post',
            'label' => __('New post in your space', 'tbc-ca'),
            'description' => __('When a new post is created in a space you belong to', 'tbc-ca'),
            'category' => 'community',
            'default' => false,
            'hook' => 'fluent_community/space_feed/created',
        ]);

        $this->register([
            'id' => 'reaction_on_post',
            'label' => __('Reaction on your post', 'tbc-ca'),
            'description' => __('When someone reacts to your post', 'tbc-ca'),
            'category' => 'community',
            'default' => true,
            'hook' => 'fluent_community/feed/react_added',
            'group' => 'reactions',
            'group_label' => __('Reactions', 'tbc-ca'),
            'group_description' => __('When someone reacts to your posts or comments', 'tbc-ca'),
            'push_label' => __('On your posts', 'tbc-ca'),
        ]);

        $this->register([
            'id' => 'reaction_on_comment',
            'label' => __('Reaction on your comment', 'tbc-ca'),
            'description' => __('When someone reacts to your comment', 'tbc-ca'),
            'category' => 'community',
            'default' => true,
            'hook' => 'fluent_community/comment/react_added',
            'group' => 'reactions',
            'push_label' => __('On your comments', 'tbc-ca'),
        ]);

        $this->register([
            'id' => 'mentioned_in_post',
            'label' => __('Mentioned in a post', 'tbc-ca'),
            'description' => __('When someone mentions you in a post', 'tbc-ca'),
            'category' => 'community',
            'default' => true,
            'hook' => 'fluent_community/feed_mentioned',
            'group' => 'mentions',
            'push_label' => __('In posts', 'tbc-ca'),
        ]);

        $this->register([
            'id' => 'space_join',
            'label' => __('Someone joined your space', 'tbc-ca'),
            'description' => __('When someone joins a space you moderate', 'tbc-ca'),
            'category' => 'community',
            'default' => false,
            'hook' => 'fluent_community/space/joined',
        ]);

        $this->register([
            'id' => 'space_role_change',
            'label' => __('Your role changed', 'tbc-ca'),
            'description' => __('When your role is changed in a space', 'tbc-ca'),
            'category' => 'community',
            'default' => true,
            'hook' => 'fluent_community/space/member/role_updated',
        ]);

        $this->register([
            'id' => 'invitation_received',
            'label' => __('Invitation received', 'tbc-ca'),
            'description' => __('When you receive an invitation', 'tbc-ca'),
            'category' => 'community',
            'default' => true,
            'hook' => 'fluent_community/invitation_created',
        ]);

        // Messaging (Fluent Messaging)
        $this->register([
            'id' => 'new_direct_message',
            'label' => __('New direct message', 'tbc-ca'),
            'description' => __('When someone sends you a direct message', 'tbc-ca'),
            'category' => 'messaging',
            'default' => true,
            'hook' => 'fluent_messaging/after_add_message',
            'user_configurable' => false,
        ]);

        // Pro (Fluent Community Pro) - feature-gated types
        $this->register([
            'id' => 'friend_new_post',
            'label' => __('Follower posted', 'tbc-ca'),
            'description' => __('When someone you follow creates a new post', 'tbc-ca'),
            'category' => 'social',
            'default' => true,
            'hook' => 'fluent_community/feed/created',
            'requires_pro' => true,
            'feature_flag' => 'followers_module',
        ]);

        $this->register([
            'id' => 'new_follower',
            'label' => __('New follower', 'tbc-ca'),
            'description' => __('When someone follows you', 'tbc-ca'),
            'category' => 'social',
            'default' => true,
            'hook' => 'fluent_community/followed_user',
            'requires_pro' => true,
            'feature_flag' => 'followers_module',
        ]);

        $this->register([
            'id' => 'level_up',
            'label' => __('You leveled up', 'tbc-ca'),
            'description' => __('When you reach a new level', 'tbc-ca'),
            'category' => 'social',
            'default' => true,
            'hook' => 'fluent_community/user_level_upgraded',
            'requires_pro' => true,
            'feature_flag' => 'leader_board_module',
        ]);

        $this->register([
            'id' => 'points_earned',
            'label' => __('Points earned', 'tbc-ca'),
            'description' => __('When you earn points', 'tbc-ca'),
            'category' => 'social',
            'default' => false,
            'hook' => 'fluent_community/user_points_updated',
            'requires_pro' => true,
            'feature_flag' => 'leader_board_module',
        ]);

        $this->register([
            'id' => 'quiz_result',
            'label' => __('Quiz submitted', 'tbc-ca'),
            'description' => __('When a quiz is submitted', 'tbc-ca'),
            'category' => 'social',
            'default' => true,
            'hook' => 'fluent_community/quiz/submitted',
            'requires_pro' => true,
            'feature_flag' => 'course_module',
        ]);

        $this->register([
            'id' => 'course_enrolled',
            'label' => __('Course enrollment', 'tbc-ca'),
            'description' => __('When you are enrolled in a course', 'tbc-ca'),
            'category' => 'community',
            'default' => true,
            'hook' => 'fluent_community/course/enrolled',
            'requires_pro' => true,
            'feature_flag' => 'course_module',
        ]);

        // Space join request (private spaces)
        $this->register([
            'id' => 'space_join_request',
            'label' => __('Space join request', 'tbc-ca'),
            'description' => __('When someone requests to join a space you moderate', 'tbc-ca'),
            'category' => 'community',
            'default' => true,
            'hook' => 'fluent_community/space/join_requested',
        ]);

        // Automated notifications (Uncanny Automator, etc.)
        $this->register([
            'id'                => 'automated_notification',
            'label'             => __('Automated notifications', 'tbc-ca'),
            'description'       => __('Automated notifications from community actions', 'tbc-ca'),
            'category'          => 'community',
            'default'           => true,
            'hook'              => 'fluent_community/notification/automated',
        ]);

        // Allow other plugins to register types
        do_action('tbc_ca_register_push_types', $this);
    }

    /**
     * Register a notification type
     */
    public function register($args) {
        $defaults = [
            'id' => '',
            'label' => '',
            'description' => '',
            'category' => 'general',
            'default' => true,
            'hook' => '',
            'requires_pro' => false,
            'feature_flag' => '',
            'user_configurable' => true,
            // UI metadata — drives the app's notification settings screen
            'email_key'         => '',
            'group'             => '',
            'group_label'       => '',
            'group_description' => '',
            'push_label'        => '',
            'note'              => '',
        ];

        $type = wp_parse_args($args, $defaults);

        if (empty($type['id'])) {
            return false;
        }

        $this->types[$type['id']] = $type;
        return true;
    }

    /**
     * Get all registered types
     */
    public function get_all() {
        return $this->types;
    }

    /**
     * Get enabled types only (based on admin settings + feature flags)
     */
    public function get_enabled() {
        $settings = TBC_CA_Core::get_settings();
        $admin_settings = $settings['notification_types'] ?? [];
        $enabled = [];

        foreach ($this->types as $id => $type) {
            // Skip types whose Fluent Community feature is disabled
            if (!$this->is_feature_active($id)) {
                continue;
            }

            // If not configured in admin, use default
            $is_enabled = isset($admin_settings[$id]['enabled'])
                ? $admin_settings[$id]['enabled']
                : true;

            if ($is_enabled) {
                $enabled[$id] = $type;
            }
        }

        return $enabled;
    }

    /**
     * Get a single type by ID
     */
    public function get($id) {
        return $this->types[$id] ?? null;
    }

    /**
     * Check if a type is enabled (admin toggle + feature flag)
     */
    public function is_enabled($id) {
        if (!$this->is_feature_active($id)) {
            return false;
        }

        $settings = TBC_CA_Core::get_settings();
        $admin_settings = $settings['notification_types'] ?? [];

        return isset($admin_settings[$id]['enabled'])
            ? $admin_settings[$id]['enabled']
            : true;
    }

    /**
     * Get default value for a type
     */
    public function get_default($id) {
        $settings = TBC_CA_Core::get_settings();
        $admin_settings = $settings['notification_types'] ?? [];

        if (isset($admin_settings[$id]['default'])) {
            return $admin_settings[$id]['default'];
        }

        $type = $this->get($id);
        return $type ? $type['default'] : true;
    }

    /**
     * Get types grouped by category
     */
    public function get_by_category() {
        $grouped = [];

        foreach ($this->types as $id => $type) {
            $category = $type['category'];
            if (!isset($grouped[$category])) {
                $grouped[$category] = [];
            }
            $grouped[$category][$id] = $type;
        }

        return $grouped;
    }

    /**
     * Check if a Fluent Community feature flag is active.
     * Static so it can be called before types are registered (e.g. from class-hooks.php).
     *
     * @param string $flag_key The feature config key (e.g. 'followers_module')
     * @return bool True if no flag provided, FC not loaded, or feature is enabled
     */
    public static function is_fc_feature_active($flag_key) {
        if (empty($flag_key)) {
            return true;
        }

        if (!class_exists('FluentCommunity\App\Functions\Utility')) {
            return true;
        }

        $features = \FluentCommunity\App\Functions\Utility::getFeaturesConfig();
        return isset($features[$flag_key]) && $features[$flag_key] === 'yes';
    }

    /**
     * Check if a notification type is user-configurable (shows in user settings)
     *
     * Admin settings override takes priority, then falls back to code default.
     *
     * @param string $type_id Notification type ID
     * @return bool
     */
    public function is_user_configurable($type_id) {
        $type = $this->get($type_id);
        if (!$type) {
            return false;
        }

        // Admin settings override takes priority
        $settings = TBC_CA_Core::get_settings();
        if (isset($settings['notification_types'][$type_id]['user_configurable'])) {
            return (bool) $settings['notification_types'][$type_id]['user_configurable'];
        }

        // Fall back to code default
        return $type['user_configurable'] !== false;
    }

    /**
     * Check if a notification type's required feature is active
     *
     * @param string $type_id Notification type ID
     * @return bool True if no feature_flag set, or the feature is enabled
     */
    public function is_feature_active($type_id) {
        $type = $this->get($type_id);
        if (!$type || empty($type['feature_flag'])) {
            return true;
        }

        return self::is_fc_feature_active($type['feature_flag']);
    }
}
