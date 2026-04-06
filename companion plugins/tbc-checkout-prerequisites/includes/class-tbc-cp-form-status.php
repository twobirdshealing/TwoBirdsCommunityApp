<?php
/**
 * Form status and rendering for Checkout Prerequisites
 */
class TBC_CP_Form_Status {

    private int $user_id;
    private int $form_id;
    private array $step_data;
    private ?array $entry;
    private ?array $form;

    /**
     * Static cache of existing entry IDs per form, keyed by form_id.
     * Used by the gform_entry_id_pre_save_lead filter to update entries in place.
     */
    private static array $existing_entries = [];

    public function __construct(int $user_id, int $form_id, array $step_data) {
        $this->user_id = $user_id;
        $this->form_id = $form_id;
        $this->step_data = $step_data;
        $this->entry = $this->get_user_entry();
        $this->form = $this->get_form();

        // Cache entry for use by static filters (pre-populate, update-in-place)
        if ($this->entry) {
            self::$existing_entries[$this->form_id] = $this->entry;
        }
    }

    public static function init_global_hooks(): void {
        add_filter('gform_confirmation', [__CLASS__, 'handle_form_confirmation'], 20, 4);
        add_action('gform_after_submission', [__CLASS__, 'handle_after_submission'], 10, 2);

        // Register per-form hooks for pre-population and update-in-place
        $form_ids = self::get_checkout_form_ids();
        foreach ($form_ids as $form_id) {
            // Pre-render: set field defaults for display
            add_filter("gform_pre_render_{$form_id}", [__CLASS__, 'prepopulate_form_fields'], 10, 1);
            // Update-in-place: overwrite existing entry instead of creating a new one
            add_filter("gform_entry_id_pre_save_lead_{$form_id}", [__CLASS__, 'update_entry_in_place'], 10, 2);
        }
    }

    /**
     * Pre-populate form fields with existing entry values.
     * Handles text, radio, checkbox, select, date, and compound fields.
     */
    public static function prepopulate_form_fields(array $form): array {
        $form_id = (int) $form['id'];
        $entry = self::resolve_existing_entry($form_id);

        if (!$entry) {
            return $form;
        }

        foreach ($form['fields'] as &$field) {
            $type = $field->type;

            // Skip non-input types
            if (in_array($type, TBC_CP_SKIP_FIELD_TYPES, true)) {
                continue;
            }

            // Date dropdown fields: parse stored value into month/day/year sub-inputs
            if ($type === 'date' && !empty($field->inputs) && is_array($field->inputs)) {
                $date_value = $entry[$field->id] ?? '';
                if (!empty($date_value)) {
                    // GF stores dates as MM/DD/YYYY or YYYY-MM-DD depending on format
                    $parts = preg_split('/[\\/\\-]/', $date_value);
                    if (count($parts) === 3) {
                        // Detect format: if first part is 4 digits, it's YYYY-MM-DD
                        if (strlen($parts[0]) === 4) {
                            $year = $parts[0];
                            $month = $parts[1];
                            $day = $parts[2];
                        } else {
                            $month = $parts[0];
                            $day = $parts[1];
                            $year = $parts[2];
                        }
                        // Sub-inputs: .1 = month, .2 = day, .3 = year
                        foreach ($field->inputs as &$input) {
                            $suffix = substr((string) $input['id'], strpos((string) $input['id'], '.'));
                            if ($suffix === '.1') $input['defaultValue'] = $month;
                            if ($suffix === '.2') $input['defaultValue'] = $day;
                            if ($suffix === '.3') $input['defaultValue'] = $year;
                        }
                        unset($input);
                    }
                }
                $field->defaultValue = $date_value;
                continue;
            }

            // Checkbox fields: mark matching choices as selected
            if ($type === 'checkbox' && !empty($field->choices) && !empty($field->inputs)) {
                foreach ($field->inputs as $input) {
                    $input_id = (string) $input['id'];
                    $value = $entry[$input_id] ?? '';
                    foreach ($field->choices as &$choice) {
                        if ($choice['value'] === $value && $value !== '') {
                            $choice['isSelected'] = true;
                        }
                    }
                    unset($choice);
                }
                continue;
            }

            // Radio / select / multiselect: mark matching choice as selected
            if (in_array($type, ['radio', 'select', 'multiselect'], true) && !empty($field->choices)) {
                $value = $entry[$field->id] ?? '';
                foreach ($field->choices as &$choice) {
                    $choice['isSelected'] = ($choice['value'] === $value);
                }
                unset($choice);
                $field->defaultValue = $value;
                continue;
            }

            // Compound fields with sub-inputs (address, name, etc.)
            if (!empty($field->inputs) && is_array($field->inputs)) {
                foreach ($field->inputs as &$input) {
                    $input_id = (string) $input['id'];
                    $value = $entry[$input_id] ?? '';
                    $input['defaultValue'] = $value;
                }
                unset($input);
                continue;
            }

            // Simple fields (text, textarea, number, email, phone, date, etc.)
            $value = $entry[$field->id] ?? '';
            $field->defaultValue = $value;
        }
        unset($field);

        return $form;
    }

