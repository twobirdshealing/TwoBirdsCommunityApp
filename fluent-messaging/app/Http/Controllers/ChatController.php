<?php

namespace FluentMessaging\App\Http\Controllers;

use FluentCommunity\App\Functions\Utility;
use FluentCommunity\App\Services\FeedsHelper;
use FluentMessaging\App\Models\Message;
use FluentMessaging\App\Models\Thread;
use FluentMessaging\App\Models\ThreadUser;
use FluentMessaging\App\Services\ChatHelper;
use FluentMessaging\App\Services\PusherHelper;
use FluentCommunity\App\Http\Controllers\Controller;
use FluentCommunity\App\Models\Space;
use FluentCommunity\App\Models\BaseSpace;
use FluentCommunity\App\Models\User;
use FluentCommunity\App\Models\XProfile;
use FluentCommunity\App\Models\SpaceUserPivot;
use FluentCommunity\App\Services\Helper;
use FluentCommunity\App\Services\ProfileHelper;
use FluentCommunity\Framework\Http\Request\Request;
use FluentCommunity\Framework\Support\Arr;

class ChatController extends Controller
{
    public function getThreads(Request $request)
    {
        $userId = get_current_user_id();
        $selectedThread = null;
        $intendedObject = null;

        if ($preSelected = $request->get('pre_selected', [])) {
            $selectedId = (int)Arr::get($preSelected, 'id');
            $selectedType = sanitize_text_field(Arr::get($preSelected, 'type'));
            if ($selectedType == 'user') {
                // check if there has already a thread between these two users
                $selectedThread = ChatHelper::getUserToUserThread($userId, $selectedId);

                if (!$selectedThread) {
                    $intendedObject = XProfile::find($selectedId);
                    if ($intendedObject) {
                        $intendedObject = [
                            'id'    => $intendedObject->user_id,
                            'title' => $intendedObject->display_name,
                            'photo' => $intendedObject->avatar,
                            'type'  => 'user'
                        ];
                    }
                }

            } else if ($selectedType == 'community') {
                $selectedThread = $this->maybeCreateCommunityThread($selectedId, $userId);
            }
        }

        $userSpaceIds = Helper::getUserSpaceIds();

        if ($userSpaceIds) {
            $missingThreads = Thread::whereIn('space_id', $userSpaceIds)
                ->whereDoesntHave('thread_users', function ($q) use ($userId) {
                    $q->where('user_id', $userId);
                })
                ->get();
            foreach ($missingThreads as $missingThread) {
                ThreadUser::create([
                    'thread_id' => $missingThread->id,
                    'user_id'   => $userId
                ]);
            }

            // Maybe delete the threadUsers that are not in the userSpaceIds
            $extraThreadIds = Thread::whereNotIn('space_id', $userSpaceIds)
                ->whereHas('thread_users', function ($q) use ($userId) {
                    $q->where('user_id', $userId);
                })
                ->pluck('id');

            if ($extraThreadIds) {
                ThreadUser::where('user_id', $userId)
                    ->whereIn('thread_id', $extraThreadIds)
                    ->delete();
            }
        }

        $search = $request->getSafe('search');

        $communityThreadsQuery = Thread::whereIn('space_id', $userSpaceIds)
            ->with(['space' => function ($q) {
                return $q;
            }, 'messages'   => function ($q) {
                $q->latest()->limit(1);
            }])
            ->where('status', 'active');

        if ($search) {
            $communityThreadsQuery->where('title', 'LIKE', "%{$search}%");
        }

        $communityThreads = $communityThreadsQuery->orderBy('updated_at', 'DESC')
            ->get();

        $threadsQuery = Thread::whereHas('users', function ($q) use ($userId) {
            $q->where('user_id', $userId);
        })
            ->with(['xprofiles' => function ($q) {
                return $q;
            }, 'messages'       => function ($q) {
                $q->latest()->limit(1);
            }])
            ->whereNull('space_id');

        if ($search) {
            $threadsQuery->where('title', 'LIKE', "%{$search}%");
        }

        $threads = $threadsQuery->orderBy('updated_at', 'DESC')
            ->get();

        $returnData = [
            'community_threads' => $communityThreads,
            'threads'           => $threads
        ];

        if ($preSelected) {
            if ($selectedThread) {
                $returnData['selected_thread'] = $selectedThread;
            } else if ($intendedObject) {
                $returnData['intended_object'] = $intendedObject;
            }
        }

        return $returnData;
    }

