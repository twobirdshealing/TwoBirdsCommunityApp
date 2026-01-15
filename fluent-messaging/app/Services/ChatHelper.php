<?php

namespace FluentMessaging\App\Services;

use FluentCommunity\App\Functions\Utility;
use FluentMessaging\App\Models\Message;
use FluentMessaging\App\Models\Thread;
use FluentMessaging\App\Models\ThreadUser;
use FluentCommunity\App\Models\SpaceUserPivot;
use FluentCommunity\App\Services\Helper;

class ChatHelper
{
    public static function getChatThread($communityId)
    {
        return Thread::where('space_id', $communityId)
            ->first();
    }

    public static function hasChatAccess($thread, $userId = null)
    {

        $threadId = $thread->id;

        if (!$userId) {
            $userId = get_current_user_id();
        }

        if (!$userId || !$thread) {
            return false;
        }

        if ($thread->space_id) {
            return SpaceUserPivot::where('space_id', $thread->space_id)
                ->where('user_id', $userId)
                ->where('status', 'active')
                ->exists();
        }

        return Thread::whereHas('users', function ($q) use ($userId) {
            $q->where('user_id', $userId);
        })
            ->where('id', $threadId)
            ->exists();
    }

    public static function getUserToUserThread($user1Id, $user2Id)
    {
        static $thread = null;

        if ($thread) {
            return $thread;
        }

        $thread = Thread::whereHas('users', function ($q) use ($user1Id) {
            $q->where('user_id', $user1Id);
        })
            ->whereHas('users', function ($q) use ($user2Id) {
                $q->where('user_id', $user2Id);
            })
            ->whereNull('space_id')
            ->first();

        return $thread;
    }

    public static function markThreadRead($thread, $userIds)
    {
        $lastMessage = Message::select(['id'])->where('thread_id', $thread->id)
            ->orderBy('id', 'DESC')
            ->first();

        if (!$lastMessage) {
            return;
        }

        ThreadUser::whereIn('user_id', $userIds)
            ->where('thread_id', $thread->id)
            ->update([
                'last_seen_message_id' => $lastMessage->id
            ]);

        return true;
    }

    public static function getUnreadThreadCounts($userId)
    {
        global $wpdb;
        $count = $wpdb->get_row("SELECT COUNT(DISTINCT messages.thread_id) AS unread_thread_count
FROM {$wpdb->prefix}fcom_chat_messages AS messages
INNER JOIN {$wpdb->prefix}fcom_chat_thread_users AS thread_users ON messages.thread_id = thread_users.thread_id
INNER JOIN {$wpdb->prefix}fcom_chat_threads AS threads ON messages.thread_id = threads.id
WHERE thread_users.user_id = {$userId}
AND threads.status = 'active'
AND (messages.id > thread_users.last_seen_message_id OR thread_users.last_seen_message_id IS NULL)");

        return $count->unread_thread_count;
    }

    public static function getUnreadThreadIds($userId)
    {
        global $wpdb;
        $unreads = $wpdb->get_results("SELECT DISTINCT messages.thread_id
FROM {$wpdb->prefix}fcom_chat_messages AS messages
INNER JOIN {$wpdb->prefix}fcom_chat_thread_users AS thread_users ON messages.thread_id = thread_users.thread_id
INNER JOIN {$wpdb->prefix}fcom_chat_threads AS threads ON messages.thread_id = threads.id
WHERE thread_users.user_id = {$userId}
AND thread_users.status = 'active'
AND threads.status = 'active'
AND (messages.id > thread_users.last_seen_message_id OR thread_users.last_seen_message_id IS NULL)");

        $ids = [];

        foreach ($unreads as $unread) {
            $ids[] = $unread->thread_id;
        }

        return $ids;
    }

    public static function userCanAccessChannel($channelName, $userId = null)
    {

        if (!$userId) {
            $userId = get_current_user_id();
        }

        if (strpos($channelName, 'private-chat_user_') === 0) {
            $channelUserId = str_replace('private-chat_user_', '', $channelName);
            return $channelUserId == $userId;
        }

        if (strpos($channelName, 'private-chat_space_') === 0) {
            $spaceId = str_replace('private-chat_space_', '', $channelName);
            return Helper::isUserInSpace($userId, $spaceId);
        }

        return false;
    }

    public static function getMessagingConfig()
    {
        static $settings = null;

        if ($settings) {
            return $settings;
        }

        $defaults = [
            'messaging_email_status'    => 'yes',
            'messaging_email_frequency' => 'disabled',
            'who_can_initiate_message'  => 'everyone', // mods | everyone
        ];

        $settings = Utility::getOption('_messaging_settings', $defaults);

        $settings = wp_parse_args($settings, $defaults);

        return $settings;
    }

    public static function updateMessagingConfig($config)
    {
        return Utility::updateOption('_messaging_settings', $config);
    }

    public static function canInitiateMessage($user = null)
    {
        if (!$user) {
            $user = Helper::getCurrentUser();
        }

        if (!$user) {
            return false;
        }

        $messagingConfig = self::getMessagingConfig();
        $canInitiateMessage = $messagingConfig['who_can_initiate_message'] === 'everyone' || Helper::isModerator($user);

        return apply_filters('fluent_messaging/can_initiate_message', $canInitiateMessage, $user);
    }

}
