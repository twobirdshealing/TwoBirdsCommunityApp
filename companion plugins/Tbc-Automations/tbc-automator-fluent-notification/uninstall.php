<?php
/**
 * Uninstall handler for TBC Automator Send Notification
 *
 * Removes the one-time migration flag. Uncanny Automator recipes using
 * this plugin's action live in Automator's own postmeta and are left
 * untouched — those belong to Uncanny Automator.
 *
 * @package TBC_AFN
 */

defined('WP_UNINSTALL_PLUGIN') || exit;

delete_option('tbc_asn_migrated_v2');
