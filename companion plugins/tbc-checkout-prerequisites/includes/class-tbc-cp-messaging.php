<?php
/**
 * Handles approval/disapproval messaging via FluentChat.
 */
class TBC_CP_Messaging {

    private const OPTION_KEY = 'tbc_cp_message_templates';

    public function __construct() {
        add_action('wp_ajax_tbc_cp_er_get_message_settings', [$this, 'get_message_settings']);
        add_action('wp_ajax_tbc_cp_er_save_message_settings', [$this, 'save_message_settings']);
        add_action('wp_ajax_tbc_cp_er_preview_message', [$this, 'preview_message']);
        add_action('wp_ajax_tbc_cp_er_send_approval_message', [$this, 'send_approval_message']);
        add_action('wp_ajax_tbc_cp_er_preview_phone_screening', [$this, 'preview_phone_screening_message']);
        add_action('wp_ajax_tbc_cp_er_send_phone_screening_message', [$this, 'send_phone_screening_message']);
    }

    /**
     * Get default templates.
     */
    public static function get_defaults(): array {
        return [
            'sender_user_id' => '',
            'approved_subject' => 'Your {form_name} has been approved',
            'approved_message' => "Hi {first_name},\n\nGreat news! Your {form_name} has been reviewed and approved.\n\n{consult_notes}\n\n{meeting_info}\n\nBlessings,\nTwo Birds Church",
            'disapproved_subject' => 'Update on your {form_name}',
            'disapproved_message' => "Hi {first_name},\n\nThank you for submitting your {form_name}. After review, we are unable to approve your submission at this time.\n\n{consult_notes}\n\nIf you have any questions, please don't hesitate to reach out.\n\nBlessings,\nTwo Birds Church",
            'enabled' => false,
            'zoom_join_url'   => '',
            'zoom_meeting_id' => '',
            'zoom_passcode'   => '',
            'phone_screening_message' => "Hi {first_name},\n\nYour phone screening has been scheduled! Here are the details:\n\n{meeting_info}\n\nIf you need to reschedule, please let us know.\n\nBlessings,\nTwo Birds Church",
        ];
    }

    /**
     * Get stored settings merged with defaults.
     */
    public static function get_settings(): array {
        $saved = get_option(self::OPTION_KEY, []);
        return wp_parse_args($saved, self::get_defaults());
    }

