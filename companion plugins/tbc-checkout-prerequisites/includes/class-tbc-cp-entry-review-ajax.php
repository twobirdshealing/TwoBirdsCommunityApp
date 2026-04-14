<?php
/**
 * AJAX handlers for Entry Review
 */
class TBC_CP_Entry_Review_Ajax {

    public function __construct() {
        add_action('wp_ajax_tbc_cp_er_update_phone_screening', [$this, 'update_phone_screening']);
        add_action('wp_ajax_tbc_cp_er_update_consult_notes', [$this, 'update_consult_notes']);
        add_action('wp_ajax_tbc_cp_er_update_approval', [$this, 'update_approval']);
        add_action('wp_ajax_tbc_cp_er_get_entry_fields', [$this, 'get_entry_fields']);
        add_action('wp_ajax_tbc_cp_er_toggle_block', [$this, 'toggle_block']);
        add_action('wp_ajax_tbc_cp_er_update_spirit_pharmacist', [$this, 'update_spirit_pharmacist']);
        add_action('wp_ajax_tbc_cp_er_update_phone_schedule', [$this, 'update_phone_schedule']);
    }

    public function update_phone_screening() {
        check_ajax_referer('tbc_cp_er_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(__('Unauthorized', 'tbc-checkout-prerequisites'));
        }

        $entry_id = absint($_POST['entry_id'] ?? 0);
        $status = sanitize_text_field($_POST['screening_status'] ?? '');

        if (!$entry_id) {
            wp_send_json_error(__('Invalid entry ID', 'tbc-checkout-prerequisites'));
        }

        if (!in_array($status, ['', 'not_required', 'required', 'completed'], true)) {
            wp_send_json_error(__('Invalid status', 'tbc-checkout-prerequisites'));
        }

        if (empty($status)) {
            gform_delete_meta($entry_id, 'tbc_cp_phone_screening');
        } else {
            gform_update_meta($entry_id, 'tbc_cp_phone_screening', $status);
        }

        wp_send_json_success(['status' => $status]);
    }

    public function update_consult_notes() {
        check_ajax_referer('tbc_cp_er_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(__('Unauthorized', 'tbc-checkout-prerequisites'));
        }

        $entry_id = absint($_POST['entry_id'] ?? 0);
        $notes = sanitize_textarea_field(wp_unslash($_POST['notes'] ?? ''));

        if (!$entry_id) {
            wp_send_json_error(__('Invalid entry ID', 'tbc-checkout-prerequisites'));
        }

        $entry = GFAPI::get_entry($entry_id);
        if (is_wp_error($entry)) {
            wp_send_json_error(__('Entry not found', 'tbc-checkout-prerequisites'));
        }

        $field_id = self::get_consult_notes_field_id((int) $entry['form_id']);
        if ($field_id === null) {
            wp_send_json_error(__('Consult notes not supported for this form', 'tbc-checkout-prerequisites'));
        }

        $entry[$field_id] = $notes;
        $result = GFAPI::update_entry($entry);

        if ($result === true) {
            wp_send_json_success(__('Notes saved', 'tbc-checkout-prerequisites'));
        } else {
            wp_send_json_error(__('Failed to save notes', 'tbc-checkout-prerequisites'));
        }
    }

    public function update_approval() {
        check_ajax_referer('tbc_cp_er_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(__('Unauthorized', 'tbc-checkout-prerequisites'));
        }

        $entry_id = absint($_POST['entry_id'] ?? 0);
        $approval_status = absint($_POST['approval_status'] ?? 0);

        if (!$entry_id || !in_array($approval_status, [1, 2, 3], true)) {
            wp_send_json_error(__('Invalid data', 'tbc-checkout-prerequisites'));
        }

        $entry = GFAPI::get_entry($entry_id);
        if (is_wp_error($entry)) {
            wp_send_json_error(__('Entry not found', 'tbc-checkout-prerequisites'));
        }

        // Safety check: consult notes required for forms that have a notes field
        $notes_field_id = self::get_consult_notes_field_id((int) $entry['form_id']);
        if ($notes_field_id !== null) {
            $consult_notes = isset($entry[$notes_field_id]) ? trim($entry[$notes_field_id]) : '';
            if (empty($consult_notes)) {
                wp_send_json_error(__('Add consultation notes before changing approval status', 'tbc-checkout-prerequisites'));
            }
        }

        // Safety check: if phone screening is enabled, must be set before any approval action
        $phone_screening_enabled = self::is_phone_screening_enabled_for_form((int) $entry['form_id']);
        if ($phone_screening_enabled) {
            $screening = gform_get_meta($entry_id, 'tbc_cp_phone_screening') ?: '';
            if ($screening === '') {
                wp_send_json_error(__('Set the phone screening status before changing approval', 'tbc-checkout-prerequisites'));
            }
        }

        // Safety check: if spirit pharmacist is enabled, must be set before any approval action
        $spirit_pharmacist_enabled = self::is_spirit_pharmacist_enabled_for_form((int) $entry['form_id']);
        if ($spirit_pharmacist_enabled) {
            $spirit = gform_get_meta($entry_id, 'tbc_cp_spirit_pharmacist') ?: '';
            if ($spirit === '') {
                wp_send_json_error(__('Set the spirit pharmacist status before changing approval', 'tbc-checkout-prerequisites'));
            }
        }

        gform_update_meta($entry_id, 'is_approved', $approval_status);
        GFFormsModel::update_entry_property($entry_id, 'is_read', 1);
        do_action('tbc_cp_entry_approval_updated', $entry_id, $approval_status);

        $labels = [
            1 => __('Approved', 'tbc-checkout-prerequisites'),
            2 => __('Disapproved', 'tbc-checkout-prerequisites'),
            3 => __('Unapproved', 'tbc-checkout-prerequisites'),
        ];

        wp_send_json_success([
            'status' => $approval_status,
            'label' => $labels[$approval_status],
        ]);
    }

