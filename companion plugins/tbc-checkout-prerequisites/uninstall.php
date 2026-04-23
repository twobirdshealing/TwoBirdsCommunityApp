<?php
/**
 * Uninstall handler for TBC Checkout Prerequisites
 *
 * Only removes data if the "Delete data on uninstall" setting is enabled
 * (wp_option 'tbc_cp_delete_data_on_uninstall'). Prerequisite step
 * configuration is preserved by default.
 *
 * WooCommerce orders, Gravity Forms entries, and LearnDash progress are
 * always left untouched — those belong to their respective plugins.
 *
 * @package TBC_Checkout_Prerequisites
 */

defined('WP_UNINSTALL_PLUGIN') || exit;

if (!get_option('tbc_cp_delete_data_on_uninstall', false)) {
    return;
}

$tbc_cp_option_keys = [
    'tbc_cp_steps',
    'tbc_cp_delete_data_on_uninstall',
];

foreach ($tbc_cp_option_keys as $tbc_cp_key) {
    delete_option($tbc_cp_key);
}
