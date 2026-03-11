<?php
/**
 * Uninstall handler for TBC Fluent Profiles.
 * Removes plugin options from wp_options.
 * Does NOT remove user meta values (field data) to prevent accidental data loss.
 *
 * @package TBC_Fluent_Profiles
 */

if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

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
];

foreach ($otp_keys as $key) {
    delete_option('tbc_fp_' . $key);
    delete_option('tbc_otp_' . $key); // legacy prefix, in case migration didn't run
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

// Remove migration flag
delete_option('tbc_fp_prefix_migrated');
