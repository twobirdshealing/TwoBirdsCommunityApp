<?php

namespace TBC_Automator_FCOM_Fields;

/**
 * Uncanny Automator trigger:
 * "A user updates their profile with {{a specific value}} in {{a specific field}}"
 *
 * Fires when a FluentCommunity custom profile field value changes.
 * Mirrors the BuddyBoss BDB_USERUPDATEPROFILEFIELDS trigger pattern.
 */
class FCOM_User_Updates_Custom_Field {

	const INTEGRATION  = 'TBCAUTOMATIONS';
	const TRIGGER_CODE = 'TBC_USER_UPDATES_CUSTOM_FIELD';
	const TRIGGER_META = 'TBC_PROFILE_FIELD';
	const VALUE_META   = 'TBC_FIELD_VALUE';

	public function __construct() {
		$this->define_trigger();
	}

	/**
	 * Register the trigger with Automator.
	 */
	public function define_trigger() {

		$trigger = array(
			'author'              => 'Two Birds Code',
			'support_link'        => '',
			'is_pro'              => false,
			'integration'         => self::INTEGRATION,
			'code'                => self::TRIGGER_CODE,
			'meta'                => self::TRIGGER_META,
			'sentence'            => sprintf(
				'A user updates their profile with {{a specific value:%1$s}} in {{a specific field:%2$s}}',
				self::VALUE_META,
				self::TRIGGER_META
			),
			'select_option_name'  => 'A user updates their profile with {{a specific value}} in {{a specific field}}',
			'action'              => 'tbc_fcom/profile_custom_fields_updated',
			'priority'            => 10,
			'accepted_args'       => 3,
			'validation_function' => array( $this, 'validate_trigger' ),
			'options_callback'    => array( $this, 'load_options' ),
		);

		\Automator()->register->trigger( $trigger );
	}

	/**
	 * Define the trigger option fields shown in the recipe builder UI.
	 *
	 * @return array
	 */
	public function load_options() {
		return \Automator()->utilities->keep_order_of_options(
			array(
				'options_group' => array(
					self::TRIGGER_META => array(
						array(
							'option_code'           => self::TRIGGER_META,
							'label'                 => 'Custom Profile Field',
							'input_type'            => 'select',
							'required'              => true,
							'options'               => FCOM_Fields_Helpers::all_custom_fields( true ),
							'relevant_tokens'       => array(),
							'supports_custom_value' => false,
						),
						\Automator()->helpers->recipe->field->text(
							array(
								'option_code' => self::VALUE_META,
								'label'       => 'Value',
								'description' => 'Enter the exact value to match, or * to trigger on any value change.',
								'required'    => true,
							)
						),
					),
				),
			)
		);
	}

	/**
	 * Validation callback — fires when tbc_fcom/profile_custom_fields_updated is dispatched.
	 *
	 * @param int   $user_id        The user whose profile was updated.
	 * @param array $changed_fields Slug => [ old_value, new_value ] for each changed field.
	 * @param array $all_new_fields Full new custom_fields array.
	 */
	public function validate_trigger( $user_id, $changed_fields, $all_new_fields ) {

		if ( empty( $changed_fields ) ) {
			return;
		}

		$recipes    = \Automator()->get->recipes_from_trigger_code( self::TRIGGER_CODE );
		$conditions = $this->match_conditions( $user_id, $recipes, $changed_fields, $all_new_fields );

		if ( empty( $conditions ) ) {
			return;
		}

		foreach ( $conditions['recipe_ids'] as $trigger_id => $recipe_id ) {

			$args = array(
				'code'             => self::TRIGGER_CODE,
				'meta'             => self::TRIGGER_META,
				'user_id'          => $user_id,
				'ignore_post_id'   => true,
				'is_signed_in'     => true,
				'recipe_to_match'  => $recipe_id,
				'trigger_to_match' => $trigger_id,
			);

			$args = \Automator()->maybe_add_trigger_entry( $args, false );

			if ( ! $args ) {
				continue;
			}

			$user_data = get_userdata( $user_id );
			if ( ! $user_data ) {
				continue;
			}

			foreach ( $args as $result ) {
				if ( true !== $result['result'] || empty( $result['args']['trigger_id'] ) || empty( $result['args']['trigger_log_id'] ) ) {
					continue;
				}

				$run_number = \Automator()->get->trigger_run_number(
					$result['args']['trigger_id'],
					$result['args']['trigger_log_id'],
					$user_id
				);

				$save_meta = array(
					'user_id'        => $user_id,
					'trigger_id'     => $result['args']['trigger_id'],
					'run_number'     => $run_number,
					'trigger_log_id' => $result['args']['trigger_log_id'],
					'ignore_user_id' => true,
				);

				$matched = $conditions['matched'][ $trigger_id ];

				// Save the field name (readable).
				$save_meta['meta_key']   = self::TRIGGER_META;
				$save_meta['meta_value'] = FCOM_Fields_Helpers::get_field_label( $matched['field'] );
				\Automator()->insert_trigger_meta( $save_meta );

				// Save the field slug.
				$save_meta['meta_key']   = 'TBC_PROFILE_FIELD_SLUG';
				$save_meta['meta_value'] = $matched['field'];
				\Automator()->insert_trigger_meta( $save_meta );

				// Save the matched value.
				$save_meta['meta_key']   = self::VALUE_META;
				$save_meta['meta_value'] = FCOM_Fields_Helpers::format_field_value( $matched['new_value'] );
				\Automator()->insert_trigger_meta( $save_meta );

				// Save the old value.
				$save_meta['meta_key']   = 'TBC_FIELD_OLD_VALUE';
				$save_meta['meta_value'] = FCOM_Fields_Helpers::format_field_value( $matched['old_value'] );
				\Automator()->insert_trigger_meta( $save_meta );

				// Save standard user tokens.
				$save_meta['meta_key']   = 'first_name';
				$save_meta['meta_value'] = $user_data->first_name;
				\Automator()->insert_trigger_meta( $save_meta );

				$save_meta['meta_key']   = 'last_name';
				$save_meta['meta_value'] = $user_data->last_name;
				\Automator()->insert_trigger_meta( $save_meta );

				$save_meta['meta_key']   = 'useremail';
				$save_meta['meta_value'] = $user_data->user_email;
				\Automator()->insert_trigger_meta( $save_meta );

				$save_meta['meta_key']   = 'username';
				$save_meta['meta_value'] = $user_data->user_login;
				\Automator()->insert_trigger_meta( $save_meta );

				$save_meta['meta_key']   = 'user_id';
				$save_meta['meta_value'] = $user_data->ID;
				\Automator()->insert_trigger_meta( $save_meta );

				\Automator()->maybe_trigger_complete( $result['args'] );
			}
		}
	}