    /**
     * Return existing entry ID so Gravity Forms updates it in place instead of creating a new one.
     * @see https://docs.gravityforms.com/gform_entry_id_pre_save_lead/
     */
    public static function update_entry_in_place($entry_id, $form) {
        $entry = self::resolve_existing_entry((int) $form['id']);

        if ($entry) {
            return (int) $entry['id'];
        }

        return $entry_id;
    }

    /**
     * Get the existing entry for a form: check cache first, then query GFAPI.
     * GF may call hooks (pre_render, pre_save_lead) before the dashboard
     * instantiates TBC_CP_Form_Status, so the cache can be cold.
     */
    private static function resolve_existing_entry(int $form_id): ?array {
        if (isset(self::$existing_entries[$form_id])) {
            return self::$existing_entries[$form_id];
        }

        if (!is_user_logged_in()) {
            return null;
        }

        $entries = GFAPI::get_entries($form_id, [
            'status' => 'active',
            'field_filters' => [
                ['key' => 'created_by', 'value' => get_current_user_id()]
            ]
        ]);

        if (!empty($entries)) {
            self::$existing_entries[$form_id] = $entries[0];
            return $entries[0];
        }

        return null;
    }

    public static function handle_form_confirmation($confirmation, $form, $entry, $ajax) {
        $form_id = (int) $form['id'];

        if (!in_array($form_id, self::get_checkout_form_ids(), true)) {
            return $confirmation;
        }

        $step = isset($_GET['step']) ? (int) $_GET['step'] : 1;
        $url = add_query_arg('step', $step, wc_get_checkout_url());

        return ['redirect' => $url];
    }

    private static function get_checkout_form_ids(): array {
        $steps = tbc_cp_get_steps();
        $form_steps = array_filter($steps, fn($s) => $s['type'] === 'form');
        return array_map(fn($s) => (int) $s['form_id'], $form_steps);
    }

    /**
     * Compute a hash of the form's input field IDs.
     * Excludes non-input types (html, section, page, captcha).
     * Sorted so reordering fields doesn't change the hash.
     */
    public static function compute_form_fields_hash(int $form_id, ?array $form = null): ?string {
        if (!class_exists('GFAPI')) {
            return null;
        }

        if (!$form) {
            $form = GFAPI::get_form($form_id);
        }
        if (!$form || empty($form['fields'])) {
            return null;
        }

        $field_ids = [];

        foreach ($form['fields'] as $field) {
            if (in_array($field->type, TBC_CP_SKIP_FIELD_TYPES, true)) {
                continue;
            }
            $field_ids[] = (int) $field->id;
        }

        sort($field_ids, SORT_NUMERIC);

        return md5(implode(',', $field_ids));
    }

