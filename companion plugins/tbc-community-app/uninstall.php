<?php
/**
 * Uninstall handler for TBC Community App
 * Only removes data if the "Delete data on uninstall" setting is enabled.
 *
 * @package TBC_Community_App
 */

defined('WP_UNINSTALL_PLUGIN') || exit;

$tbc_ca_settings = get_option('tbc_ca_settings', []);

// Only remove data if the user explicitly opted in
if (empty($tbc_ca_settings['delete_data_on_uninstall'])) {
    return;
}

// === Full data removal (user opted in) ===

global $wpdb;

// Remove options
delete_option('tbc_ca_settings');
delete_option('tbc_ca_version');
delete_option('tbc_ca_jwt_secret');

// Drop custom tables
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- DDL during uninstall.
$wpdb->query("DROP TABLE IF EXISTS `{$wpdb->prefix}tbc_ca_device_tokens`");
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- DDL during uninstall.
$wpdb->query("DROP TABLE IF EXISTS `{$wpdb->prefix}tbc_ca_push_log`");

// Clean up login token transients
$tbc_ca_like = $wpdb->esc_like('_transient_tbc_ca_login_token_') . '%';
$tbc_ca_timeout = $wpdb->esc_like('_transient_timeout_tbc_ca_login_token_') . '%';
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Uninstall transient cleanup.
$wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s", $tbc_ca_like, $tbc_ca_timeout));

// Remove JWT session user meta
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Uninstall user meta cleanup.
$wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->usermeta} WHERE meta_key = %s", 'tbc_ca_jwt_sessions'));

// Remove notification preferences user meta
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Uninstall user meta cleanup.
$wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->usermeta} WHERE meta_key = %s", 'tbc_ca_notification_prefs'));

// Remove scheduled cron events
wp_clear_scheduled_hook('tbc_ca_daily_cleanup');
