<?php
/**
 * BuddyBoss Custom Notification Class for Event Notes
 * 
 * @package TBC_Participant_Frontend
 * @since 3.0.0
 */

defined('ABSPATH') || exit;

if (!class_exists('BP_Core_Notification_Abstract')) {
    return;
}

// Load the Event Notes notification class
add_action('bp_init', function() {
    if (class_exists('TBC_PF_Event_Notes_Notification')) {
        TBC_PF_Event_Notes_Notification::instance();
    }
});

/**
 * Event Notes Notification Class
 */
class TBC_PF_Event_Notes_Notification extends BP_Core_Notification_Abstract {
 
    private static $instance = null;

    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function __construct() {
        $this->start();
    }

    public function load() {
        $this->register_notification_group(
            'tbc_pf_event_notes',
            esc_html__('Event Notes', 'tbc-participant-frontend'),
            esc_html__('Event Notes', 'tbc-participant-frontend')
        );

        $this->register_custom_notification();
    }

    public function register_custom_notification() {
        $this->register_notification_type(
            'tbc_pf_new_event_note',
            esc_html__('New Event Note', 'tbc-participant-frontend'),
            esc_html__('New Event Note', 'tbc-participant-frontend'),
            'tbc_pf_event_notes'
        );

        $this->register_email_type(
            'tbc_pf_event_note_notification',
            [
                'email_title'         => __('You have a new event note', 'tbc-participant-frontend'),
                'email_content'       => __('You have received a new event note: {{event_note_content}}', 'tbc-participant-frontend'),
                'email_plain_content' => __('You have received a new event note: {{event_note_content}}', 'tbc-participant-frontend'),
                'situation_label'     => __('New event note received', 'tbc-participant-frontend'),
                'unsubscribe_text'    => __('You will no longer receive emails for new event notes.', 'tbc-participant-frontend'),
            ],
            'tbc_pf_new_event_note'
        );

        $this->register_notification(
            'tbc_pf_event_notes',
            'tbc_pf_new_event_note_received',
            'tbc_pf_new_event_note'
        );

        $this->register_notification_filter(
            __('Event Notes', 'tbc-participant-frontend'),
            ['tbc_pf_new_event_note'],
            5
        );
    }

    public function format_notification($content, $item_id, $secondary_item_id, $action_item_count, $component_action_name, $component_name, $notification_id, $screen) {
        if ($component_name !== 'tbc_pf_event_notes' || $component_action_name !== 'tbc_pf_new_event_note_received') {
            return $content;
        }
        
        $text = esc_html__('You have received a new event note.', 'tbc-participant-frontend');
        $link = site_url('/admin');

        if ($screen === 'app_push' || $screen === 'web_push') {
            $text = esc_html__('New Event Note Received!', 'tbc-participant-frontend');
        }

        return [
            'title' => '',
            'text' => $text,
            'link' => $link,
        ];
    }

    /**
     * Send Event Note notification
     */
    public function send_event_note_notification($order_id, $user_ids) {
        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }
        
        $note_content = $order->get_meta('_tbc_pf_event_notes', true);
        $note_content = $note_content ?: __('No event note content available.', 'tbc-participant-frontend');

        $product_name = '';
        $customer_name = $order->get_billing_first_name() . ' ' . $order->get_billing_last_name();

        $items = $order->get_items();
        if (!empty($items)) {
            $item = current($items);
            $product_name = $item->get_name();
        }

        foreach ($user_ids as $user_id) {
            bp_notifications_add_notification([
                'user_id'           => $user_id,
                'item_id'           => $order_id,
                'secondary_item_id' => time(),
                'component_name'    => 'tbc_pf_event_notes',
                'component_action'  => 'tbc_pf_new_event_note_received',
                'date_notified'     => bp_core_current_time(),
                'is_new'            => 1,
            ]);

            bp_send_email(
                'tbc_pf_event_note_notification',
                $user_id,
                [
                    'tokens' => [
                        'event_note_content' => $note_content,
                        'product_name' => $product_name,
                        'customer_name' => $customer_name
                    ],
                ]
            );
        }
    }
}

/**
 * Notification avatar for event notes
 */
function tbc_pf_event_notes_notification_avatar() {
    $avatar_url = 'https://media.twobirdschurch.com/wp-content/uploads/2024/02/03144818/contact-list.png';
    echo '<img src="' . esc_url($avatar_url) . '" class="avatar tbc-pf-event-notes-avatar" alt="' . esc_attr__('Event Notes Avatar', 'tbc-participant-frontend') . '">';
}
add_action('bb_notification_avatar_tbc_pf_event_notes', 'tbc_pf_event_notes_notification_avatar');

/**
 * Modify notification avatar URL for REST API
 */
function tbc_pf_modify_event_notes_notification_avatar_url($response) {
    $data = $response->get_data();
    if (empty($data) || ($data['component'] ?? '') !== 'tbc_pf_event_notes') {
        return $response;
    }
    
    $avatar_url = 'https://media.twobirdschurch.com/wp-content/uploads/2024/02/03144818/contact-list.png';
    $data['avatar_urls'] = [
        'full'  => $avatar_url,
        'thumb' => $avatar_url,
    ];
    $response->set_data($data);
    
    return $response;
}
add_filter('bp_rest_notifications_prepare_value', 'tbc_pf_modify_event_notes_notification_avatar_url', 20, 1);