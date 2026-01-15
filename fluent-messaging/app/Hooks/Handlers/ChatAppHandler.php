<?php

namespace FluentMessaging\App\Hooks\Handlers;

use FluentMessaging\App\Models\Thread;
use FluentMessaging\App\Services\ChatHelper;
use FluentCommunity\App\Services\Helper;
use FluentCommunity\Framework\Support\Arr;

class ChatAppHandler
{
    /**
     * Add Custom Menu
     *
     * @return null
     */
    public function register()
    {
        add_action('fluent_community/before_header_menu_items', [$this, 'addChatMenu'], 10, 2);

        add_action('fluent_community/before_js_loaded', [$this, 'loadChatComponents']);

        add_filter('fluent_community/portal_vars', function ($vars) {
            $vars['has_chat'] = is_user_logged_in();
            if ($vars['has_chat']) {
                $vars['permissions']['can_initiate_message'] = ChatHelper::canInitiateMessage();
            }
            return $vars;
        });

        add_filter('fluent_community/mobile_menu', function ($items) {
            if (!is_user_logged_in()) {
                return $items;
            }

            $lastItem = array_pop($items);
            $items[] = [
                'permalink' => Helper::baseUrl('chat'),
                'icon_svg'  => '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.8092 16.4087C15.295 16.177 18.0717 13.3609 18.3001 9.82565C18.3448 9.13382 18.3448 8.41736 18.3001 7.72552C18.0717 4.19023 15.295 1.3742 11.8092 1.14248C10.6199 1.06343 9.3783 1.06359 8.19149 1.14248C4.70565 1.3742 1.929 4.19023 1.70053 7.72552C1.65581 8.41736 1.65581 9.13382 1.70053 9.82565C1.78374 11.1132 2.35319 12.3054 3.02358 13.3121C3.41283 14.0168 3.15595 14.8965 2.7505 15.6648C2.45817 16.2187 2.312 16.4957 2.42936 16.6958C2.54672 16.8959 2.80887 16.9023 3.33318 16.9151C4.37005 16.9403 5.06923 16.6464 5.62422 16.2371C5.939 16.005 6.09638 15.8889 6.20486 15.8756C6.31333 15.8623 6.5268 15.9502 6.95366 16.126C7.33733 16.284 7.7828 16.3815 8.19149 16.4087C9.3783 16.4876 10.6199 16.4877 11.8092 16.4087Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"></path><path d="M9.99659 9H10.0041M13.3262 9H13.3337M6.66699 9H6.67447" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
                'html'      => '<span class="fcomc_unread_badge"></span>'
            ];

            $items[] = $lastItem;
            return $items;
        });

        add_filter('fluent_community/space_header_links', function ($links, $space) {
            if (!$space->membership || !$space->membership->pivot || $space->membership->pivot->status != 'active') {
                return $links;
            }

            // Find the chat thread id
            $thread = ChatHelper::getChatThread($space->id);

            if ($thread && $thread->status == 'active') {
                $links[] = [
                    'title' => __('Chat', 'fluent-messaging'),
                    'url'   => Helper::baseUrl('chat?thread_id=' . $thread->id)
                ];
                $space->chat_thread_id = $thread->id;
            }

            return $links;
        }, 10, 2);

        add_action('fluent_community/space/created', function ($community, $data) {
            if (Arr::get($data, 'group_chat_support') != 'yes') {
                return;
            }

            // Let's create a chat thread for this community
            Thread::create([
                'space_id'      => $community->id,
                'message_count' => 0,
                'status'        => 'active',
                'title'         => $community->title,
            ]);

        }, 10, 2);

        add_action('fluent_community/space/deleted', function ($communityId) {
            $thread = ChatHelper::getChatThread($communityId);
            if ($thread) {
                $thread->deleteChatThread();
            }
        });

        add_action('fluent_community/space/updated', function ($community, $data) {
            if (!isset($data['group_chat_support'])) {
                return;
            }

            $isActive = $data['group_chat_support'] == 'yes';

            $thread = ChatHelper::getChatThread($community->id);

            if (!$isActive) {
                if ($thread) {
                    $thread->status = 'disabled';
                    $thread->save();
                }
                return;
            }

            if ($thread) {
                $thread->status = 'active';
                $thread->save();
                return true;
            }

            // create the thread
            Thread::create([
                'space_id'      => $community->id,
                'message_count' => 0,
                'status'        => 'active',
                'title'         => $community->title,
            ]);

            return true;
        }, 10, 2);

        add_filter('fluent_community/profile_view_data', function ($data, $xprofile) {
            $currentUserId = get_current_user_id();
            if (!$currentUserId || $currentUserId == $xprofile->user_id) {
                return $data;
            }

            if (!ChatHelper::canInitiateMessage()) {
                return $data;
            }

            $data['profile_nav_actions'][] = [
                'css_class' => 'fcom_chat_button fcom_route el-button fcom_primary_button',
                'title'     => __('Message', 'fluent-messaging'),
                'svg_icon'  => '<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M1.998 5.5c0-1.381 1.119-2.5 2.5-2.5h15c1.381 0 2.5 1.119 2.5 2.5v13c0 1.381-1.119 2.5-2.5 2.5h-15c-1.381 0-2.5-1.119-2.5-2.5v-13zm2.5-.5c-.276 0-.5.224-.5.5v2.764l8 3.638 8-3.636V5.5c0-.276-.224-.5-.5-.5h-15zm15.5 5.463l-8 3.636-8-3.638V18.5c0 .276.224.5.5.5h15c.276 0 .5-.224.5-.5v-8.037z"></path></g></svg>',
                'url'       => Helper::baseUrl('chat?user_id=' . $xprofile->user_id)
            ];

            return $data;
        }, 10, 2);
    }

