<?php

namespace FluentMessaging\App\Hooks\Handlers;

class ActivationHandler
{
    public static function handle($networkWide = false)
    {
        if ($networkWide) {
            global $wpdb;
            $old_blog = $wpdb->blogid;
            // Get all blog ids
            $blogids = $wpdb->get_col("SELECT blog_id FROM $wpdb->blogs");
            foreach ($blogids as $blog_id) {
                switch_to_blog($blog_id);
                self::createDbTables();
            }
            switch_to_blog($old_blog);
        } else {
            self::createDbTables();
        }
    }

    private static function createDbTables()
    {
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        self::createChatThreadsTable();
        self::createMessagesTable();
        self::createThreadUserTable();
    }

    public static function createChatThreadsTable()
    {
        global $wpdb;

        $charsetCollate = $wpdb->get_charset_collate();
        $table = $wpdb->prefix . 'fcom_chat_threads';

        if ($wpdb->get_var("SHOW TABLES LIKE '$table'") != $table) {
            $sql = "CREATE TABLE $table (
                `id` BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
                `title` VARCHAR(192) NULL,
                `space_id` BIGINT UNSIGNED NULL,
                `message_count` BIGINT UNSIGNED NULL DEFAULT 0,
                `status` VARCHAR(100) NULL DEFAULT 'active',
                `provider` VARCHAR(50) NULL DEFAULT 'fcom',
                `created_at` TIMESTAMP NULL,
                `updated_at` TIMESTAMP NULL,
                INDEX `space_id` (`space_id`),
                INDEX `provider` (`provider`)
            ) $charsetCollate;";
            dbDelta($sql);
        } else {
            // check if scheduled_at is exist or not
            $isMigrated = $wpdb->get_col($wpdb->prepare("SELECT * FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND COLUMN_NAME='provider' AND TABLE_NAME=%s", $table));
            if (!$isMigrated) {
                $wpdb->query("ALTER TABLE {$table} ADD COLUMN `provider` VARCHAR(50) NULL DEFAULT 'fcom' AFTER `status`");
                // add index
                $wpdb->query("ALTER TABLE {$table} ADD INDEX `provider` (`provider`)");
            }
        }
    }

    private static function createMessagesTable()
    {
        global $wpdb;

        $charsetCollate = $wpdb->get_charset_collate();
        $table = $wpdb->prefix . 'fcom_chat_messages';

        if ($wpdb->get_var("SHOW TABLES LIKE '$table'") != $table) {
            $sql = "CREATE TABLE $table (
                `id` BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
                `thread_id` BIGINT NOT NULL,
                `user_id` BIGINT NOT NULL,
                `text` TEXT NOT NULL,
                `meta` TEXT NULL,
                `created_at` TIMESTAMP NULL,
                `updated_at` TIMESTAMP NULL,
                KEY `thread_id` (`thread_id`),
                KEY `user_id` (`user_id`)
            ) $charsetCollate;";
            dbDelta($sql);
        }
    }

    private static function createThreadUserTable()
    {
        global $wpdb;

        $charsetCollate = $wpdb->get_charset_collate();
        $table = $wpdb->prefix . 'fcom_chat_thread_users';

        if ($wpdb->get_var("SHOW TABLES LIKE '$table'") != $table) {
            $sql = "CREATE TABLE $table (
                `id` BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
                `thread_id` BIGINT NOT NULL,
                `user_id` BIGINT NOT NULL,
                `last_seen_message_id` BIGINT NULL,
                `status` VARCHAR(50) NULL DEFAULT 'active',
                `created_at` TIMESTAMP NULL,
                `updated_at` TIMESTAMP NULL,
                KEY `thread_id` (`thread_id`),
                KEY `user_id` (`user_id`)
            ) $charsetCollate;";
            dbDelta($sql);
        }
    }

}

