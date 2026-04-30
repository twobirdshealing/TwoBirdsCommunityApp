<?php

namespace TBC_Automator_FluentChat;

/**
 * Uncanny Automator action: Send a FluentChat direct message.
 */
class FluentChat_Send_DM {

	const ACTION_CODE    = 'TBC_SEND_DM';
	const ACTION_META    = 'TBC_DM_CONTENT';
	const MESSAGE_GROUP  = 'TBC_DM_MSG';
	const SENDER_KEY     = 'TBC_DM_SENDER';
	const RECIPIENT_KEY  = 'TBC_DM_RECIPIENT';

	public function __construct() {
		$this->define_action();
	}

	/**
	 * Register the action with Automator.
	 */
	public function define_action() {

		$action = array(
			'author'             => 'Two Birds Code',
			'support_link'       => '',
			'is_pro'             => false,
			'requires_user'      => false,
			'integration'        => Add_FluentChat_Integration::INTEGRATION,
			'code'               => self::ACTION_CODE,
			'sentence'           => sprintf(
				'Send {{a direct message:%1$s}} to {{a specific user:%2$s}}',
				self::MESSAGE_GROUP,
				self::RECIPIENT_KEY
			),
			'select_option_name' => 'Send {{a direct message}} to {{a specific user}}',
			'priority'           => 10,
			'accepted_args'      => 1,
			'execution_function' => array( $this, 'send_dm' ),
			'options_callback'   => array( $this, 'load_options' ),
		);

		\Automator()->register->action( $action );
	}

	/**
	 * Define the action fields shown in the recipe UI.
	 */
	public function load_options() {
		return \Automator()->utilities->keep_order_of_options(
			array(
				'options_group' => array(
					self::RECIPIENT_KEY => array(
						\Automator()->helpers->recipe->field->text_field(
							self::RECIPIENT_KEY,
							esc_attr__( 'Recipient user ID', 'tbc-automator-fluentchat' ),
							true,
							'text',
							'',
							false,
							esc_attr__( 'WordPress user ID of the recipient. Use a token like {{User ID}} from the trigger.', 'tbc-automator-fluentchat' )
						),
					),
					self::MESSAGE_GROUP => array(
						\Automator()->helpers->recipe->field->text_field(
							self::SENDER_KEY,
							esc_attr__( 'Sender user ID (optional)', 'tbc-automator-fluentchat' ),
							true,
							'text',
							'',
							false,
							esc_attr__( 'WordPress user ID of the sender. Defaults to site admin (user ID 1) if empty.', 'tbc-automator-fluentchat' )
						),
						\Automator()->helpers->recipe->field->text(
							array(
								'option_code'      => self::ACTION_META,
								'label'            => esc_attr__( 'Message content', 'tbc-automator-fluentchat' ),
								'input_type'       => 'textarea',
								'supports_tokens'  => true,
								'supports_tinymce' => true,
								'required'         => true,
								'description'      => esc_attr__( 'The message to send. Supports tokens and merge tags from the trigger.', 'tbc-automator-fluentchat' ),
							)
						),
					),
				),
			)
		);
	}

	/**
	 * Execute the action — send a FluentChat DM.
	 */
	public function send_dm( $user_id, $action_data, $recipe_id, $args ) {

		try {
			$sender_id    = absint( \Automator()->parse->text( $action_data['meta'][ self::SENDER_KEY ] ?? '', $recipe_id, $user_id, $args ) );
			$recipient_id = absint( \Automator()->parse->text( $action_data['meta'][ self::RECIPIENT_KEY ] ?? '', $recipe_id, $user_id, $args ) );
			$message      = \Automator()->parse->text( $action_data['meta'][ self::ACTION_META ] ?? '', $recipe_id, $user_id, $args );
			$message      = do_shortcode( $message );

			// Default to site admin (user ID 1) if sender is empty.
			if ( empty( $sender_id ) ) {
				$sender_id = 1;
			}

			if ( empty( $recipient_id ) ) {
				return $this->complete_with_error( $user_id, $action_data, $recipe_id, 'Recipient user ID is empty or invalid.' );
			}

			if ( $sender_id === $recipient_id ) {
				return $this->complete_with_error( $user_id, $action_data, $recipe_id, 'Sender and recipient cannot be the same user.' );
			}

			if ( ! get_userdata( $sender_id ) ) {
				return $this->complete_with_error( $user_id, $action_data, $recipe_id, sprintf( 'Sender user ID %d does not exist.', $sender_id ) );
			}

			if ( ! get_userdata( $recipient_id ) ) {
				return $this->complete_with_error( $user_id, $action_data, $recipe_id, sprintf( 'Recipient user ID %d does not exist.', $recipient_id ) );
			}

			if ( empty( trim( $message ) ) ) {
				return $this->complete_with_error( $user_id, $action_data, $recipe_id, 'Message content is empty.' );
			}

			$result = FluentChat_Helpers::send_dm( $sender_id, $recipient_id, $message );

			if ( is_wp_error( $result ) ) {
				return $this->complete_with_error( $user_id, $action_data, $recipe_id, $result->get_error_message() );
			}

			\Automator()->complete_action( $user_id, $action_data, $recipe_id );

		} catch ( \Throwable $e ) {
			$this->complete_with_error( $user_id, $action_data, $recipe_id, sprintf( 'Uncaught error: %s', $e->getMessage() ) );
		}
	}

	/**
	 * Complete the action with an error message.
	 */
	private function complete_with_error( $user_id, &$action_data, $recipe_id, $message ) {
		$action_data['complete_with_errors'] = true;
		\Automator()->complete_action( $user_id, $action_data, $recipe_id, $message );
	}
}
