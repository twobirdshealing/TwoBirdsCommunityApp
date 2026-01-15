<?php

namespace FluentMessaging\App\Hooks\Handlers;

use FluentCommunity\App\Functions\Utility;
use FluentCommunity\App\Models\NotificationSubscription;
use FluentCommunity\Framework\Support\Arr;
use FluentMessaging\App\Models\ThreadUser;
use FluentMessaging\App\Services\ChatHelper;
use FluentMessaging\App\Services\EmailNotificationMail;

class SchedulerHandler
{
    private $maxRunTime = 0;

    public function register()
    {
        add_action('fluent_community_scheduled_hour_jobs', [$this, 'maybeInitHourlyMessagingEmails'], 1);
        add_action('fluent_community_daily_jobs', [$this, 'maybeInitDailyMessagingEmails'], 1);

        add_action('fluent_community_messaging_send_hourly_emails', [$this, 'sendHourlyEmails']);
        add_action('fluent_community_messaging_send_daily_emails', [$this, 'sendDailyEmails']);
        add_action('fluent_community_messaging_send_weekly_emails', [$this, 'sendWeeklyEmails']);
    }

    public function maybeInitHourlyMessagingEmails()
    {
        $globalSettings = ChatHelper::getMessagingConfig();

        if ($globalSettings['messaging_email_status'] !== 'yes') {
            return; // globally disabled
        }

        $globalEnabled = Arr::get($globalSettings, 'messaging_email_frequency') == 'hourly';

        if (!$globalEnabled) {
            // Check if any user has any hourly email notification set
            $isEnabled = NotificationSubscription::query()->where('notification_type', 'message_email_frequency')
                ->where('is_read', 1)
                ->exists();

            if (!$isEnabled) {
                return false;
            }
        }

        $hourlySentConfig = Utility::getOption('last_messaging_hourly_sent_config', false);

        if (!$hourlySentConfig) {
            $hourlySentConfig = [];
        }

        $lastScheduled = Arr::get($hourlySentConfig, 'last_started_at');
        if (!$lastScheduled) {
            $lastScheduled = date('Y-m-d H:i:s', current_time('timestamp') - 3600);
        }

        $hourlySentConfig['last_started_at'] = current_time('mysql');
        Utility::updateOption('last_messaging_hourly_sent_config', $hourlySentConfig);

        if (!$this->hasUnreadMessages($lastScheduled, $globalEnabled, 1)) { // 1 for hourly
            return false;
        }

        if (!as_next_scheduled_action('fluent_community_messaging_send_hourly_emails', [], 'fluent-community')) {
            // Let's check if we have the hourly email action scheduled or not
            $timestamp = time() + 5; // schedule just after 5 seconds

            \as_schedule_single_action($timestamp, 'fluent_community_messaging_send_hourly_emails', [
                $lastScheduled
            ], 'fluent-community', true);
        }

        return true;
    }

