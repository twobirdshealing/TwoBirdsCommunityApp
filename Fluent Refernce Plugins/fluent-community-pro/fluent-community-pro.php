<?php defined('ABSPATH') or die;

/*
Plugin Name: FluentCommunity Pro
Description: The Pro version of FluentCommunity Plugin
Version: 2.1.02
Author: WPManageNinja LLC
Author URI: https://fluentcommunity.co
Plugin URI: https://fluentcommunity.co
License: GPLv2 or later
Text Domain: fluent-community-pro
Domain Path: /language
*/

define('FLUENT_COMMUNITY_PRO', true);
define('FLUENT_COMMUNITY_PRO_DIR', plugin_dir_path(__FILE__));
define('FLUENT_COMMUNITY_PRO_URL', plugin_dir_url(__FILE__));
define('FLUENT_COMMUNITY_PRO_DIR_FILE', __FILE__);
define('FLUENT_COMMUNITY_PRO_VERSION', '2.1.02');
define('FLUENT_COMMUNITY_MIN_CORE_VERSION', '2.1.02');

require __DIR__ . '/vendor/autoload.php';

call_user_func(function ($bootstrap) {
    $bootstrap(__FILE__);
}, require(__DIR__ . '/boot/app.php'));
