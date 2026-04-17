<?php
/**
 * Uninstall handler for TBC Profile Completion
 *
 * Only removes data if the "Delete data on uninstall" setting is enabled.
 *
 * @package TBC_ProfileCompletion
 */

defined('WP_UNINSTALL_PLUGIN') || exit;

if (!get_option('tbc_pcom_delete_data_on_uninstall', false)) {
    return;
}

$tbc_pcom_option_prefix = 'tbc_pcom_';

$tbc_pcom_option_keys = [
    'enabled',
    'require_bio',
    'require_avatar',
    'disable_fc_onboarding',
];

foreach ($tbc_pcom_option_keys as $tbc_pcom_key) {
    delete_option($tbc_pcom_option_prefix . $tbc_pcom_key);
}

delete_option('tbc_pcom_delete_data_on_uninstall');

// Remove the registration-complete flag from every user.
delete_metadata('user', 0, '_tbc_registration_complete', '', true);
