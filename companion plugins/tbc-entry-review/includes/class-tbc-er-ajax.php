<?php
/**
 * AJAX handlers for Entry Review
 */
class TBC_ER_Ajax {

    public function __construct() {
        add_action('wp_ajax_tbc_er_update_phone_screening', [$this, 'update_phone_screening']);
        add_action('wp_ajax_tbc_er_update_consult_notes', [$this, 'update_consult_notes']);
        add_action('wp_ajax_tbc_er_update_approval', [$this, 'update_approval']);
        add_action('wp_ajax_tbc_er_get_entry_fields', [$this, 'get_entry_fields']);
        add_action('wp_ajax_tbc_er_toggle_block', [$this, 'toggle_block']);
        add_action('wp_ajax_tbc_er_update_spirit_pharmacist', [$this, 'update_spirit_pharmacist']);
        add_action('wp_ajax_tbc_er_update_phone_schedule', [$this, 'update_phone_schedule']);
    }

    public function update_phone_screening() {
        check_ajax_referer('tbc_er_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(__('Unauthorized', 'tbc-entry-review'));
        }

        $entry_id = absint($_POST['entry_id'] ?? 0);
        $status = sanitize_text_field($_POST['screening_status'] ?? '');

        if (!$entry_id) {
            wp_send_json_error(__('Invalid entry ID', 'tbc-entry-review'));
        }

        if (!in_array($status, ['', 'not_required', 'required', 'completed'], true)) {
            wp_send_json_error(__('Invalid status', 'tbc-entry-review'));
        }

        if (empty($status)) {
            gform_delete_meta($entry_id, 'tbc_cp_phone_screening');
        } else {
            gform_update_meta($entry_id, 'tbc_cp_phone_screening', $status);
        }

        wp_send_json_success(['status' => $status]);
    }

    public function update_consult_notes() {
        check_ajax_referer('tbc_er_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(__('Unauthorized', 'tbc-entry-review'));
        }

        $entry_id = absint($_POST['entry_id'] ?? 0);
        $notes = sanitize_textarea_field(wp_unslash($_POST['notes'] ?? ''));

        if (!$entry_id) {
            wp_send_json_error(__('Invalid entry ID', 'tbc-entry-review'));
        }

        $entry = GFAPI::get_entry($entry_id);
        if (is_wp_error($entry)) {
            wp_send_json_error(__('Entry not found', 'tbc-entry-review'));
        }

        $field_map = [1 => 18, 16 => 119];
        $field_id = $field_map[(int) $entry['form_id']] ?? null;
        if ($field_id === null) {
            wp_send_json_error(__('Consult notes not supported for this form', 'tbc-entry-review'));
        }

        $entry[$field_id] = $notes;
        $result = GFAPI::update_entry($entry);

        if ($result === true) {
            wp_send_json_success(__('Notes saved', 'tbc-entry-review'));
        } else {
            wp_send_json_error(__('Failed to save notes', 'tbc-entry-review'));
        }
    }

