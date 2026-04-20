<?php
/**
 * Frontend shortcode for Entry Review
 */
class TBC_CP_Entry_Review {

    private const PER_PAGE = 20;
    private ?array $tab_counts = null;
    private ?array $all_entry_data = null;

    public function __construct() {
        add_shortcode('tbc_cp_entry_review', [$this, 'render_shortcode']);
        add_action('wp_enqueue_scripts', [$this, 'maybe_enqueue_assets']);
    }

    public function maybe_enqueue_assets() {
        global $post;
        if (!$post || !has_shortcode($post->post_content, 'tbc_cp_entry_review')) {
            return;
        }
        if (!current_user_can('manage_options')) {
            return;
        }

        // Load Fluent Community global styles + color variables (light/dark)
        // so --fcom-* CSS variables are available for theming
        if (did_action('fluent_community/enqueue_global_assets') === 0) {
            do_action('fluent_community/enqueue_global_assets', true);
        }

        wp_enqueue_style('tbc-cp-entry-review', TBC_CP_URL . 'css/tbc-cp-entry-review.css', [], TBC_CP_VERSION);
        wp_enqueue_style('tbc-cp-navigation', TBC_CP_URL . 'css/tbc-cp-navigation.css', [], TBC_CP_VERSION);
        wp_enqueue_script('tbc-cp-utils', TBC_CP_URL . 'js/tbc-cp-utils.js', ['jquery'], TBC_CP_VERSION, true);
        wp_enqueue_script('tbc-cp-entry-review', TBC_CP_URL . 'js/tbc-cp-entry-review.js', ['jquery', 'tbc-cp-utils'], TBC_CP_VERSION, true);
        wp_localize_script('tbc-cp-entry-review', 'tbc_cp_er', [
            'ajaxurl' => admin_url('admin-ajax.php'),
            'nonce'   => wp_create_nonce('tbc_cp_er_nonce'),
        ]);
    }

    public function render_shortcode($atts): string {
        if (!current_user_can('manage_options')) {
            return '<p>You do not have permission to view this page.</p>';
        }

        if (!class_exists('GFAPI')) {
            return '<p>Gravity Forms is required for entry review.</p>';
        }

        ob_start();
        $this->render_page();
        return ob_get_clean();
    }