    public function getThread(Request $request, $id)
    {
        $thread = Thread::where('id', $id)->where('status', 'active')->first();

        if (!$thread) {
            return $this->sendError([
                'message' => __('This chat thread could not be found or is no longer active', 'fluent-messaging')
            ]);
        }

        if (!ChatHelper::hasChatAccess($thread, get_current_user_id())) {
            return $this->sendError([
                'message' => __('You are not allowed to view this thread', 'fluent-messaging')
            ]);
        }

        return [
            'thread' => $thread
        ];
    }

    public function getMessages(Request $request, $threadId)
    {
        $thread = Thread::findOrFail($threadId);

        if ($thread->space_id && $thread->status != 'active') {
            return $this->sendError([
                'message' => __('This chat thread could not be found or is no longer active', 'fluent-messaging')
            ]);
        }

        $currentUserId = get_current_user_id();

        if (!ChatHelper::hasChatAccess($thread, $currentUserId)) {
            return $this->sendError([
                'message' => __('You are not allowed to view this thread', 'fluent-messaging')
            ]);
        }

        $currentUser = $this->getUser();

        $returnData = [];

        if ($request->get('page') == 1) {
            $details = [
                'id' => $thread->id
            ];

            if ($thread->space_id) {
                $details['title'] = $thread->space->title;
                $details['photo'] = $thread->space->logo;
                $details['space_id'] = $thread->space_id;
                $details['slug'] = $thread->space->slug;
                $details['type'] = 'community';
                $details['emoji'] = Arr::get($thread->space->settings, 'emoji');
                $details['shape_svg'] = Arr::get($thread->space->settings, 'shape_svg');
                $details['leave_thread'] = false;
                $hideMembersCount = Arr::get($thread->space->settings, 'hide_members_count') === 'yes';
                $canViewMembers = $currentUser && $thread->space->verifyUserPermisson($currentUser, 'can_view_members', false);

                if ($hideMembersCount && !$canViewMembers) {
                    $details['total_members'] = 0;
                } else {
                    $totalMembers = $thread->space->x_members()->count();
                    $inactiveMembers = ThreadUser::where('thread_id', $thread->id)->where('status', 'inactive')->count();
                    $details['total_members'] = $totalMembers - $inactiveMembers;
                }

                $details['url'] = Helper::baseUrl('space/' . $thread->space->slug . '/home');
                $details['is_admin'] = $thread->space->isAdmin($currentUserId);
            } else {
                $otherUser = $thread->getOtherProfile($currentUserId);

                $canViewLastActivity = Utility::getPrivacySetting('show_last_activity') === 'yes' || Helper::isModerator();

                $isOtherUserActive = ThreadUser::where('thread_id', $thread->id)
                    ->where('user_id', '!=', $currentUserId)
                    ->where('status', 'active')
                    ->whereHas('xprofile', function ($q) {
                        $q->where('status', 'active');
                    })
                    ->first();

                $details = $isOtherUserActive ? [
                    'id'            => $thread->id,
                    'title'         => $otherUser->display_name,
                    'photo'         => $otherUser->avatar,
                    'user_id'       => $otherUser->user_id,
                    'username'      => $otherUser->username,
                    'type'          => 'user',
                    'created_at'    => $otherUser->created_at,
                    'last_activity' => $canViewLastActivity ? $otherUser->last_activity : '',
                    'description'   => $otherUser->short_description,
                    'is_verified'   => $otherUser->is_verified,
                    'url'           => Helper::baseUrl('u/' . $otherUser->username)
                ] : [
                    'unavailable_user' => true
                ];
            }

            if ($thread->space_id) {
                $inactiveThreadUser = ThreadUser::where('thread_id', $threadId)
                    ->where('user_id', $currentUserId)
                    ->where('status', '!=', 'active')
                    ->first();

                if ($inactiveThreadUser) {
                    $details['leave_thread'] = true;
                    $returnData['threadDetails'] = $details;
                    return $returnData;
                }
            }

            if (!$thread->space_id) {
                $blockedThreadUser = ThreadUser::where('thread_id', $threadId)
                    ->where('user_id', $currentUserId)
                    ->where('status', 'blocked')
                    ->first();

                if ($blockedThreadUser) {
                    $details['blocked_thread'] = true;
                }
            }

            $returnData['threadDetails'] = $details;

            ChatHelper::markThreadRead($thread, [$currentUserId]);
        }

        $messages = Message::orderBy('id', 'DESC')->with(['xprofile' => function ($q) {
            $q->select(ProfileHelper::getXProfilePublicFields());
        }])->where('thread_id', $threadId)
            ->orderBy('id', 'DESC')
            ->paginate();

        $returnData['messages'] = $messages;

        return $returnData;
    }

