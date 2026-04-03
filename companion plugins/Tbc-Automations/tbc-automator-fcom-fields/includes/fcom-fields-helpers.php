<?php

namespace TBC_Automator_FCOM_Fields;

/**
 * Helper utilities for FluentCommunity custom profile field triggers.
 */
class FCOM_Fields_Helpers {

	/**
	 * Get all configured custom profile fields as Automator dropdown options.
	 *
	 * Reads from FluentCommunity Pro's ProfileFieldsService config.
	 *
	 * @param bool $include_any Whether to include an "Any field" option.
	 * @return array
	 */
	public static function all_custom_fields( $include_any = true ) {
		$options = array();

		if ( $include_any ) {
			$options['*'] = 'Any custom field';
		}

		$fields = self::get_fc_custom_fields();

		foreach ( $fields as $field ) {
			if ( empty( $field['slug'] ) || empty( $field['label'] ) ) {
				continue;
			}
			if ( isset( $field['is_enabled'] ) && ! $field['is_enabled'] ) {
				continue;
			}
			$options[ $field['slug'] ] = $field['label'];
		}

		return $options;
	}

	/**
	 * Get the raw custom fields config from FC Pro.
	 *
	 * @return array
	 */
	public static function get_fc_custom_fields() {
		static $cache = null;

		if ( null !== $cache ) {
			return $cache;
		}

		// FluentCommunity Pro stores config via its ProfileFieldsService.
		if ( class_exists( '\FluentCommunityPro\App\Services\ProfileFieldsService' ) ) {
			$cache = \FluentCommunityPro\App\Services\ProfileFieldsService::getFields();
			return $cache;
		}

		// Fallback: read directly from the WP option FC Pro uses.
		if ( method_exists( '\FluentCommunity\App\Functions\Utility', 'getOption' ) ) {
			$config = \FluentCommunity\App\Functions\Utility::getOption( 'custom_profile_fields', array() );
			$cache  = isset( $config['fields'] ) ? $config['fields'] : array();
			return $cache;
		}

		// Last resort: direct option read.
		$option_key = '_fcom_custom_profile_fields'; // FC stores with prefix
		$config     = get_option( $option_key, array() );

		if ( empty( $config ) ) {
			// Try the Utility table if FC uses its own options table.
			global $wpdb;
			$table = $wpdb->prefix . 'fcom_meta';
			if ( $wpdb->get_var( "SHOW TABLES LIKE '{$table}'" ) === $table ) {
				$row = $wpdb->get_var(
					$wpdb->prepare(
						"SELECT `value` FROM `{$table}` WHERE `key` = %s LIMIT 1",
						'custom_profile_fields'
					)
				);
				if ( $row ) {
					$config = maybe_unserialize( $row );
					if ( is_string( $config ) ) {
						$config = json_decode( $config, true );
					}
				}
			}
		}

		$cache = isset( $config['fields'] ) ? (array) $config['fields'] : array();
		return $cache;
	}

	/**
	 * Get the human-readable label for a custom field slug.
	 *
	 * @param string $slug
	 * @return string
	 */
	public static function get_field_label( $slug ) {
		$fields = self::get_fc_custom_fields();

		foreach ( $fields as $field ) {
			if ( isset( $field['slug'] ) && $field['slug'] === $slug ) {
				return isset( $field['label'] ) ? $field['label'] : $slug;
			}
		}

		return $slug;
	}

	/**
	 * Format a field value for display (handles arrays like multiselect).
	 *
	 * @param mixed $value
	 * @return string
	 */
	public static function format_field_value( $value ) {
		if ( is_array( $value ) ) {
			return implode( ', ', $value );
		}
		return (string) $value;
	}
}
