<?php
/**
 * BuddyBoss Message Notification Extension
 * Extends BuddyBoss notification system for SMS and voicemail messages
 * 
 * NOTE: BP_Message_Notification class extends BuddyBoss core - keep class name for compatibility
 */
 
defined('ABSPATH') || exit;
 
if (!class_exists('BP_Core_Notification_Abstract')) {
    return;
}

// Load the message notification class
add_action('bp_init', function() {
    if (class_exists('BP_Message_Notification')) {
        BP_Message_Notification::instance();
    }
});
 
/**
 * Unified Message Notification Class
 * Extends BuddyBoss core notification system
 */
class BP_Message_Notification extends BP_Core_Notification_Abstract {
 
    /**
     * Instance of this class
     */
    private static $instance = null;
 
    /**
     * Get the instance of this class (singleton)
     */
    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Constructor method
     */
    public function __construct() {
        $this->start();
    }

    /**
     * Initialize notification registration
     */
    public function load() {
 
        // Register notification group for messages
        $this->register_notification_group(
            'message',
            esc_html__('Messages', 'buddyboss'),
            esc_html__('Messages', 'buddyboss')
        );
          
        $this->register_custom_notification();
    }

    /**
     * Register notification for new messages
     */
    public function register_custom_notification() {
        
        // Register notification type
        $this->register_notification_type(
            'new_message',
            esc_html__('New Message', 'buddyboss'),
            esc_html__('New Message', 'buddyboss'),
            'message'
        );

        // Add email schema
        $this->register_email_type(
            'message_notification',
            array(
                'email_title'         => __('You have a new message', 'buddyboss'),
                'email_content'       => __('You have received a new message: {{message_content}}', 'buddyboss'),
                'email_plain_content' => __('You have received a new message: {{message_content}}', 'buddyboss'),
                'situation_label'     => __('New message received', 'buddyboss'),
                'unsubscribe_text'    => __('You will no longer receive emails for new messages.', 'buddyboss'),
            ),
            'new_message'
        );

        // Register notification
        $this->register_notification(
            'message',
            'new_message_received',
            'new_message'
        );

        // Register notification filter
        $this->register_notification_filter(
            __('Messages', 'buddyboss'),
            array('new_message'),
            5
        );
    }

    /**
     * Format the notifications for display
     */
    public function format_notification($content, $item_id, $secondary_item_id, $action_item_count, $component_action_name, $component_name, $notification_id, $screen) {
          
        if ('message' === $component_name && 'new_message_received' === $component_action_name) {
            
            $text = esc_html__('You have received a new message.', 'buddyboss');
            $link = 'https://community.twobirdschurch.com/admin/';

            // Change text for push notifications
            if ($screen == 'app_push' || $screen == 'web_push') {
                $text = esc_html__('New Message Received!', 'buddyboss');
            }

            return array(
                'title' => '', // optional - only for push notification
                'text' => $text,
                'link' => $link,
            );
        }

        return $content;
    }

    /**
     * Send unified message notification
     * Works for both SMS and voicemail
     */
    public function sendMessageNotification($message_id, $user_ids) {
        global $wpdb;
        
        // Use new table name
        $table_name = $wpdb->prefix . 'tbc_mc_messages';
        $message_data = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table_name WHERE id = %d", $message_id));

        if (!$message_data) {
            return;
        }

        // Get message content (works for both SMS content and voicemail transcription)
        $message_content = $message_data ? $message_data->content : __('No message content available.', 'buddyboss');
        
        // Limit content length for notifications
        if (strlen($message_content) > 100) {
            $message_content = substr($message_content, 0, 97) . '...';
        }

        foreach ($user_ids as $user_id) {
            // Add notification for each user
            bp_notifications_add_notification(array(
                'user_id'           => $user_id,
                'item_id'           => time(),
                'secondary_item_id' => $message_id,
                'component_name'    => 'message',
                'component_action'  => 'new_message_received',
                'date_notified'     => bp_core_current_time(),
                'is_new'            => 1,
            ));

            // Send email to each user
            bp_send_email(
                'message_notification',
                $user_id,
                array(
                    'tokens' => array(
                        'message_content' => $message_content,
                    ),
                )
            );
        }
    }
}

/**
 * Display custom message notification avatar
 * Our custom function - uses tbc_mc_ prefix
 */
function tbc_mc_notification_avatar() {
    $avatar_url = "https://media.twobirdschurch.com/wp-content/uploads/2023/10/07152140/comments.png";
    echo '<img src="' . esc_url($avatar_url) . '" class="avatar message-avatar" alt="' . esc_attr__('Message Avatar', 'buddyboss') . '">';
}
add_action('bb_notification_avatar_message', 'tbc_mc_notification_avatar');

/**
 * Modify message notification avatar URL for API responses
 * Our custom function - uses tbc_mc_ prefix
 */
function tbc_mc_modify_avatar_url($response) {
    $data = $response->get_data();
    
    if (
        !empty($data) &&
        !empty($data['component']) &&
        'message' === $data['component']
    ) {
        $avatar_url = "https://media.twobirdschurch.com/wp-content/uploads/2023/10/07152140/comments.png";
        $data['avatar_urls'] = array(
            'full'  => $avatar_url,
            'thumb' => $avatar_url,
        );
        $response->set_data($data);
    }
    
    return $response;
}
add_filter('bp_rest_notifications_prepare_value', 'tbc_mc_modify_avatar_url', 20, 1);