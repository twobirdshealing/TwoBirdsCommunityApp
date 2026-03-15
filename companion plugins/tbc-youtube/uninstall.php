<?php
/**
 * Uninstall handler for TBC YouTube.
 * Only removes data if the "Delete data on uninstall" setting is enabled.
 *
 * @package TBC_YouTube
 */

defined('WP_UNINSTALL_PLUGIN') || exit;

$tbc_yt_settings = get_option('tbc_youtube_settings', []);

// Only remove data if the user explicitly opted in
if (empty($tbc_yt_settings['delete_data_on_uninstall'])) {
    return;
}

// === Full data removal (user opted in) ===

// Remove options
delete_option('tbc_youtube_settings');
delete_option('tbc_yt_version');

// Remove cached transients
global $wpdb;
$tbc_yt_like = $wpdb->esc_like('_transient_tbc_yt_') . '%';
$tbc_yt_timeout = $wpdb->esc_like('_transient_timeout_tbc_yt_') . '%';
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Uninstall cleanup.
$wpdb->query($wpdb->prepare(
    "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
    $tbc_yt_like,
    $tbc_yt_timeout
));
