<?php
/**
 * Adds and queries the tbc_mr_reaction_type column on FC's fcom_post_reactions table.
 *
 * @package TBC_Multi_Reactions
 */

namespace TBCMultiReactions;

defined('ABSPATH') || exit;

class Database {

    public static function add_reaction_type_column() {
        global $wpdb;
        $table_name = $wpdb->prefix . 'fcom_post_reactions';

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Schema inspection during activation.
        $column_exists = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = %s
                AND TABLE_NAME = %s
                AND COLUMN_NAME = 'tbc_mr_reaction_type'",
                DB_NAME,
                $table_name
            )
        );

        if (!empty($column_exists)) {
            return true;
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared -- DDL with $wpdb->prefix table name during activation.
        $result = $wpdb->query("ALTER TABLE `{$table_name}`
                ADD COLUMN `tbc_mr_reaction_type` VARCHAR(50) NULL DEFAULT NULL
                COMMENT 'TBC multi-reaction type (like, love, laugh, etc.)'
                AFTER `type`");

        if ($result === false) {
            return false;
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- DDL with $wpdb->prefix table name.
        $wpdb->query("ALTER TABLE `{$table_name}` ADD INDEX `idx_tbc_mr_reaction_type` (`tbc_mr_reaction_type`)");

        // Backfill existing FC "like" reactions so they render as our default "like" type instead of showing up blank in breakdowns.
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Backfill during activation.
        $wpdb->query("UPDATE `{$table_name}` SET tbc_mr_reaction_type = 'like' WHERE tbc_mr_reaction_type IS NULL AND type = 'like'");

        return true;
    }

    public static function remove_reaction_type_column() {
        global $wpdb;
        $table_name = $wpdb->prefix . 'fcom_post_reactions';

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Uninstall cleanup.
        $table_exists = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s",
                DB_NAME,
                $table_name
            )
        );

        if (!$table_exists) {
            return;
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Uninstall cleanup.
        $column_exists = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = 'tbc_mr_reaction_type'",
                DB_NAME,
                $table_name
            )
        );

        if (!empty($column_exists)) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- DDL with $wpdb->prefix table name during uninstall.
            $wpdb->query("ALTER TABLE `{$table_name}` DROP COLUMN `tbc_mr_reaction_type`");
        }
    }

    public static function get_reaction_breakdown($object_id, $object_type) {
        $cache_key = "tbc_mr_{$object_type}_{$object_id}";
        $cached = get_transient($cache_key);

        if ($cached !== false) {
            return $cached;
        }

        global $wpdb;
        $table = $wpdb->prefix . 'fcom_post_reactions';

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Results cached via transient below.
        $results = $wpdb->get_results($wpdb->prepare(
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $table is from $wpdb->prefix.
            "SELECT tbc_mr_reaction_type as reaction_type, COUNT(*) as count
            FROM {$table}
            WHERE object_id = %d
            AND object_type = %s
            AND tbc_mr_reaction_type IS NOT NULL
            GROUP BY tbc_mr_reaction_type
            ORDER BY count DESC, tbc_mr_reaction_type ASC",
            $object_id, $object_type
        ), ARRAY_A);

        $results = $results ?: [];

        set_transient($cache_key, $results, 30);

        return $results;
    }

    public static function clear_reaction_breakdown_cache($object_id, $object_type) {
        delete_transient("tbc_mr_{$object_type}_{$object_id}");
    }

    public static function get_user_reaction_type($user_id, $object_id, $object_type) {
        global $wpdb;
        $table = $wpdb->prefix . 'fcom_post_reactions';

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Real-time user reaction lookup.
        return $wpdb->get_var($wpdb->prepare(
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $table is from $wpdb->prefix.
            "SELECT tbc_mr_reaction_type FROM {$table}
            WHERE user_id = %d
            AND object_id = %d
            AND object_type = %s
            LIMIT 1",
            $user_id, $object_id, $object_type
        ));
    }

    public static function get_user_reaction_types_batch($user_id, $object_ids, $object_type) {
        if (empty($object_ids)) {
            return [];
        }

        global $wpdb;
        $table = $wpdb->prefix . 'fcom_post_reactions';

        $ids = array_map('intval', $object_ids);
        $ids = array_filter($ids);

        if (empty($ids)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($ids), '%d'));

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Real-time batch reaction lookup.
        $results = $wpdb->get_results(
            $wpdb->prepare(
                // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $table is from $wpdb->prefix; $placeholders is generated array_fill of %d.
                "SELECT object_id, tbc_mr_reaction_type FROM {$table}
                WHERE user_id = %d
                AND object_id IN ({$placeholders})
                AND object_type = %s
                AND tbc_mr_reaction_type IS NOT NULL",
                array_merge(array($user_id), $ids, array($object_type))
            ),
            ARRAY_A
        );

        $map = [];
        foreach ($results as $row) {
            $map[$row['object_id']] = $row['tbc_mr_reaction_type'];
        }

        return $map;
    }

    public static function get_reaction_breakdowns_batch($object_ids, $object_type) {
        $ids = array_map('absint', $object_ids);
        $ids = array_filter($ids);

        if (empty($ids)) {
            return [];
        }

        global $wpdb;
        $table = $wpdb->prefix . 'fcom_post_reactions';
        $placeholders = implode(',', array_fill(0, count($ids), '%d'));

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Real-time batch reaction data for feed display.
        $results = $wpdb->get_results(
            $wpdb->prepare(
                // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $table is from $wpdb->prefix; $placeholders is generated.
                "SELECT object_id, tbc_mr_reaction_type as reaction_type, COUNT(*) as count
                FROM {$table}
                WHERE object_id IN ({$placeholders})
                AND object_type = %s
                AND tbc_mr_reaction_type IS NOT NULL
                GROUP BY object_id, tbc_mr_reaction_type
                ORDER BY object_id, count DESC, tbc_mr_reaction_type ASC",
                array_merge($ids, array($object_type))
            ),
            ARRAY_A
        );

        $breakdowns = [];
        foreach ($ids as $id) {
            $breakdowns[$id] = ['breakdown' => [], 'total' => 0];
        }

        $enabled_reactions = Core::get_enabled_reactions();
        $reaction_map = [];
        foreach ($enabled_reactions as $reaction) {
            $reaction_map[$reaction['id']] = $reaction;
        }

        foreach ($results as $row) {
            $obj_id = (int) $row['object_id'];
            $type = $row['reaction_type'];
            $count = (int) $row['count'];

            if (!isset($breakdowns[$obj_id]) || !isset($reaction_map[$type])) {
                continue;
            }

            $config = $reaction_map[$type];
            $breakdowns[$obj_id]['breakdown'][] = [
                'type' => $type,
                'icon_url' => $config['icon_url'] ?? null,
                'emoji' => $config['emoji'] ?? null,
                'name' => $config['name'],
                'count' => $count,
                'color' => $config['color'],
            ];
            $breakdowns[$obj_id]['total'] += $count;
        }

        return $breakdowns;
    }

    /**
     * Updates only tbc_mr_reaction_type — never FC's type column, so FC's own heart-reaction bookkeeping stays intact.
     */
    public static function update_reaction_type($user_id, $object_id, $object_type, $reaction_type) {
        global $wpdb;
        $table = $wpdb->prefix . 'fcom_post_reactions';

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Real-time reaction update.
        $result = $wpdb->update(
            $table,
            ['tbc_mr_reaction_type' => $reaction_type],
            [
                'user_id' => $user_id,
                'object_id' => $object_id,
                'object_type' => $object_type,
            ],
            ['%s'],
            ['%d', '%d', '%s']
        );

        if ($result === false) {
            return false;
        }

        self::clear_reaction_breakdown_cache($object_id, $object_type);
        return true;
    }
}
