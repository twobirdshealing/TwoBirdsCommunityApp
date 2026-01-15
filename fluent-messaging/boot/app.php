<?php

use FluentMessaging\App\Core\Application;

return function($file) {
    add_action('fluent_community/portal_loaded', function($app) use ($file) {
        new Application($app, $file);


        /**
         * Plugin Updater
         */
        $apiUrl = 'https://fluentcommunity.co/wp-admin/admin-ajax.php?action=fluent_messaging_update&time=' . time();
        new \FluentMessaging\App\Services\PluginManager\Updater($apiUrl, FLUENT_MESSAGING_CHAT_DIR_FILE, array(
            'version'   => FLUENT_MESSAGING_CHAT_VERSION,
            'license'   => '12345',
            'item_name' => 'Fluent Messaging',
            'item_id'   => 'fluent-messaging',
            'author'    => 'wpmanageninja'
        ),
            array(
                'license_status' => 'valid',
                'admin_page_url' => admin_url('admin.php?page=fluent-community#/'),
                'purchase_url'   => 'https://fluentcommunity.co',
                'plugin_title'   => 'Fluent Messaging'
            )
        );

        add_filter('plugin_row_meta', function ($links, $file) {
            if ('fluent-messaging/fluent-messaging.php' !== $file) {
                return $links;
            }

            $checkUpdateUrl = esc_url(admin_url('plugins.php?fluent-messaging-check-update=' . time()));

            $row_meta = array(
                'check_update' => '<a  style="color: #583fad;font-weight: 600;" href="' . $checkUpdateUrl . '" aria-label="' . esc_attr__('Check Update', 'fluent-messaging') . '">' . esc_html__('Check Update', 'fluent-messaging') . '</a>',
            );

            return array_merge($links, $row_meta);

        }, 10, 2);
    });

    register_activation_hook($file, ['\FluentMessaging\App\Hooks\Handlers\ActivationHandler', 'handle']);
};
