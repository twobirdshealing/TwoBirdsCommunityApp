<?php
/**
 * Plugin Name: TBC - Automator Send Notification
 * Plugin URI: https://twobirdscode.com
 * Description: Adds a "Send Notification" action to Uncanny Automator — sends native FluentCommunity in-app notifications when automations run.
 * Version: 1.0.0
 * Author: Two Birds Code
 * Author URI: https://twobirdscode.com
 * Text Domain: tbc-automator-fluent-notification
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'TBC_AFN_DIR', plugin_dir_path( __FILE__ ) );
define( 'TBC_AFN_URL', plugin_dir_url( __FILE__ ) );

/**
 * Register the Send Notification integration after Automator finishes loading.
 */
add_action( 'automator_configuration_complete', function () {

	if ( ! class_exists( 'Uncanny_Automator\Automator_Functions' ) ) {
		return;
	}

	require_once TBC_AFN_DIR . 'includes/add-fluent-notification-integration.php';
	require_once TBC_AFN_DIR . 'includes/fluent-notification-helpers.php';
	require_once TBC_AFN_DIR . 'includes/fluent-notification-send.php';

	new \TBC_Automator_Fluent_Notification\Add_Fluent_Notification_Integration();

}, 20 );
