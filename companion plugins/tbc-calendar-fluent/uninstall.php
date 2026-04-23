<?php
/**
 * Uninstall handler for TBC WooCommerce Calendar
 *
 * Only removes data if the "Delete data on uninstall" setting is enabled
 * (wp_option 'tbc_wc_delete_data_on_uninstall'). The Google Maps API key,
 * toolbar settings, and per-product waitlist data are preserved by default.
 *
 * WooCommerce products, orders, and event metadata on products are always
 * left untouched — those belong to WooCommerce.
 *
 * @package TBC_WC_Calendar
 */

defined('WP_UNINSTALL_PLUGIN') || exit;

if (!get_option('tbc_wc_delete_data_on_uninstall', false)) {
    return;
}

$tbc_wc_option_keys = [
    'tbc_wc_google_maps_api_key',
    'tbc_wc_waitlist_url',
    'tbc_wc_delete_data_on_uninstall',
];

foreach ($tbc_wc_option_keys as $tbc_wc_key) {
    delete_option($tbc_wc_key);
}

// Remove per-product waitlist options (tbc_wc_waitlist_<product_id>).
global $wpdb;
$tbc_wc_like = $wpdb->esc_like('tbc_wc_waitlist_') . '%';
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Uninstall bulk option cleanup.
$wpdb->query(
    $wpdb->prepare(
        "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s AND option_name != 'tbc_wc_waitlist_url'",
        $tbc_wc_like
    )
);
