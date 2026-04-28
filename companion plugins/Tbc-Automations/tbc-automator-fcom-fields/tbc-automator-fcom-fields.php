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