    /**
     * After submission: store form fields hash and reset approval if this was an update.
     * Only applies to forms configured as checkout prerequisite steps.
     */
    public static function handle_after_submission($entry, $form): void {
        if (empty($entry) || empty($form)) {
            return;
        }

        $form_id = (int) $form['id'];
        $form_ids = self::get_checkout_form_ids();

        if (!in_array($form_id, $form_ids, true)) {
            return;
        }

        // Store form fields hash
        $hash = self::compute_form_fields_hash($form_id);
        if ($hash !== null) {
            gform_update_meta($entry['id'], 'tbc_cp_fields_hash', $hash);
        }

        // Reset approval to unapproved (3) so edited entries go back through review
        gform_update_meta($entry['id'], 'is_approved', 3);

        // Reset phone screening and spirit pharmacist statuses
        gform_delete_meta($entry['id'], 'tbc_cp_phone_screening');
        gform_delete_meta($entry['id'], 'tbc_cp_spirit_pharmacist');
        gform_delete_meta($entry['id'], 'tbc_cp_phone_screening_date');
        gform_delete_meta($entry['id'], 'tbc_cp_phone_screening_note');
    }

    public function get_form_status(): array {
        $has_entry = !empty($this->entry);
        $approval_status = null;
        $pending_approval = false;
        $form_changed = false;
        $phone_screening = null;
        $phone_screening_required = false;
        $spirit_pharmacist = null;
        $spirit_pharmacist_required = false;

        if ($has_entry) {
            $form_changed = $this->is_form_structure_changed();
        }

        if ($has_entry && !$form_changed && !empty($this->step_data['approval_required'])) {
            $approval_status = (int) gform_get_meta($this->entry['id'], 'is_approved');
            $completed_statuses = $this->step_data['completed_statuses'] ?? [1, 2];
            $pending_approval = !in_array($approval_status, $completed_statuses, true);
        }

        $expired = $this->is_entry_expired();
        if ($expired || $form_changed) {
            $pending_approval = false;
        }

        if ($has_entry && !$form_changed && !$expired && !empty($this->step_data['phone_screening_enabled'])) {
            $phone_screening = gform_get_meta($this->entry['id'], 'tbc_cp_phone_screening') ?: '';
            if ($phone_screening === 'required') {
                $phone_screening_required = true;
            }
        }

        if ($has_entry && !$form_changed && !$expired && !empty($this->step_data['spirit_pharmacist_enabled'])) {
            $spirit_pharmacist = gform_get_meta($this->entry['id'], 'tbc_cp_spirit_pharmacist') ?: '';
            if ($spirit_pharmacist === 'required') {
                $spirit_pharmacist_required = true;
            }
        }

        return [
            'completed' => $has_entry && !$pending_approval && !$phone_screening_required && !$spirit_pharmacist_required && !$expired && !$form_changed,
            'expired' => $expired,
            'form_changed' => $form_changed,
            'has_entry' => $has_entry,
            'entry_id' => $has_entry ? $this->entry['id'] : null,
            'last_updated' => $has_entry ? $this->entry['date_updated'] : null,
            'approval_status' => $approval_status,
            'pending_approval' => $pending_approval,
            'phone_screening' => $phone_screening,
            'phone_screening_required' => $phone_screening_required,
            'spirit_pharmacist' => $spirit_pharmacist,
            'spirit_pharmacist_required' => $spirit_pharmacist_required,
        ];
    }