    public function sendHourlyEmails($lastDateTime = '')
    {
        if (!$this->isEnabled()) {
            return false;
        }

        if (!$this->maxRunTime) {
            $this->maxRunTime = Utility::getMaxRunTime();
        }

        $hourlySentConfig = Utility::getOption('last_messaging_hourly_sent_config', false);

        if (!$hourlySentConfig) {
            $hourlySentConfig = [];
        }

        if(!$lastDateTime) {
            $lastDateTime = date('Y-m-d H:i:s', current_time('timestamp') - 3600);
        }

        $lastSentCompleted = Arr::get($hourlySentConfig, 'sent_at', date('Y-m-d H:i:s', current_time('timestamp') - 3600)); //  1 hour ago
        if (current_time('timestamp') - strtotime($lastSentCompleted) < 1800) {
            return false; // we don't wanna send notification in less than 30 minutes
        }

        $lastUserId = Arr::get($hourlySentConfig, 'last_user_id', 0);

        $globalSettings = ChatHelper::getMessagingConfig();
        $globalEnabled = Arr::get($globalSettings, 'messaging_email_frequency') == 'hourly';

        $userIds = $this->getUnreadMessagesUserIds($lastDateTime, $globalEnabled, 1, $lastUserId, 100);

        if (!$userIds) {
            $hourlySentConfig['sent_at'] = current_time('mysql');
            $hourlySentConfig['last_id'] = 0;
            Utility::updateOption('last_messaging_hourly_sent_config', $hourlySentConfig);
            // It's done
            return true;
        }

        $startAt = microtime(true);
        $maxSendPerSecond = 10;
        $sentCount = 0;

        foreach ($userIds as $userId) {
            $hourlySentConfig['last_user_id'] = $userId;
            Utility::updateOption('last_messaging_hourly_sent_config', $hourlySentConfig);
            $result = (new EmailNotificationMail($userId, $lastDateTime))->send();
            $sentCount++;

            if (microtime(true) - FLUENT_COMMUNITY_START_TIME > $this->maxRunTime) {
                // It's been 45 seconds, let's stop and schedule the next one and schedule a new one
                as_schedule_single_action(time(), 'fluent_community_messaging_send_hourly_emails', [$lastDateTime], 'fluent-community', false);
                return true;
            }

            if ($sentCount % $maxSendPerSecond === 0) {
                $timeTaken = microtime(true) - $startAt;
                if ($timeTaken < 1) {
                    usleep((int)(1000000 - ($timeTaken * 1000000)));
                }

                $startAt = microtime(true);
            }
        }

        return $this->sendHourlyEmails($lastDateTime);
    }

    public function maybeInitDailyMessagingEmails()
    {
        $globalSettings = ChatHelper::getMessagingConfig();
        if ($globalSettings['messaging_email_status'] !== 'yes') {
            return; // globally disabled
        }
        $globalFrequency = Arr::get($globalSettings, 'messaging_email_frequency');
        $this->maybeScheuleWeeklyEmail($globalFrequency);
        $globalEnabled = $globalFrequency === 'daily';

        if (!$globalEnabled) {
            // Check if any user has any hourly email notification set
            $isEnabled = NotificationSubscription::query()->where('notification_type', 'message_email_frequency')
                ->where('is_read', 2) // 2 means daily
                ->exists();

            if (!$isEnabled) {
                return;
            }
        }

        $sentConfig = Utility::getOption('last_messaging_daily_sent_config', false);

        $lastScheduled = Arr::get($sentConfig, 'last_started_at');
        if (!$lastScheduled) {
            $lastScheduled = date('Y-m-d H:i:s', current_time('timestamp') - 86400);  // in the last 24 hours
        }

        $hourlySentConfig['last_started_at'] = current_time('mysql');
        Utility::updateOption('last_messaging_daily_sent_config', $hourlySentConfig);

        if (!$this->hasUnreadMessages($lastScheduled, $globalEnabled, 2)) { // 2 for daily
            return false;
        }

        if (!as_next_scheduled_action('fluent_community_messaging_send_daily_emails', [], 'fluent-community')) {
            // Let's check if we have the hourly email action scheduled or not
            $timestamp = time() + 120; // schedule just after 2 minutes
            \as_schedule_single_action($timestamp, 'fluent_community_messaging_send_daily_emails', [$lastScheduled], 'fluent-community', true);
        }

        return true;
    }