    public function get_entry_fields() {
        check_ajax_referer('tbc_cp_er_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(__('Unauthorized', 'tbc-checkout-prerequisites'));
        }

        $entry_id = absint($_POST['entry_id'] ?? 0);
        $form_id = absint($_POST['form_id'] ?? 0);

        if (!$entry_id || !$form_id) {
            wp_send_json_error(__('Invalid data', 'tbc-checkout-prerequisites'));
        }

        $entry = GFAPI::get_entry($entry_id);
        if (is_wp_error($entry)) {
            wp_send_json_error(__('Entry not found', 'tbc-checkout-prerequisites'));
        }

        $form = GFAPI::get_form($form_id);
        if (!$form || empty($form['fields'])) {
            wp_send_json_error(__('Form not found', 'tbc-checkout-prerequisites'));
        }

        $format = sanitize_text_field($_POST['format'] ?? 'html');

        if ($format === 'text') {
            $text = $this->render_entry_fields_text($entry, $form);
            wp_send_json_success(['text' => $text]);
        } else {
            $html = $this->render_entry_fields($entry, $form);
            wp_send_json_success(['html' => $html]);
        }
    }

    public function toggle_block() {
        check_ajax_referer('tbc_cp_er_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(__('Unauthorized', 'tbc-checkout-prerequisites'));
        }

        $user_id = absint($_POST['user_id'] ?? 0);
        $block = ($_POST['block'] ?? '') === '1';

        if (!$user_id) {
            wp_send_json_error(__('Invalid user ID', 'tbc-checkout-prerequisites'));
        }

        $user = get_userdata($user_id);
        if (!$user) {
            wp_send_json_error(__('User not found', 'tbc-checkout-prerequisites'));
        }

        if ($block) {
            $user->add_role('church_user');
        } else {
            $user->remove_role('church_user');
        }

        wp_send_json_success(['blocked' => $block]);
    }

    public function update_spirit_pharmacist() {
        check_ajax_referer('tbc_cp_er_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(__('Unauthorized', 'tbc-checkout-prerequisites'));
        }

        $entry_id = absint($_POST['entry_id'] ?? 0);
        $status = sanitize_text_field($_POST['spirit_status'] ?? '');

        if (!$entry_id) {
            wp_send_json_error(__('Invalid entry ID', 'tbc-checkout-prerequisites'));
        }

        if (!in_array($status, ['', 'not_required', 'required', 'completed'], true)) {
            wp_send_json_error(__('Invalid status', 'tbc-checkout-prerequisites'));
        }

        if (empty($status)) {
            gform_delete_meta($entry_id, 'tbc_cp_spirit_pharmacist');
        } else {
            gform_update_meta($entry_id, 'tbc_cp_spirit_pharmacist', $status);
        }

        wp_send_json_success(['status' => $status]);
    }

    public function update_phone_schedule() {
        check_ajax_referer('tbc_cp_er_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(__('Unauthorized', 'tbc-checkout-prerequisites'));
        }

        $entry_id = absint($_POST['entry_id'] ?? 0);
        $date = sanitize_text_field($_POST['screening_date'] ?? '');
        $note = sanitize_text_field(wp_unslash($_POST['screening_note'] ?? ''));

        if (!$entry_id) {
            wp_send_json_error(__('Invalid entry ID', 'tbc-checkout-prerequisites'));
        }

        if (!empty($date) && strtotime($date) === false) {
            wp_send_json_error(__('Invalid date format', 'tbc-checkout-prerequisites'));
        }

        if (empty($date)) {
            gform_delete_meta($entry_id, 'tbc_cp_phone_screening_date');
            gform_delete_meta($entry_id, 'tbc_cp_phone_screening_note');
        } else {
            gform_update_meta($entry_id, 'tbc_cp_phone_screening_date', $date);
            if (!empty($note)) {
                gform_update_meta($entry_id, 'tbc_cp_phone_screening_note', $note);
            } else {
                gform_delete_meta($entry_id, 'tbc_cp_phone_screening_note');
            }
        }

        wp_send_json_success([
            'date' => $date,
            'note' => $note,
            'formatted_date' => !empty($date) ? date_i18n('M j, g:i A', strtotime($date)) : '',
            'calendar_url' => !empty($date) ? tbc_cp_calendar_url($entry_id) : '',
        ]);
    }