    public function render_form(): string {
        if (!$this->form) {
            return '<div class="tbc-cp-form-error"><p>' . esc_html__('Form not found or Gravity Forms is not active.', 'tbc-checkout-prerequisites') . '</p></div>';
        }

        $status = $this->get_form_status();

        ob_start();
        ?>
        <div class="tbc-cp-ld-wrap">
            <?php if ($status['expired'] || $status['form_changed']) : ?>
                <div class="tbc-cp-form-header">
                    <div class="tbc-cp-form-update-required">
                        <?php esc_html_e('Your information needs to be updated. Please review and update your details below.', 'tbc-checkout-prerequisites'); ?>
                        <?php if ($status['last_updated']) : ?>
                            <span class="tbc-cp-last-updated">
                                <?php echo esc_html(sprintf(
                                    __('Last updated: %s', 'tbc-checkout-prerequisites'),
                                    date_i18n(get_option('date_format'), strtotime($status['last_updated']))
                                )); ?>
                            </span>
                        <?php endif; ?>
                    </div>
                </div>
            <?php endif; ?>

            <div class="tbc-cp-form-content">
                <?php if ($status['spirit_pharmacist_required']) : ?>
                    <div class="tbc-cp-spirit-pharmacist-pending">
                        <h4><span class="tbc-cp-pharmacist-icon"><ion-icon name="medkit-outline"></ion-icon></span> <?php esc_html_e('Pharmacist Consult', 'tbc-checkout-prerequisites'); ?></h4>
                        <p><?php esc_html_e('Your medication(s) require review by a licensed clinical pharmacist before your registration can be confirmed. This is not a decision we can make on your behalf — it requires a licensed clinician who can review your full picture and work with your prescriber if needed. That process can take time, so the sooner you book, the better.', 'tbc-checkout-prerequisites'); ?></p>
                        <p class="tbc-cp-pharmacist-booking">
                            <strong><?php esc_html_e('Book your consult here:', 'tbc-checkout-prerequisites'); ?></strong>
                            <a href="https://calendly.com/spiritpharmacist/30minmember" target="_blank" rel="noopener">calendly.com/spiritpharmacist/30minmember</a>
                        </p>
                        <p><?php esc_html_e('Once your appointment is booked, please let us know. At the start of your consult, ask the pharmacist for a copy of their report to share with us — we require it before registration can be confirmed.', 'tbc-checkout-prerequisites'); ?></p>
                        <?php if ($status['last_updated']) : ?>
                            <span class="tbc-cp-last-updated">
                                <?php echo esc_html(sprintf(
                                    __('Submitted: %s', 'tbc-checkout-prerequisites'),
                                    date_i18n(get_option('date_format'), strtotime($status['last_updated']))
                                )); ?>
                            </span>
                        <?php endif; ?>
                    </div>
                <?php elseif ($status['phone_screening_required']) : ?>
                    <div class="tbc-cp-phone-screening-pending">
                        <h4><span class="tbc-cp-phone-icon"><ion-icon name="call-outline"></ion-icon></span> <?php esc_html_e('New Member', 'tbc-checkout-prerequisites'); ?></h4>
                        <p><?php esc_html_e('We love that you\'re interested in joining us! We like to connect with everyone who is new to our community before their first ceremony. If you haven\'t heard from us yet, check your messages on the site to setup a zoom call or you are also welcome to come meet us in person — Sunday services are open 3–6pm.', 'tbc-checkout-prerequisites'); ?></p>
                        <p><?php esc_html_e('Check the calendar for all upcoming dates.', 'tbc-checkout-prerequisites'); ?></p>
                        <p><?php esc_html_e('We look forward to connecting!', 'tbc-checkout-prerequisites'); ?></p>
                        <?php if ($status['last_updated']) : ?>
                            <span class="tbc-cp-last-updated">
                                <?php echo esc_html(sprintf(
                                    __('Submitted: %s', 'tbc-checkout-prerequisites'),
                                    date_i18n(get_option('date_format'), strtotime($status['last_updated']))
                                )); ?>
                            </span>
                        <?php endif; ?>
                    </div>
                <?php elseif ($status['pending_approval']) : ?>
                    <div class="tbc-cp-approval-pending">
                        <h4><span class="tbc-cp-approval-icon"><ion-icon name="hourglass-outline"></ion-icon></span> <?php esc_html_e('Awaiting Review', 'tbc-checkout-prerequisites'); ?></h4>
                        <p><?php esc_html_e('Your submission has been received and is being reviewed. You can continue to the next steps while we review — approval is required before final checkout.', 'tbc-checkout-prerequisites'); ?></p>
                        <?php if ($status['last_updated']) : ?>
                            <span class="tbc-cp-last-updated">
                                <?php echo esc_html(sprintf(
                                    __('Submitted: %s', 'tbc-checkout-prerequisites'),
                                    date_i18n(get_option('date_format'), strtotime($status['last_updated']))
                                )); ?>
                            </span>
                        <?php endif; ?>
                    </div>
                <?php elseif (!$status['completed'] || !empty($_GET['update'])) : ?>
                    <?php
                    if (function_exists('gravity_form')) {
                        // Add cancel button next to form navigation when updating
                        if (!empty($_GET['update'])) {
                            $cancel_form_id = $this->form_id;
                            $cancel_step = isset($_GET['step']) ? (int) $_GET['step'] : 1;
                            $cancel_url = esc_url(add_query_arg('step', $cancel_step, wc_get_checkout_url()));

                            $add_cancel = function($button, $form) use ($cancel_form_id, $cancel_url, &$add_cancel) {
                                if ((int) $form['id'] !== $cancel_form_id) {
                                    return $button;
                                }
                                return $button . ' <a href="' . $cancel_url . '" class="tbc-cp-nav-btn">' . esc_html__('Cancel', 'tbc-checkout-prerequisites') . '</a>';
                            };
                            add_filter('gform_submit_button', $add_cancel, 10, 2);
                            add_filter('gform_next_button', $add_cancel, 10, 2);
                        }
                        gravity_form($this->form_id, false, true, false, null, false, 0, true);
                    } else {
                        echo '<p>' . esc_html__('Unable to display form. Please ensure Gravity Forms is active.', 'tbc-checkout-prerequisites') . '</p>';
                    }
                    ?>
                <?php else : ?>
                    <?php echo $this->render_entry_display(); ?>
                <?php endif; ?>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Render a summary card for a completed/submitted entry.
     */
    private function render_entry_display(): string {
        if (!$this->entry) {
            return '';
        }

        // Get user's name from the entry
        $user = get_userdata($this->entry['created_by']);
        $user_name = $user ? $user->display_name : '';

        $submitted_date = date_i18n(
            get_option('date_format') . ' ' . get_option('time_format'),
            strtotime($this->entry['date_updated'] . ' UTC')
        );

        $step_num = isset($_GET['step']) ? (int) $_GET['step'] : 1;
        $update_url = add_query_arg(['step' => $step_num, 'update' => '1'], wc_get_checkout_url());

        ob_start();
        ?>
        <div class="tbc-cp-entry-summary">
            <div class="tbc-cp-entry-summary-icon"><ion-icon name="checkmark-circle"></ion-icon></div>
            <div class="tbc-cp-entry-summary-info">
                <?php if ($user_name) : ?>
                    <div class="tbc-cp-entry-summary-name"><?php echo esc_html($user_name); ?></div>
                <?php endif; ?>
                <div class="tbc-cp-entry-summary-date"><?php echo esc_html(sprintf(__('Submitted: %s', 'tbc-checkout-prerequisites'), $submitted_date)); ?></div>
            </div>
            <a href="<?php echo esc_url($update_url); ?>" class="tbc-cp-nav-btn"><?php esc_html_e('Update Information', 'tbc-checkout-prerequisites'); ?></a>
        </div>
        <?php
        return ob_get_clean();
    }

    private function get_form(): ?array {
        if (!class_exists('GFAPI')) {
            return null;
        }
        return GFAPI::get_form($this->form_id) ?: null;
    }

    private function get_user_entry(): ?array {
        if (!class_exists('GFAPI')) {
            return null;
        }

        $entries = GFAPI::get_entries($this->form_id, [
            'status' => 'active',
            'field_filters' => [
                ['key' => 'created_by', 'value' => $this->user_id]
            ]
        ]);

        return !empty($entries) ? $entries[0] : null;
    }

    /**
     * Check if the form's field structure has changed since this entry was submitted.
     * Returns false if tracking is disabled for this step.
     * Entries without a stored hash (legacy) are treated as changed.
     */
    private function is_form_structure_changed(): bool {
        if (empty($this->step_data['track_field_changes'])) {
            return false;
        }

        if (!$this->entry) {
            return false;
        }

        $current_hash = self::compute_form_fields_hash($this->form_id, $this->form);
        if ($current_hash === null) {
            return false;
        }

        $stored_hash = gform_get_meta($this->entry['id'], 'tbc_cp_fields_hash');

        if ($stored_hash === null || $stored_hash === false || $stored_hash === '') {
            return true;
        }

        return $stored_hash !== $current_hash;
    }

    private function is_entry_expired(): bool {
        if (!$this->entry || empty($this->step_data['expires'])) {
            return false;
        }

        $last_updated = strtotime($this->entry['date_updated']);
        $expiry_days = (int) $this->step_data['expiry_days'];

        return (time() - ($expiry_days * DAY_IN_SECONDS)) > $last_updated;
    }
}