    /**
     * AJAX: Return current settings.
     */
    public function get_message_settings(): void {
        check_ajax_referer('tbc_cp_er_nonce', 'nonce');
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Unauthorized');
        }
        wp_send_json_success(self::get_settings());
    }

    /**
     * AJAX: Save settings.
     */
    public function save_message_settings(): void {
        check_ajax_referer('tbc_cp_er_nonce', 'nonce');
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Unauthorized');
        }

        $settings = [
            'sender_user_id'       => absint($_POST['sender_user_id'] ?? ''),
            'approved_subject'     => sanitize_text_field(wp_unslash($_POST['approved_subject'] ?? '')),
            'approved_message'     => sanitize_textarea_field(wp_unslash($_POST['approved_message'] ?? '')),
            'disapproved_subject'  => sanitize_text_field(wp_unslash($_POST['disapproved_subject'] ?? '')),
            'disapproved_message'      => sanitize_textarea_field(wp_unslash($_POST['disapproved_message'] ?? '')),
            'phone_screening_message'  => sanitize_textarea_field(wp_unslash($_POST['phone_screening_message'] ?? '')),
            'zoom_join_url'            => esc_url_raw(wp_unslash($_POST['zoom_join_url'] ?? '')),
            'zoom_meeting_id'          => sanitize_text_field(wp_unslash($_POST['zoom_meeting_id'] ?? '')),
            'zoom_passcode'            => sanitize_text_field(wp_unslash($_POST['zoom_passcode'] ?? '')),
            'enabled'                  => !empty($_POST['enabled']),
        ];

        update_option(self::OPTION_KEY, $settings);
        wp_send_json_success('Settings saved');
    }

    /**
     * AJAX: Preview approval message.
     */
    public function preview_message(): void {
        check_ajax_referer('tbc_cp_er_nonce', 'nonce');
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Unauthorized');
        }

        $entry_id = absint($_POST['entry_id'] ?? 0);
        $approval_status = absint($_POST['approval_status'] ?? 0);

        if (!$entry_id || !in_array($approval_status, [1, 2], true)) {
            wp_send_json_error('Invalid data');
        }

        $template_key = $approval_status === 1 ? 'approved_message' : 'disapproved_message';
        $this->preview_template_for_entry($entry_id, $template_key);
    }

    /**
     * AJAX: Preview phone screening message.
     */
    public function preview_phone_screening_message(): void {
        check_ajax_referer('tbc_cp_er_nonce', 'nonce');
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Unauthorized');
        }

        $entry_id = absint($_POST['entry_id'] ?? 0);
        if (!$entry_id) {
            wp_send_json_error('Invalid entry ID');
        }

        $this->preview_template_for_entry($entry_id, 'phone_screening_message');
    }

    /**
     * AJAX: Send approval message.
     */
    public function send_approval_message(): void {
        check_ajax_referer('tbc_cp_er_nonce', 'nonce');
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Unauthorized');
        }

        $entry_id = absint($_POST['entry_id'] ?? 0);
        $approval_status = absint($_POST['approval_status'] ?? 0);
        $message_text = sanitize_textarea_field(wp_unslash($_POST['message'] ?? ''));

        if (!$entry_id || !in_array($approval_status, [1, 2], true)) {
            wp_send_json_error('Invalid data');
        }

        $this->send_message_for_entry($entry_id, $message_text);
    }

    /**
     * AJAX: Send phone screening message.
     */
    public function send_phone_screening_message(): void {
        check_ajax_referer('tbc_cp_er_nonce', 'nonce');
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Unauthorized');
        }

        $entry_id = absint($_POST['entry_id'] ?? 0);
        $message_text = sanitize_textarea_field(wp_unslash($_POST['message'] ?? ''));

        if (!$entry_id) {
            wp_send_json_error('Invalid entry ID');
        }

        $this->send_message_for_entry($entry_id, $message_text);
    }

    /**
     * Render a template for an entry and return the preview response.
     */
    private function preview_template_for_entry(int $entry_id, string $template_key): void {
        $entry = GFAPI::get_entry($entry_id);
        if (is_wp_error($entry)) {
            wp_send_json_error('Entry not found');
        }

        $settings = self::get_settings();
        $rendered = self::replace_merge_tags($settings[$template_key], $entry);

        wp_send_json_success([
            'message'    => $rendered,
            'enabled'    => !empty($settings['enabled']),
            'has_sender' => !empty($settings['sender_user_id']),
        ]);
    }

    /**
     * Validate sender/recipient and send a message for an entry via FluentChat.
     */
    private function send_message_for_entry(int $entry_id, string $message_text): void {
        if (empty($message_text)) {
            wp_send_json_error('Message is empty');
        }

        $entry = GFAPI::get_entry($entry_id);
        if (is_wp_error($entry)) {
            wp_send_json_error('Entry not found');
        }

        $settings = self::get_settings();
        $sender_id = absint($settings['sender_user_id']);
        $recipient_id = absint($entry['created_by']);

        if (!$sender_id) {
            wp_send_json_error('No sender configured. Open Message Settings to set a sender.');
        }
        if (!$recipient_id) {
            wp_send_json_error('Entry has no associated user');
        }
        if (!self::fluentchat_available()) {
            wp_send_json_error('FluentChat is not active. Messages cannot be sent.');
        }

        $result = self::send_dm($sender_id, $recipient_id, $message_text);

        if (is_wp_error($result)) {
            wp_send_json_error($result->get_error_message());
        }

        wp_send_json_success('Message sent');
    }

    /**
     * Replace merge tags in a template string.
     */
    public static function replace_merge_tags(string $template, array $entry): string {
        $form_id = (int) $entry['form_id'];
        $form = GFAPI::get_form($form_id);
        $user = get_userdata($entry['created_by']);

        $user_name = $user ? $user->display_name : '';
        $first_name = $user ? $user->first_name : '';
        if (empty($first_name) && !empty($user_name)) {
            $first_name = explode(' ', $user_name)[0];
        }
        $user_email = $user ? $user->user_email : '';

        // Get form title and consult notes from step config
        $form_name = '';
        $consult_notes = '';
        $steps = tbc_cp_get_steps();
        foreach ($steps as $step) {
            if ($step['type'] === 'form' && (int) $step['form_id'] === $form_id) {
                $form_name = $step['title'];
                if (!empty($step['consult_notes_field_id'])) {
                    $field_id = (int) $step['consult_notes_field_id'];
                    $consult_notes = isset($entry[$field_id]) ? trim(stripslashes($entry[$field_id])) : '';
                }
                break;
            }
        }
        if (empty($form_name) && $form) {
            $form_name = $form['title'] ?? '';
        }

        // Meeting info
        $meeting_info = '';
        $screening_date = gform_get_meta($entry['id'], 'tbc_cp_phone_screening_date') ?: '';
        if (!empty($screening_date)) {
            $settings = self::get_settings();
            $formatted_date = date_i18n('l, F j, Y \a\t g:i A', strtotime($screening_date));
            $calendar_url = function_exists('tbc_cp_calendar_url') ? tbc_cp_calendar_url((int) $entry['id']) : '';

            $meeting_info = "Your phone consultation has been scheduled for {$formatted_date}.\n\n";
            if (!empty($settings['zoom_join_url'])) {
                $meeting_info .= "Please join using the Zoom link below:\n\n";
                $meeting_info .= "Quick Join Link: {$settings['zoom_join_url']}\n";
                if (!empty($settings['zoom_meeting_id'])) {
                    $meeting_info .= "Meeting ID: {$settings['zoom_meeting_id']}\n";
                }
                if (!empty($settings['zoom_passcode'])) {
                    $meeting_info .= "Passcode: {$settings['zoom_passcode']}\n";
                }
            }
            if (!empty($calendar_url)) {
                $meeting_info .= "\nAdd to your calendar: {$calendar_url}";
            }
        }

        $tags = [
            '{name}'           => $user_name,
            '{first_name}'     => $first_name,
            '{email}'          => $user_email,
            '{form_name}'      => $form_name,
            '{consult_notes}'  => $consult_notes,
            '{meeting_info}'   => $meeting_info,
            '{entry_id}'       => $entry['id'],
            '{date_submitted}' => date_i18n(get_option('date_format') . ' ' . get_option('time_format'), strtotime($entry['date_created'] . ' UTC')),
        ];

        $result = str_replace(array_keys($tags), array_values($tags), $template);

        // Clean up empty merge tag lines (if a tag resolved to empty, remove blank lines)
        $result = preg_replace("/\n{3,}/", "\n\n", $result);

        return trim($result);
    }

    /**
     * Check if FluentChat classes are available.
     */
    private static function fluentchat_available(): bool {
        return class_exists('\FluentMessaging\App\Models\Message')
            && class_exists('\FluentMessaging\App\Services\ChatHelper');
    }

    /**
     * Send a DM via FluentChat.
     */
    private static function send_dm(int $sender_id, int $recipient_id, string $message) {
        try {
            $sender = get_userdata($sender_id);
            $recipient = get_userdata($recipient_id);

            if (!$sender) {
                return new \WP_Error('invalid_sender', 'Sender user (ID: ' . $sender_id . ') does not exist.');
            }
            if (!$recipient) {
                return new \WP_Error('invalid_recipient', 'Recipient user (ID: ' . $recipient_id . ') does not exist.');
            }

            $message_html = '<div class="chat_text">' . nl2br(wp_kses_post($message)) . '</div>';

            $thread = \FluentMessaging\App\Services\ChatHelper::getUserToUserThread($sender_id, $recipient_id);

            if (!$thread) {
                $thread = \FluentMessaging\App\Models\Thread::create([
                    'title'  => sprintf('Chat between %s & %s',
                        $recipient->display_name,
                        $sender->display_name
                    ),
                    'status' => 'active',
                ]);

                $thread->users()->attach([$recipient_id, $sender_id]);
            }

            $new_message = \FluentMessaging\App\Models\Message::create([
                'thread_id' => $thread->id,
                'user_id'   => $sender_id,
                'text'      => $message_html,
            ]);

            do_action('fluent_messaging/after_add_message', $new_message);

            return true;
        } catch (\Throwable $e) {
            error_log('[TBC-CP Messaging] FluentChat send_dm failed: ' . $e->getMessage() . ' | Sender: ' . $sender_id . ' | Recipient: ' . $recipient_id);
            return new \WP_Error('fluentchat_send_failed', 'FluentChat error: ' . $e->getMessage());
        }
    }
}
