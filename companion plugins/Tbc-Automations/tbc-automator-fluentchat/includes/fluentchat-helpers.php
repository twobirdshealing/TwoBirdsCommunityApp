<?php

namespace TBC_Automator_FluentChat;

use FluentMessaging\App\Models\Thread;
use FluentMessaging\App\Models\Message;
use FluentMessaging\App\Services\ChatHelper;

/**
 * Helper class for sending FluentChat direct messages.
 *
 * Uses FluentChat's native Eloquent models and hooks exclusively.
 * Mirrors the logic in ChatController::createIntendedThread().
 */
class FluentChat_Helpers {

	/**
	 * Send a direct message from one user to another via FluentChat.
	 *
	 * @param int    $sender_id    WordPress user ID of the sender.
	 * @param int    $recipient_id WordPress user ID of the recipient.
	 * @param string $message      Message text (will be wrapped in chat_text HTML).
	 *
	 * @return true|\WP_Error True on success, WP_Error on failure.
	 */
	public static function send_dm( int $sender_id, int $recipient_id, string $message ) {

		try {
			$message_html = '<div class="chat_text">' . nl2br( wp_kses_post( $message ) ) . '</div>';

			// Find or create a DM thread between the two users
			$thread = ChatHelper::getUserToUserThread( $sender_id, $recipient_id );

			if ( ! $thread ) {
				$sender    = get_userdata( $sender_id );
				$recipient = get_userdata( $recipient_id );

				$thread = Thread::create( array(
					'title'  => sprintf(
						'Chat between %s & %s',
						$recipient ? $recipient->display_name : 'User',
						$sender ? $sender->display_name : 'User'
					),
					'status' => 'active',
				) );

				$thread->users()->attach( array( $recipient_id, $sender_id ) );
			}

			// Create the message
			$new_message = Message::create( array(
				'thread_id' => $thread->id,
				'user_id'   => $sender_id,
				'text'      => $message_html,
			) );

			do_action( 'fluent_messaging/after_add_message', $new_message );

			return true;

		} catch ( \Throwable $e ) {
			return new \WP_Error(
				'fluentchat_send_failed',
				sprintf( 'FluentChat error: %s', $e->getMessage() )
			);
		}
	}
}
