<?php
/**
 * Uninstall handler for TBC Cart
 *
 * Only removes data if the "Delete data on uninstall" setting is enabled.
 * WooCommerce cart data, orders, and products are always left untouched —
 * those belong to WooCommerce.
 *
 * @package TBC_Cart
 */

defined('WP_UNINSTALL_PLUGIN') || exit;

if (!get_option('tbc_cart_delete_data_on_uninstall', false)) {
    return;
}

$tbc_cart_option_keys = [
    'tbc_cart_wc_integration',
    'tbc_cart_wc_template',
    'tbc_cart_wc_mini_cart',
    'tbc_cart_delete_data_on_uninstall',
];

foreach ($tbc_cart_option_keys as $tbc_cart_key) {
    delete_option($tbc_cart_key);
}
