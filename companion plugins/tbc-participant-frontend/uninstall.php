<?php
/**
 * Uninstall handler for TBC Participant Frontend
 *
 * Only removes data if the "Delete data on uninstall" setting is enabled
 * (wp_option 'tbc_pf_delete_data_on_uninstall').
 *
 * WooCommerce products, orders, and Fluent Community spaces are always
 * left untouched — those belong to their respective plugins.
 *
 * @package TBC_Participant_Frontend
 */

defined('WP_UNINSTALL_PLUGIN') || exit;

if (!get_option('tbc_pf_delete_data_on_uninstall', false)) {
    return;
}

$tbc_pf_option_keys = [
    'tbc_pf_event_category_ids',
    'tbc_pf_course_sapo_pre',
    'tbc_pf_course_ceremony_pre',
    'tbc_pf_course_ceremony_post',
    'tbc_pf_ceremony_space_parent',
    'tbc_pf_delete_data_on_uninstall',
];

foreach ($tbc_pf_option_keys as $tbc_pf_key) {
    delete_option($tbc_pf_key);
}

global $wpdb;
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Uninstall table drop.
$wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}tbc_pf_event_post_types");
