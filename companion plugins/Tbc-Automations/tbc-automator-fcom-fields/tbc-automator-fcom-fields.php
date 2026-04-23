<?php
/**
 * Plugin Name: TBC - Automator Custom Field Triggers
 * Plugin URI: https://twobirdscode.com
 * Description: Adds FluentCommunity custom profile field triggers to Uncanny Automator — fire automations when a user updates a specific custom field to a specific value.
 * Version: 1.0.0
 * Author: Two Birds Code
 * Author URI: https://twobirdscode.com
 * Text Domain: tbc-automator-fcom-fields
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'TBC_AFCF_DIR', plugin_dir_path( __FILE__ ) );
define( 'TBC_AFCF_URL', plugin_dir_url( __FILE__ ) );

/**
 * One-time migration: update saved triggers from old FLUENT_COMMUNITY integration to TBCAUTOMATIONS.
 */
add_action( 'admin_init', function () {
	if ( get_option( 'tbc_afcf_migrated_v2' ) ) {
		return;
	}
	global $wpdb;

	// Find our specific trigger posts first.
	$trigger_post_ids = $wpdb->get_col(
		"SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = 'code' AND meta_value = 'FCOM_USER_UPDATES_CUSTOM_FIELD'"
	);

	if ( ! empty( $trigger_post_ids ) ) {
		$ids = implode( ',', array_map( 'absint', $trigger_post_ids ) );

		// Migrate integration code (only our triggers, not all FLUENT_COMMUNITY).
		$wpdb->query(
			"UPDATE {$wpdb->postmeta} SET meta_value = 'TBCAUTOMATIONS' WHERE meta_key = 'integration' AND meta_value = 'FLUENT_COMMUNITY' AND post_id IN ({$ids})"
		);

		// Migrate trigger code.
		$wpdb->query(
			"UPDATE {$wpdb->postmeta} SET meta_value = 'TBC_USER_UPDATES_CUSTOM_FIELD' WHERE meta_key = 'code' AND meta_value = 'FCOM_USER_UPDATES_CUSTOM_FIELD' AND post_id IN ({$ids})"
		);

		// Migrate meta keys on these trigger posts.
		$renames = array(
			'FCOM_PROFILE_FIELD'  => 'TBC_PROFILE_FIELD',
			'FCOM_FIELD_VALUE'    => 'TBC_FIELD_VALUE',
			'FCOM_FIELD_OLD_VALUE'=> 'TBC_FIELD_OLD_VALUE',
		);
		foreach ( $renames as $old => $new ) {
			$wpdb->query( $wpdb->prepare(
				"UPDATE {$wpdb->postmeta} SET meta_key = %s WHERE meta_key = %s AND post_id IN ({$ids})", $new, $old
			) );
			$wpdb->query( $wpdb->prepare(
				"UPDATE {$wpdb->postmeta} SET meta_value = %s WHERE meta_value = %s AND post_id IN ({$ids})", $new, $old
			) );
		}
	}

	// Also migrate trigger log meta (in Automator's custom tables).
	// Only run if we found trigger posts to migrate; avoids a SHOW TABLES query when there is nothing to do.
	if ( ! empty( $trigger_post_ids ) && $wpdb->get_var( "SHOW TABLES LIKE '{$wpdb->prefix}uap_trigger_log_meta'" ) ) {
		$log_renames = array(
			'FCOM_PROFILE_FIELD'       => 'TBC_PROFILE_FIELD',
			'FCOM_PROFILE_FIELD_SLUG'  => 'TBC_PROFILE_FIELD_SLUG',
			'FCOM_FIELD_VALUE'         => 'TBC_FIELD_VALUE',
			'FCOM_FIELD_OLD_VALUE'     => 'TBC_FIELD_OLD_VALUE',
		);
		foreach ( $log_renames as $old => $new ) {
			$wpdb->query( $wpdb->prepare(
				"UPDATE {$wpdb->prefix}uap_trigger_log_meta SET meta_key = %s WHERE meta_key = %s", $new, $old
			) );
		}
	}

	update_option( 'tbc_afcf_migrated_v2', '1' );
} );

/**
 * Bridge: Hook into FluentCommunity's profile update filter to detect
 * custom field changes and fire a custom action for Automator triggers.
 *
 * Priority 999 ensures we run AFTER FluentCommunity Pro's
 * CustomProfileFieldsHandler (priority 10) merges custom_fields.
 */
add_filter( 'fluent_community/update_profile_data', 'tbc_afcf_detect_custom_field_changes', 999, 3 );

function tbc_afcf_detect_custom_field_changes( $updateData, $data, $xProfile ) {

	if ( empty( $updateData['custom_fields'] ) ) {
		return $updateData;
	}

	$old_fields = (array) $xProfile->custom_fields;
	$new_fields = (array) $updateData['custom_fields'];

	// Identify fields that actually changed.
	$changed = array();
	foreach ( $new_fields as $slug => $value ) {
		$old_value = isset( $old_fields[ $slug ] ) ? $old_fields[ $slug ] : null;

		// Normalize for comparison (arrays, strings, etc.).
		if ( is_array( $value ) || is_array( $old_value ) ) {
			if ( (array) $old_value !== (array) $value ) {
				$changed[ $slug ] = array(
					'old_value' => $old_value,
					'new_value' => $value,
				);
			}
		} elseif ( (string) $old_value !== (string) $value ) {
			$changed[ $slug ] = array(
				'old_value' => $old_value,
				'new_value' => $value,
			);
		}
	}

	if ( ! empty( $changed ) ) {
		// Fire immediately — we are inside the save transaction, data is committed.
		// Automator trigger processing is just DB inserts, safe to do here.
		do_action( 'tbc_fcom/profile_custom_fields_updated', $xProfile->user_id, $changed, $new_fields );
	}

	return $updateData;
}

/**
 * Register triggers with Uncanny Automator after it finishes loading.
 */
add_action( 'automator_configuration_complete', function () {

	if ( ! class_exists( 'Uncanny_Automator\Automator_Functions' ) ) {
		return;
	}

	if ( ! class_exists( '\FluentCommunity\App\Services\Helper' ) ) {
		return;
	}

	require_once TBC_AFCF_DIR . 'includes/fcom-fields-helpers.php';
	require_once TBC_AFCF_DIR . 'includes/triggers/fcom-user-updates-custom-field.php';

	// Register the shared TBC Automations integration (skip if already registered by another TBC Automator plugin).
	if ( ! automator_integration_exists( 'TBCAUTOMATIONS' ) ) {
		\Automator()->register->integration(
			'TBCAUTOMATIONS',
			array(
				'name'      => 'TBC Automations',
				'icon_svg'  => TBC_AFCF_URL . 'img/tbc-automations-icon.svg',
				'connected' => true,
			)
		);
	}
	\Uncanny_Automator\Set_Up_Automator::set_active_integration_code( 'TBCAUTOMATIONS' );

	new \TBC_Automator_FCOM_Fields\FCOM_User_Updates_Custom_Field();

}, 20 );