    private function render_page(): void {
        $base_url = get_permalink();

        // Tab filter
        $filter = sanitize_text_field($_GET['er_filter'] ?? 'pending');

        // Additional filters
        $search = sanitize_text_field($_GET['er_search'] ?? '');
        $filter_meds = sanitize_text_field($_GET['er_meds'] ?? '');
        $filter_blocked = sanitize_text_field($_GET['er_blocked'] ?? '');
        $filter_approval = sanitize_text_field($_GET['er_approval'] ?? '');
        $filter_screening = sanitize_text_field($_GET['er_screening'] ?? '');
        $filter_spirit = sanitize_text_field($_GET['er_spirit'] ?? '');
        $paged = max(1, absint($_GET['er_paged'] ?? 1));
        $sort_by = sanitize_text_field($_GET['er_sort'] ?? 'updated');
        $sort_order = sanitize_text_field($_GET['er_order'] ?? 'desc');
        if (!in_array($sort_by, ['submitted', 'updated'], true)) {
            $sort_by = 'updated';
        }
        if (!in_array($sort_order, ['asc', 'desc'], true)) {
            $sort_order = 'desc';
        }

        $filters = [
            'search' => $search,
            'meds' => $filter_meds,
            'blocked' => $filter_blocked,
            'approval' => $filter_approval,
            'screening' => $filter_screening,
            'spirit' => $filter_spirit,
        ];

        $form_steps = $this->get_form_steps();

        $all_entries = $this->get_entries_for_review($form_steps, $filter, $filters, $sort_by, $sort_order);

        // Pagination
        $total = count($all_entries);
        $total_pages = max(1, (int) ceil($total / self::PER_PAGE));
        $paged = min($paged, $total_pages);
        $offset = ($paged - 1) * self::PER_PAGE;
        $entries = array_slice($all_entries, $offset, self::PER_PAGE);

        // Build base URL for pagination (preserve all filters)
        $base_args = array_filter([
            'er_filter' => $filter,
            'er_search' => $search,
            'er_meds' => $filter_meds,
            'er_blocked' => $filter_blocked,
            'er_approval' => $filter_approval,
            'er_screening' => $filter_screening,
            'er_spirit' => $filter_spirit,
            'er_sort' => $sort_by !== 'updated' ? $sort_by : '',
            'er_order' => $sort_order !== 'desc' ? $sort_order : '',
        ]);
        $clear_url = add_query_arg(['er_filter' => $filter], $base_url);
        $has_filters = $search || $filter_meds || $filter_blocked || $filter_approval || $filter_screening || $filter_spirit;

        ?>
        <div class="tbc-cp-er-wrap">
            <div class="tbc-cp-er-header-row">
                <h2><?php esc_html_e('Entry Review', 'tbc-checkout-prerequisites'); ?></h2>
                <button type="button" class="tbc-cp-er-settings-gear" id="tbc-cp-er-open-msg-settings" title="<?php esc_attr_e('Message Settings', 'tbc-checkout-prerequisites'); ?>">&#9881;</button>
            </div>

            <div class="tbc-cp-er-workflow-banner">
                <strong><?php esc_html_e('Workflow:', 'tbc-checkout-prerequisites'); ?></strong>
                <?php esc_html_e('Review entry → Set spirit pharmacist / phone screening status → Edit consultation notes → Approve → Confirm & send message.', 'tbc-checkout-prerequisites'); ?>
            </div>

            <?php $this->render_upcoming_calls_banner($form_steps); ?>

            <?php $counts = $this->get_tab_counts($form_steps); ?>
            <div class="tbc-cp-er-tabs">
                <?php
                $tabs = [
                    'pending' => __('Pending Review', 'tbc-checkout-prerequisites'),
                    'spirit_pharmacist' => __('Pharmacist Required', 'tbc-checkout-prerequisites'),
                    'phone_screening' => __('Phone Screening Required', 'tbc-checkout-prerequisites'),
                    'upcoming_calls' => __('Upcoming Calls', 'tbc-checkout-prerequisites'),
                    'all' => __('All Entries', 'tbc-checkout-prerequisites'),
                ];
                $tab_keys = array_keys($tabs);
                foreach ($tabs as $key => $label) :
                    $tab_url = add_query_arg('er_filter', $key, $base_url);
                    $is_current = $filter === $key;
                    $is_last = $key === end($tab_keys);
                ?>
                    <a href="<?php echo esc_url($tab_url); ?>" class="tbc-cp-er-tab<?php echo $is_current ? ' tbc-cp-er-tab-current' : ''; ?>">
                        <?php echo esc_html($label); ?>
                        <span class="tbc-cp-er-count">(<?php echo (int) $counts[$key]; ?>)</span>
                    </a><?php if (!$is_last) echo ' | '; ?>
                <?php endforeach; ?>
            </div>

            <div class="tbc-cp-er-filters">
                <form method="get" action="<?php echo esc_url($base_url); ?>">
                    <input type="hidden" name="er_filter" value="<?php echo esc_attr($filter); ?>">
                    <input type="text" name="er_search" placeholder="<?php esc_attr_e('Search user...', 'tbc-checkout-prerequisites'); ?>" value="<?php echo esc_attr($search); ?>">
                    <select name="er_meds">
                        <option value=""><?php esc_html_e('All Medications', 'tbc-checkout-prerequisites'); ?></option>
                        <option value="yes" <?php selected($filter_meds, 'yes'); ?>><?php esc_html_e('On Medication', 'tbc-checkout-prerequisites'); ?></option>
                        <option value="no" <?php selected($filter_meds, 'no'); ?>><?php esc_html_e('No Medication', 'tbc-checkout-prerequisites'); ?></option>
                    </select>
                    <select name="er_blocked">
                        <option value=""><?php esc_html_e('All Users', 'tbc-checkout-prerequisites'); ?></option>
                        <option value="1" <?php selected($filter_blocked, '1'); ?>><?php esc_html_e('Blocked', 'tbc-checkout-prerequisites'); ?></option>
                        <option value="0" <?php selected($filter_blocked, '0'); ?>><?php esc_html_e('Allowed', 'tbc-checkout-prerequisites'); ?></option>
                    </select>
                    <select name="er_approval">
                        <option value=""><?php esc_html_e('All Approval', 'tbc-checkout-prerequisites'); ?></option>
                        <option value="unapproved" <?php selected($filter_approval, 'unapproved'); ?>><?php esc_html_e('Unapproved', 'tbc-checkout-prerequisites'); ?></option>
                        <option value="1" <?php selected($filter_approval, '1'); ?>><?php esc_html_e('Approved', 'tbc-checkout-prerequisites'); ?></option>
                        <option value="2" <?php selected($filter_approval, '2'); ?>><?php esc_html_e('Disapproved', 'tbc-checkout-prerequisites'); ?></option>
                    </select>
                    <select name="er_screening">
                        <option value=""><?php esc_html_e('All Screening', 'tbc-checkout-prerequisites'); ?></option>
                        <option value="not_set" <?php selected($filter_screening, 'not_set'); ?>><?php esc_html_e('Not Set', 'tbc-checkout-prerequisites'); ?></option>
                        <option value="not_required" <?php selected($filter_screening, 'not_required'); ?>><?php esc_html_e('Not Required', 'tbc-checkout-prerequisites'); ?></option>
                        <option value="required" <?php selected($filter_screening, 'required'); ?>><?php esc_html_e('Required', 'tbc-checkout-prerequisites'); ?></option>
                        <option value="completed" <?php selected($filter_screening, 'completed'); ?>><?php esc_html_e('Completed', 'tbc-checkout-prerequisites'); ?></option>
                    </select>
                    <select name="er_spirit">
                        <option value=""><?php esc_html_e('All Pharmacist', 'tbc-checkout-prerequisites'); ?></option>
                        <option value="not_set" <?php selected($filter_spirit, 'not_set'); ?>><?php esc_html_e('Not Set', 'tbc-checkout-prerequisites'); ?></option>
                        <option value="not_required" <?php selected($filter_spirit, 'not_required'); ?>><?php esc_html_e('Not Required', 'tbc-checkout-prerequisites'); ?></option>
                        <option value="required" <?php selected($filter_spirit, 'required'); ?>><?php esc_html_e('Required', 'tbc-checkout-prerequisites'); ?></option>
                        <option value="completed" <?php selected($filter_spirit, 'completed'); ?>><?php esc_html_e('Completed', 'tbc-checkout-prerequisites'); ?></option>
                    </select>
                    <button type="submit" class="tbc-cp-er-btn"><?php esc_html_e('Filter', 'tbc-checkout-prerequisites'); ?></button>
                    <?php if ($has_filters) : ?>
                        <a href="<?php echo esc_url($clear_url); ?>" class="tbc-cp-er-clear-filters"><?php esc_html_e('Clear Filters', 'tbc-checkout-prerequisites'); ?></a>
                    <?php endif; ?>
                </form>
            </div>

            <?php $this->render_pagination($total, $paged, $total_pages, $base_args, $base_url); ?>

            <?php
            // Build sortable column URLs
            $sort_base = array_filter([
                'er_filter' => $filter,
                'er_search' => $search,
                'er_meds' => $filter_meds,
                'er_blocked' => $filter_blocked,
                'er_approval' => $filter_approval,
                'er_screening' => $filter_screening,
                'er_spirit' => $filter_spirit,
            ]);
            $submitted_order = ($sort_by === 'submitted' && $sort_order === 'desc') ? 'asc' : 'desc';
            $updated_order = ($sort_by === 'updated' && $sort_order === 'desc') ? 'asc' : 'desc';
            $submitted_url = add_query_arg(array_merge($sort_base, ['er_sort' => 'submitted', 'er_order' => $submitted_order]), $base_url);
            $updated_url = add_query_arg(array_merge($sort_base, ['er_sort' => 'updated', 'er_order' => $updated_order]), $base_url);
            $arrow_submitted = $sort_by === 'submitted' ? ($sort_order === 'asc' ? ' &#9650;' : ' &#9660;') : '';
            $arrow_updated = $sort_by === 'updated' ? ($sort_order === 'asc' ? ' &#9650;' : ' &#9660;') : '';
            ?>

            <div class="tbc-cp-er-table-wrap">
                <table class="tbc-cp-er-table">
                    <thead>
                        <tr>
                            <th><?php esc_html_e('User', 'tbc-checkout-prerequisites'); ?></th>
                            <th><?php esc_html_e('Form', 'tbc-checkout-prerequisites'); ?></th>
                            <th class="tbc-cp-er-sortable <?php echo $sort_by === 'submitted' ? 'tbc-cp-er-sorted' : ''; ?>">
                                <a href="<?php echo esc_url($submitted_url); ?>"><?php esc_html_e('Submitted', 'tbc-checkout-prerequisites'); ?><?php echo $arrow_submitted; ?></a>
                            </th>
                            <th class="tbc-cp-er-sortable <?php echo $sort_by === 'updated' ? 'tbc-cp-er-sorted' : ''; ?>">
                                <a href="<?php echo esc_url($updated_url); ?>"><?php esc_html_e('Last Updated', 'tbc-checkout-prerequisites'); ?><?php echo $arrow_updated; ?></a>
                            </th>
                            <th><?php esc_html_e('Medications', 'tbc-checkout-prerequisites'); ?></th>
                            <th><?php esc_html_e('Blocked', 'tbc-checkout-prerequisites'); ?></th>
                            <th><?php esc_html_e('Spirit Pharmacist', 'tbc-checkout-prerequisites'); ?></th>
                            <th><?php esc_html_e('Phone Screening', 'tbc-checkout-prerequisites'); ?></th>
                            <th><?php esc_html_e('Consult Notes', 'tbc-checkout-prerequisites'); ?></th>
                            <th><?php esc_html_e('Approval', 'tbc-checkout-prerequisites'); ?></th>
                            <th class="tbc-cp-er-actions-header"><?php esc_html_e('Actions', 'tbc-checkout-prerequisites'); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($entries)) : ?>
                            <tr>
                                <td colspan="11">
                                    <p style="text-align:center; padding: 20px;">
                                        <?php esc_html_e('No entries found for this filter.', 'tbc-checkout-prerequisites'); ?>
                                    </p>
                                </td>
                            </tr>
                        <?php else : ?>
                            <?php foreach ($entries as $data) : ?>
                                <?php $this->render_entry_row($data); ?>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>