    public function sendDailyEmails($lastDateTime = '')
    {
        if (!$this->isEnabled()) {
            return false;
        }

        if (!$this->maxRunTime) {
            $this->maxRunTime = Utility::getMaxRunTime();
        }

        $sentConfig = Utility::getOption('last_messaging_daily_sent_config', false);

        if (!$sentConfig) {
            $sentConfig = [];
        }

        if(!$lastDateTime) {
            $lastDateTime = date('Y-m-d H:i:s', current_time('timestamp') - 86400);
        }

        if (current_time('timestamp') - strtotime($lastDateTime) < 82800) { // 23 hours
            return false; // we don't wanna send notification in less than 23 hours
        }

        $lastUserId = Arr::get($sentConfig, 'last_user_id', 0);
        $globalSettings = ChatHelper::getMessagingConfig();
        $globalEnabled = Arr::get($globalSettings, 'messaging_email_frequency') == 'daily';

        $userIds = $this->getUnreadMessagesUserIds($lastDateTime, $globalEnabled, 2, $lastUserId, 100); // 2 for the daily

        if (!$userIds) {
            $sentConfig['sent_at'] = current_time('mysql');
            $sentConfig['last_user_id'] = 0;
            Utility::updateOption('last_messaging_daily_sent_config', $sentConfig);
            return false;
        }

        $startAt = microtime(true);
        $maxSendPerSecond = 10;
        $sentCount = 0;

        foreach ($userIds as $userId) {
            $sentConfig['last_user_id'] = $userId;
            Utility::updateOption('last_messaging_daily_sent_config', $sentConfig);
            (new EmailNotificationMail($userId, $lastDateTime))->send();
            $sentCount++;

            if (microtime(true) - FLUENT_COMMUNITY_START_TIME > $this->maxRunTime) {
                // It's been 45 seconds, let's stop and schedule the next one and schedule a new one
                as_schedule_single_action(time(), 'fluent_community_messaging_send_daily_emails', [$lastDateTime], 'fluent-community', false);
                return true;
            }

            if ($sentCount % $maxSendPerSecond === 0) {
                $timeTaken = microtime(true) - $startAt;
                if ($timeTaken < 1) {
                    usleep((int)(1000000 - ($timeTaken * 1000000)));
                }
                $startAt = microtime(true);
            }
        }

        return $this->sendDailyEmails($lastDateTime);
    }

    private function maybeScheuleWeeklyEmail($globalFrequency)
    {
        if (\as_next_scheduled_action('fluent_community_messaging_send_weekly_emails', [], 'fluent-community')) {
            return;
        }

        $globalEnabled = $globalFrequency === 'weekly';
        $isEnabled = true;

        if (!$globalEnabled) {
            // Check if any user has any hourly email notification set
            $isEnabled = NotificationSubscription::query()->where('notification_type', 'message_email_frequency')
                ->where('is_read', 3) // 2 means weekly
                ->exists();
        }

        if (!$isEnabled) {
            // unset the scheduled action if any
            if (\as_next_scheduled_action('fluent_community_messaging_send_weekly_emails', [], 'fluent-community')) {
                \as_unschedule_all_actions('fluent_community_messaging_send_weekly_emails', [], 'fluent-community');
            }
        }

        // Let's schedule at the next monday
        $nextMonday = strtotime('next Monday at 09:00', current_time('timestamp'));

        if ($nextMonday) {
            \as_schedule_single_action($nextMonday, 'fluent_community_messaging_send_weekly_emails', [], 'fluent-community', true);
        }
    }

    public function sendWeeklyEmails()
    {
        if (!$this->isEnabled()) {
            return false;
        }

        if (!$this->maxRunTime) {
            $this->maxRunTime = Utility::getMaxRunTime();
        }

        $sentConfig = Utility::getOption('last_messaging_weekly_sent_config', false);

        if (!$sentConfig) {
            $sentConfig = [];
        }

        $lastDateTime = Arr::get($sentConfig, 'sent_at', date('Y-m-d H:i:s', current_time('timestamp') - 604800)); //  7 days ago
        if (current_time('timestamp') - strtotime($lastDateTime) < 518400) { // 6 days
            return false; // we don't wanna send notification in less than 6 days
        }

        $lastUserId = Arr::get($sentConfig, 'last_user_id', 0);
        $globalSettings = ChatHelper::getMessagingConfig();
        $globalEnabled = Arr::get($globalSettings, 'messaging_email_frequency') == 'weekly';

        $userIds = $this->getUnreadMessagesUserIds($lastDateTime, $globalEnabled, 3, $lastUserId, 100); // 3 for the daily

        if (!$userIds) {
            // It's done
            Utility::updateOption('last_messaging_weekly_sent_config', [
                'sent_at'      => current_time('mysql'),
                'last_user_id' => 0
            ]);
            return false;
        }

        $startAt = microtime(true);
        $maxSendPerSecond = 10;
        $sentCount = 0;

        foreach ($userIds as $userId) {
            $sentConfig['last_user_id'] = $userId;
            Utility::updateOption('last_messaging_weekly_sent_config', $sentConfig);
            (new EmailNotificationMail($userId, $lastDateTime))->send();
            $sentCount++;

            if (microtime(true) - FLUENT_COMMUNITY_START_TIME > $this->maxRunTime) {
                // It's been 45 seconds, let's stop and schedule the next one and schedule a new one
                as_schedule_single_action(time(), 'fluent_community_messaging_send_weekly_emails', [], 'fluent-community', false);
                return true;
            }

            if ($sentCount % $maxSendPerSecond === 0) {
                $timeTaken = microtime(true) - $startAt;
                if ($timeTaken < 1) {
                    usleep((int)(1000000 - ($timeTaken * 1000000)));
                }
                $startAt = microtime(true);
            }
        }

        return $this->sendWeeklyEmails();
    }

