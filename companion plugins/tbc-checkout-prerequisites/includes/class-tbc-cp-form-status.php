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

    public function __construct(int $user_id, int $form_id, array $step_data) {
        $this->user_id = $user_id;
        $this->form_id = $form_id;
        $this->step_data = $step_data;
        $this->entry = $this->get_user_entry();
        $this->form = $this->get_form();
    }

    public static function init_global_hooks(): void {
        add_filter('gform_confirmation', [__CLASS__, 'handle_form_confirmation'], 20, 4);
        add_filter('gravityview/edit_entry/success', [__CLASS__, 'handle_gravityview_success'], 20, 4);
        add_action('gform_after_submission', [__CLASS__, 'store_form_fields_hash'], 10, 2);
    }

    public static function handle_form_confirmation($confirmation, $form, $entry, $ajax) {
        if (!is_checkout()) {
            return $confirmation;
        }
        
        $form_ids = self::get_checkout_form_ids();
        
        if (!in_array((int) $form['id'], $form_ids, true)) {
            return $confirmation;
        }
        
        $step = isset($_GET['step']) ? (int) $_GET['step'] : 1;
        $url = add_query_arg('step', $step, wc_get_checkout_url());
        
        return self::render_success_card(
            __('Step Completed!', 'tbc-checkout-prerequisites'),
            __('Great job! Your information has been saved.', 'tbc-checkout-prerequisites'),
            $url,
            (int) $form['id']
        );
    }

    public static function handle_gravityview_success($message, $view, $entry, $back_link) {
        if (!is_checkout()) {
            return $message;
        }

        $form_ids = self::get_checkout_form_ids();

        if (!in_array((int) $entry['form_id'], $form_ids, true)) {
            return $message;
        }

        // Store updated form structure hash after edit
        $hash = self::compute_form_fields_hash((int) $entry['form_id']);
        if ($hash !== null && function_exists('gform_update_meta')) {
            gform_update_meta($entry['id'], 'tbc_cp_fields_hash', $hash);
        }

        $step = isset($_GET['step']) ? (int) $_GET['step'] : 1;
        $url = add_query_arg('step', $step, wc_get_checkout_url());

        return self::render_success_card(
            __('Step Updated!', 'tbc-checkout-prerequisites'),
            __('Great job! Your information has been updated.', 'tbc-checkout-prerequisites'),
            $url,
            (int) $entry['form_id']
        );
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
    public static function compute_form_fields_hash(int $form_id): ?string {
        if (!class_exists('GFAPI')) {
            return null;
        }

        $form = GFAPI::get_form($form_id);
        if (!$form || empty($form['fields'])) {
            return null;
        }

        $non_input_types = ['html', 'section', 'page', 'captcha'];
        $field_ids = [];

        foreach ($form['fields'] as $field) {
            if (in_array($field->type, $non_input_types, true)) {
                continue;
            }
            $field_ids[] = (int) $field->id;
        }

        sort($field_ids, SORT_NUMERIC);

        return md5(implode(',', $field_ids));
    }

    /**
     * Store the form structure hash on the entry after submission.
     * Only applies to forms configured as checkout prerequisite steps.
     */
    public static function store_form_fields_hash($entry, $form): void {
        if (empty($entry) || empty($form)) {
            return;
        }

        $form_ids = self::get_checkout_form_ids();

        if (!in_array((int) $form['id'], $form_ids, true)) {
            return;
        }

        $hash = self::compute_form_fields_hash((int) $form['id']);
        if ($hash !== null) {
            gform_update_meta($entry['id'], 'tbc_cp_fields_hash', $hash);
        }
    }

    private static function render_success_card(string $title, string $message, string $redirect_url = '', int $form_id = 0): string {
        $redirect_attr = $redirect_url ? ' data-redirect-url="' . esc_attr($redirect_url) . '"' : '';
        $form_attr = $form_id ? ' data-form-id="' . esc_attr($form_id) . '"' : '';

        return '
        <div class="tbc-cp-success-card"' . $redirect_attr . $form_attr . '>
            <div class="tbc-cp-success-icon"></div>
            <h3 class="tbc-cp-success-title">' . esc_html($title) . '</h3>
            <p class="tbc-cp-success-message">' . esc_html($message) . '<br>' . esc_html__('Updating your progress...', 'tbc-checkout-prerequisites') . '</p>
            <div class="tbc-cp-success-spinner"></div>
        </div>';
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
            $approval_status = function_exists('gform_get_meta')
                ? (int) gform_get_meta($this->entry['id'], 'is_approved')
                : null;
            $completed_statuses = $this->step_data['completed_statuses'] ?? [1, 2];
            if ($approval_status !== null) {
                $pending_approval = !in_array($approval_status, $completed_statuses, true);
            }
        }

        $expired = $this->is_entry_expired();
        if ($expired || $form_changed) {
            $pending_approval = false;
        }

        if ($has_entry && !$form_changed && !$expired && !empty($this->step_data['phone_screening_enabled'])) {
            $phone_screening = function_exists('gform_get_meta')
                ? gform_get_meta($this->entry['id'], 'tbc_cp_phone_screening')
                : null;
            if ($phone_screening === 'required') {
                $phone_screening_required = true;
            }
        }

        if ($has_entry && !$form_changed && !$expired && !empty($this->step_data['spirit_pharmacist_enabled'])) {
            $spirit_pharmacist = function_exists('gform_get_meta')
                ? gform_get_meta($this->entry['id'], 'tbc_cp_spirit_pharmacist')
                : null;
            if ($spirit_pharmacist === 'required') {
                $spirit_pharmacist_required = true;
            }
        }

        return [
            'completed' => $has_entry && !$pending_approval && !$phone_screening_required && !$spirit_pharmacist_required,
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
                        <div class="tbc-cp-pharmacist-icon"></div>
                        <h4><?php esc_html_e('Spirit Pharmacist Consultation Required', 'tbc-checkout-prerequisites'); ?></h4>
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
                        <div class="tbc-cp-phone-icon"></div>
                        <h4><?php esc_html_e('New Member Check-In', 'tbc-checkout-prerequisites'); ?></h4>
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
                        <div class="tbc-cp-approval-icon"></div>
                        <h4><?php esc_html_e('Submitted — Awaiting Review', 'tbc-checkout-prerequisites'); ?></h4>
                        <p><?php esc_html_e('Your submission has been received and is being reviewed. You\'ll be able to proceed once it\'s been approved.', 'tbc-checkout-prerequisites'); ?></p>
                        <?php if ($status['last_updated']) : ?>
                            <span class="tbc-cp-last-updated">
                                <?php echo esc_html(sprintf(
                                    __('Submitted: %s', 'tbc-checkout-prerequisites'),
                                    date_i18n(get_option('date_format'), strtotime($status['last_updated']))
                                )); ?>
                            </span>
                        <?php endif; ?>
                    </div>
                    <?php if (!empty($this->step_data['gravityview_shortcode'])) : ?>
                        <?php echo do_shortcode($this->step_data['gravityview_shortcode']); ?>
                    <?php endif; ?>
                <?php elseif (!$status['completed']) : ?>
                    <?php
                    if (function_exists('gravity_form')) {
                        gravity_form($this->form_id, false, true, false, null, false, 0, true);
                    } else {
                        echo '<p>' . esc_html__('Unable to display form. Please ensure Gravity Forms is active.', 'tbc-checkout-prerequisites') . '</p>';
                    }
                    ?>
                <?php elseif (!empty($this->step_data['gravityview_shortcode'])) : ?>
                    <?php echo do_shortcode($this->step_data['gravityview_shortcode']); ?>
                <?php else : ?>
                    <div class="tbc-cp-gv-missing">
                        <p><?php esc_html_e('GravityView display has not been configured for this form.', 'tbc-checkout-prerequisites'); ?></p>
                    </div>
                <?php endif; ?>
            </div>
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

        if (!$this->entry || !function_exists('gform_get_meta')) {
            return false;
        }

        $current_hash = self::compute_form_fields_hash($this->form_id);
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