	/**
	 * Match recipe trigger conditions against the changed fields.
	 *
	 * @param int   $user_id
	 * @param array $recipes
	 * @param array $changed_fields  Slug => [ old_value, new_value ]
	 * @param array $all_new_fields  Full new custom_fields
	 * @return array|false
	 */
	private function match_conditions( $user_id, $recipes, $changed_fields, $all_new_fields ) {

		if ( empty( $recipes ) ) {
			return false;
		}

		$matches    = array();
		$recipe_ids = array();

		// Collect all trigger conditions from recipes.
		foreach ( $recipes as $recipe ) {
			foreach ( $recipe['triggers'] as $trigger ) {
				if ( ! isset( $trigger['meta'][ self::TRIGGER_META ] ) ) {
					continue;
				}
				$matches[ $trigger['ID'] ] = array(
					'field' => $trigger['meta'][ self::TRIGGER_META ],
					'value' => isset( $trigger['meta'][ self::VALUE_META ] ) ? $trigger['meta'][ self::VALUE_META ] : '',
				);
				$recipe_ids[ $trigger['ID'] ] = $recipe['ID'];
			}
		}

		if ( empty( $matches ) ) {
			return false;
		}

		// Evaluate each trigger condition.
		foreach ( $matches as $trigger_id => $match ) {

			$required_field = $match['field'];
			$required_value = $match['value'];

			// "Any field" wildcard — match if ANY field changed.
			if ( '*' === $required_field ) {
				// Pick the first changed field for token data.
				$first_slug = array_key_first( $changed_fields );
				$matches[ $trigger_id ]['matched_slug'] = $first_slug;
				$matches[ $trigger_id ]['old_value']    = $changed_fields[ $first_slug ]['old_value'];
				$matches[ $trigger_id ]['new_value']    = $changed_fields[ $first_slug ]['new_value'];

				// If value is also *, any change matches.
				if ( '*' === $required_value ) {
					continue;
				}

				// Check if ANY changed field has the required value.
				$value_matched = false;
				foreach ( $changed_fields as $slug => $change ) {
					if ( $this->value_matches( $change['new_value'], $required_value ) ) {
						$matches[ $trigger_id ]['matched_slug'] = $slug;
						$matches[ $trigger_id ]['old_value']    = $change['old_value'];
						$matches[ $trigger_id ]['new_value']    = $change['new_value'];
						$value_matched = true;
						break;
					}
				}

				if ( ! $value_matched ) {
					unset( $recipe_ids[ $trigger_id ] );
				}
				continue;
			}

			// Specific field required — must be in the changed set.
			if ( ! isset( $changed_fields[ $required_field ] ) ) {
				unset( $recipe_ids[ $trigger_id ] );
				continue;
			}

			$change   = $changed_fields[ $required_field ];
			$new_val  = $change['new_value'];

			$matches[ $trigger_id ]['old_value'] = $change['old_value'];
			$matches[ $trigger_id ]['new_value'] = $new_val;

			// Wildcard value — any change to this field triggers.
			if ( '*' === $required_value ) {
				continue;
			}

			// Exact value match.
			if ( ! $this->value_matches( $new_val, $required_value ) ) {
				unset( $recipe_ids[ $trigger_id ] );
			}
		}

		if ( empty( $recipe_ids ) ) {
			return false;
		}

		return array(
			'recipe_ids' => $recipe_ids,
			'result'     => true,
			'matched'    => $matches,
		);
	}

	/**
	 * Check if a field value matches the expected trigger value.
	 *
	 * Handles scalars and arrays (multiselect fields).
	 *
	 * @param mixed  $field_value    The actual field value.
	 * @param string $expected_value The value configured in the recipe.
	 * @return bool
	 */
	private function value_matches( $field_value, $expected_value ) {

		// Array field (multiselect): check if expected value(s) are present.
		if ( is_array( $field_value ) ) {
			$expected_parts = array_map( 'trim', explode( ',', $expected_value ) );
			return empty( array_diff( $expected_parts, $field_value ) );
		}

		// Scalar comparison (case-sensitive, matching BuddyBoss behavior).
		return (string) $field_value === (string) $expected_value;
	}
}
