<?php
/**
 * Uninstall handler for TBC Multi Reactions
 * Only removes data if the "Delete data on uninstall" setting is enabled.
 *
 * @package TBC_Multi_Reactions
 */

defined('WP_UNINSTALL_PLUGIN') || exit;

$tbc_mr_settings = get_option('tbc_mr_settings', []);

if (empty($tbc_mr_settings['delete_data_on_uninstall'])) {
    return;
}

delete_option('tbc_mr_settings');
delete_option('tbc_mr_pending_reaction');

require_once __DIR__ . '/includes/class-database.php';
\TBCMultiReactions\Database::remove_reaction_type_column();

global $wpdb;
$tbc_mr_media_table = $wpdb->prefix . 'fcom_media_archive';
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Uninstall cleanup.
$tbc_mr_media_exists = $wpdb->get_var(
    $wpdb->prepare("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s", DB_NAME, $tbc_mr_media_table)
);

if ($tbc_mr_media_exists) {
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

$tbc_mr_like_transient = $wpdb->esc_like('_transient_tbc_mr_') . '%';
$tbc_mr_like_timeout = $wpdb->esc_like('_transient_timeout_tbc_mr_') . '%';
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Uninstall transient cleanup.
$wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s", $tbc_mr_like_transient, $tbc_mr_like_timeout));