    /**
     * Render entry fields as HTML.
     */
    private function render_entry_fields(array $entry, array $form): string {
        $output = '<div class="tbc-cp-er-entry-fields">';
        $notes_field_id = self::get_consult_notes_field_id((int) $entry['form_id']);

        foreach ($form['fields'] as $field) {
            $field_id = $field->id;

            if ($field->type === 'address') {
                $city = $entry[$field_id . '.3'] ?? '';
                $state = $entry[$field_id . '.4'] ?? '';
                if (!empty($city)) {
                    $output .= '<div class="tbc-cp-er-field"><strong>' . esc_html__('City', 'tbc-checkout-prerequisites') . ':</strong> ' . esc_html($city) . '</div>';
                }
                if (!empty($state)) {
                    $output .= '<div class="tbc-cp-er-field"><strong>' . esc_html__('State', 'tbc-checkout-prerequisites') . ':</strong> ' . esc_html($state) . '</div>';
                }
                continue;
            }

            if ($field->type === 'name') {
                $first = $entry[$field_id . '.3'] ?? '';
                $last = $entry[$field_id . '.6'] ?? '';
                $full_name = trim($first . ' ' . $last);
                if (!empty($full_name)) {
                    $output .= '<div class="tbc-cp-er-field"><strong>' . esc_html($field->label) . ':</strong> ' . esc_html($full_name) . '</div>';
                }
                continue;
            }

            if (in_array($field->type, TBC_CP_SKIP_FIELD_TYPES, true)) {
                continue;
            }

            $value = $entry[$field_id] ?? '';

            if ($value === '' || $value === null) {
                continue;
            }

            if ($notes_field_id !== null && (int) $field_id === $notes_field_id) {
                $output .= '<div class="tbc-cp-er-field tbc-cp-er-field-admin"><strong>' . esc_html($field->label) . ' <em>(' . esc_html__('Admin', 'tbc-checkout-prerequisites') . ')</em>:</strong> ' . nl2br(esc_html($value)) . '</div>';
                continue;
            }

            $output .= '<div class="tbc-cp-er-field"><strong>' . esc_html($field->label) . ':</strong> ' . nl2br(esc_html($value)) . '</div>';
        }

        $output .= '</div>';
        return $output;
    }

    /**
     * Render entry fields as plain text for clipboard copy.
     */
    private function render_entry_fields_text(array $entry, array $form): string {
        $lines = [];
        $notes_field_id = self::get_consult_notes_field_id((int) $entry['form_id']);

        foreach ($form['fields'] as $field) {
            $field_id = $field->id;

            if ($notes_field_id !== null && (int) $field_id === $notes_field_id) {
                continue;
            }

            if ($field->type === 'address') {
                $city = $entry[$field_id . '.3'] ?? '';
                $state = $entry[$field_id . '.4'] ?? '';
                if (!empty($city)) {
                    $lines[] = 'City: ' . $city;
                }
                if (!empty($state)) {
                    $lines[] = 'State: ' . $state;
                }
                continue;
            }

            if ($field->type === 'name') {
                $first = $entry[$field_id . '.3'] ?? '';
                $last = $entry[$field_id . '.6'] ?? '';
                $full_name = trim($first . ' ' . $last);
                if (!empty($full_name)) {
                    $lines[] = $field->label . ': ' . $full_name;
                }
                continue;
            }

            if (in_array($field->type, TBC_CP_SKIP_FIELD_TYPES, true)) {
                continue;
            }

            $value = $entry[$field_id] ?? '';
            if ($value === '' || $value === null) {
                continue;
            }

            $lines[] = $field->label . ': ' . $value;
        }

        return implode("\n", $lines);
    }

    /**
     * Get the step config for a given form ID.
     */
    private static function get_step_for_form(int $form_id): ?array {
        $steps = tbc_cp_get_steps();
        foreach ($steps as $step) {
            if ($step['type'] === 'form' && (int) $step['form_id'] === $form_id) {
                return $step;
            }
        }
        return null;
    }

    /**
     * Get the consult notes field ID for a form from step config.
     */
    private static function get_consult_notes_field_id(int $form_id): ?int {
        $step = self::get_step_for_form($form_id);
        if ($step && !empty($step['consult_notes_field_id'])) {
            return (int) $step['consult_notes_field_id'];
        }
        return null;
    }

    private static function is_phone_screening_enabled_for_form(int $form_id): bool {
        $step = self::get_step_for_form($form_id);
        return $step ? !empty($step['phone_screening_enabled']) : false;
    }

    private static function is_spirit_pharmacist_enabled_for_form(int $form_id): bool {
        $step = self::get_step_for_form($form_id);
        return $step ? !empty($step['spirit_pharmacist_enabled']) : false;
    }
}
