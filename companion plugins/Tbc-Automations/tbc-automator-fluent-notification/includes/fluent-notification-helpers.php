<?php

namespace TBC_Automator_Fluent_Notification;

use FluentCommunity\App\Models\Notification;

/**
 * Helper class for sending FluentCommunity notifications.
 *
 * Uses FluentCommunity's native Notification model directly,
 * mirroring the pattern in NotificationEventHandler.
 */
class Fluent_Notification_Helpers {

	/**
	 * Send a native FluentCommunity notification to a user.
	 *
	 * @param int        $recipient_id WordPress user ID of the recipient.
	 * @param string     $content      HTML notification content.
	 * @param array|null $route        Optional. FC route array with 'name' and 'params' keys.
	 * @param string     $title        Optional. Notification title (e.g. "Order Cancelled"). Prepended as bold text
	 *                                 to the bell notification content, and passed separately for the push title.
	 * @param int        $sender_id    Optional. WordPress user ID whose avatar/name appears on the notification.
	 *                                 Defaults to site admin (user ID 1) if empty or zero.
	 *
	 * @return true|\WP_Error True on success, WP_Error on failure.
	 */
	public static function send_notification( int $recipient_id, string $content, $route = null, string $title = '', int $sender_id = 0 ) {

		try {

			// Merge title into content for the bell notification (FC doesn't use a title field).
			// e.g. "<b>Order Cancelled</b> Your donation #123 has been cancelled."
			$full_content = $content;
			if ( ! empty( $title ) ) {
				$full_content = '<b>' . esc_html( $title ) . '</b> ' . $content;
			}

			// Default to site admin (user ID 1) so FC can load a real xprofile for the notification.
			if ( empty( $sender_id ) ) {
				$sender_id = 1;
			}

			$notification_data = array(
				'src_user_id'     => $sender_id,
				'src_object_type' => 'automated',
				'action'          => 'automated/notification',
				'content'         => wp_kses_post( $full_content ),
			);

			if ( $route ) {
				$notification_data['route'] = $route;
			}

			$notification = Notification::create( $notification_data );

			$notification->subscribe( array( $recipient_id ) );

			/**
			 * Fires after an automated notification is created.
			 *
			 * Hook into this from tbc-community-app to trigger push notifications.
			 *
			 * push_title and push_body are passed separately because the bell content
			 * has the title merged in as bold HTML — the push needs them split.
			 *
			 * @param array $data {
			 *     @type int[]        $user_ids   Array of recipient user IDs.
			 *     @type Notification $notification The created Notification model.
			 *     @type string       $push_title Optional. Custom push notification title.
			 *     @type string       $push_body  Original content without title prefix.
			 * }
			 */
			do_action( 'fluent_community/notification/automated', array(
				'user_ids'   => array( $recipient_id ),
				'notification' => $notification,
				'push_title' => sanitize_text_field( $title ),
				'push_body'  => wp_strip_all_tags( $content ),
			) );

			return true;

		} catch ( \Throwable $e ) {
			return new \WP_Error(
				'fluent_notification_failed',
				sprintf( 'Fluent Notification error: %s', $e->getMessage() )
			);
		}
	}
}
