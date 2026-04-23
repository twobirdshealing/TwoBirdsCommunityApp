<?php
/**
 * Uninstall handler for TBC Message Roles
 *
 * Only removes data if the "Delete data on uninstall" setting is enabled
 * (wp_option 'tbc_msgr_delete_data_on_uninstall'). Role allow-list
 * configuration is preserved by default.
 *
 * Fluent Community spaces, messages, and user data are always left
 * untouched — those belong to Fluent Community.
 *
 * @package TBC_Message_Roles
 */

defined('WP_UNINSTALL_PLUGIN') || exit;

if (!get_option('tbc_msgr_delete_data_on_uninstall', false)) {
    return;
}

// All plugin options share the 'tbc_msgr_' prefix (see TBC_MSGR_OPTION_PREFIX).
global $wpdb;
$tbc_msgr_like = $wpdb->esc_like('tbc_msgr_') . '%';
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Uninstall bulk option cleanup.
$wpdb->query(
    $wpdb->prepare(
        "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s",
        $tbc_msgr_like
    )
);
