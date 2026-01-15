<?php

namespace FluentMessaging\App\Services;

use FluentCommunity\App\Models\XProfile;
use FluentCommunity\App\Services\Helper;
use FluentCommunity\App\Services\Libs\EmailComposer;
use FluentCommunity\App\Services\Libs\Mailer;
use FluentCommunity\App\Services\ProfileHelper;
use FluentMessaging\App\Models\Thread;

class EmailNotificationMail
{
    private $userId = null;
    private $fromDateTime = null;
    private $subject = null;
    private $body = null;
    private $user = null;
    private $threads = null;

    public function __construct($userId, $fromDateTime)
    {
        $this->userId = $userId;
        $this->fromDateTime = $fromDateTime;
        $this->prepareData();
    }

    private function prepareData()
    {
        // get unread threads of the user
        $this->user = \FluentCommunity\App\Models\User::with('xprofile')->find($this->userId);
        if (!$this->user || !$this->user->xprofile || $this->user->xprofile->status != 'active') {
            return;
        }


        $this->threads = $this->getThreads();

        $threadsCount = $this->threads->count();

        if ($threadsCount == 0) {
            return;
        }

        if ($threadsCount == 1) {
            $this->subject = __('1 new message in your inbox', 'fluent-messaging');
        } else {
            $this->subject = __(sprintf('%s new messages in your inbox', $threadsCount > 10 ? ' (10+)' : '(' . $threadsCount . ')'), 'fluent-messaging');
        }

        $this->body = $this->getEmailBody();

        return $this;
    }

    public function getThreads()
    {
        $threads = Thread::whereHas('thread_users', function ($q) {
            $q->where('user_id', $this->userId)
                ->where(function ($query) {
                    $query->whereHas('thread.messages', function ($msgQuery) {
                        $msgQuery->where('created_at', '>', $this->fromDateTime)
                            ->where(function ($subQuery) {
                                $subQuery->whereNull('fcom_chat_thread_users.last_seen_message_id')
                                    ->orWhereColumn('fcom_chat_thread_users.last_seen_message_id', '<', 'fcom_chat_messages.id');
                            });
                    });
                });
        })
            ->with([
                'messages' => function ($q) {
                    $q->latest()->limit(5);
                }
            ])
            ->whereNull('space_id')
            ->where('status', 'active')
            ->orderBy('updated_at', 'DESC')
            ->limit(11)
            ->get();

        return $threads;
    }

    public function getEmailBody()
    {
        $fromattedThreadMessages = [];

        $messageUserIds = [];
        foreach ($this->threads as $thread) {
            foreach ($thread->messages as $message) {
                if ($message->user_id == $this->userId) {
                    break;
                }

                if (!isset($fromattedThreadMessages[$message->user_id])) {
                    $fromattedThreadMessages[$message->user_id] = [];
                    $messageUserIds[] = $message->user_id;
                }

                $fromattedThreadMessages[$message->user_id][] = [
                    'message'    => $message->text,
                    'thread_id'  => $message->thread_id,
                    'created_at' => $message->created_at->format('Y-m-d H:i:s'),
                    'user_id'    => $message->user_id
                ];
            }
        }

        $xprofiles = XProfile::whereIn('user_id', $messageUserIds)->get()->keyBy('user_id');


        foreach ($fromattedThreadMessages as $userId => $messages) {
            if (empty($xprofiles[$userId])) {
                unset($fromattedThreadMessages[$userId]);
                continue;
            }

            $allMessages = array_reverse($messages);
            $messagesHtml = '';
            $lastSentAt = '';
            foreach ($allMessages as $index => $message) {
                $isLast = count($allMessages) - 1 == $index;
                $lastSentAt = $message['created_at'];
                if (strlen($messagesHtml) > 800) {
                    $messagesHtml .= '....';
                    break;
                }
                if (!$isLast) {
                    $messagesHtml .= $message['message'] . ' ';
                } else {
                    $messagesHtml .= $message['message'];
                }
            }

            $fromattedThreadMessages[$userId] = [
                'prfile'       => $xprofiles[$userId],
                'message_html' => $messagesHtml,
                'last_sent_at' => human_time_diff(strtotime($lastSentAt), current_time('timestamp')),
                'permalink'    => ProfileHelper::signUserUrlWithAuthHash(Helper::baseUrl('chat?thread_id=' . $messages[0]['thread_id']), $this->userId),
            ];
        }

        if (!$fromattedThreadMessages) {
            return '';
        }

        $messagesHtml = '';

        foreach ($fromattedThreadMessages as $messages) {
            $messagesHtml .= (string)$this->generateMessageHtml([
                'permalink'   => $messages['permalink'],
                'user_avatar' => $messages['prfile']->avatar,
                'user_name'   => $messages['prfile']->display_name,
                'timestamp'   => $messages['last_sent_at'],
                'content'     => $messages['message_html'],
            ]);
        }
        
        $emailComposer = new EmailComposer();

        $emailComposer->addBlock('paragraph', sprintf(__('Hi %s,', 'fluent-community'), $this->user->xprofile->display_name));

        $thredsCount = count($fromattedThreadMessages);
        if ($thredsCount == 1) {
            $emailComposer->addBlock('paragraph', __('You have a new message waiting for you in your inbox.', 'fluent-community'));
        } else {
            $emailComposer->addBlock('paragraph', sprintf(__('You have %s new messages waiting for you in your inbox.', 'fluent-community'), $thredsCount));
        }

        $emailComposer->addBlock('html_content', $messagesHtml);
        $emailComposer->addBlock('button', __('View All Messages', 'fluent-community'), [
            'link' => ProfileHelper::signUserUrlWithAuthHash(Helper::baseUrl('chat'), $this->userId)
        ]);

        $emailComposer->setDefaultFooter();

        $html = $emailComposer->getHtml();

        $html = str_replace([
            '##email_notification_url##'
        ], [
            ProfileHelper::getSignedNotificationPrefUrl($this->userId)
        ], $html);

        return $html;
    }

    public function send()
    {
        if (!$this->subject || !$this->body) {
            return new \WP_Error('failed', __('Email subject or body is empty.', 'fluent-messaging'));
        }

        $mailer = new Mailer('', $this->subject, $this->body);
        $mailer->to($this->user->user_email, $this->user->xprofile->display_name);
        return $mailer->send();
    }

    private function generateMessageHtml($data)
    {
        ob_start();
        extract($data, EXTR_SKIP);
        include(FLUENT_MESSAGING_CHAT_DIR . 'app/Views/email/message.php');
        return ob_get_clean();
    }
}