    public function getNewMessages(Request $request, $threadId)
    {
        $thread = Thread::findOrFail($threadId);
        $lastId = $request->get('last_id');

        if (!ChatHelper::hasChatAccess($thread, get_current_user_id())) {
            return $this->sendError([
                'message' => __('You are not allowed to view this thread', 'fluent-messaging')
            ]);
        }

        $messages = Message::orderBy('id', 'DESC')->with(['xprofile' => function ($q) {
            $q->select(ProfileHelper::getXProfilePublicFields());
        }])
            ->where('thread_id', $threadId)
            ->where('id', '>', $lastId)
            ->orderBy('id', 'ASC')
            ->get();

        return [
            'messages' => $messages
        ];
    }

    public function addMessage(Request $request, $theadId)
    {
        $thread = Thread::where('id', $theadId)->where('status', 'active')->firstOrFail();

        if (!ChatHelper::hasChatAccess($thread, get_current_user_id())) {
            return $this->sendError([
                'message' => __('You are not allowed to view this thread', 'fluent-messaging')
            ]);
        }

        $activeUser = ThreadUser::where('thread_id', $thread->id)
            ->where('user_id', get_current_user_id())
            ->where('status', 'active')
            ->whereHas('xprofile', function ($q) {
                $q->where('status', 'active');
            })
            ->first();

        if (!$activeUser) {
            return $this->sendError([
                'message' => __('You are not allowed to send messages in this thread', 'fluent-messaging')
            ]);
        }

        $textRule = 'required|min:1|max:5000';

        $mediaImages = $request->get('mediaItems', []);

        if ($mediaImages) {
            $textRule = 'nullable|min:1|max:5000';
        }

        $data = $this->validate($request->get(), [
            'text'       => $textRule,
            'reply_to'   => 'nullable|numeric',
            'reply_text' => 'nullable|min:1|max:5000'
        ]);

        $message = $this->basicMarkdown(sanitize_textarea_field(Arr::get($data, 'text')));

        if ($message) {
            $message = '<div class="chat_text">' . $message . '</div>';
        }

        if ($mediaImages) {
            $mediaItems = Helper::getMediaItemsFromUrl($mediaImages);

            $mediaHtml = '';
            foreach ($mediaItems as $mediaItem) {
                $mediaItem->object_source = 'chat_message';
                $mediaItem->feed_id = $thread->id;
                $mediaItem->is_active = 1;
                $mediaItem->user_id = $this->getUserId();
                $mediaItem->save();
                $mediaHtml .= '<div class="chat_media"><img src="' . $mediaItem->media_url . '" alt="Image shared in chat"></div>';
            }

            if ($mediaHtml) {
                $message .= '<div class="chat_medias">' . $mediaHtml . '<div class="chat_media_overlay"></div></div>';
            }
        }

        $message = [
            'thread_id' => $theadId,
            'text'      => $message,
        ];

        $replyTo = intval(Arr::get($data, 'reply_to'));

        $replyText = wp_kses_post(Arr::get($data, 'reply_text'));

        if ($replyTo) {
            $message['meta'] = [
                'reply_to'   => $replyTo,
                'reply_text' => $replyText
            ];
        }

        $message = Message::create($message);

        ThreadUser::where('user_id', $this->getUserId())
            ->where('thread_id', $thread->id)
            ->update([
                'last_seen_message_id' => $message->id
            ]);

        if ($lastMessageId = $request->get('last_message_id')) {
            $messages = Message::orderBy('id', 'DESC')->with(['xprofile' => function ($q) {
                $q->select(ProfileHelper::getXProfilePublicFields());
            }])
                ->where('thread_id', $thread->id)
                ->where('id', '>', $lastMessageId)
                ->orderBy('id', 'ASC')
                ->get()
                ->toArray();

            return [
                'new_messages' => $messages
            ];
        }

        $message->load(['xprofile']);

        $returnMessage = $message->toArray();

        $returnMessage['xprofile'] = $message->xprofile;

        if ($message->space_id) {
            PusherHelper::sendMessage('private-chat_space_' . $message->space_id, 'new_message', [
                'message' => $returnMessage
            ]);
        } else {
            foreach ($message->thread->users as $user) {
                if ($user->ID == get_current_user_id()) {
                    continue;
                }
                PusherHelper::sendMessage('private-chat_user_' . $user->ID, 'new_message', [
                    'message' => $returnMessage
                ]);
            }
        }

        return [
            'message' => $returnMessage
        ];
    }

