<?php
/**
 * Push Hooks - hooks into Fluent Community events to send push notifications
 *
 * All notifications use one unified path: send_to_users() → AS batch job → Expo batch API.
 * as_enqueue_async_action() is called directly inside each hook handler (proven reliable).
 * Zero blocking HTTP calls during any WordPress request.
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_Push_Hooks {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->register_hooks();
    }

    /**
     * Register all Fluent Community hooks
     */
    private function register_hooks() {
        // Comment notifications - all pass 1 arg: array with user_ids, notification, comment, feed, key
        add_action('fluent_community/notification/comment/notifed_to_author', [$this, 'on_comment_to_author'], 10, 1);
        add_action('fluent_community/notification/comment/notifed_to_mentions', [$this, 'on_comment_mention'], 10, 1);
        add_action('fluent_community/notification/comment/notifed_to_thread_commetenter', [$this, 'on_comment_reply'], 10, 1);
        add_action('fluent_community/notification/comment/notifed_to_other_users', [$this, 'on_comment_followed'], 10, 1);

        // Post notifications
        // space_feed/created: passes ($feed) - 1 arg
        add_action('fluent_community/space_feed/created', [$this, 'on_new_space_post'], 10, 1);
        // feed/react_added: passes ($react, $feed) - 2 args
        add_action('fluent_community/feed/react_added', [$this, 'on_reaction'], 10, 2);
        // comment/react_added (FC 2.2.01+): passes ($reaction, $comment, $feed) - 3 args
        add_action('fluent_community/comment/react_added', [$this, 'on_comment_reaction'], 10, 3);
        // feed_mentioned: passes ($feed, $mentionedUsers) - 2 args
        add_action('fluent_community/feed_mentioned', [$this, 'on_post_mention'], 10, 2);

        // Space notifications
        // space/joined: passes ($space, $userId, $by) - 3 args
        add_action('fluent_community/space/joined', [$this, 'on_space_join'], 10, 3);
        // space/join_requested: passes ($space, $userId, $by) - 3 args (private spaces)
        add_action('fluent_community/space/join_requested', [$this, 'on_space_join_request'], 10, 3);
        // member/role_updated: passes ($space, $pivot) - 2 args
        add_action('fluent_community/space/member/role_updated', [$this, 'on_role_change'], 10, 2);

        // Invitation notification — FC passes 1 arg: $invitation (inviter is $invitation->user_id)
        add_action('fluent_community/invitation_created', [$this, 'on_invitation'], 10, 1);

        // Automated notifications (Uncanny Automator, etc.)
        add_action('fluent_community/notification/automated', [$this, 'on_automated_notification'], 10, 1);

        // Direct message notification (Fluent Messaging)
        // fluent_messaging/after_add_message: passes ($message) - 1 arg
        add_action('fluent_messaging/after_add_message', [$this, 'on_new_direct_message'], 10, 1);

        // Pro hooks — only register if corresponding FC feature is enabled
        if (TBC_CA_Push_Registry::is_fc_feature_active('followers_module')) {
            // Friend posted - fires for ALL published posts
            add_action('fluent_community/feed/created', [$this, 'on_friend_post'], 10, 1);
            // followed_user: passes ($follow, $xProfile) - 2 args
            add_action('fluent_community/followed_user', [$this, 'on_new_follower'], 10, 2);
        }

        if (TBC_CA_Push_Registry::is_fc_feature_active('leader_board_module')) {
            // user_level_upgraded: passes ($xprofile, $newLevel, $oldLevel) - 3 args
            add_action('fluent_community/user_level_upgraded', [$this, 'on_level_up'], 10, 3);
            // user_points_updated: passes ($xprofile, $oldPoints) — 2 args
            add_action('fluent_community/user_points_updated', [$this, 'on_points_earned'], 10, 2);
        }

        if (TBC_CA_Push_Registry::is_fc_feature_active('course_module')) {
            // quiz/submitted: passes ($quizResult, $user, $quiz) - 3 args
            add_action('fluent_community/quiz/submitted', [$this, 'on_quiz_submitted'], 10, 3);
            // course/enrolled: passes ($course, $userId, $by, $created) - 4 args
            add_action('fluent_community/course/enrolled', [$this, 'on_course_enrolled'], 10, 4);
        }

        // Action Scheduler handler for batch push processing
        add_action('tbc_ca_process_push_batch', [$this, 'process_push_batch'], 10, 2);
    }

    // =========================================================================
    // UNIFIED SEND + BATCH SYSTEM
    // =========================================================================

    /**
     * Schedule push notifications for async batch processing via Expo API.
     *
     * Unified entry point for ALL notifications (1 user or 100 users — same path).
     * Calls as_enqueue_async_action() directly inside the hook handler, which is
     * the only pattern proven to reliably create AS jobs in this environment.
     *
     * @param array       $user_ids   Array of user IDs to notify
     * @param string      $type       Notification type ID (from registry)
     * @param string      $title      Notification title
     * @param string      $body       Notification body text
     * @param string|null $route      App route to navigate to on tap
     * @param int|null    $exclude_id User ID to exclude (e.g. the author)
     */
    private function send_to_users($user_ids, $type, $title, $body, $route = null, $exclude_id = null, $force = false, $source = 'hook') {
        $filtered_ids = [];
        foreach ($user_ids as $user_id) {
            if ($exclude_id && $user_id == $exclude_id) {
                continue;
            }
            $filtered_ids[] = (int) $user_id;
        }

        if (empty($filtered_ids)) {
            return;
        }

        $notification_data = [
            'type'  => $type,
            'title' => $title,
            'body'  => $body,
            'route' => $route,
            'force'  => $force,
            'source' => $source,
        ];

        // ~1500 IDs fit under AS's 8000 char JSON arg limit
        $chunks = array_chunk($filtered_ids, 1500);

        error_log("[TBC Push] Scheduling " . count($filtered_ids) . " notification(s) in " . count($chunks) . " chunk(s), type={$type}");

        foreach ($chunks as $i => $chunk) {
            $action_id = as_enqueue_async_action('tbc_ca_process_push_batch', [$chunk, $notification_data], 'tbc-community-app');
            error_log("[TBC Push] AS action created: id=" . var_export($action_id, true) . ", chunk=" . ($i + 1) . "/" . count($chunks) . ", items=" . count($chunk));
        }
    }

    /**
     * Public wrapper for send_to_users() — used by external plugins via tbc_send_push_to_users().
     *
     * @param array       $user_ids   Array of user IDs to notify
     * @param string      $type       Notification type ID (from registry)
     * @param string      $title      Notification title
     * @param string      $body       Notification body text
     * @param string|null $route      App route to navigate to on tap
     * @param int|null    $exclude_id User ID to exclude (e.g. the author)
     * @param bool        $force      If true, skip user preference check (for manual sends)
     */
    public function send_to_users_external($user_ids, $type, $title, $body, $route = null, $exclude_id = null, $force = false, $source = 'hook') {
        $this->send_to_users($user_ids, $type, $title, $body, $route, $exclude_id, $force, $source);
    }

    /**
     * Process a batch of queued push notifications via Expo batch API.
     * Called by Action Scheduler (async, separate request).
     */
    public function process_push_batch($user_ids, $notification_data) {
        if (empty($user_ids) || !is_array($user_ids) || empty($notification_data)) {
            error_log("[TBC Push Batch] Empty or invalid args received");
            return;
        }

        // Rebuild queue items from compact format
        $queue = [];
        foreach ($user_ids as $uid) {
            $queue[] = [
                'user_id' => $uid,
                'type'    => $notification_data['type'],
                'title'   => $notification_data['title'],
                'body'    => $notification_data['body'],
                'route'   => $notification_data['route'] ?? null,
            ];
        }

        error_log("[TBC Push Batch] Processing " . count($queue) . " notification(s), type=" . $notification_data['type']);
        $start = microtime(true);

        $firebase = TBC_CA_Push_Firebase::get_instance();
        $force = !empty($notification_data['force']);
        $results = $firebase->send_queued_notifications($queue, $force);

        $elapsed = round((microtime(true) - $start) * 1000);
        error_log("[TBC Push Batch] Complete in {$elapsed}ms: " . json_encode($results));

        // Log the batch result
        $total_sent = 0;
        $total_failed = 0;
        foreach ($results as $batch_result) {
            $total_sent += $batch_result['sent'] ?? 0;
            $total_failed += $batch_result['errors'] ?? 0;
        }
        $source = $notification_data['source'] ?? 'hook';
        TBC_CA_Push_Log::get_instance()->log(
            $notification_data['type'],
            $notification_data['title'] ?? '',
            $notification_data['body'] ?? '',
            count($user_ids),
            $total_sent,
            $total_failed,
            $source
        );
    }

    /**
     * Helper: Get user display name
     */
    private function get_display_name($user_id) {
        $user = get_user_by('ID', $user_id);
        if (!$user) {
            return 'Someone';
        }
        return $user->display_name ?: $user->user_login;
    }

    // =========================================================================
    // COMMENT NOTIFICATIONS
    // All hooks pass 1 arg: array with keys: user_ids, notification, comment, feed, key
    // =========================================================================

    /**
     * Comment on author's post
     */
    public function on_comment_to_author($data) {
        $feed = $data['feed'] ?? null;
        $comment = $data['comment'] ?? null;

        if (!$feed || !$comment) {
            return;
        }

        $author_id = $feed->user_id ?? null;
        $commenter_id = $comment->user_id ?? null;

        if (!$author_id || $author_id == $commenter_id) {
            return;
        }

        $commenter_name = $this->get_display_name($commenter_id);
        $post_title = wp_trim_words($feed->message ?? 'your post', 5);

        $this->send_to_users(
            [$author_id],
            'comment_on_post',
            'New Comment',
            "{$commenter_name} commented on {$post_title}",
            "/feed/{$feed->id}"
        );
    }

    /**
     * Mentioned in comment
     */
    public function on_comment_mention($data) {
        $comment = $data['comment'] ?? null;
        $feed = $data['feed'] ?? null;
        $user_ids = $data['user_ids'] ?? [];

        if (!$comment || !$feed || empty($user_ids)) {
            return;
        }

        $commenter_id = $comment->user_id ?? null;
        $commenter_name = $this->get_display_name($commenter_id);

        $this->send_to_users(
            $user_ids,
            'mentioned_in_comment',
            'You were mentioned',
            "{$commenter_name} mentioned you in a comment",
            "/feed/{$feed->id}",
            $commenter_id
        );
    }

    /**
     * Reply to comment thread
     */
    public function on_comment_reply($data) {
        $comment = $data['comment'] ?? null;
        $feed = $data['feed'] ?? null;
        $user_ids = $data['user_ids'] ?? [];

        if (!$comment || !$feed || empty($user_ids)) {
            return;
        }

        $commenter_id = $comment->user_id ?? null;
        $commenter_name = $this->get_display_name($commenter_id);

        $this->send_to_users(
            $user_ids,
            'reply_to_comment',
            'New Reply',
            "{$commenter_name} replied to your comment",
            "/feed/{$feed->id}",
            $commenter_id
        );
    }

    /**
     * Comment on followed post
     */
    public function on_comment_followed($data) {
        $comment = $data['comment'] ?? null;
        $feed = $data['feed'] ?? null;
        $user_ids = $data['user_ids'] ?? [];

        if (!$comment || !$feed || empty($user_ids)) {
            return;
        }

        $commenter_id = $comment->user_id ?? null;
        $commenter_name = $this->get_display_name($commenter_id);

        $this->send_to_users(
            $user_ids,
            'comment_on_followed_post',
            'New Comment',
            "{$commenter_name} commented on a post you follow",
            "/feed/{$feed->id}",
            $commenter_id
        );
    }

    // =========================================================================
    // POST NOTIFICATIONS
    // =========================================================================

    /**
     * New post in space
     * Note: Fluent Community only passes $feed, we get space from $feed->space_id
     */
    public function on_new_space_post($feed) {
        $author_id = $feed->user_id ?? null;
        $author_name = $this->get_display_name($author_id);
        $space_id = $feed->space_id ?? null;

        if (!$space_id) {
            return;
        }

        // Get space info from database
        $space = $this->get_space_by_id($space_id);
        $space_name = $space->title ?? 'a space';

        // Get all space members
        $members = $this->get_space_members($space_id);

        $this->send_to_users(
            $members,
            'new_space_post',
            "New post in {$space_name}",
            "{$author_name} shared a new post",
            "/feed/{$feed->id}",
            $author_id
        );
    }

    /**
     * Reaction on post
     * Hook passes: ($react, $feed)
     */
    public function on_reaction($react, $feed) {
        $author_id = $feed->user_id ?? null;
        $reactor_id = $react->user_id ?? null;

        if (!$author_id || $author_id == $reactor_id) {
            return;
        }

        $reactor_name = $this->get_display_name($reactor_id);

        $this->send_to_users(
            [$author_id],
            'reaction_on_post',
            'New Reaction',
            "{$reactor_name} reacted to your post",
            "/feed/{$feed->id}"
        );
    }

    /**
     * Reaction on comment (FC 2.2.01+)
     * Hook passes: ($reaction, $comment, $feed)
     */
    public function on_comment_reaction($reaction, $comment, $feed) {
        $comment_author_id = $comment->user_id ?? null;
        $reactor_id = $reaction->user_id ?? null;

        if (!$comment_author_id || $comment_author_id == $reactor_id) {
            return;
        }

        $reactor_name = $this->get_display_name($reactor_id);

        $this->send_to_users(
            [$comment_author_id],
            'reaction_on_comment',
            'New Reaction',
            "{$reactor_name} reacted to your comment",
            "/feed/{$feed->id}"
        );
    }

    /**
     * Mentioned in post
     * Note: Fluent Community passes user OBJECTS, not user IDs
     */
    public function on_post_mention($feed, $mentioned_users) {
        $author_id = $feed->user_id ?? null;
        $author_name = $this->get_display_name($author_id);

        // Extract user IDs from user objects
        $mention_ids = [];
        foreach ($mentioned_users as $user) {
            $uid = is_object($user) ? ($user->ID ?? $user->id ?? null)
                 : (is_array($user) ? ($user['ID'] ?? $user['id'] ?? null)
                 : $user);
            if ($uid) {
                $mention_ids[] = $uid;
            }
        }

        $this->send_to_users(
            $mention_ids,
            'mentioned_in_post',
            'You were mentioned',
            "{$author_name} mentioned you in a post",
            "/feed/{$feed->id}",
            $author_id
        );
    }

    /**
     * Friend posted - notify followers when someone they follow creates a post
     * Hook: fluent_community/feed/created - fires for ALL published posts
     */
    public function on_friend_post($feed) {
        $author_id = $feed->user_id ?? null;
        if (!$author_id) {
            return;
        }

        // Get followers of the post author (level >= 1, excludes blocked)
        $follower_ids = $this->get_followers($author_id);
        if (empty($follower_ids)) {
            return;
        }

        $author_name = $this->get_display_name($author_id);

        // Build message - include space name if it's a space post
        $space_id = $feed->space_id ?? null;
        if ($space_id) {
            $space = $this->get_space_by_id($space_id);
            $space_name = $space->title ?? 'a space';
            $body = "{$author_name} shared a new post in {$space_name}";
        } else {
            $body = "{$author_name} shared a new post";
        }

        $this->send_to_users(
            $follower_ids,
            'friend_new_post',
            'Friend posted',
            $body,
            "/feed/{$feed->id}",
            $author_id
        );
    }

    // =========================================================================
    // SPACE NOTIFICATIONS
    // =========================================================================

    /**
     * Someone joined space
     * Hook passes: ($space, $userId, $by)
     */
    public function on_space_join($space, $user_id, $by = 'self') {
        $user_name = $this->get_display_name($user_id);
        $space_name = $space->title ?? 'your space';

        // Notify space moderators
        $moderators = $this->get_space_moderators($space->id ?? 0);

        $this->send_to_users(
            $moderators,
            'space_join',
            'New Member',
            "{$user_name} joined {$space_name}",
            "/space/{$space->slug}",
            $user_id
        );
    }

    /**
     * Space join request (private spaces)
     * Hook passes: ($space, $userId, $by)
     */
    public function on_space_join_request($space, $user_id, $by = 'self') {
        $user_name = $this->get_display_name($user_id);
        $space_name = $space->title ?? 'a space';

        // Notify space moderators
        $moderators = $this->get_space_moderators($space->id ?? 0);

        $this->send_to_users(
            $moderators,
            'space_join_request',
            'Join Request',
            "{$user_name} requested to join {$space_name}",
            "/space/{$space->slug}",
            $user_id
        );
    }

    /**
     * Role changed in space
     * Hook passes: ($space, $pivot) where $pivot has user_id and role
     */
    public function on_role_change($space, $pivot) {
        $user_id = $pivot->user_id ?? null;
        $new_role = $pivot->role ?? 'member';
        $space_name = $space->title ?? 'a space';

        if (!$user_id) {
            return;
        }

        $this->send_to_users(
            [$user_id],
            'space_role_change',
            'Role Updated',
            "Your role in {$space_name} was changed to {$new_role}",
            "/space/{$space->slug}"
        );
    }

    /**
     * Invitation received
     * FC passes 1 arg: $invitation (Invitation model)
     * Inviter ID is $invitation->user_id, invitee email is $invitation->message
     * (FC stores email in the 'message' column — see InvitationService::createNewInvitation)
     */
    public function on_invitation($invitation) {
        $email = $invitation->message ?? null;

        if (!$email) {
            return;
        }

        // Try to find user by email
        $user = get_user_by('email', $email);
        if (!$user) {
            return; // User doesn't exist yet, can't send push
        }

        $inviter_id = $invitation->user_id ?? 0;
        $inviter_name = $this->get_display_name($inviter_id);

        $this->send_to_users(
            [$user->ID],
            'invitation_received',
            'Invitation Received',
            "{$inviter_name} invited you to join the community",
            "/notifications"
        );
    }

    // =========================================================================
    // AUTOMATED NOTIFICATIONS
    // =========================================================================

    /**
     * Automated notification (Uncanny Automator, etc.)
     * Hook data includes push_title and push_body pre-split so we don't need
     * to parse them back out of the bell content (which has the title merged in).
     */
    public function on_automated_notification($data) {
        $user_ids = $data['user_ids'] ?? [];

        if (empty($user_ids)) {
            return;
        }

        $title = !empty($data['push_title']) ? $data['push_title'] : 'New Notification';
        $body  = !empty($data['push_body']) ? wp_trim_words($data['push_body'], 15) : $title;
        $route = '/notifications';

        $this->send_to_users(
            $user_ids,
            'automated_notification',
            $title,
            $body,
            $route
        );
    }

    // =========================================================================
    // PRO NOTIFICATIONS
    // =========================================================================

    /**
     * New follower
     * Hook passes: ($follow, $xProfile) where $follow has user_id (follower) and $xProfile is followed user
     */
    public function on_new_follower($follow, $xProfile) {
        $followed_id = $xProfile->user_id ?? null;
        $follower_id = $follow->user_id ?? null;

        if (!$followed_id || $followed_id == $follower_id) {
            return;
        }

        $follower_name = $this->get_display_name($follower_id);
        $follower_user = get_user_by('ID', $follower_id);
        $follower_username = $follower_user ? $follower_user->user_login : null;

        $this->send_to_users(
            [$followed_id],
            'new_follower',
            'New Follower',
            "{$follower_name} started following you",
            $follower_username ? "/profile/{$follower_username}" : "/notifications"
        );
    }

    /**
     * Level up
     * Hook passes: ($xprofile, $newLevel, $oldLevel)
     */
    public function on_level_up($xprofile, $new_level, $old_level = null) {
        $user_id = $xprofile->user_id ?? null;

        if (!$user_id) {
            return;
        }

        $level_name = is_object($new_level) ? ($new_level->name ?? "Level {$new_level->level}") : "Level {$new_level}";

        $this->send_to_users(
            [$user_id],
            'level_up',
            'Level Up!',
            "Congratulations! You reached {$level_name}",
            "/(tabs)/profile"
        );
    }

    /**
     * Points earned
     * FC passes: ($xprofile, $oldPoints) where $xprofile->total_points is the NEW value
     */
    public function on_points_earned($xprofile, $old_points) {
        $user_id = $xprofile->user_id ?? null;
        $new_total = $xprofile->total_points ?? 0;
        $points_added = $new_total - (int) $old_points;

        if (!$user_id || $points_added <= 0) {
            return;
        }

        $this->send_to_users(
            [$user_id],
            'points_earned',
            'Points Earned',
            "You earned {$points_added} points! Total: {$new_total}",
            "/(tabs)/profile"
        );
    }

    /**
     * Quiz submitted
     * Hook passes: ($quizResult, $user, $quiz)
     */
    public function on_quiz_submitted($quizResult, $user, $quiz) {
        $user_id = $user->ID ?? $user->id ?? null;
        $quiz_title = $quiz->title ?? 'Quiz';

        if (!$user_id) {
            return;
        }

        $this->send_to_users(
            [$user_id],
            'quiz_result',
            'Quiz Submitted',
            "Your answers for '{$quiz_title}' have been submitted",
            "/notifications"
        );
    }

    /**
     * Course enrollment
     * Hook passes: ($course, $userId, $by, $created)
     */
    public function on_course_enrolled($course, $user_id, $by = 'self', $created = true) {
        if (!$user_id) {
            return;
        }

        $course_title = $course->title ?? 'a course';

        $this->send_to_users(
            [$user_id],
            'course_enrolled',
            'Course Enrollment',
            "You have been enrolled in {$course_title}",
            "/notifications"
        );
    }

    // =========================================================================
    // MESSAGING NOTIFICATIONS
    // =========================================================================

    /**
     * New direct message
     * Hook: fluent_messaging/after_add_message — passes ($message)
     * $message is FluentMessaging Message model with thread_id, user_id, text
     */
    public function on_new_direct_message($message) {
        $sender_id = $message->user_id ?? null;
        $thread_id = $message->thread_id ?? null;

        if (!$sender_id || !$thread_id) {
            return;
        }

        // Get other users in this thread
        global $wpdb;
        $table = $wpdb->prefix . 'fcom_chat_thread_users';

        // Check if table exists (Fluent Messaging may not be active)
        $table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$table}'");
        if (!$table_exists) {
            return;
        }

        $recipient_ids = $wpdb->get_col($wpdb->prepare(
            "SELECT user_id FROM {$table} WHERE thread_id = %d AND user_id != %d AND status = 'active'",
            $thread_id,
            $sender_id
        ));

        if (empty($recipient_ids)) {
            return;
        }

        $sender_name = $this->get_display_name($sender_id);

        // Message preview for push body
        $text_preview = wp_strip_all_tags($message->text ?? '');
        $text_preview = wp_trim_words($text_preview, 10, '...');
        if (empty($text_preview)) {
            $text_preview = 'Sent you a message';
        }

        $this->send_to_users(
            $recipient_ids,
            'new_direct_message',
            $sender_name,
            $text_preview,
            "/messages/user/{$sender_id}"
        );
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    /**
     * Get space by ID
     */
    private function get_space_by_id($space_id) {
        if (!$space_id) {
            return null;
        }

        global $wpdb;
        $table = $wpdb->prefix . 'fcom_spaces';

        return $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$table} WHERE id = %d",
            $space_id
        ));
    }

    /**
     * Get space member user IDs
     */
    private function get_space_members($space_id) {
        if (!$space_id) {
            return [];
        }

        global $wpdb;
        $table = $wpdb->prefix . 'fcom_space_user';

        $results = $wpdb->get_col($wpdb->prepare(
            "SELECT user_id FROM {$table} WHERE space_id = %d AND status = 'active'",
            $space_id
        ));

        return $results ?: [];
    }

    /**
     * Get space moderator user IDs
     */
    private function get_space_moderators($space_id) {
        if (!$space_id) {
            return [];
        }

        global $wpdb;
        $table = $wpdb->prefix . 'fcom_space_user';

        $results = $wpdb->get_col($wpdb->prepare(
            "SELECT user_id FROM {$table} WHERE space_id = %d AND status = 'active' AND role IN ('admin', 'moderator')",
            $space_id
        ));

        return $results ?: [];
    }

    /**
     * Get follower user IDs for a given user (people who follow them)
     * Returns followers with level >= 1 (excludes blocked, level 0)
     */
    private function get_followers($user_id) {
        if (!$user_id) {
            return [];
        }

        global $wpdb;
        $table = $wpdb->prefix . 'fcom_followers';

        // Check if the followers table exists (Pro feature)
        $table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$table}'");
        if (!$table_exists) {
            return [];
        }

        $results = $wpdb->get_col($wpdb->prepare(
            "SELECT follower_id FROM {$table} WHERE followed_id = %d AND level >= 1",
            $user_id
        ));

        return $results ?: [];
    }
}
