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

/**
 * Changelog:
 *
 * 2.3.1 — 2026-03-25
 * - Refactor: Extract visibility_for() helper — removes ~80 lines of boilerplate
 * - Refactor: Merge resolve_space_slug/resolve_feed_slug into single resolve_slug()
 * - Perf: Only parse and resolve route fields relevant to selected destination type
 * - Fix: Validate recipient before route work to short-circuit early on bad input
 * - Fix: Trim content at assignment for consistency
 *
 * 2.3.0 — 2026-03-25
 * - Breaking: Replaced "Link URL" with "Click destination" dropdown
 * - All native FC destinations: Space home, Post in a space, Community post, User profile, Course home, Course lesson
 * - Conditional fields via dynamic_visibility — only relevant fields show per destination
 * - All ID fields auto-resolve: Space ID → slug, Post ID → slug, Course ID → slug
 * - Fix: src_user_id defaults to 1 (was 0, causing null xprofile — no avatar)
 * - Added optional "Sender user ID" field
 *
 * 1.1.0
 * - Rebranded integration from FLUENTNOTIFICATION to TBCAUTOMATIONS
 * - Added migration for existing recipes
 * - Added title and route fields
 *
 * 1.0.0
 * - Initial release
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'TBC_AFN_DIR', plugin_dir_path( __FILE__ ) );
define( 'TBC_AFN_URL', plugin_dir_url( __FILE__ ) );

/**
 * One-time migration: update saved actions from old FLUENTNOTIFICATION integration to TBCAUTOMATIONS.
 */
add_action( 'admin_init', function () {
	if ( get_option( 'tbc_asn_migrated_v2' ) ) {
		return;
	}
	global $wpdb;

	// Migrate integration code.
	$wpdb->query( "UPDATE {$wpdb->postmeta} SET meta_value = 'TBCAUTOMATIONS' WHERE meta_key = 'integration' AND meta_value = 'FLUENTNOTIFICATION'" );

	// Migrate action code.
	$wpdb->query( "UPDATE {$wpdb->postmeta} SET meta_value = 'TBC_SEND_NOTIFICATION' WHERE meta_key = 'code' AND meta_value = 'FLUENT_SEND_NOTIFICATION'" );

	// Migrate meta keys.
	$renames = array(
		'FLUENT_NOTIFICATION_CONTENT'   => 'TBC_NOTIFICATION_CONTENT',
		'FLUENT_NOTIFICATION_MSG'       => 'TBC_NOTIFICATION_MSG',
		'FLUENT_NOTIFICATION_RECIPIENT' => 'TBC_NOTIFICATION_RECIPIENT',
		'FLUENT_NOTIFICATION_ROUTE'     => 'TBC_NOTIFICATION_ROUTE',
	);
	foreach ( $renames as $old => $new ) {
		$wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->postmeta} SET meta_key = %s WHERE meta_key = %s", $new, $old ) );
		$wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->postmeta} SET meta_value = %s WHERE meta_value = %s", $new, $old ) );
	}

	update_option( 'tbc_asn_migrated_v2', '1' );
} );

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