    public function deleteMessage(Request $request, $messageId)
    {
        $message = Message::findOrFail($messageId);

        if (!ChatHelper::hasChatAccess($message->thread, get_current_user_id())) {
            return $this->sendError([
                'message' => __('You are not allowed to view this thread', 'fluent-messaging')
            ]);
        }

        if ($message->user_id != get_current_user_id()) {
            return $this->sendError([
                'message' => __('You are not allowed to delete this message', 'fluent-messaging')
            ]);
        }

        do_action('fluent_chat/before_delete_message', $message);

        $message->delete();

        do_action('fluent_chat/after_delete_message', $message);

        return [
            'success' => true,
            'message' => 'Message deleted successfully'
        ];
    }

    public function createThread(Request $request)
    {
        $request->validate([
            'title' => 'required|min:1|max:5000'
        ]);

        $space = Space::findOrFail($request->get('space_id'));

        if (!Helper::isUserInSpace(get_current_user_id(), $request->get('space_id'))) {
            return $this->sendError([
                'message' => __('You are not allowed to create thread in this community', 'fluent-messaging')
            ]);
        }

        if (Thread::where('space_id', $space->id)->first()) {
            return $this->sendError([
                'message' => __('Thread already exist in this community', 'fluent-messaging')
            ]);
        }

        $thread = Thread::create([
            'space_id' => $space->id,
            'title'    => $request->get('title'),
            'slug'     => sanitize_title($request->get('title'))
        ]);

        return [
            'thread' => $thread
        ];
    }

    public function broadcastAuth(Request $request)
    {
        $pusher = PusherHelper::getPusher();

        $socketId = $request->get('socket_id');
        $channelName = $request->get('channel_name');

        if (!ChatHelper::userCanAccessChannel($channelName)) {
            return $this->sendError([
                'status' => false
            ], 422);
        }

        $auth = $pusher->authorizeChannel($channelName, $socketId);
        $auth = json_decode($auth, true);

        return $this->send([
            'auth' => $auth['auth']
        ]);
    }