    public function addChatMenu($auth, $context = 'headless')
    {
        if (!$auth) {
            return;
        }
        $unreadThreadCount = \FluentMessaging\App\Services\ChatHelper::getUnreadThreadCounts($auth->user_id);
        ?>
        <li class="top_menu_item fcom_desktop_only fcom_chat_notification_holder fcom_countable_notification_holder">
            <a href="<?php echo Helper::baseUrl('chat'); ?>"
               class="fcom_menu_button fcom_theme_button el-badge fcom_chat_menu item el-tooltip__trigger el-tooltip__trigger">
                <i class="el-icon">
                    <svg width="20" height="20" viewBox="0 0 20 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                            d="M11.8092 16.4087C15.295 16.177 18.0717 13.3609 18.3001 9.82565C18.3448 9.13382 18.3448 8.41736 18.3001 7.72552C18.0717 4.19023 15.295 1.3742 11.8092 1.14248C10.6199 1.06343 9.3783 1.06359 8.19149 1.14248C4.70565 1.3742 1.929 4.19023 1.70053 7.72552C1.65581 8.41736 1.65581 9.13382 1.70053 9.82565C1.78374 11.1132 2.35319 12.3054 3.02358 13.3121C3.41283 14.0168 3.15595 14.8965 2.7505 15.6648C2.45817 16.2187 2.312 16.4957 2.42936 16.6958C2.54672 16.8959 2.80887 16.9023 3.33318 16.9151C4.37005 16.9403 5.06923 16.6464 5.62422 16.2371C5.939 16.005 6.09638 15.8889 6.20486 15.8756C6.31333 15.8623 6.5268 15.9502 6.95366 16.126C7.33733 16.284 7.7828 16.3815 8.19149 16.4087C9.3783 16.4876 10.6199 16.4877 11.8092 16.4087Z"
                            stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                        <path d="M9.99659 9H10.0041M13.3262 9H13.3337M6.66699 9H6.67447" stroke="currentColor"
                              stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </i>
                <?php if ($unreadThreadCount): ?>
                    <sup class="el-badge__content fcomc_unread_badge el-badge__content--danger is-fixed">
                        <?php echo $unreadThreadCount > 10 ? '10+' : $unreadThreadCount; ?>
                    </sup>
                <?php endif; ?>
            </a>
        </li>
        <?php
    }

