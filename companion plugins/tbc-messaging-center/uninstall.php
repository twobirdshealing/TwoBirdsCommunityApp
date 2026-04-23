<?php
/**
 * Uninstall handler for TBC Messaging Center
 *
 * Only removes data if the "Delete data on uninstall" setting is enabled
 * (wp_option 'tbc_mc_delete_data_on_uninstall'). Twilio credentials and
 * message history are preserved by default so uninstalling for testing
 * doesn't wipe production configuration.
 *
 * @package TBC_Messaging_Center
 */

defined('WP_UNINSTALL_PLUGIN') || exit;

if (!get_option('tbc_mc_delete_data_on_uninstall', false)) {
    return;
}

$tbc_mc_option_keys = [
    'tbc_mc_twilio_sid',
    'tbc_mc_twilio_token',
    'tbc_mc_twilio_messaging_service_sid',
    'tbc_mc_twilio_number',
    'tbc_mc_phone_field_slug',
    'tbc_mc_sms_optin_field_slug',
    'tbc_mc_sms_optout_value',
    'tbc_mc_opt_out_message',
    'tbc_mc_delete_data_on_uninstall',
];

foreach ($tbc_mc_option_keys as $tbc_mc_key) {
    delete_option($tbc_mc_key);
}

global $wpdb;
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Uninstall table drop; table names cannot be prepared.
$wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}tbc_mc_messages");
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Uninstall table drop.
$wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}tbc_mc_scheduler_batches");
