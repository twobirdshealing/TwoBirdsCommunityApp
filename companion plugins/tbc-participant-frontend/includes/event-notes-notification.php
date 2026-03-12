<?php
/**
 * Event Notes Notification Class
 *
 * Sends email notifications when event notes are added/updated.
 * Replaces the BuddyBoss BP_Core_Notification_Abstract implementation.
 *
 * @package TBC_Participant_Frontend
 * @since 4.0.0
 */

defined('ABSPATH') || exit;

class TBC_PF_Event_Notes_Notification {

    private static $instance = null;

    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Send Event Note notification via email
     *
     * @param int $order_id WooCommerce order ID
     * @param array $user_ids Array of user IDs to notify
     */
    public function send_event_note_notification($order_id, $user_ids) {
        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }

        $note_content = $order->get_meta('_tbc_pf_event_notes', true);
        $note_content = $note_content ?: __('No event note content available.', 'tbc-participant-frontend');

        $customer_name = $order->get_billing_first_name() . ' ' . $order->get_billing_last_name();

        $product_name = '';
        $items = $order->get_items();
        if (!empty($items)) {
            $item = current($items);
            $product_name = $item->get_name();
        }

        $subject = sprintf(
            __('New Event Note - %s', 'tbc-participant-frontend'),
            $product_name
        );

        $message = sprintf(
            __("Event note for %s (%s):\n\n%s", 'tbc-participant-frontend'),
            $customer_name,
            $product_name,
            $note_content
        );

        foreach ($user_ids as $uid) {
            $user = get_userdata($uid);
            if (!$user) {
                continue;
            }
            wp_mail($user->user_email, $subject, $message);
        }
    }
}
