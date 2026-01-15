<?php

/**
 * All registered filter's handlers should be in app\Hooks\Handlers,
 * addFilter is similar to add_filter and addCustomFlter is just a
 * wrapper over add_filter which will add a prefix to the hook name
 * using the plugin slug to make it unique in all wordpress plugins,
 * ex: $app->addCustomFilter('foo', ['FooHandler', 'handleFoo']) is
 * equivalent to add_filter('slug-foo', ['FooHandler', 'handleFoo']).
 */

/**
 * @var $app FluentCommunity\Framework\Foundation\Application
 */


add_filter('fluent_messaging/get_unread_message_count', function ($count, $userId) {
    return \FluentMessaging\App\Services\ChatHelper::getUnreadThreadCounts($userId);
}, 10, 2);