    private function hasUnreadMessages($lastDateTime, $globalEnabled, $prefFlag = 1)
    {
        return ThreadUser::query()
            ->join('fcom_chat_messages', 'fcom_chat_thread_users.thread_id', '=', 'fcom_chat_messages.thread_id')
            ->where('fcom_chat_messages.created_at', '>', $lastDateTime)
            ->where(function ($query) {
                $query->whereNull('fcom_chat_thread_users.last_seen_message_id')
                    ->orWhereColumn('fcom_chat_thread_users.last_seen_message_id', '<', 'fcom_chat_messages.id');
            })
            ->when($globalEnabled, function ($query) use ($prefFlag) { // we are exclusively checking if user enabled other than hourly
                $query->whereDoesntHave('email_notification_pref', function ($query) use ($prefFlag) {
                    $query->where('is_read', '!=', $prefFlag); // this is for hourly
                });
            })
            ->when(!$globalEnabled, function ($query) use ($prefFlag) { // we are explicitly checking if user enabled hourly or not
                $query->whereHas('email_notification_pref', function ($query) use ($prefFlag) {
                    $query->where('is_read', $prefFlag); // this is for hourly
                });
            })
            ->where('fcom_chat_thread_users.status', 'active')
            ->exists();
    }

    private function getUnreadMessagesUserIds($lastDateTime, $globalEnabled, $prefFlag, $lastSentUserId, $limit)
    {
        global $wpdb;
        $userIds = ThreadUser::query()
            ->join('fcom_chat_messages', 'fcom_chat_thread_users.thread_id', '=', 'fcom_chat_messages.thread_id')
            ->where('fcom_chat_messages.created_at', '>', $lastDateTime)
            ->where(function ($query) {
                $query->whereNull('fcom_chat_thread_users.last_seen_message_id')
                    ->orWhereColumn('fcom_chat_thread_users.last_seen_message_id', '<', 'fcom_chat_messages.id');
            })
            ->when($globalEnabled, function ($query) use ($prefFlag) { // we are exclusively checking if user enabled other than hourly
                $query->whereDoesntHave('email_notification_pref', function ($query) use ($prefFlag) {
                    $query->where('is_read', '!=', $prefFlag); // this is for hourly
                });
            })
            ->when(!$globalEnabled, function ($query) use ($prefFlag) { // we are explicitly checking if user enabled hourly or not
                $query->whereHas('email_notification_pref', function ($query) use ($prefFlag) {
                    $query->where('is_read', $prefFlag); // this is for hourly
                });
            })
            ->where('fcom_chat_thread_users.status', 'active')
            ->whereHas('thread', function ($query) {
                $query->where('status', 'active')
                    ->whereNull('space_id');
            })
            ->when($lastSentUserId, function ($query) use ($lastSentUserId) {
                $query->where('fcom_chat_thread_users.user_id', '>', $lastSentUserId);
            })
            ->select('fcom_chat_thread_users.user_id') // Select only user_id
            ->distinct() // Apply DISTINCT on the selected column
            ->orderBy('fcom_chat_thread_users.user_id', 'ASC')
            ->limit($limit)
            ->get()
            ->pluck('user_id')
            ->toArray();

        return $userIds;
    }

    private function isEnabled()
    {
        $config = ChatHelper::getMessagingConfig();

        return $config['messaging_email_status'] === 'yes';
    }
}