    public function update_approval() {
        check_ajax_referer('tbc_er_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(__('Unauthorized', 'tbc-entry-review'));
        }

        $entry_id = absint($_POST['entry_id'] ?? 0);
        $approval_status = absint($_POST['approval_status'] ?? 0);

        if (!$entry_id || !in_array($approval_status, [1, 2, 3], true)) {
            wp_send_json_error(__('Invalid data', 'tbc-entry-review'));
        }

        $entry = GFAPI::get_entry($entry_id);
        if (is_wp_error($entry)) {
            wp_send_json_error(__('Entry not found', 'tbc-entry-review'));
        }

        // Safety check: consult notes required for forms that have a notes field
        $notes_field_map = [1 => 18, 16 => 119];
        $notes_field_id = $notes_field_map[(int) $entry['form_id']] ?? null;
        if ($notes_field_id !== null) {
            $consult_notes = isset($entry[$notes_field_id]) ? trim($entry[$notes_field_id]) : '';
            if (empty($consult_notes)) {
                wp_send_json_error(__('Add consultation notes before changing approval status', 'tbc-entry-review'));
            }
        }

        // Safety check: if phone screening is enabled, must be set before any approval action
        $phone_screening_enabled = $this->is_phone_screening_enabled($entry_id);
        if ($phone_screening_enabled) {
            $screening = gform_get_meta($entry_id, 'tbc_cp_phone_screening') ?: '';
            if ($screening === '') {
                wp_send_json_error(__('Set the phone screening status before changing approval', 'tbc-entry-review'));
            }
        }

        // Safety check: if spirit pharmacist is enabled, must be set before any approval action
        $spirit_pharmacist_enabled = $this->is_spirit_pharmacist_enabled($entry_id);
        if ($spirit_pharmacist_enabled) {
            $spirit = gform_get_meta($entry_id, 'tbc_cp_spirit_pharmacist') ?: '';
            if ($spirit === '') {
                wp_send_json_error(__('Set the spirit pharmacist status before changing approval', 'tbc-entry-review'));
            }
        }

        gform_update_meta($entry_id, 'is_approved', $approval_status);
        do_action('tbc_cp_entry_approval_updated', $entry_id, $approval_status);

        $labels = [
            1 => __('Approved', 'tbc-entry-review'),
            2 => __('Disapproved', 'tbc-entry-review'),
            3 => __('Unapproved', 'tbc-entry-review'),
        ];

        wp_send_json_success([
            'status' => $approval_status,
            'label' => $labels[$approval_status],
        ]);
    }

    public function get_entry_fields() {
        check_ajax_referer('tbc_er_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(__('Unauthorized', 'tbc-entry-review'));
        }

        $entry_id = absint($_POST['entry_id'] ?? 0);
        $form_id = absint($_POST['form_id'] ?? 0);

        if (!$entry_id || !$form_id) {
            wp_send_json_error(__('Invalid data', 'tbc-entry-review'));
        }

        $entry = GFAPI::get_entry($entry_id);
        if (is_wp_error($entry)) {
            wp_send_json_error(__('Entry not found', 'tbc-entry-review'));
        }

        $form = GFAPI::get_form($form_id);
        if (!$form || empty($form['fields'])) {
            wp_send_json_error(__('Form not found', 'tbc-entry-review'));
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
        check_ajax_referer('tbc_er_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(__('Unauthorized', 'tbc-entry-review'));
        }

        $user_id = absint($_POST['user_id'] ?? 0);
        $block = ($_POST['block'] ?? '') === '1';

        if (!$user_id) {
            wp_send_json_error(__('Invalid user ID', 'tbc-entry-review'));
        }

        $user = get_userdata($user_id);
        if (!$user) {
            wp_send_json_error(__('User not found', 'tbc-entry-review'));
        }

        if ($block) {
            $user->add_role('church_user');
        } else {
            $user->remove_role('church_user');
        }

        wp_send_json_success(['blocked' => $block]);
    }

    public function update_spirit_pharmacist() {
        check_ajax_referer('tbc_er_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(__('Unauthorized', 'tbc-entry-review'));
        }

        $entry_id = absint($_POST['entry_id'] ?? 0);
        $status = sanitize_text_field($_POST['spirit_status'] ?? '');

        if (!$entry_id) {
            wp_send_json_error(__('Invalid entry ID', 'tbc-entry-review'));
        }

        if (!in_array($status, ['', 'not_required', 'required', 'completed'], true)) {
            wp_send_json_error(__('Invalid status', 'tbc-entry-review'));
        }

        if (empty($status)) {
            gform_delete_meta($entry_id, 'tbc_cp_spirit_pharmacist');
        } else {
            gform_update_meta($entry_id, 'tbc_cp_spirit_pharmacist', $status);
        }

        wp_send_json_success(['status' => $status]);
    }

    public function update_phone_schedule() {
        check_ajax_referer('tbc_er_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(__('Unauthorized', 'tbc-entry-review'));
        }

        $entry_id = absint($_POST['entry_id'] ?? 0);
        $date = sanitize_text_field($_POST['screening_date'] ?? '');
        $note = sanitize_text_field(wp_unslash($_POST['screening_note'] ?? ''));

        if (!$entry_id) {
            wp_send_json_error(__('Invalid entry ID', 'tbc-entry-review'));
        }

        // Validate date format if provided
        if (!empty($date) && strtotime($date) === false) {
            wp_send_json_error(__('Invalid date format', 'tbc-entry-review'));
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
            'calendar_url' => !empty($date) ? tbc_er_calendar_url($entry_id) : '',
        ]);
    }

