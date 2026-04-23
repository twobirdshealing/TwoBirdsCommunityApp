<?php
/**
 * Plugin Name: TBC - Automator Send Message
 * Plugin URI: https://twobirdscode.com
 * Description: Adds a "Send Direct Message" action to Uncanny Automator — sends direct messages via FluentChat when automations run.
 * Version: 1.0.0
 * Author: Two Birds Code
 * Author URI: https://twobirdscode.com
 * Text Domain: tbc-automator-fluentchat
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'TBC_AFC_DIR', plugin_dir_path( __FILE__ ) );
define( 'TBC_AFC_URL', plugin_dir_url( __FILE__ ) );

/**
 * One-time migration: update saved actions from old FLUENTCHAT integration to TBCAUTOMATIONS.
 */
add_action( 'admin_init', function () {
	if ( get_option( 'tbc_asm_migrated_v2' ) ) {
		return;
	}
	global $wpdb;

	// Migrate integration code.
	$wpdb->query( "UPDATE {$wpdb->postmeta} SET meta_value = 'TBCAUTOMATIONS' WHERE meta_key = 'integration' AND meta_value = 'FLUENTCHAT'" );

	// Migrate action code.
	$wpdb->query( "UPDATE {$wpdb->postmeta} SET meta_value = 'TBC_SEND_DM' WHERE meta_key = 'code' AND meta_value = 'FLUENTCHAT_SEND_DM'" );

	// Migrate meta keys (stored as both meta_key and meta_value in postmeta).
	$renames = array(
		'FLUENTCHAT_MESSAGE'   => 'TBC_DM_CONTENT',
		'FLUENTCHAT_DM'        => 'TBC_DM_MSG',
		'FLUENTCHAT_SENDER'    => 'TBC_DM_SENDER',
		'FLUENTCHAT_RECIPIENT' => 'TBC_DM_RECIPIENT',
	);
	foreach ( $renames as $old => $new ) {
		$wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->postmeta} SET meta_key = %s WHERE meta_key = %s", $new, $old ) );
		$wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->postmeta} SET meta_value = %s WHERE meta_value = %s", $new, $old ) );
	}

	update_option( 'tbc_asm_migrated_v2', '1' );
} );

/**
 * Register the Send Message integration after Automator finishes loading.
 */
add_action( 'automator_configuration_complete', function () {

	if ( ! class_exists( 'Uncanny_Automator\Automator_Functions' ) ) {
		return;
	}

	require_once TBC_AFC_DIR . 'includes/add-fluentchat-integration.php';
	require_once TBC_AFC_DIR . 'includes/fluentchat-helpers.php';
	require_once TBC_AFC_DIR . 'includes/fluentchat-send-dm.php';

	new \TBC_Automator_FluentChat\Add_FluentChat_Integration();

}, 20 );