    public function createIntendedThread(Request $request)
    {
        $data = $request->get();

        $data = $this->validate($data, [
            'message'     => 'required|min:1|max:5000',
            'intent_id'   => 'required|integer',
            'intent_type' => 'required|in:user,community'
        ]);

        $intentType = sanitize_text_field($data['intent_type']);
        $currentUser = wp_get_current_user();

        $message = sanitize_textarea_field($data['message']);
        $message = str_replace(PHP_EOL, '<br />', $message);

        $intentId = (int)$data['intent_id'];

        if ($intentType == 'user') {
            if ($intentId == get_current_user_id()) {
                return $this->sendError([
                    'message' => __('You can not create thread with yourself', 'fluent-messaging')
                ]);
            }

            $selectedThread = ChatHelper::getUserToUserThread($data['intent_id'], get_current_user_id());

            if ($selectedThread) {

                // Let's create the first message
                Message::create([
                    'thread_id' => $selectedThread->id,
                    'user_id'   => $currentUser->ID,
                    'text'      => $message
                ]);

                $selectedThread->load(['xprofiles']);

                return [
                    'thread' => $selectedThread
                ];
            }

            if (!ChatHelper::canInitiateMessage($this->getUser())) {
                return $this->sendError([
                    'message' => __('You are not allowed to initiate a message', 'fluent-messaging')
                ]);
            }

            $targetUser = User::findOrFail($intentId);

            // Let's create the thread
            $thread = Thread::create([
                'title'  => 'Chat between ' . $targetUser->display_name . ' & ' . $currentUser->display_name,
                'status' => 'active'
            ]);

            $thread->users()->attach([$targetUser->ID, $currentUser->ID]);

            // Let's create the first message
            Message::create([
                'thread_id' => $thread->id,
                'user_id'   => $currentUser->ID,
                'text'      => $message
            ]);

            $thread->load(['xprofiles']);

            PusherHelper::sendMessage('private-chat_user_' . $targetUser->ID, 'new_thread', [
                'thread' => $thread
            ]);

            return [
                'thread' => $thread,
                'is_new' => true
            ];
        }

    }

    public function getUnreadThreadIds()
    {
        $ids = ChatHelper::getUnreadThreadIds(get_current_user_id());

        $idObje = [];

        foreach ($ids as $id) {
            $idObje[$id] = 1;
        }

        if (!$idObje) {
            $idObje = (object)[];
        }

        return [
            'unread_threads' => $idObje
        ];
    }

    public function markThreadRead(Request $request)
    {
        $threadIds = $request->get('thread_ids', []);

        $threads = Thread::whereIn('id', $threadIds)->get();

        foreach ($threads as $thread) {
            ChatHelper::markThreadRead($thread, [get_current_user_id()]);
        }

        return [
            'success' => true
        ];
    }

    private function maybeCreateCommunityThread($communityId, $userId)
    {

        $space = BaseSpace::find($communityId);

        if (!$space) {
            return false;
        }

        if (!Helper::isUserInSpace($userId, $communityId)) {
            return false;
        }

        $exist = Thread::where('space_id', $communityId)->first();

        if ($exist) {
            // check if the user is in the thread
            $threadUser = ThreadUser::where('thread_id', $exist->id)
                ->where('user_id', $userId)
                ->first();

            if ($threadUser) {
                return $exist;
            }

            // create the connection
            ThreadUser::create([
                'thread_id' => $exist->id,
                'user_id'   => $userId
            ]);

            return $exist;
        }

        $thread = Thread::create([
            'space_id' => $space->id,
            'title'    => $space->title
        ]);

        ThreadUser::create([
            'thread_id' => $thread->id,
            'user_id'   => $userId
        ]);

        return $thread;
    }

    public function getOtherUsers(Request $request)
    {
        $userId = $request->get('user_id');
        $userId = $userId ? (int)$userId : get_current_user_id();
        $search = $request->getSafe('search');
        $threadId = $request->get('thread_id');

        if ($threadId) {
            $thread = Thread::findOrFail($threadId);
            if (!ChatHelper::hasChatAccess($thread, get_current_user_id())) {
                return $this->sendError([
                    'message' => __('You are not allowed to view this thread members', 'fluent-messaging')
                ]);
            }
        }

        $query = XProfile::where('user_id', '!=', $userId)
            ->whereHas('user')
            ->where('status', 'active')
            ->select(ProfileHelper::getXProfilePublicFields())
            ->orderBy('last_activity', 'DESC')
            ->limit(50);

        if ($search) {
            $query->searchBy($search);
        }

        $latestUsers = $query->get();

        return [
            'users' => $latestUsers,
        ];
    }

