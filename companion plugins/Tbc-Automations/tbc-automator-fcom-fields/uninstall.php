<?php
/**
 * Uninstall handler for TBC Automator Custom Field Triggers
 *
 * Removes the one-time migration flag. Uncanny Automator recipes using
 * this plugin's triggers live in Automator's own postmeta and are left
 * untouched — those belong to Uncanny Automator.
 *
 * @package TBC_AFCF
 */

defined('WP_UNINSTALL_PLUGIN') || exit;

delete_option('tbc_afcf_migrated_v2');
