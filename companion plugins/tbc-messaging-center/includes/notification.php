<?php
/**
 * Message Notification Handler
 * Sends email notifications for incoming SMS and voicemail messages
 */

defined('ABSPATH') || exit;

class TBC_MC_Notification {

    private static $instance = null;

    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Send notification for a new message (SMS or voicemail)
     *
     * @param int   $message_id Row ID in wp_tbc_mc_messages
     * @param int[] $user_ids   WordPress user IDs to notify
     */
    public function sendMessageNotification($message_id, $user_ids) {
        global $wpdb;

        $table_name = $wpdb->prefix . 'tbc_mc_messages';
        $message_data = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table_name WHERE id = %d", $message_id));

        if (!$message_data) {
            return;
        }

        $message_content = $message_data->content ?: __('No message content available.', 'tbc-mc');

        if (strlen($message_content) > 100) {
            $message_content = substr($message_content, 0, 97) . '...';
        }

        $type_label = ($message_data->type === 'voicemail') ? 'Voicemail' : 'SMS';
        $subject = sprintf(__('New %s Received', 'tbc-mc'), $type_label);

        foreach ($user_ids as $user_id) {
            $user = get_user_by('id', $user_id);
            if (!$user || empty($user->user_email)) {
                continue;
            }

            $body = sprintf(
                __("You have received a new %s from %s:\n\n%s\n\nView in Message Center: %s", 'tbc-mc'),
                strtolower($type_label),
                $message_data->sender_number,
                $message_content,
                admin_url('admin.php?page=tbc-messaging-center')
            );

            wp_mail($user->user_email, $subject, $body);
        }

        /**
         * Fires after a new message notification is sent.
         * Other plugins (e.g. tbc-community-app) can hook in for push notifications.
         *
         * @param int   $message_id  The message row ID
         * @param int[] $user_ids    Notified user IDs
         * @param object $message_data The message row from DB
         */
        do_action('tbc_mc_new_message', $message_id, $user_ids, $message_data);
    }
}
