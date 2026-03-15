<?php
/**
 * Uninstall handler for TBC Book Club Manager.
 * Only removes data if the "Delete data on uninstall" setting is enabled.
 *
 * @package TBC_Book_Club
 */

defined('WP_UNINSTALL_PLUGIN') || exit;

// Only remove data if the user explicitly opted in
if (!get_option('tbc_bc_delete_data_on_uninstall')) {
    return;
}

// === Full data removal (user opted in) ===

global $wpdb;

// Drop custom tables (bookmarks first due to foreign key)
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- DDL during uninstall.
$wpdb->query("DROP TABLE IF EXISTS `{$wpdb->prefix}tbc_bc_bookmarks`");
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- DDL during uninstall.
$wpdb->query("DROP TABLE IF EXISTS `{$wpdb->prefix}tbc_bc_books`");

// Remove options
delete_option('tbc_bc_delete_data_on_uninstall');