            <?php $this->render_pagination($total, $paged, $total_pages, $base_args, $base_url); ?>
        </div>

        <?php $this->render_entry_modal(); ?>
        <?php $this->render_notes_modal(); ?>
        <?php $this->render_schedule_modal(); ?>
        <?php $this->render_message_settings_modal(); ?>
        <?php $this->render_approval_preview_modal(); ?>
        <?php
    }

    private function render_pagination(int $total, int $paged, int $total_pages, array $base_args, string $base_url): void {
        if ($total <= self::PER_PAGE) {
            return;
        }

        $start = (($paged - 1) * self::PER_PAGE) + 1;
        $end = min($paged * self::PER_PAGE, $total);

        $page_links = paginate_links([
            'base' => add_query_arg('er_paged', '%#%', add_query_arg($base_args, $base_url)),
            'format' => '',
            'current' => $paged,
            'total' => $total_pages,
            'prev_text' => '&laquo;',
            'next_text' => '&raquo;',
        ]);

        ?>
        <div class="tbc-cp-er-pagination">
            <span class="tbc-cp-er-entry-count">
                <?php printf(
                    esc_html__('Showing %1$d–%2$d of %3$d entries', 'tbc-checkout-prerequisites'),
                    $start, $end, $total
                ); ?>
            </span>
            <?php if ($page_links) : ?>
                <div class="tbc-cp-er-page-links"><?php echo $page_links; ?></div>
            <?php endif; ?>
        </div>
        <?php
    }

    private function get_form_steps(): array {
        $steps = tbc_cp_get_steps();
        return array_filter($steps, fn($s) => $s['type'] === 'form' && !empty($s['approval_required']));
    }

    /**
     * Load all entry data once. Used by tab counts, entry list, and upcoming calls banner.
     */
    private function load_all_entry_data(array $form_steps): array {
        if ($this->all_entry_data !== null) {
            return $this->all_entry_data;
        }

        $this->all_entry_data = [];

        // First pass: collect all entries and unique user IDs for batch prefetch
        $all_raw = [];
        foreach ($form_steps as $step) {
            $entries = GFAPI::get_entries($step['form_id'], ['status' => 'active'], [], ['offset' => 0, 'page_size' => 999]);
            if (!empty($entries)) {
                $all_raw[] = ['step' => $step, 'entries' => $entries];
            }
        }

        // Batch-prime user cache to avoid N+1 get_userdata calls
        $user_ids = [];
        foreach ($all_raw as $group) {
            foreach ($group['entries'] as $entry) {
                if (!empty($entry['created_by'])) {
                    $user_ids[] = (int) $entry['created_by'];
                }
            }
        }
        if (!empty($user_ids)) {
            cache_users(array_unique($user_ids));
        }

        // Second pass: build entry data
        foreach ($all_raw as $group) {
            $step = $group['step'];
            $entries = $group['entries'];
            $form_obj = GFAPI::get_form($step['form_id']);
            $phone_screening_enabled = !empty($step['phone_screening_enabled']);
            $spirit_pharmacist_enabled = !empty($step['spirit_pharmacist_enabled']);
            $consult_notes_field_id = !empty($step['consult_notes_field_id']) ? (int) $step['consult_notes_field_id'] : null;
            $consult_notes_enabled = $consult_notes_field_id !== null;

            foreach ($entries as $entry) {
                $approval_status = (int) gform_get_meta($entry['id'], 'is_approved');
                $phone_screening = gform_get_meta($entry['id'], 'tbc_cp_phone_screening') ?: '';
                $spirit_pharmacist = gform_get_meta($entry['id'], 'tbc_cp_spirit_pharmacist') ?: '';
                $screening_date = gform_get_meta($entry['id'], 'tbc_cp_phone_screening_date') ?: '';
                $screening_note = gform_get_meta($entry['id'], 'tbc_cp_phone_screening_note') ?: '';

                $user = get_userdata($entry['created_by']);
                $user_name = $user ? $user->display_name : __('Unknown', 'tbc-checkout-prerequisites');
                $user_email = $user ? $user->user_email : '';
                $is_blocked = $user && in_array('church_user', $user->roles, true);

                $this->all_entry_data[] = [
                    'entry' => $entry,
                    'entry_id' => $entry['id'],
                    'form_id' => $step['form_id'],
                    'form_title' => $step['title'],
                    'user_name' => $user_name,
                    'user_email' => $user_email,
                    'user_id' => $entry['created_by'],
                    'approval_status' => $approval_status,
                    'phone_screening' => $phone_screening,
                    'phone_screening_enabled' => $phone_screening_enabled,
                    'phone_screening_date' => $screening_date,
                    'phone_screening_note' => $screening_note,
                    'spirit_pharmacist' => $spirit_pharmacist,
                    'spirit_pharmacist_enabled' => $spirit_pharmacist_enabled,
                    'consult_notes_enabled' => $consult_notes_enabled,
                    'consult_notes' => $consult_notes_enabled && isset($entry[$consult_notes_field_id]) ? stripslashes($entry[$consult_notes_field_id]) : '',
                    'consult_notes_field_id' => $consult_notes_field_id,
                    'submitted' => $entry['date_created'],
                    'updated' => $entry['date_updated'] ?: $entry['date_created'],
                    'is_blocked' => $is_blocked,
                    'medications' => $this->get_medications_value($entry, $form_obj),
                ];
            }
        }

        return $this->all_entry_data;
    }

    private function get_tab_counts(array $form_steps): array {
        if ($this->tab_counts !== null) {
            return $this->tab_counts;
        }

        $all = $this->load_all_entry_data($form_steps);

        $counts = [
            'pending' => 0,
            'spirit_pharmacist' => 0,
            'phone_screening' => 0,
            'upcoming_calls' => 0,
            'all' => count($all),
        ];

        foreach ($all as $data) {
            if (!in_array($data['approval_status'], [1, 2], true)) {
                $counts['pending']++;
            }
            if ($data['spirit_pharmacist'] === 'required') {
                $counts['spirit_pharmacist']++;
            }
            if ($data['phone_screening'] === 'required') {
                $counts['phone_screening']++;
                if (!empty($data['phone_screening_date'])) {
                    $counts['upcoming_calls']++;
                }
            }
        }

        $this->tab_counts = $counts;
        return $counts;
    }

    private function get_entries_for_review(array $form_steps, string $filter, array $filters = [], string $sort_by = 'updated', string $sort_order = 'desc'): array {
        $all = $this->load_all_entry_data($form_steps);
        $search = $filters['search'] ?? '';
        $filter_meds = $filters['meds'] ?? '';
        $filter_blocked = $filters['blocked'] ?? '';
        $filter_approval = $filters['approval'] ?? '';
        $filter_screening = $filters['screening'] ?? '';
        $filter_spirit = $filters['spirit'] ?? '';

        $filtered = [];

        foreach ($all as $data) {
            // Tab filters
            if ($filter === 'pending' && in_array($data['approval_status'], [1, 2], true)) {
                continue;
            }
            if ($filter === 'phone_screening' && $data['phone_screening'] !== 'required') {
                continue;
            }
            if ($filter === 'spirit_pharmacist' && $data['spirit_pharmacist'] !== 'required') {
                continue;
            }
            if ($filter === 'upcoming_calls') {
                if ($data['phone_screening'] !== 'required' || empty($data['phone_screening_date'])) {
                    continue;
                }
            }

            // Approval dropdown filter
            if ($filter_approval !== '') {
                if ($filter_approval === 'unapproved' && in_array($data['approval_status'], [1, 2], true)) {
                    continue;
                } elseif ($filter_approval !== 'unapproved' && $data['approval_status'] !== (int) $filter_approval) {
                    continue;
                }
            }

            // Screening dropdown filter
            if ($filter_screening !== '') {
                if ($filter_screening === 'not_set' && $data['phone_screening'] !== '') {
                    continue;
                } elseif ($filter_screening !== 'not_set' && $data['phone_screening'] !== $filter_screening) {
                    continue;
                }
            }

            // Spirit pharmacist dropdown filter
            if ($filter_spirit !== '') {
                if ($filter_spirit === 'not_set' && $data['spirit_pharmacist'] !== '') {
                    continue;
                } elseif ($filter_spirit !== 'not_set' && $data['spirit_pharmacist'] !== $filter_spirit) {
                    continue;
                }
            }

            // Search filter
            if ($search !== '' && stripos($data['user_name'] . ' ' . $data['user_email'], $search) === false) {
                continue;
            }

            // Blocked filter
            if ($filter_blocked === '1' && !$data['is_blocked']) {
                continue;
            }
            if ($filter_blocked === '0' && $data['is_blocked']) {
                continue;
            }

            // Medications filter
            if ($filter_meds !== '') {
                $has_meds = (stripos($data['medications'], 'yes') !== false);
                if ($filter_meds === 'yes' && !$has_meds) {
                    continue;
                }
                if ($filter_meds === 'no' && $has_meds) {
                    continue;
                }
            }

            $filtered[] = $data;
        }

        // Sort
        if ($filter === 'upcoming_calls') {
            foreach ($filtered as &$e) {
                $e['_sort_ts'] = tbc_cp_parse_schedule_ts($e['phone_screening_date']);
            }
            unset($e);
            usort($filtered, fn($a, $b) => $a['_sort_ts'] - $b['_sort_ts']);
        } else {
            $key = $sort_by === 'submitted' ? 'submitted' : 'updated';
            $desc = $sort_order === 'desc';
            foreach ($filtered as &$e) {
                $e['_sort_ts'] = strtotime($e[$key] . ' UTC');
            }
            unset($e);
            usort($filtered, fn($a, $b) => $desc ? $b['_sort_ts'] - $a['_sort_ts'] : $a['_sort_ts'] - $b['_sort_ts']);
        }

        return $filtered;
    }

    private function get_medications_value(array $entry, $form): string {
        if (!$form || empty($form['fields'])) {
            return '';
        }

        foreach ($form['fields'] as $field) {
            $label = strtolower($field->label ?? '');
            if (strpos($label, 'medication') !== false) {
                $value = $entry[$field->id] ?? '';
                if (!empty($value)) {
                    return $value;
                }
            }
        }

        return '';
    }

    private function render_entry_row(array $data): void {
        $entry_id = esc_attr($data['entry_id']);
        $has_notes = !empty($data['consult_notes']);
        $can_change_approval = $this->can_change_approval($data);
        ?>
        <tr data-entry-id="<?php echo $entry_id; ?>" data-form-id="<?php echo esc_attr($data['form_id']); ?>" data-phone-screening-enabled="<?php echo $data['phone_screening_enabled'] ? '1' : '0'; ?>" data-spirit-pharmacist-enabled="<?php echo $data['spirit_pharmacist_enabled'] ? '1' : '0'; ?>" data-consult-notes-enabled="<?php echo $data['consult_notes_enabled'] ? '1' : '0'; ?>" data-has-notes="<?php echo $has_notes ? '1' : '0'; ?>">
            <td data-label="<?php esc_attr_e('User', 'tbc-checkout-prerequisites'); ?>">
                <strong><?php echo esc_html($data['user_name']); ?></strong>
                <br><small><?php echo esc_html($data['user_email']); ?></small>
            </td>
            <td data-label="<?php esc_attr_e('Form', 'tbc-checkout-prerequisites'); ?>"><?php echo esc_html($data['form_title']); ?></td>
            <td data-label="<?php esc_attr_e('Submitted', 'tbc-checkout-prerequisites'); ?>"><?php echo esc_html(date_i18n(get_option('date_format') . ' ' . get_option('time_format'), strtotime($data['submitted'] . ' UTC'))); ?></td>
            <td data-label="<?php esc_attr_e('Last Updated', 'tbc-checkout-prerequisites'); ?>"><?php echo esc_html(date_i18n(get_option('date_format') . ' ' . get_option('time_format'), strtotime($data['updated'] . ' UTC'))); ?></td>
            <td data-label="<?php esc_attr_e('Medications', 'tbc-checkout-prerequisites'); ?>">
                <?php
                $meds = $data['medications'];
                if (!empty($meds)) {
                    $meds_lower = strtolower($meds);
                    $is_yes = (strpos($meds_lower, 'yes') !== false);
                    $badge_class = $is_yes ? 'tbc-cp-er-meds-yes' : 'tbc-cp-er-meds-no';
                    echo '<span class="tbc-cp-er-meds-badge ' . esc_attr($badge_class) . '">' . esc_html($meds) . '</span>';
                } else {
                    echo '<span class="tbc-cp-er-meds-badge tbc-cp-er-meds-unknown">&mdash;</span>';
                }
                ?>
            </td>
            <td data-label="<?php esc_attr_e('Blocked', 'tbc-checkout-prerequisites'); ?>">
                <button type="button" class="tbc-cp-er-btn tbc-cp-er-btn-sm tbc-cp-er-block-toggle" data-user-id="<?php echo esc_attr($data['user_id']); ?>" data-blocked="<?php echo $data['is_blocked'] ? '1' : '0'; ?>">
                    <?php echo $data['is_blocked'] ? esc_html__('Blocked', 'tbc-checkout-prerequisites') : esc_html__('Allowed', 'tbc-checkout-prerequisites'); ?>
                </button>
            </td>
            <td data-label="<?php esc_attr_e('Spirit Pharmacist', 'tbc-checkout-prerequisites'); ?>">
                <?php if ($data['spirit_pharmacist_enabled']) : ?>
                    <select class="tbc-cp-er-spirit-dropdown" data-entry-id="<?php echo $entry_id; ?>">
                        <option value="" <?php selected($data['spirit_pharmacist'], ''); ?>><?php esc_html_e('Not set', 'tbc-checkout-prerequisites'); ?></option>
                        <option value="not_required" <?php selected($data['spirit_pharmacist'], 'not_required'); ?>><?php esc_html_e('Not required', 'tbc-checkout-prerequisites'); ?></option>
                        <option value="required" <?php selected($data['spirit_pharmacist'], 'required'); ?>><?php esc_html_e('Required', 'tbc-checkout-prerequisites'); ?></option>
                        <option value="completed" <?php selected($data['spirit_pharmacist'], 'completed'); ?>><?php esc_html_e('Completed', 'tbc-checkout-prerequisites'); ?></option>
                    </select>
                <?php else : ?>
                    <span class="tbc-cp-er-na"><?php esc_html_e('N/A', 'tbc-checkout-prerequisites'); ?></span>
                <?php endif; ?>
            </td>
            <td data-label="<?php esc_attr_e('Phone Screening', 'tbc-checkout-prerequisites'); ?>">
                <?php if ($data['phone_screening_enabled']) : ?>
                    <div class="tbc-cp-er-screening-cell">
                        <select class="tbc-cp-er-screening-dropdown" data-entry-id="<?php echo $entry_id; ?>">
                            <option value="" <?php selected($data['phone_screening'], ''); ?>><?php esc_html_e('Not set', 'tbc-checkout-prerequisites'); ?></option>
                            <option value="not_required" <?php selected($data['phone_screening'], 'not_required'); ?>><?php esc_html_e('Not required', 'tbc-checkout-prerequisites'); ?></option>
                            <option value="required" <?php selected($data['phone_screening'], 'required'); ?>><?php esc_html_e('Required', 'tbc-checkout-prerequisites'); ?></option>
                            <option value="completed" <?php selected($data['phone_screening'], 'completed'); ?>><?php esc_html_e('Completed', 'tbc-checkout-prerequisites'); ?></option>
                        </select>
                        <?php if ($data['phone_screening'] === 'required') : ?>
                            <div class="tbc-cp-er-schedule-info" data-entry-id="<?php echo $entry_id; ?>">
                                <?php if (!empty($data['phone_screening_date'])) :
                                    $sched_time = tbc_cp_parse_schedule_ts($data['phone_screening_date']);
                                    $is_overdue = $sched_time && $sched_time < time();
                                    $badge_class = $is_overdue ? 'tbc-cp-er-schedule-overdue' : 'tbc-cp-er-schedule-set';
                                    $sched_label = $sched_time ? wp_date('M j, g:i A', $sched_time) . ' ' . tbc_cp_tz_abbr($sched_time) : '';
                                ?>
                                    <span class="tbc-cp-er-schedule-badge <?php echo esc_attr($badge_class); ?>">
                                        <?php if ($is_overdue) : ?>
                                            <?php echo esc_html(__('Overdue', 'tbc-checkout-prerequisites') . ': ' . $sched_label); ?>
                                        <?php else : ?>
                                            &#128222; <?php echo esc_html($sched_label); ?>
                                        <?php endif; ?>
                                    </span>
                                    <button type="button" class="tbc-cp-er-schedule-call tbc-cp-er-schedule-edit"
                                        data-entry-id="<?php echo $entry_id; ?>"
                                        data-user-name="<?php echo esc_attr($data['user_name']); ?>"
                                        data-current-date="<?php echo esc_attr($data['phone_screening_date']); ?>"
                                        data-current-note="<?php echo esc_attr($data['phone_screening_note']); ?>"
                                        title="<?php esc_attr_e('Edit Schedule', 'tbc-checkout-prerequisites'); ?>">&#9998;</button>
                                    <a href="<?php echo esc_url(tbc_cp_calendar_url((int) $data['entry_id'])); ?>" class="tbc-cp-er-schedule-calendar" title="<?php esc_attr_e('Add to calendar', 'tbc-checkout-prerequisites'); ?>" target="_blank">&#128197;</a>
                                <?php else : ?>
                                    <button type="button" class="tbc-cp-er-btn tbc-cp-er-btn-sm tbc-cp-er-schedule-call"
                                        data-entry-id="<?php echo $entry_id; ?>"
                                        data-user-name="<?php echo esc_attr($data['user_name']); ?>"
                                        data-current-date=""
                                        data-current-note="">
                                        <?php esc_html_e('Schedule Call', 'tbc-checkout-prerequisites'); ?>
                                    </button>
                                <?php endif; ?>
                            </div>
                        <?php elseif ($data['phone_screening'] === 'completed' && !empty($data['phone_screening_date'])) :
                            $was_ts = tbc_cp_parse_schedule_ts($data['phone_screening_date']);
                        ?>
                            <div class="tbc-cp-er-schedule-info">
                                <span class="tbc-cp-er-schedule-badge tbc-cp-er-schedule-completed">
                                    <?php echo esc_html(__('Was', 'tbc-checkout-prerequisites') . ': ' . ($was_ts ? wp_date('M j, g:i A', $was_ts) . ' ' . tbc_cp_tz_abbr($was_ts) : '')); ?>
                                </span>
                            </div>
                        <?php endif; ?>
                    </div>
                <?php else : ?>
                    <span class="tbc-cp-er-na"><?php esc_html_e('N/A', 'tbc-checkout-prerequisites'); ?></span>
                <?php endif; ?>
            </td>
            <td data-label="<?php esc_attr_e('Consult Notes', 'tbc-checkout-prerequisites'); ?>">
                <?php if ($data['consult_notes_enabled']) : ?>
                    <button type="button" class="tbc-cp-er-btn tbc-cp-er-btn-sm tbc-cp-er-edit-notes <?php echo $has_notes ? 'tbc-cp-er-notes-filled' : ''; ?>" data-entry-id="<?php echo $entry_id; ?>" data-user-name="<?php echo esc_attr($data['user_name']); ?>">
                        <?php echo $has_notes ? esc_html__('Edit Notes', 'tbc-checkout-prerequisites') : esc_html__('Add Notes', 'tbc-checkout-prerequisites'); ?>
                    </button>
                    <textarea class="tbc-cp-er-notes-data" style="display:none;"><?php echo esc_textarea($data['consult_notes']); ?></textarea>
                <?php else : ?>
                    &mdash;
                <?php endif; ?>
            </td>
            <td data-label="<?php esc_attr_e('Approval', 'tbc-checkout-prerequisites'); ?>">
                <?php
                $disabled_attr = !$can_change_approval
                    ? 'disabled title="' . esc_attr__('Set required statuses and add consult notes before changing approval', 'tbc-checkout-prerequisites') . '"'
                    : '';
                $approval_val = in_array($data['approval_status'], [1, 2, 3], true) ? $data['approval_status'] : 3;
                ?>
                <select class="tbc-cp-er-approval-dropdown" data-entry-id="<?php echo $entry_id; ?>" <?php echo $disabled_attr; ?>>
                    <option value="3" <?php selected($approval_val, 3); ?>><?php esc_html_e('Unapproved', 'tbc-checkout-prerequisites'); ?></option>
                    <option value="1" <?php selected($approval_val, 1); ?>><?php esc_html_e('Approved', 'tbc-checkout-prerequisites'); ?></option>
                    <option value="2" <?php selected($approval_val, 2); ?>><?php esc_html_e('Disapproved', 'tbc-checkout-prerequisites'); ?></option>
                </select>
            </td>
            <td data-label="<?php esc_attr_e('Actions', 'tbc-checkout-prerequisites'); ?>" class="tbc-cp-er-actions">
                <button type="button" class="tbc-cp-er-btn tbc-cp-er-btn-sm tbc-cp-er-view-entry" data-entry-id="<?php echo $entry_id; ?>" data-form-id="<?php echo esc_attr($data['form_id']); ?>" data-user-name="<?php echo esc_attr($data['user_name']); ?>">
                    <?php esc_html_e('View', 'tbc-checkout-prerequisites'); ?>
                </button>
                <button type="button" class="tbc-cp-er-btn tbc-cp-er-btn-sm tbc-cp-er-copy-entry" data-entry-id="<?php echo $entry_id; ?>" data-form-id="<?php echo esc_attr($data['form_id']); ?>">
                    <?php esc_html_e('Copy', 'tbc-checkout-prerequisites'); ?>
                </button>
            </td>
        </tr>
        <?php
    }

    private function can_change_approval(array $data): bool {
        if (!empty($data['consult_notes_enabled']) && empty($data['consult_notes'])) {
            return false;
        }
        if ($data['phone_screening_enabled'] && $data['phone_screening'] === '') {
            return false;
        }
        if ($data['spirit_pharmacist_enabled'] && $data['spirit_pharmacist'] === '') {
            return false;
        }
        return true;
    }

    private function render_entry_modal(): void {
        ?>
        <div id="tbc-cp-er-entry-modal" class="tbc-cp-er-modal" style="display: none;">
            <div class="tbc-cp-er-modal-content tbc-cp-er-modal-wide">
                <div class="tbc-cp-er-modal-header">
                    <h2 id="tbc-cp-er-entry-modal-title"><?php esc_html_e('Entry Details', 'tbc-checkout-prerequisites'); ?></h2>
                    <button type="button" class="tbc-cp-er-modal-close">&times;</button>
                </div>
                <div class="tbc-cp-er-modal-body" id="tbc-cp-er-entry-fields">
                    <div class="tbc-cp-er-loading"><?php esc_html_e('Loading entry...', 'tbc-checkout-prerequisites'); ?></div>
                </div>
                <div class="tbc-cp-er-modal-footer">
                    <button type="button" class="tbc-cp-er-btn tbc-cp-er-modal-close"><?php esc_html_e('Close', 'tbc-checkout-prerequisites'); ?></button>
                </div>
            </div>
        </div>
        <?php
    }

    private function render_upcoming_calls_banner(array $form_steps): void {
        $all = $this->load_all_entry_data($form_steps);
        $items = [];
        $now = time();
        $cutoff = $now + (48 * 3600);

        foreach ($all as $data) {
            if ($data['phone_screening'] !== 'required' || empty($data['phone_screening_date'])) {
                continue;
            }

            $sched_time = tbc_cp_parse_schedule_ts($data['phone_screening_date']);
            if (!$sched_time || $sched_time > $cutoff) {
                continue;
            }

            $items[] = [
                'name' => $data['user_name'],
                'time' => $sched_time,
                'overdue' => $sched_time < $now,
            ];
        }

        if (empty($items)) {
            return;
        }

        usort($items, fn($a, $b) => $a['time'] - $b['time']);

        $parts = [];
        foreach ($items as $item) {
            $formatted = wp_date('M j, g:i A', $item['time']) . ' ' . tbc_cp_tz_abbr($item['time']);
            if ($item['overdue']) {
                $parts[] = '<span class="tbc-cp-er-overdue-item">' . esc_html($item['name']) . ' (overdue — ' . esc_html($formatted) . ')</span>';
            } else {
                $parts[] = esc_html($item['name']) . ' (' . esc_html($formatted) . ')';
            }
        }

        ?>
        <div class="tbc-cp-er-upcoming-banner">
            <strong><?php esc_html_e('Upcoming Calls:', 'tbc-checkout-prerequisites'); ?></strong>
            <?php echo implode(', ', $parts); ?>
        </div>
        <?php
    }

    private function render_schedule_modal(): void {
        ?>
        <div id="tbc-cp-er-schedule-modal" class="tbc-cp-er-modal" style="display: none;">
            <div class="tbc-cp-er-modal-content">
                <div class="tbc-cp-er-modal-header">
                    <h2 id="tbc-cp-er-schedule-modal-title"><?php esc_html_e('Schedule Phone Screening', 'tbc-checkout-prerequisites'); ?></h2>
                    <button type="button" class="tbc-cp-er-modal-close">&times;</button>
                </div>
                <div class="tbc-cp-er-modal-body">
                    <div class="tbc-cp-er-schedule-field">
                        <label for="tbc-cp-er-schedule-datetime"><?php esc_html_e('Date & Time', 'tbc-checkout-prerequisites'); ?></label>
                        <input type="datetime-local" id="tbc-cp-er-schedule-datetime" style="width:100%;">
                        <p class="tbc-cp-er-schedule-tz-hint">
                            <?php
                            /* translators: 1: long tz name e.g. "Central Time", 2: short abbr e.g. "CST", 3: current time e.g. "Apr 20, 10:15 AM" */
                            printf(
                                esc_html__('All times in %1$s (%2$s). Current time: %3$s %2$s.', 'tbc-checkout-prerequisites'),
                                esc_html(tbc_cp_tz_long_name()),
                                esc_html(tbc_cp_tz_abbr()),
                                esc_html(wp_date('M j, g:i A'))
                            );
                            ?>
                        </p>
                    </div>
                    <div class="tbc-cp-er-schedule-field" style="margin-top: 12px;">
                        <label for="tbc-cp-er-schedule-note"><?php esc_html_e('Note (optional)', 'tbc-checkout-prerequisites'); ?></label>
                        <input type="text" id="tbc-cp-er-schedule-note" style="width:100%;"
                            placeholder="<?php esc_attr_e('e.g. Available after 5pm weekdays', 'tbc-checkout-prerequisites'); ?>">
                    </div>
                </div>
                <div class="tbc-cp-er-modal-footer">
                    <button type="button" class="tbc-cp-er-btn tbc-cp-er-modal-close"><?php esc_html_e('Cancel', 'tbc-checkout-prerequisites'); ?></button>
                    <button type="button" class="tbc-cp-er-btn tbc-cp-er-btn-danger" id="tbc-cp-er-clear-schedule"><?php esc_html_e('Clear Schedule', 'tbc-checkout-prerequisites'); ?></button>
                    <button type="button" class="tbc-cp-er-btn tbc-cp-er-btn-primary" id="tbc-cp-er-send-screening-msg" disabled><?php esc_html_e('Send Message', 'tbc-checkout-prerequisites'); ?></button>
                    <button type="button" class="tbc-cp-er-btn tbc-cp-er-btn-primary" id="tbc-cp-er-save-schedule"><?php esc_html_e('Save Schedule', 'tbc-checkout-prerequisites'); ?></button>
                </div>
            </div>
        </div>
        <?php
    }

    private function render_notes_modal(): void {
        ?>
        <div id="tbc-cp-er-notes-modal" class="tbc-cp-er-modal" style="display: none;">
            <div class="tbc-cp-er-modal-content">
                <div class="tbc-cp-er-modal-header">
                    <h2 id="tbc-cp-er-notes-modal-title"><?php esc_html_e('Consultation Notes', 'tbc-checkout-prerequisites'); ?></h2>
                    <button type="button" class="tbc-cp-er-modal-close">&times;</button>
                </div>
                <div class="tbc-cp-er-modal-body">
                    <p class="tbc-cp-er-description">
                        <?php esc_html_e('These notes are included in the automated message sent to the user when their entry is approved.', 'tbc-checkout-prerequisites'); ?>
                    </p>
                    <textarea id="tbc-cp-er-notes-textarea" rows="8" style="width:100%;"></textarea>
                </div>
                <div class="tbc-cp-er-modal-footer">
                    <button type="button" class="tbc-cp-er-btn tbc-cp-er-modal-close"><?php esc_html_e('Cancel', 'tbc-checkout-prerequisites'); ?></button>
                    <button type="button" class="tbc-cp-er-btn tbc-cp-er-btn-primary" id="tbc-cp-er-save-notes"><?php esc_html_e('Save Notes', 'tbc-checkout-prerequisites'); ?></button>
                </div>
            </div>
        </div>
        <?php
    }

    private function render_message_settings_modal(): void {
        // Get admin users for sender dropdown
        $admins = get_users(['role__in' => ['administrator'], 'orderby' => 'display_name', 'number' => 50]);
        ?>
        <div id="tbc-cp-er-msg-settings-modal" class="tbc-cp-er-modal" style="display: none;">
            <div class="tbc-cp-er-modal-content tbc-cp-er-modal-wide">
                <div class="tbc-cp-er-modal-header">
                    <h2><?php esc_html_e('Message Settings', 'tbc-checkout-prerequisites'); ?></h2>
                    <button type="button" class="tbc-cp-er-modal-close">&times;</button>
                </div>
                <div class="tbc-cp-er-modal-body">
                    <div class="tbc-cp-er-msg-settings-grid">
                        <div class="tbc-cp-er-msg-field">
                            <label>
                                <input type="checkbox" id="tbc-cp-er-msg-enabled">
                                <?php esc_html_e('Enable automated messages on approval/disapproval', 'tbc-checkout-prerequisites'); ?>
                            </label>
                        </div>

                        <div class="tbc-cp-er-msg-field">
                            <label for="tbc-cp-er-msg-sender"><?php esc_html_e('Send messages as:', 'tbc-checkout-prerequisites'); ?></label>
                            <select id="tbc-cp-er-msg-sender" style="width:100%;">
                                <option value=""><?php esc_html_e('Select a user...', 'tbc-checkout-prerequisites'); ?></option>
                                <?php foreach ($admins as $admin) : ?>
                                    <option value="<?php echo esc_attr($admin->ID); ?>">
                                        <?php echo esc_html($admin->display_name . ' (' . $admin->user_email . ')'); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>

                        <hr>

                        <h3><?php esc_html_e('Zoom Meeting Details', 'tbc-checkout-prerequisites'); ?></h3>
                        <div class="tbc-cp-er-msg-field">
                            <label for="tbc-cp-er-zoom-url"><?php esc_html_e('Zoom Join URL', 'tbc-checkout-prerequisites'); ?></label>
                            <input type="url" id="tbc-cp-er-zoom-url" style="width:100%;" placeholder="https://us02web.zoom.us/j/...">
                        </div>
                        <div class="tbc-cp-er-msg-field" style="display:flex; gap:12px;">
                            <div style="flex:1;">
                                <label for="tbc-cp-er-zoom-id"><?php esc_html_e('Meeting ID', 'tbc-checkout-prerequisites'); ?></label>
                                <input type="text" id="tbc-cp-er-zoom-id" style="width:100%;" placeholder="930 169 6301">
                            </div>
                            <div style="flex:1;">
                                <label for="tbc-cp-er-zoom-passcode"><?php esc_html_e('Passcode', 'tbc-checkout-prerequisites'); ?></label>
                                <input type="text" id="tbc-cp-er-zoom-passcode" style="width:100%;" placeholder="love">
                            </div>
                        </div>

                        <hr>

                        <div class="tbc-cp-er-msg-merge-tags">
                            <strong><?php esc_html_e('Available merge tags:', 'tbc-checkout-prerequisites'); ?></strong>
                            <code>{first_name}</code>
                            <code>{name}</code>
                            <code>{email}</code>
                            <code>{form_name}</code>
                            <code>{consult_notes}</code>
                            <code>{meeting_info}</code>
                            <code>{entry_id}</code>
                            <code>{date_submitted}</code>
                        </div>

                        <hr>

                        <h3><?php esc_html_e('Approved Message Template', 'tbc-checkout-prerequisites'); ?></h3>
                        <div class="tbc-cp-er-msg-field">
                            <textarea id="tbc-cp-er-msg-approved" rows="10" style="width:100%;"></textarea>
                        </div>

                        <h3><?php esc_html_e('Disapproved Message Template', 'tbc-checkout-prerequisites'); ?></h3>
                        <div class="tbc-cp-er-msg-field">
                            <textarea id="tbc-cp-er-msg-disapproved" rows="10" style="width:100%;"></textarea>
                        </div>

                        <h3><?php esc_html_e('Phone Screening Scheduled Message', 'tbc-checkout-prerequisites'); ?></h3>
                        <div class="tbc-cp-er-msg-field">
                            <textarea id="tbc-cp-er-msg-phone-screening" rows="10" style="width:100%;"></textarea>
                        </div>
                    </div>
                </div>
                <div class="tbc-cp-er-modal-footer">
                    <button type="button" class="tbc-cp-er-btn tbc-cp-er-modal-close"><?php esc_html_e('Cancel', 'tbc-checkout-prerequisites'); ?></button>
                    <button type="button" class="tbc-cp-er-btn tbc-cp-er-btn-primary" id="tbc-cp-er-save-msg-settings"><?php esc_html_e('Save Settings', 'tbc-checkout-prerequisites'); ?></button>
                </div>
            </div>
        </div>
        <?php
    }

    private function render_approval_preview_modal(): void {
        ?>
        <div id="tbc-cp-er-approval-preview-modal" class="tbc-cp-er-modal" style="display: none;">
            <div class="tbc-cp-er-modal-content tbc-cp-er-modal-wide">
                <div class="tbc-cp-er-modal-header">
                    <h2 id="tbc-cp-er-approval-preview-title"><?php esc_html_e('Message Preview', 'tbc-checkout-prerequisites'); ?></h2>
                    <button type="button" class="tbc-cp-er-modal-close">&times;</button>
                </div>
                <div class="tbc-cp-er-modal-body">
                    <p class="tbc-cp-er-description" id="tbc-cp-er-approval-preview-desc"></p>
                    <div id="tbc-cp-er-approval-preview-content" class="tbc-cp-er-preview-box"></div>
                    <div id="tbc-cp-er-approval-preview-loading" class="tbc-cp-er-loading" style="display:none;">
                        <?php esc_html_e('Loading preview...', 'tbc-checkout-prerequisites'); ?>
                    </div>
                    <div id="tbc-cp-er-approval-preview-warning" class="tbc-cp-er-preview-warning" style="display:none;"></div>
                </div>
                <div class="tbc-cp-er-modal-footer">
                    <button type="button" class="tbc-cp-er-btn tbc-cp-er-modal-close" id="tbc-cp-er-approval-cancel"><?php esc_html_e('Cancel', 'tbc-checkout-prerequisites'); ?></button>
                    <button type="button" class="tbc-cp-er-btn tbc-cp-er-btn-primary" id="tbc-cp-er-approval-confirm"><?php esc_html_e('Confirm & Send', 'tbc-checkout-prerequisites'); ?></button>
                </div>
            </div>
        </div>
        <?php
    }

}
