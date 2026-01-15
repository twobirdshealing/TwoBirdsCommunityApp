<?php

/**
 * @var $router FluentCommunity\Framework\Http\Router
 */

$router->withPolicy(\FluentCommunity\App\Http\Policies\PortalPolicy::class)->prefix('chat')->group(function ($router) {
    $router->get('/messages/{thread_id}', 'ChatController@getMessages')->int('thread_id');
    $router->post('/messages/{thread_id}', 'ChatController@addMessage')->int('thread_id');
    $router->post('/messages/delete/{message_id}', 'ChatController@deleteMessage')->int('message_id');
    $router->get('/messages/{thread_id}/new', 'ChatController@getNewMessages')->int('thread_id');

    $router->get('/broadcast/auth', 'ChatController@broadcastAuth');
    $router->post('/broadcast/auth', 'ChatController@broadcastAuth');

    $router->get('threads', 'ChatController@getThreads');
    $router->post('threads', 'ChatController@createIntendedThread');

    $router->get('unread_threads', 'ChatController@getUnreadThreadIds');
    $router->post('read-threads', 'ChatController@markThreadRead');

    $router->get('users', 'ChatController@getOtherUsers');

    $router->get('threads/{thread_id}/members', 'ChatController@getThreadMembers')->int('thread_id');

    $router->post('threads/join/{thread_id}', 'ChatController@joinThread')->int('thread_id');
    $router->post('threads/leave/{thread_id}', 'ChatController@leaveThread')->int('thread_id');
    $router->post('threads/block/{thread_id}', 'ChatController@blockUser')->int('thread_id');
    $router->post('threads/unblock/{thread_id}', 'ChatController@unblockUser')->int('thread_id');
});

