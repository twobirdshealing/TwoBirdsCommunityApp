<?php

namespace TBC_Automator_Fluent_Notification;

/**
 * Uncanny Automator action: Send a FluentCommunity notification to a user.
 */
class Fluent_Notification_Send {

	const ACTION_CODE      = 'TBC_SEND_NOTIFICATION';
	const ACTION_META      = 'TBC_NOTIFICATION_CONTENT';
	const CONTENT_GROUP    = 'TBC_NOTIFICATION_MSG';
	const RECIPIENT_KEY    = 'TBC_NOTIFICATION_RECIPIENT';
	const ROUTE_TYPE_KEY   = 'TBC_NOTIFICATION_ROUTE_TYPE';
	const ROUTE_SPACE_KEY  = 'TBC_NOTIFICATION_ROUTE_SPACE';
	const ROUTE_POST_KEY   = 'TBC_NOTIFICATION_ROUTE_POST';
	const ROUTE_USER_KEY   = 'TBC_NOTIFICATION_ROUTE_USER';
	const ROUTE_COURSE_KEY = 'TBC_NOTIFICATION_ROUTE_COURSE';
	const ROUTE_LESSON_KEY = 'TBC_NOTIFICATION_ROUTE_LESSON';
	const TITLE_KEY        = 'TBC_NOTIFICATION_TITLE';
	const SENDER_KEY       = 'TBC_NOTIFICATION_SENDER';

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
			'integration'        => Add_Fluent_Notification_Integration::INTEGRATION,
			'code'               => self::ACTION_CODE,
			'sentence'           => sprintf(
				'Send {{a notification:%1$s}} to {{a specific user:%2$s}}',
				self::CONTENT_GROUP,
				self::RECIPIENT_KEY
			),
			'select_option_name' => 'Send {{a notification}} to {{a specific user}}',
			'priority'           => 10,
			'accepted_args'      => 1,
			'execution_function' => array( $this, 'send_notification' ),
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
							esc_attr__( 'Recipient user ID', 'tbc-automator-fluent-notification' ),
							true,
							'text',
							'',
							true,
							esc_attr__( 'WordPress user ID of the recipient. Use a token like {{User ID}} from the trigger.', 'tbc-automator-fluent-notification' )
						),
					),
					self::CONTENT_GROUP => array(
						\Automator()->helpers->recipe->field->text_field(
							self::SENDER_KEY,
							esc_attr__( 'Sender user ID (optional)', 'tbc-automator-fluent-notification' ),
							true,
							'text',
							'',
							false,
							esc_attr__( 'WordPress user ID of the sender. Defaults to site admin (user ID 1) if empty.', 'tbc-automator-fluent-notification' )
						),
						\Automator()->helpers->recipe->field->text(
							array(
								'option_code'      => self::ACTION_META,
								'label'            => esc_attr__( 'Notification content', 'tbc-automator-fluent-notification' ),
								'input_type'       => 'textarea',
								'supports_tokens'  => true,
								'supports_tinymce' => true,
								'required'         => true,
								'description'      => esc_attr__( 'The notification text shown in the bell. Supports tokens and merge tags from the trigger.', 'tbc-automator-fluent-notification' ),
							)
						),
						\Automator()->helpers->recipe->field->text_field(
							self::TITLE_KEY,
							esc_attr__( 'Notification title (optional)', 'tbc-automator-fluent-notification' ),
							true,
							'text',
							'',
							false,
							esc_attr__( 'Optional title shown in bold at the start of the in-app notification. Also used as the push notification title for users with the TBC Mobile App installed. If empty, no bold prefix appears in the bell and pushes default to "New Notification".', 'tbc-automator-fluent-notification' )
						),
						array(
							'option_code'           => self::ROUTE_TYPE_KEY,
							'label'                 => esc_attr__( 'Click destination (optional)', 'tbc-automator-fluent-notification' ),
							'input_type'            => 'select',
							'required'              => false,
							'relevant_tokens'       => array(),
							'supports_custom_value' => false,
							'description'           => esc_attr__( 'Where the notification navigates when clicked.', 'tbc-automator-fluent-notification' ),
							'options'               => array(
								'none'         => esc_attr__( 'None (no link)', 'tbc-automator-fluent-notification' ),
								'space_feeds'  => esc_attr__( 'Space home', 'tbc-automator-fluent-notification' ),
								'space_feed'   => esc_attr__( 'Post in a space', 'tbc-automator-fluent-notification' ),
								'single_feed'  => esc_attr__( 'Community post (no space)', 'tbc-automator-fluent-notification' ),
								'user_profile' => esc_attr__( 'User profile', 'tbc-automator-fluent-notification' ),
								'course_home'  => esc_attr__( 'Course home', 'tbc-automator-fluent-notification' ),
								'view_lesson'  => esc_attr__( 'Course lesson', 'tbc-automator-fluent-notification' ),
							),
						),
						array(
							'option_code'        => self::ROUTE_SPACE_KEY,
							'label'              => esc_attr__( 'Space ID or slug', 'tbc-automator-fluent-notification' ),
							'input_type'         => 'text',
							'required'           => false,
							'supports_tokens'    => true,
							'description'        => esc_attr__( 'Use the Space ID token from your trigger, or type a slug like "book-club".', 'tbc-automator-fluent-notification' ),
							'dynamic_visibility' => self::visibility_for( array( 'space_feeds', 'space_feed' ) ),
						),
						array(
							'option_code'        => self::ROUTE_POST_KEY,
							'label'              => esc_attr__( 'Post ID or slug', 'tbc-automator-fluent-notification' ),
							'input_type'         => 'text',
							'required'           => false,
							'supports_tokens'    => true,
							'description'        => esc_attr__( 'The feed/post ID or slug. Use a token from your trigger if available.', 'tbc-automator-fluent-notification' ),
							'dynamic_visibility' => self::visibility_for( array( 'space_feed', 'single_feed' ) ),
						),
						array(
							'option_code'        => self::ROUTE_USER_KEY,
							'label'              => esc_attr__( 'Username', 'tbc-automator-fluent-notification' ),
							'input_type'         => 'text',
							'required'           => false,
							'supports_tokens'    => true,
							'description'        => esc_attr__( 'Use a username token from your trigger, or type a username like "johndoe".', 'tbc-automator-fluent-notification' ),
							'dynamic_visibility' => self::visibility_for( array( 'user_profile' ) ),
						),
						array(
							'option_code'        => self::ROUTE_COURSE_KEY,
							'label'              => esc_attr__( 'Course ID or slug', 'tbc-automator-fluent-notification' ),
							'input_type'         => 'text',
							'required'           => false,
							'supports_tokens'    => true,
							'description'        => esc_attr__( 'Use a Course ID token from your trigger, or type a course slug.', 'tbc-automator-fluent-notification' ),
							'dynamic_visibility' => self::visibility_for( array( 'course_home', 'view_lesson' ) ),
						),
						array(
							'option_code'        => self::ROUTE_LESSON_KEY,
							'label'              => esc_attr__( 'Lesson slug', 'tbc-automator-fluent-notification' ),
							'input_type'         => 'text',
							'required'           => false,
							'supports_tokens'    => true,
							'description'        => esc_attr__( 'The lesson slug within the course.', 'tbc-automator-fluent-notification' ),
							'dynamic_visibility' => self::visibility_for( array( 'view_lesson' ) ),
						),
					),
				),
			)
		);
	}

	/**
	 * Build the dynamic_visibility array for conditional field display.
	 *
	 * @param array $route_types Route type values that should trigger this field to show.
	 * @return array Automator dynamic_visibility config.
	 */
	private static function visibility_for( array $route_types ): array {
		return array(
			'default_state'    => 'hidden',
			'visibility_rules' => array(
				array(
					'operator'             => count( $route_types ) > 1 ? 'OR' : 'AND',
					'rule_conditions'      => array_map( function ( $val ) {
						return array(
							'option_code' => self::ROUTE_TYPE_KEY,
							'compare'     => '==',
							'value'       => $val,
						);
					}, $route_types ),
					'resulting_visibility' => 'show',
				),
			),
		);
	}

	/**
	 * Execute the action — send a FluentCommunity notification.
	 */
	public function send_notification( $user_id, $action_data, $recipe_id, $args ) {

		try {
			$meta         = $action_data['meta'];
			$parse        = \Automator()->parse;
			$recipient_id = absint( $parse->text( $meta[ self::RECIPIENT_KEY ] ?? '', $recipe_id, $user_id, $args ) );
			$content      = trim( do_shortcode( $parse->text( $meta[ self::ACTION_META ] ?? '', $recipe_id, $user_id, $args ) ) );
			$title        = trim( $parse->text( $meta[ self::TITLE_KEY ] ?? '', $recipe_id, $user_id, $args ) );
			$sender_id    = absint( $parse->text( $meta[ self::SENDER_KEY ] ?? '', $recipe_id, $user_id, $args ) );

			if ( empty( $recipient_id ) ) {
				return $this->complete_with_error( $user_id, $action_data, $recipe_id, 'Recipient user ID is empty or invalid.' );
			}

			if ( ! get_userdata( $recipient_id ) ) {
				return $this->complete_with_error( $user_id, $action_data, $recipe_id, sprintf( 'Recipient user ID %d does not exist.', $recipient_id ) );
			}

			if ( empty( $content ) ) {
				return $this->complete_with_error( $user_id, $action_data, $recipe_id, 'Notification content is empty.' );
			}

			$route = $this->build_route_from_meta( $meta, $recipe_id, $user_id, $args );

			$result = Fluent_Notification_Helpers::send_notification( $recipient_id, $content, $route, $title, $sender_id );

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

	/**
	 * Parse the route type from meta and resolve only the fields needed for that type.
	 *
	 * @return array|null FC route array or null.
	 */
	private function build_route_from_meta( $meta, $recipe_id, $user_id, $args ) {
		$route_type = sanitize_text_field( $meta[ self::ROUTE_TYPE_KEY ] ?? 'none' );
		$parse      = \Automator()->parse;

		switch ( $route_type ) {
			case 'space_feeds':
				$space = self::resolve_slug( trim( $parse->text( $meta[ self::ROUTE_SPACE_KEY ] ?? '', $recipe_id, $user_id, $args ) ), \FluentCommunity\App\Models\Space::class );
				return $space ? array( 'name' => 'space_feeds', 'params' => array( 'space' => $space ) ) : null;

			case 'space_feed':
				$space = self::resolve_slug( trim( $parse->text( $meta[ self::ROUTE_SPACE_KEY ] ?? '', $recipe_id, $user_id, $args ) ), \FluentCommunity\App\Models\Space::class );
				$post  = self::resolve_slug( trim( $parse->text( $meta[ self::ROUTE_POST_KEY ] ?? '', $recipe_id, $user_id, $args ) ), \FluentCommunity\App\Models\Feed::class );
				return ( $space && $post ) ? array( 'name' => 'space_feed', 'params' => array( 'space' => $space, 'feed_slug' => $post ) ) : null;

			case 'single_feed':
				$post = self::resolve_slug( trim( $parse->text( $meta[ self::ROUTE_POST_KEY ] ?? '', $recipe_id, $user_id, $args ) ), \FluentCommunity\App\Models\Feed::class );
				return $post ? array( 'name' => 'single_feed', 'params' => array( 'feed_slug' => $post ) ) : null;

			case 'user_profile':
				$username = sanitize_user( trim( $parse->text( $meta[ self::ROUTE_USER_KEY ] ?? '', $recipe_id, $user_id, $args ) ) );
				return $username ? array( 'name' => 'user_profile', 'params' => array( 'username' => $username ) ) : null;

			case 'course_home':
				$course = self::resolve_slug( trim( $parse->text( $meta[ self::ROUTE_COURSE_KEY ] ?? '', $recipe_id, $user_id, $args ) ), \FluentCommunity\App\Models\Space::class );
				return $course ? array( 'name' => 'space_feeds', 'params' => array( 'space' => $course ) ) : null;

			case 'view_lesson':
				$course = self::resolve_slug( trim( $parse->text( $meta[ self::ROUTE_COURSE_KEY ] ?? '', $recipe_id, $user_id, $args ) ), \FluentCommunity\App\Models\Space::class );
				$lesson = sanitize_title( trim( $parse->text( $meta[ self::ROUTE_LESSON_KEY ] ?? '', $recipe_id, $user_id, $args ) ) );
				return ( $course && $lesson ) ? array( 'name' => 'view_lesson', 'params' => array( 'course_slug' => $course, 'lesson_slug' => $lesson ) ) : null;

			default:
				return null;
		}
	}

	/**
	 * Resolve an ID or slug string to a model slug via DB lookup.
	 *
	 * @param string $value  Numeric ID or slug string.
	 * @param string $model  Fully-qualified model class (e.g. Space::class, Feed::class).
	 * @return string Slug, or empty string if not found.
	 */
	private static function resolve_slug( $value, $model ) {
		if ( empty( $value ) ) {
			return '';
		}

		if ( is_numeric( $value ) ) {
			$record = $model::find( absint( $value ) );
			return $record ? $record->slug : '';
		}

		return sanitize_title( $value );
	}
}