    public function loadChatComponents()
    {
        $xprofile = Helper::getCurrentProfile();
        if (!$xprofile) {
            return;
        }
        $isDevMode = file_exists(FLUENT_MESSAGING_CHAT_DIR . 'dist/vite_running.json');
        $styles = [];
        if ($isDevMode) {
            $scripts = [
                'http://localhost:8880/@vite/client',
                'http://localhost:8880/src/chat.js',
            ];
        } else {
            $scripts = [
                FLUENT_MESSAGING_CHAT_URL . 'dist/js/chat.js'
            ];

            $cssFile = FLUENT_MESSAGING_CHAT_URL . 'dist/chat.css';

            if (Helper::isRtl()) {
                $cssFile = FLUENT_MESSAGING_CHAT_URL . 'dist/chat.rtl.css';
            }

            $styles = [
                $cssFile
            ];
        }

        foreach ($styles as $style) {
            ?>
            <link rel="stylesheet" href="<?php echo $style; ?>?version=<?php echo FLUENT_MESSAGING_CHAT_VERSION; ?>">
            <?php
        }

        $i18n = [
            'Chat'                                                      => __('Chat', 'fluent-messaging'),
            'Delete'                                                    => __('Delete', 'fluent-messaging'),
            'sending...'                                                => __('sending...', 'fluent-messaging'),
            'Reply'                                                     => __('Reply', 'fluent-messaging'),
            'Members'                                                   => __('Members', 'fluent-messaging'),
            'Admin'                                                     => __('Admin', 'fluent-messaging'),
            'Type your message here'                                    => __('Type your message here', 'fluent-messaging'),
            'Start a chat session with %s by sending the first message' => __('Start a chat session with %s by sending the first message', 'fluent-messaging'),
            'To:'                                                       => __('To:', 'fluent-messaging'),
            'Select or search user'                                     => __('Select or search user', 'fluent-messaging'),
            'Select a user to start messaging'                          => __('Select a user to start messaging', 'fluent-messaging'),
            'Joined: %s'                                                => __('Joined: %s', 'fluent-messaging'),
            'Search...'                                                 => __('Search...', 'fluent-messaging'),
            'Uploading'                                                 => __('Uploading', 'fluent-messaging'),
            'Write a message here...'                                   => __('Write a message here...', 'fluent-messaging'),
            'Send'                                                      => __('Send', 'fluent-messaging'),
            'Confirm'                                                   => __('Confirm', 'fluent-messaging'),
            'Cancel'                                                    => __('Cancel', 'fluent-messaging'),
            '%s unread messages'                                        => __('%s unread messages', 'fluent-messaging'),
            '%s unread message'                                         => __('%s unread messa', 'fluent-messaging'),
            'Messages'                                                  => __('Messages', 'fluent-messaging'),
            'Load more messages'                                        => __('Load more messages', 'fluent-messaging'),
            'Loading...'                                                => __('Loading...', 'fluent-messaging'),
            'Active Now'                                                => __('Active Now', 'fluent-messaging'),
            'Last seen %s'                                              => __('Last seen %s', 'fluent-messaging'),
            'Last seen: %s'                                             => __('Last seen: %s', 'fluent-messaging'),
            'Sorry, you can not intiate a new message'                  => __('Sorry, you can not intiate a new message', 'fluent-messaging'),
            'Join Space'                                                => __('Join Space', 'fluent-messaging'),
            'Leave Space'                                               => __('Leave Space', 'fluent-messaging'),
            'Block User'                                                => __('Block User', 'fluent-messaging'),
            'Unblock User'                                              => __('Unblock User', 'fluent-messaging'),
            'Deleted User'                                              => __('Deleted User', 'fluent-messaging'),
            'Delete Message'                                            => __('Delete Message', 'fluent-messaging'),
            'Are you sure you want to delete this message?'             => __('Are you sure you want to delete this message?', 'fluent-messaging'),
            'Yes, I\'m sure'                                            => __('Yes, I\'m sure', 'fluent-messaging'),
            'No, cancel'                                                => __('No, cancel', 'fluent-messaging'),
            'You have left this space'                                  => __('You have left this space', 'fluent-messaging'),
            'You can join this space again by clicking the button below' => __('You can join this space again by clicking the button below', 'fluent-messaging')
        ];

        foreach ($scripts as $script) {
            ?>
            <script type="text/javascript">
                window.fcomChatVars = {
                    user: <?php echo json_encode([
                        'ID'           => $xprofile->user_id,
                        'display_name' => $xprofile->display_name,
                        'photo'        => $xprofile->avatar
                    ]); ?>,
                    rest: {
                        base_url: '<?php echo rest_url('fluent-community/v2/chat/'); ?>',
                        site_url: '<?php echo rtrim(site_url(), '/'); ?>',
                        pusherAuthUrl: '<?php echo str_replace(rtrim(site_url(), '/'), '', rest_url('fluent-community/v2/chat/broadcast/auth')); ?>',
                        nonce: '<?php echo wp_create_nonce('wp_rest'); ?>',
                        app_url: '<?php echo Helper::baseUrl(); ?>',
                    },
                    is_dev: <?php echo WP_DEBUG ? 1 : 0 ?>,
                    i18n: <?php echo json_encode($i18n); ?>,
                    can_initiate_message: <?php echo ChatHelper::canInitiateMessage() ? 1 : 0; ?>,
                }
            </script>
            <script type="module"
                    src="<?php echo $script; ?>?verson=<?php echo FLUENT_MESSAGING_CHAT_VERSION; ?>"></script>
            <?php
        }
    }
}
