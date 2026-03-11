<?php
/**
 * Uninstall handler for TBC Multi Reactions
 * Removes plugin data when uninstalled via WP admin
 *
 * @package TBC_Multi_Reactions
 */

defined('WP_UNINSTALL_PLUGIN') || exit;

// Remove settings
delete_option('tbc_mr_settings');
delete_option('tbc_mr_pending_reaction');
delete_option('tbc_mr_db_version');

// Remove the tbc_mr_reaction_type column from FC's table
global $wpdb;
$tbc_mr_table_name = $wpdb->prefix . 'fcom_post_reactions';

// Check if table exists before trying to alter it
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Uninstall cleanup, one-time operation.
$tbc_mr_table_exists = $wpdb->get_var(
    $wpdb->prepare("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s", DB_NAME, $tbc_mr_table_name)
);

if ($tbc_mr_table_exists) {
    // Check if column exists before dropping
    // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Uninstall cleanup.
    $tbc_mr_column_exists = $wpdb->get_results(
        $wpdb->prepare(
            "SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = 'tbc_mr_reaction_type'",
            DB_NAME, $tbc_mr_table_name
        )
    );

    if (!empty($tbc_mr_column_exists)) {
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- DDL with $wpdb->prefix table name during uninstall.
        $wpdb->query("ALTER TABLE `{$tbc_mr_table_name}` DROP COLUMN `tbc_mr_reaction_type`");
    }
}

// Delete icon media records and their physical files
$tbc_mr_media_table = $wpdb->prefix . 'fcom_media_archive';
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Uninstall cleanup.
$tbc_mr_media_exists = $wpdb->get_var(
    $wpdb->prepare("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s", DB_NAME, $tbc_mr_media_table)
);

if ($tbc_mr_media_exists) {
    // Get file paths before deleting records
    // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name from $wpdb->prefix.
    $tbc_mr_icon_files = $wpdb->get_col($wpdb->prepare("SELECT media_path FROM `{$tbc_mr_media_table}` WHERE object_source = %s", 'tbc_mr_icon'));
    foreach ($tbc_mr_icon_files as $tbc_mr_path) {
        if ($tbc_mr_path && file_exists($tbc_mr_path)) {
            wp_delete_file($tbc_mr_path);
        }
    }
    // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name from $wpdb->prefix.
    $wpdb->query($wpdb->prepare("DELETE FROM `{$tbc_mr_media_table}` WHERE object_source = %s", 'tbc_mr_icon'));
}

// Clean up transients
$tbc_mr_like_transient = $wpdb->esc_like('_transient_tbc_mr_') . '%';
$tbc_mr_like_timeout = $wpdb->esc_like('_transient_timeout_tbc_mr_') . '%';
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Uninstall transient cleanup.
$wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s", $tbc_mr_like_transient, $tbc_mr_like_timeout));
