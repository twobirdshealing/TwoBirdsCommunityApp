<?php


/**
 * @var $app \FluentCommunity\Framework\Foundation\Application
 */

$app->addAction('init', 'ChatAppHandler@register');

(new \FluentMessaging\App\Hooks\Handlers\SchedulerHandler())->register();
