<?php
/**
 * Uninstall handler for TBC Member Perks
 *
 * Only removes data if the "Delete data on uninstall" setting is enabled
 * (wp_option 'wmp_delete_data_on_uninstall'). Perk level configuration and
 * imported subscriber history are preserved by default.
 *
 * WooCommerce subscriptions, orders, and user roles are always left untouched —
 * those belong to WooCommerce / WordPress core.
 *
 * @package TBC_Member_Perks
 */

defined('WP_UNINSTALL_PLUGIN') || exit;

if (!get_option('wmp_delete_data_on_uninstall', false)) {
    return;
}

delete_option('wmp_delete_data_on_uninstall');

global $wpdb;
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Uninstall table drop.
$wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}perk_levels");
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Uninstall table drop.
$wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}imported_subscribers");
