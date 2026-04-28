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
