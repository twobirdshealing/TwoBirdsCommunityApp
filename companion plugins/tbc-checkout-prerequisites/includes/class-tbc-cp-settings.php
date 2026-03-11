<?php
/**
 * Admin settings for Checkout Prerequisites
 */
class TBC_CP_Settings {
    
    public function __construct() {
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_init', [$this, 'register_settings']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_admin_assets']);
        add_action('wp_ajax_tbc_cp_save_steps', [$this, 'save_steps_ajax']);
    }

    public function add_admin_menu() {
        add_submenu_page(
            'woocommerce',
            __('Checkout Prerequisites', 'tbc-checkout-prerequisites'),
            __('Checkout Prerequisites', 'tbc-checkout-prerequisites'),
            'manage_options',
            'tbc-checkout-prerequisites',
            [$this, 'render_settings_page']
        );
    }

    public function register_settings() {
        register_setting('tbc_cp_settings', 'tbc_cp_steps');
    }

    public function enqueue_admin_assets($hook) {
        if ($hook !== 'woocommerce_page_tbc-checkout-prerequisites') {
            return;
        }
        
        wp_enqueue_style('tbc-cp-admin', TBC_CP_URL . 'css/tbc-cp-admin.css', [], TBC_CP_VERSION);
        wp_enqueue_script('tbc-cp-admin', TBC_CP_URL . 'js/tbc-cp-admin.js', ['jquery', 'jquery-ui-sortable'], TBC_CP_VERSION, true);
        
        wp_localize_script('tbc-cp-admin', 'tbc_cp_admin', [
            'courses' => $this->get_available_courses(),
            'forms' => $this->get_available_forms(),
            'categories' => $this->get_product_categories(),
            'nonce' => wp_create_nonce('tbc_cp_admin_nonce'),
            'ajaxurl' => admin_url('admin-ajax.php'),
            'steps' => tbc_cp_get_steps()
        ]);
    }

    private function get_product_categories() {
        $terms = get_terms([
            'taxonomy' => 'product_cat',
            'hide_empty' => false,
        ]);

        if (is_wp_error($terms)) {
            return [];
        }

        return array_map(fn($term) => [
            'id' => $term->term_id,
            'name' => $term->name
        ], $terms);
    }

    private function get_available_courses() {
        if (!TBC_CP_Course_Status::is_fluent_community_active()) {
            return [];
        }

        $fc_courses = \FluentCommunity\Modules\Course\Model\Course::where('status', 'published')
            ->orderBy('title', 'ASC')
            ->get();

        $courses = [];
        foreach ($fc_courses as $course) {
            $courses[] = [
                'id' => $course->id,
                'title' => $course->title
            ];
        }

        return $courses;
    }

    private function get_available_forms() {
        if (!class_exists('GFAPI')) {
            return [];
        }
        
        return array_map(fn($form) => [
            'id' => $form['id'],
            'title' => $form['title']
        ], GFAPI::get_forms());
    }

    public function save_steps_ajax() {
        check_ajax_referer('tbc_cp_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Unauthorized');
        }

        $steps = json_decode(stripslashes($_POST['steps'] ?? ''), true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            wp_send_json_error('Invalid data format');
        }

        $sanitized_steps = [];
        foreach ($steps as $step) {
            $sanitized = $this->sanitize_step_data($step);
            if ($sanitized === false) {
                wp_send_json_error('Invalid step data');
            }
            $sanitized_steps[] = $sanitized;
        }

        update_option('tbc_cp_steps', $sanitized_steps);
        wp_send_json_success('Steps saved successfully');
    }

    private function sanitize_step_data($step) {
        $type = sanitize_text_field($step['type'] ?? '');
        
        if (!in_array($type, ['course', 'form'], true)) {
            return false;
        }

        $sanitized = [
            'id' => sanitize_text_field($step['id'] ?? ''),
            'type' => $type,
            'title' => sanitize_text_field($step['title'] ?? ''),
            'description' => sanitize_textarea_field($step['description'] ?? ''),
            'categories' => array_map('absint', $step['categories'] ?? []),
            'order' => absint($step['order'] ?? 0)
        ];

        if ($type === 'course') {
            $sanitized['course_id'] = absint($step['course_id'] ?? 0);

            if (TBC_CP_Course_Status::is_fluent_community_active()) {
                $course = \FluentCommunity\Modules\Course\Model\Course::find($sanitized['course_id']);
                if (!$course) {
                    return false;
                }
            }
        } else {
            $sanitized['form_id'] = absint($step['form_id'] ?? 0);
            
            if (class_exists('GFAPI') && !GFAPI::form_id_exists($sanitized['form_id'])) {
                return false;
            }
            
            $sanitized['expires'] = !empty($step['expires']);
            $sanitized['expiry_days'] = absint($step['expiry_days'] ?? 365);
            $sanitized['track_field_changes'] = !empty($step['track_field_changes']);
            $sanitized['gravityview_shortcode'] = $this->sanitize_shortcode($step['gravityview_shortcode'] ?? '');

            $sanitized['approval_required'] = !empty($step['approval_required']);
            $sanitized['completed_statuses'] = array_map('absint', $step['completed_statuses'] ?? []);
            if ($sanitized['approval_required'] && empty($sanitized['completed_statuses'])) {
                $sanitized['completed_statuses'] = [1, 2];
            }
            $sanitized['phone_screening_enabled'] = !empty($step['phone_screening_enabled']);
            $sanitized['spirit_pharmacist_enabled'] = !empty($step['spirit_pharmacist_enabled']);
        }

        return $sanitized;
    }

    private function sanitize_shortcode(string $input): string {
        $input = trim($input);
        if ($input === '') {
            return '';
        }
        if (preg_match('/^\[gravityview\s[^\]]*\]$/', $input)) {
            return wp_kses($input, []);
        }
        return '';
    }

    public function render_settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }
        
        $steps = tbc_cp_get_steps();
        ?>
        <div class="wrap tbc-cp-settings-page">
            <h1><?php esc_html_e('Checkout Prerequisites', 'tbc-checkout-prerequisites'); ?></h1>
            <p class="description"><?php esc_html_e('Configure the steps customers must complete before checkout.', 'tbc-checkout-prerequisites'); ?></p>
            
            <div class="tbc-cp-steps-wrap">
                <div id="tbc-cp-steps-list">
                    <?php if (!empty($steps)) : ?>
                        <?php foreach ($steps as $step) : ?>
                            <?php echo $this->render_step_item($step); ?>
                        <?php endforeach; ?>
                    <?php else : ?>
                        <p class="tbc-cp-no-steps"><?php esc_html_e('No steps configured yet. Add your first step below.', 'tbc-checkout-prerequisites'); ?></p>
                    <?php endif; ?>
                </div>

                <div class="tbc-cp-actions">
                    <button type="button" class="button button-secondary" id="tbc-cp-save-steps"><?php esc_html_e('Save Order', 'tbc-checkout-prerequisites'); ?></button>
                    <button type="button" class="button button-primary" id="tbc-cp-add-step"><?php esc_html_e('Add New Step', 'tbc-checkout-prerequisites'); ?></button>
                </div>
            </div>

            <?php echo $this->render_step_modal(); ?>
        </div>
        <?php
    }

    private function render_step_item($step) {
        $category_names = $this->get_category_names($step['categories'] ?? []);
        $step_id = esc_attr($step['id']);
        $step_type = esc_html(ucfirst($step['type']));
        $step_title = esc_html($step['title']);
        $step_desc = esc_html($step['description']);
        
        ob_start();
        ?>
        <div class="tbc-cp-step-item" data-step-id="<?php echo $step_id; ?>">
            <div class="tbc-cp-step-drag dashicons dashicons-menu"></div>
            <div class="tbc-cp-step-content">
                <h3><?php echo $step_title; ?></h3>
                <p><?php echo $step_desc; ?></p>
                <div class="tbc-cp-step-meta">
                    <span class="tbc-cp-meta-type"><?php echo $step_type; ?></span>
                    <?php if ($step['type'] === 'course') : ?>
                        <span class="tbc-cp-meta-id"><?php echo esc_html__('Course ID:', 'tbc-checkout-prerequisites') . ' ' . esc_html($step['course_id']); ?></span>
                    <?php else : ?>
                        <span class="tbc-cp-meta-id"><?php echo esc_html__('Form ID:', 'tbc-checkout-prerequisites') . ' ' . esc_html($step['form_id']); ?></span>
                        <?php if (!empty($step['expires'])) : ?>
                            <span class="tbc-cp-meta-expiry"><?php echo esc_html(sprintf(__('Expires after %d days', 'tbc-checkout-prerequisites'), $step['expiry_days'])); ?></span>
                        <?php endif; ?>
                        <?php if (!empty($step['gravityview_shortcode'])) : ?>
                            <span class="tbc-cp-meta-gv"><?php esc_html_e('Has GravityView', 'tbc-checkout-prerequisites'); ?></span>
                        <?php endif; ?>
                        <?php if (!empty($step['approval_required'])) : ?>
                            <span class="tbc-cp-meta-approval"><?php esc_html_e('Requires Approval', 'tbc-checkout-prerequisites'); ?></span>
                        <?php endif; ?>
                        <?php if (!empty($step['track_field_changes'])) : ?>
                            <span class="tbc-cp-meta-track"><?php esc_html_e('Tracks Changes', 'tbc-checkout-prerequisites'); ?></span>
                        <?php endif; ?>
                        <?php if (!empty($step['phone_screening_enabled'])) : ?>
                            <span class="tbc-cp-meta-phone"><?php esc_html_e('Phone Screening', 'tbc-checkout-prerequisites'); ?></span>
                        <?php endif; ?>
                        <?php if (!empty($step['spirit_pharmacist_enabled'])) : ?>
                            <span class="tbc-cp-meta-pharmacist"><?php esc_html_e('Spirit Pharmacist', 'tbc-checkout-prerequisites'); ?></span>
                        <?php endif; ?>
                    <?php endif; ?>
                    <span class="tbc-cp-meta-cats"><?php echo esc_html__('Categories:', 'tbc-checkout-prerequisites') . ' ' . esc_html($category_names); ?></span>
                </div>
            </div>
            <div class="tbc-cp-step-actions">
                <button type="button" class="button tbc-cp-edit-step" data-step-id="<?php echo $step_id; ?>"><?php esc_html_e('Edit', 'tbc-checkout-prerequisites'); ?></button>
                <button type="button" class="button tbc-cp-delete-step" data-step-id="<?php echo $step_id; ?>"><?php esc_html_e('Delete', 'tbc-checkout-prerequisites'); ?></button>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    private function get_category_names($category_ids) {
        if (empty($category_ids)) {
            return __('All Categories', 'tbc-checkout-prerequisites');
        }
        
        $categories = get_terms([
            'taxonomy' => 'product_cat',
            'include' => $category_ids,
            'hide_empty' => false,
        ]);
        
        if (is_wp_error($categories) || empty($categories)) {
            return __('All Categories', 'tbc-checkout-prerequisites');
        }
        
        return implode(', ', wp_list_pluck($categories, 'name'));
    }

    private function render_step_modal() {
        $categories = $this->get_product_categories();
        ob_start();
        ?>
        <div id="tbc-cp-modal" class="tbc-cp-modal" style="display: none;">
            <div class="tbc-cp-modal__content">
                <div class="tbc-cp-modal__header">
                    <h2><?php esc_html_e('Configure Step', 'tbc-checkout-prerequisites'); ?></h2>
                    <button type="button" class="tbc-cp-modal-close">&times;</button>
                </div>
                <div class="tbc-cp-modal__body">
                    <form id="tbc-cp-step-form">
                        <input type="hidden" name="step_id" id="tbc-cp-step-id">
                        
                        <div class="tbc-cp-field">
                            <label for="tbc-cp-step-type"><?php esc_html_e('Step Type', 'tbc-checkout-prerequisites'); ?> *</label>
                            <select name="step_type" id="tbc-cp-step-type" required>
                                <option value=""><?php esc_html_e('Select Type', 'tbc-checkout-prerequisites'); ?></option>
                                <option value="course"><?php esc_html_e('Fluent Community Course', 'tbc-checkout-prerequisites'); ?></option>
                                <option value="form"><?php esc_html_e('Gravity Form', 'tbc-checkout-prerequisites'); ?></option>
                            </select>
                        </div>

                        <div class="tbc-cp-field tbc-cp-course-field">
                            <label for="tbc-cp-course-id"><?php esc_html_e('Select Course', 'tbc-checkout-prerequisites'); ?> *</label>
                            <select name="course_id" id="tbc-cp-course-id"></select>
                        </div>

                        <div class="tbc-cp-field tbc-cp-form-field">
                            <label for="tbc-cp-form-id"><?php esc_html_e('Select Form', 'tbc-checkout-prerequisites'); ?> *</label>
                            <select name="form_id" id="tbc-cp-form-id"></select>
                        </div>

                        <div class="tbc-cp-field">
                            <label for="tbc-cp-step-title"><?php esc_html_e('Step Title', 'tbc-checkout-prerequisites'); ?> *</label>
                            <input type="text" name="step_title" id="tbc-cp-step-title" required>
                        </div>

                        <div class="tbc-cp-field">
                            <label for="tbc-cp-step-desc"><?php esc_html_e('Step Description', 'tbc-checkout-prerequisites'); ?></label>
                            <textarea name="step_description" id="tbc-cp-step-desc" rows="3"></textarea>
                        </div>

                        <div class="tbc-cp-field">
                            <label for="tbc-cp-step-cats"><?php esc_html_e('Show for Categories', 'tbc-checkout-prerequisites'); ?></label>
                            <select name="step_categories[]" id="tbc-cp-step-cats" multiple="multiple" class="widefat">
                                <?php foreach ($categories as $cat) : ?>
                                    <option value="<?php echo esc_attr($cat['id']); ?>"><?php echo esc_html($cat['name']); ?></option>
                                <?php endforeach; ?>
                            </select>
                            <p class="description"><?php esc_html_e('Leave empty to show for all categories.', 'tbc-checkout-prerequisites'); ?></p>
                        </div>

                        <div class="tbc-cp-field tbc-cp-form-options">
                            <label>
                                <input type="checkbox" name="expires" id="tbc-cp-expires">
                                <?php esc_html_e('Form Expires', 'tbc-checkout-prerequisites'); ?>
                            </label>
                            <div class="tbc-cp-expiry-days" style="display: none;">
                                <label for="tbc-cp-expiry-days"><?php esc_html_e('Days until expiry', 'tbc-checkout-prerequisites'); ?></label>
                                <input type="number" name="expiry_days" id="tbc-cp-expiry-days" min="1" value="365">
                            </div>
                        </div>

                        <div class="tbc-cp-field tbc-cp-form-options">
                            <label>
                                <input type="checkbox" name="track_field_changes" id="tbc-cp-track-changes">
                                <?php esc_html_e('Require re-submission when questions change', 'tbc-checkout-prerequisites'); ?>
                            </label>
                            <p class="description"><?php esc_html_e('When enabled, users must re-submit if new questions are added to this form.', 'tbc-checkout-prerequisites'); ?></p>
                        </div>

                        <div class="tbc-cp-field tbc-cp-form-options">
                            <label for="tbc-cp-gv-shortcode"><?php esc_html_e('GravityView Shortcode', 'tbc-checkout-prerequisites'); ?></label>
                            <input type="text" name="gravityview_shortcode" id="tbc-cp-gv-shortcode" placeholder="[gravityview id=&quot;123&quot;]">
                            <p class="description"><?php esc_html_e('Paste your GravityView shortcode here to display form data.', 'tbc-checkout-prerequisites'); ?></p>
                        </div>

                        <div class="tbc-cp-field tbc-cp-form-options">
                            <label>
                                <input type="checkbox" name="approval_required" id="tbc-cp-approval-required">
                                <?php esc_html_e('Require Approval Status', 'tbc-checkout-prerequisites'); ?>
                            </label>
                            <p class="description"><?php esc_html_e('Gate this step until the entry reaches a qualifying GravityView approval status.', 'tbc-checkout-prerequisites'); ?></p>
                            <div class="tbc-cp-approval-statuses" style="display: none;">
                                <label><?php esc_html_e('Statuses that count as completed:', 'tbc-checkout-prerequisites'); ?></label>
                                <label class="tbc-cp-checkbox-label">
                                    <input type="checkbox" name="completed_statuses[]" value="1">
                                    <?php esc_html_e('Approved', 'tbc-checkout-prerequisites'); ?>
                                </label>
                                <label class="tbc-cp-checkbox-label">
                                    <input type="checkbox" name="completed_statuses[]" value="2">
                                    <?php esc_html_e('Disapproved', 'tbc-checkout-prerequisites'); ?>
                                </label>
                                <label class="tbc-cp-checkbox-label">
                                    <input type="checkbox" name="completed_statuses[]" value="3">
                                    <?php esc_html_e('Unapproved', 'tbc-checkout-prerequisites'); ?>
                                </label>
                            </div>
                        </div>

                        <div class="tbc-cp-field tbc-cp-form-options">
                            <label>
                                <input type="checkbox" name="phone_screening_enabled" id="tbc-cp-phone-screening">
                                <?php esc_html_e('Require Phone Screening Confirmation', 'tbc-checkout-prerequisites'); ?>
                            </label>
                            <p class="description"><?php esc_html_e('When enabled, admin must set a phone screening status before the entry can be approved. Users see a specific message when screening is pending.', 'tbc-checkout-prerequisites'); ?></p>
                        </div>

                        <div class="tbc-cp-field tbc-cp-form-options">
                            <label>
                                <input type="checkbox" name="spirit_pharmacist_enabled" id="tbc-cp-spirit-pharmacist">
                                <?php esc_html_e('Require Spirit Pharmacist Consultation', 'tbc-checkout-prerequisites'); ?>
                            </label>
                            <p class="description"><?php esc_html_e('When enabled, admin can require users to complete a clinical pharmacist consultation before proceeding. Users see booking instructions when consultation is required.', 'tbc-checkout-prerequisites'); ?></p>
                        </div>
                    </form>
                </div>
                <div class="tbc-cp-modal__footer">
                    <button type="button" class="button button-secondary tbc-cp-modal-close"><?php esc_html_e('Cancel', 'tbc-checkout-prerequisites'); ?></button>
                    <button type="button" class="button button-primary tbc-cp-save-step"><?php esc_html_e('Save Step', 'tbc-checkout-prerequisites'); ?></button>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }
}