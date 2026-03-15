<?php
/**
 * Uninstall handler for TBC Fluent Profiles.
 * Only removes data if the "Delete data on uninstall" setting is enabled.
 *
 * @package TBC_Fluent_Profiles
 */

defined('WP_UNINSTALL_PLUGIN') || exit;

// Only remove data if the user explicitly opted in
if (!get_option('tbc_fp_delete_data_on_uninstall')) {
    return;
}

// === Full data removal (user opted in) ===

// Remove field definitions
delete_option('tbc_fp_fields');

// Remove OTP / verification settings (current tbc_fp_ prefix)
$otp_keys = [
    'twilio_sid',
    'twilio_token',
    'verify_service_sid',
    'enable_registration_verification',
    'enable_password_recovery',
    'enable_profile_verification',
    'enable_voice_fallback',
    'enable_email_verification',
    'disable_rate_limit',
    'restrict_duplicates',
    'blocked_numbers',
    'phone_meta_key',
    'phone_meta_key_custom',
    'sms_optin_field',
    'sms_optin_value',
];

foreach ($otp_keys as $key) {
    delete_option('tbc_fp_' . $key);
}

// Remove profile completion settings
$pc_keys = [
    'profile_completion_enabled',
    'profile_completion_require_bio',
    'profile_completion_require_avatar',
    'disable_fc_onboarding',
];

foreach ($pc_keys as $key) {
    delete_option('tbc_fp_' . $key);
}

// Remove uninstall pref
delete_option('tbc_fp_delete_data_on_uninstall');

// Remove user meta (field values + registration complete flag)
global $wpdb;

// Remove custom field values (all keys with _tbc_fp_ prefix)
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Uninstall cleanup.
$wpdb->query("DELETE FROM {$wpdb->usermeta} WHERE meta_key LIKE '\\_tbc\\_fp\\_%'");

// Remove registration complete flag
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Uninstall cleanup.
$wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->usermeta} WHERE meta_key = %s", '_tbc_registration_complete'));

// Clean up OTP transient sessions
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Uninstall cleanup.
$wpdb->query(
    "DELETE FROM {$wpdb->options}
     WHERE option_name LIKE '_transient_tbc_fp_session_%'
        OR option_name LIKE '_transient_timeout_tbc_fp_session_%'
        OR option_name LIKE '_transient_tbc_fp_recovery_%'
        OR option_name LIKE '_transient_timeout_tbc_fp_recovery_%'
        OR option_name LIKE '_transient_tbc_fp_profile_%'
        OR option_name LIKE '_transient_timeout_tbc_fp_profile_%'"
);

// Remove SMS roles
remove_role('sms_in');
remove_role('sms_out');
