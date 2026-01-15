<?php
/*
Plugin Name: Fluent Messaging
Description: Chat Plugin for FluentCommunity
Version: 1.7.0
Author: techjewel
Author URI: https://fluentcommunity.co
Plugin URI: https://fluentcommunity.co
License: GPLv2 or later
Text Domain: fluent-messaging
Domain Path: /language
*/

defined('ABSPATH') or die;

define('FLUENT_MESSAGING_CHAT_VERSION', '1.7.0');
define('FLUENT_MESSAGING_CHAT_MODE', 'production');
define('FLUENT_MESSAGING_CHAT_URL', plugin_dir_url(__FILE__));
define('FLUENT_MESSAGING_CHAT_DIR', plugin_dir_path(__FILE__));
define('FLUENT_MESSAGING_CHAT_DIR_FILE', __FILE__);

require __DIR__.'/vendor/autoload.php';

call_user_func(function($bootstrap) {
    $bootstrap(__FILE__);
}, require(__DIR__.'/boot/app.php'));