    private function basicMarkdown($markdown_text)
    {
        return FeedsHelper::mdToHtml($markdown_text);
    }

    public function getThreadMembers(Request $request, $threadId)
    {
        $thread = Thread::findOrFail($threadId);

        if (!ChatHelper::hasChatAccess($thread, get_current_user_id())) {
            return $this->sendError([
                'message' => __('You are not allowed to view this thread members', 'fluent-messaging')
            ]);
        }

        $inactiveMemberIds = ThreadUser::where('thread_id', $threadId)
            ->where('status', 'inactive')
            ->pluck('user_id');

        $spaceMembers = SpaceUserPivot::bySpace($thread->space_id)
            ->with(['xprofile' => function ($q) {
                $q->select(ProfileHelper::getXProfilePublicFields());
            }])
            ->where('status', 'active')
            ->whereNotIn('user_id', $inactiveMemberIds)
            ->paginate();

        return [
            'members' => $spaceMembers
        ];
    }

    public function joinThread($threadId)
    {
        $thread = Thread::where('id', $threadId)->where('space_id', '!=', null)->firstOrFail();

        $inactiveThreadUser = ThreadUser::where('thread_id', $thread->id)
            ->where('user_id', get_current_user_id())
            ->where('status', 'inactive')
            ->first();

        if ($inactiveThreadUser) {
            $inactiveThreadUser->update([
                'status' => 'active'
            ]);
        }

        return [
            'success' => $inactiveThreadUser ? true : false,
            'message' => $inactiveThreadUser ? __('You have joined the thread', 'fluent-messaging') : __('You are already in this thread', 'fluent-messaging')
        ];
    }

    public function leaveThread($threadId)
    {
        $thread = Thread::where('id', $threadId)->where('space_id', '!=', null)->firstOrFail();

        $activeThreadUser = ThreadUser::where('thread_id', $thread->id)
            ->where('user_id', get_current_user_id())
            ->where('status', 'active')
            ->first();

        if ($activeThreadUser) {
            $activeThreadUser->update([
                'status' => 'inactive'
            ]);
        }

        return [
            'success' => $activeThreadUser ? true : false,
            'message' => $activeThreadUser ? __('You have left the thread', 'fluent-messaging') : __('You are not in this thread', 'fluent-messaging')
        ];
    }

    public function blockUser($threadId)
    {
        $thread = Thread::where('id', $threadId)->where('space_id', null)->firstOrFail();

        $activeThreadUser = ThreadUser::where('thread_id', $thread->id)
            ->where('user_id', get_current_user_id())
            ->where('status', 'active')
            ->first();

        if ($activeThreadUser) {
            $thread->update([
                'status' => 'inactive'
            ]);
            $activeThreadUser->update([
                'status' => 'blocked'
            ]);
        }

        return [
            'success' => $activeThreadUser ? true : false,
            'message' => $activeThreadUser ? __('You have blocked this user', 'fluent-messaging') : __('You are not in this thread', 'fluent-messaging')
        ];
    }

    public function unblockUser($threadId)
    {
        $thread = Thread::where('id', $threadId)->where('space_id', null)->firstOrFail();

        $blockedThreadUser = ThreadUser::where('thread_id', $thread->id)
            ->where('user_id', get_current_user_id())
            ->where('status', 'blocked')
            ->first();

        if ($blockedThreadUser) {
            $thread->update([
                'status' => 'active'
            ]);
            $blockedThreadUser->update([
                'status' => 'active'
            ]);
        }

        return [
            'success' => $blockedThreadUser ? true : false,
            'message' => $blockedThreadUser ? __('You have unblocked this user', 'fluent-messaging') : __('You are not in this thread', 'fluent-messaging')
        ];
    }
}
