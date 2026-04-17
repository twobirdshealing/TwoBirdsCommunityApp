<?php
/**
 * Uninstall handler for TBC OTP
 *
 * Only removes data if the "Delete data on uninstall" setting is enabled.
 * Keeps Twilio credentials intact by default so uninstalling for testing
 * doesn't wipe the configuration.
 *
 * @package TBC_OTP
 */

defined('WP_UNINSTALL_PLUGIN') || exit;

$tbc_otp_option_prefix = 'tbc_otp_';

if (!get_option($tbc_otp_option_prefix . 'delete_data_on_uninstall', false)) {
    return;
}

$tbc_otp_option_keys = [
    'twilio_sid',
    'twilio_token',
    'verify_service_sid',
    'enable_registration_verification',
    'enable_voice_fallback',
    'enable_email_2fa',
    'restrict_duplicates',
    'blocked_numbers',
    'phone_field_slug',
    'delete_data_on_uninstall',
];

foreach ($tbc_otp_option_keys as $tbc_otp_key) {
    delete_option($tbc_otp_option_prefix . $tbc_otp_key);
}

// Clean up OTP session transients (ephemeral verification state).
global $wpdb;
$tbc_otp_like_transient = $wpdb->esc_like('_transient_tbc_otp_session_') . '%';
$tbc_otp_like_timeout   = $wpdb->esc_like('_transient_timeout_tbc_otp_session_') . '%';
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Uninstall transient cleanup.
$wpdb->query(
    $wpdb->prepare(
        "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
        $tbc_otp_like_transient,
        $tbc_otp_like_timeout
    )
);