    /**
     * Render entry fields as HTML.
     * Adapted from tbc_pf_display_gravity_form_entry() in tbc-participant-frontend.
     */
    private function render_entry_fields(array $entry, array $form): string {
        $output = '<div class="tbc-er-entry-fields">';

        foreach ($form['fields'] as $field) {
            $field_id = $field->id;

            // Handle address fields specially (city, state subfields)
            if ($field->type === 'address') {
                $city = $entry[$field_id . '.3'] ?? '';
                $state = $entry[$field_id . '.4'] ?? '';
                if (!empty($city)) {
                    $output .= '<div class="tbc-er-field"><strong>' . esc_html__('City', 'tbc-entry-review') . ':</strong> ' . esc_html($city) . '</div>';
                }
                if (!empty($state)) {
                    $output .= '<div class="tbc-er-field"><strong>' . esc_html__('State', 'tbc-entry-review') . ':</strong> ' . esc_html($state) . '</div>';
                }
                continue;
            }

            // Handle name fields (first, last subfields)
            if ($field->type === 'name') {
                $first = $entry[$field_id . '.3'] ?? '';
                $last = $entry[$field_id . '.6'] ?? '';
                $full_name = trim($first . ' ' . $last);
                if (!empty($full_name)) {
                    $output .= '<div class="tbc-er-field"><strong>' . esc_html($field->label) . ':</strong> ' . esc_html($full_name) . '</div>';
                }
                continue;
            }

            // Skip non-input field types
            if (in_array($field->type, ['html', 'section', 'page', 'captcha', 'hidden'], true)) {
                continue;
            }

            $value = $entry[$field_id] ?? '';

            // Skip empty values
            if ($value === '' || $value === null) {
                continue;
            }

            // Consult notes fields — show but mark as admin-only
            $admin_notes_fields = [18, 119];
            if (in_array((int) $field_id, $admin_notes_fields, true)) {
                $output .= '<div class="tbc-er-field tbc-er-field-admin"><strong>' . esc_html($field->label) . ' <em>(' . esc_html__('Admin', 'tbc-entry-review') . ')</em>:</strong> ' . nl2br(esc_html($value)) . '</div>';
                continue;
            }

            $output .= '<div class="tbc-er-field"><strong>' . esc_html($field->label) . ':</strong> ' . nl2br(esc_html($value)) . '</div>';
        }

        $output .= '</div>';
        return $output;
    }

    /**
     * Render entry fields as plain text for clipboard copy.
     */
    private function render_entry_fields_text(array $entry, array $form): string {
        $lines = [];

        foreach ($form['fields'] as $field) {
            $field_id = $field->id;

            // Skip admin consult notes fields
            $admin_notes_fields = [18, 119];
            if (in_array((int) $field_id, $admin_notes_fields, true)) {
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

            if (in_array($field->type, ['html', 'section', 'page', 'captcha', 'hidden'], true)) {
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
     * Check if phone screening is enabled for the form step associated with an entry.
     */
    private function is_phone_screening_enabled(int $entry_id): bool {
        $entry = GFAPI::get_entry($entry_id);
        if (is_wp_error($entry)) {
            return false;
        }

        $steps = get_option('tbc_cp_steps', []);
        foreach ($steps as $step) {
            if ($step['type'] === 'form' && (int) $step['form_id'] === (int) $entry['form_id']) {
                return !empty($step['phone_screening_enabled']);
            }
        }

        return false;
    }

    private function is_spirit_pharmacist_enabled(int $entry_id): bool {
        $entry = GFAPI::get_entry($entry_id);
        if (is_wp_error($entry)) {
            return false;
        }

        $steps = get_option('tbc_cp_steps', []);
        foreach ($steps as $step) {
            if ($step['type'] === 'form' && (int) $step['form_id'] === (int) $entry['form_id']) {
                return !empty($step['spirit_pharmacist_enabled']);
            }
        }

        return false;
    }
}
