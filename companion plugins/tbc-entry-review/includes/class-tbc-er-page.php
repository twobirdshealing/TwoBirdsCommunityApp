<?php
/**
 * Admin page for Entry Review
 */
class TBC_ER_Page {

    private const PER_PAGE = 20;
    private ?array $tab_counts = null;

    public function __construct() {
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_assets']);
    }

    public function add_admin_menu() {
        add_submenu_page(
            'woocommerce',
            __('Entry Review', 'tbc-entry-review'),
            __('Entry Review', 'tbc-entry-review'),
            'manage_options',
            'tbc-entry-review',
            [$this, 'render_page']
        );
    }

    public function enqueue_assets($hook) {
        if ($hook !== 'woocommerce_page_tbc-entry-review') {
            return;
        }

        wp_enqueue_style('tbc-er-admin', TBC_ER_URL . 'css/tbc-er-admin.css', [], TBC_ER_VERSION);
        wp_enqueue_script('tbc-er-admin', TBC_ER_URL . 'js/tbc-er-admin.js', ['jquery'], TBC_ER_VERSION, true);

        wp_localize_script('tbc-er-admin', 'tbc_er', [
            'ajaxurl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('tbc_er_nonce'),
        ]);
    }

    public function render_page() {
        if (!current_user_can('manage_options')) {
            return;
        }

        // Tab filter
        $filter = sanitize_text_field($_GET['filter'] ?? 'pending');

        // Additional filters
        $search = sanitize_text_field($_GET['search'] ?? '');
        $filter_meds = sanitize_text_field($_GET['meds'] ?? '');
        $filter_blocked = sanitize_text_field($_GET['blocked'] ?? '');
        $filter_approval = sanitize_text_field($_GET['approval'] ?? '');
        $filter_screening = sanitize_text_field($_GET['screening'] ?? '');
        $filter_spirit = sanitize_text_field($_GET['spirit'] ?? '');
        $paged = max(1, absint($_GET['paged'] ?? 1));
        $sort_by = sanitize_text_field($_GET['sort'] ?? 'updated');
        $sort_order = sanitize_text_field($_GET['order'] ?? 'desc');
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
            'page' => 'tbc-entry-review',
            'filter' => $filter,
            'search' => $search,
            'meds' => $filter_meds,
            'blocked' => $filter_blocked,
            'approval' => $filter_approval,
            'screening' => $filter_screening,
            'spirit' => $filter_spirit,
            'sort' => $sort_by !== 'updated' ? $sort_by : '',
            'order' => $sort_order !== 'desc' ? $sort_order : '',
        ]);
        $clear_url = admin_url('admin.php?' . http_build_query(['page' => 'tbc-entry-review', 'filter' => $filter]));
        $has_filters = $search || $filter_meds || $filter_blocked || $filter_approval || $filter_screening || $filter_spirit;

        ?>
        <div class="wrap tbc-er-page">
            <h1><?php esc_html_e('Entry Review', 'tbc-entry-review'); ?></h1>

            <div class="tbc-er-workflow-banner">
                <strong><?php esc_html_e('Workflow:', 'tbc-entry-review'); ?></strong>
                <?php esc_html_e('Review entry → Set spirit pharmacist / phone screening status → Edit consultation notes → Approve. Notes are included in the automated message sent to the user.', 'tbc-entry-review'); ?>
            </div>

            <?php $this->render_upcoming_calls_banner($form_steps); ?>

            <?php $counts = $this->get_tab_counts($form_steps); ?>
            <ul class="subsubsub">
                <li>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=tbc-entry-review&filter=pending')); ?>" <?php echo $filter === 'pending' ? 'class="current"' : ''; ?>>
                        <?php esc_html_e('Pending Review', 'tbc-entry-review'); ?>
                        <span class="count">(<?php echo (int) $counts['pending']; ?>)</span>
                    </a> |
                </li>
                <li>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=tbc-entry-review&filter=spirit_pharmacist')); ?>" <?php echo $filter === 'spirit_pharmacist' ? 'class="current"' : ''; ?>>
                        <?php esc_html_e('Pharmacist Required', 'tbc-entry-review'); ?>
                        <span class="count">(<?php echo (int) $counts['spirit_pharmacist']; ?>)</span>
                    </a> |
                </li>
                <li>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=tbc-entry-review&filter=phone_screening')); ?>" <?php echo $filter === 'phone_screening' ? 'class="current"' : ''; ?>>
                        <?php esc_html_e('Phone Screening Required', 'tbc-entry-review'); ?>
                        <span class="count">(<?php echo (int) $counts['phone_screening']; ?>)</span>
                    </a> |
                </li>
                <li>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=tbc-entry-review&filter=upcoming_calls')); ?>" <?php echo $filter === 'upcoming_calls' ? 'class="current"' : ''; ?>>
                        <?php esc_html_e('Upcoming Calls', 'tbc-entry-review'); ?>
                        <span class="count">(<?php echo (int) $counts['upcoming_calls']; ?>)</span>
                    </a> |
                </li>
                <li>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=tbc-entry-review&filter=all')); ?>" <?php echo $filter === 'all' ? 'class="current"' : ''; ?>>
                        <?php esc_html_e('All Entries', 'tbc-entry-review'); ?>
                        <span class="count">(<?php echo (int) $counts['all']; ?>)</span>
                    </a>
                </li>
            </ul>

            <div class="tbc-er-filters">
                <form method="get" action="<?php echo esc_url(admin_url('admin.php')); ?>">
                    <input type="hidden" name="page" value="tbc-entry-review">
                    <input type="hidden" name="filter" value="<?php echo esc_attr($filter); ?>">
                    <input type="text" name="search" placeholder="<?php esc_attr_e('Search user...', 'tbc-entry-review'); ?>" value="<?php echo esc_attr($search); ?>">
                    <select name="meds">
                        <option value=""><?php esc_html_e('All Medications', 'tbc-entry-review'); ?></option>
                        <option value="yes" <?php selected($filter_meds, 'yes'); ?>><?php esc_html_e('On Medication', 'tbc-entry-review'); ?></option>
                        <option value="no" <?php selected($filter_meds, 'no'); ?>><?php esc_html_e('No Medication', 'tbc-entry-review'); ?></option>
                    </select>
                    <select name="blocked">
                        <option value=""><?php esc_html_e('All Users', 'tbc-entry-review'); ?></option>
                        <option value="1" <?php selected($filter_blocked, '1'); ?>><?php esc_html_e('Blocked', 'tbc-entry-review'); ?></option>
                        <option value="0" <?php selected($filter_blocked, '0'); ?>><?php esc_html_e('Allowed', 'tbc-entry-review'); ?></option>
                    </select>
                    <select name="approval">
                        <option value=""><?php esc_html_e('All Approval', 'tbc-entry-review'); ?></option>
                        <option value="unapproved" <?php selected($filter_approval, 'unapproved'); ?>><?php esc_html_e('Unapproved', 'tbc-entry-review'); ?></option>
                        <option value="1" <?php selected($filter_approval, '1'); ?>><?php esc_html_e('Approved', 'tbc-entry-review'); ?></option>
                        <option value="2" <?php selected($filter_approval, '2'); ?>><?php esc_html_e('Disapproved', 'tbc-entry-review'); ?></option>
                    </select>
                    <select name="screening">
                        <option value=""><?php esc_html_e('All Screening', 'tbc-entry-review'); ?></option>
                        <option value="not_set" <?php selected($filter_screening, 'not_set'); ?>><?php esc_html_e('Not Set', 'tbc-entry-review'); ?></option>
                        <option value="not_required" <?php selected($filter_screening, 'not_required'); ?>><?php esc_html_e('Not Required', 'tbc-entry-review'); ?></option>
                        <option value="required" <?php selected($filter_screening, 'required'); ?>><?php esc_html_e('Required', 'tbc-entry-review'); ?></option>
                        <option value="completed" <?php selected($filter_screening, 'completed'); ?>><?php esc_html_e('Completed', 'tbc-entry-review'); ?></option>
                    </select>
                    <select name="spirit">
                        <option value=""><?php esc_html_e('All Pharmacist', 'tbc-entry-review'); ?></option>
                        <option value="not_set" <?php selected($filter_spirit, 'not_set'); ?>><?php esc_html_e('Not Set', 'tbc-entry-review'); ?></option>
                        <option value="not_required" <?php selected($filter_spirit, 'not_required'); ?>><?php esc_html_e('Not Required', 'tbc-entry-review'); ?></option>
                        <option value="required" <?php selected($filter_spirit, 'required'); ?>><?php esc_html_e('Required', 'tbc-entry-review'); ?></option>
                        <option value="completed" <?php selected($filter_spirit, 'completed'); ?>><?php esc_html_e('Completed', 'tbc-entry-review'); ?></option>
                    </select>
                    <button type="submit" class="button"><?php esc_html_e('Filter', 'tbc-entry-review'); ?></button>
                    <?php if ($has_filters) : ?>
                        <a href="<?php echo esc_url($clear_url); ?>" class="button-link tbc-er-clear-filters"><?php esc_html_e('Clear Filters', 'tbc-entry-review'); ?></a>
                    <?php endif; ?>
                </form>
            </div>

            <?php $this->render_pagination($total, $paged, $total_pages, $base_args); ?>

            <?php
            // Build sortable column URLs
            $sort_base = array_filter([
                'page' => 'tbc-entry-review',
                'filter' => $filter,
                'search' => $search,
                'meds' => $filter_meds,
                'blocked' => $filter_blocked,
                'approval' => $filter_approval,
                'screening' => $filter_screening,
                'spirit' => $filter_spirit,
            ]);
            $submitted_order = ($sort_by === 'submitted' && $sort_order === 'desc') ? 'asc' : 'desc';
            $updated_order = ($sort_by === 'updated' && $sort_order === 'desc') ? 'asc' : 'desc';
            $submitted_url = admin_url('admin.php?' . http_build_query(array_merge($sort_base, ['sort' => 'submitted', 'order' => $submitted_order])));
            $updated_url = admin_url('admin.php?' . http_build_query(array_merge($sort_base, ['sort' => 'updated', 'order' => $updated_order])));
            $arrow_submitted = $sort_by === 'submitted' ? ($sort_order === 'asc' ? ' &#9650;' : ' &#9660;') : '';
            $arrow_updated = $sort_by === 'updated' ? ($sort_order === 'asc' ? ' &#9650;' : ' &#9660;') : '';
            ?>

            <table class="wp-list-table widefat striped tbc-er-table">
                <thead>
                    <tr>
                        <th><?php esc_html_e('User', 'tbc-entry-review'); ?></th>
                        <th><?php esc_html_e('Form', 'tbc-entry-review'); ?></th>
                        <th class="tbc-er-sortable <?php echo $sort_by === 'submitted' ? 'tbc-er-sorted' : ''; ?>">
                            <a href="<?php echo esc_url($submitted_url); ?>"><?php esc_html_e('Submitted', 'tbc-entry-review'); ?><?php echo $arrow_submitted; ?></a>
                        </th>
                        <th class="tbc-er-sortable <?php echo $sort_by === 'updated' ? 'tbc-er-sorted' : ''; ?>">
                            <a href="<?php echo esc_url($updated_url); ?>"><?php esc_html_e('Last Updated', 'tbc-entry-review'); ?><?php echo $arrow_updated; ?></a>
                        </th>
                        <th><?php esc_html_e('Medications', 'tbc-entry-review'); ?></th>
                        <th><?php esc_html_e('Blocked', 'tbc-entry-review'); ?></th>
                        <th><?php esc_html_e('Spirit Pharmacist', 'tbc-entry-review'); ?></th>
                        <th><?php esc_html_e('Phone Screening', 'tbc-entry-review'); ?></th>
                        <th><?php esc_html_e('Consult Notes', 'tbc-entry-review'); ?></th>
                        <th><?php esc_html_e('Approval', 'tbc-entry-review'); ?></th>
                        <th class="tbc-er-actions-header"><?php esc_html_e('Actions', 'tbc-entry-review'); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($entries)) : ?>
                        <tr>
                            <td colspan="11">
                                <p style="text-align:center; padding: 20px;">
                                    <?php esc_html_e('No entries found for this filter.', 'tbc-entry-review'); ?>
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

            <?php $this->render_pagination($total, $paged, $total_pages, $base_args); ?>
        </div>

        <?php $this->render_entry_modal(); ?>
        <?php $this->render_notes_modal(); ?>
        <?php $this->render_schedule_modal(); ?>
        <?php
    }

    private function render_pagination(int $total, int $paged, int $total_pages, array $base_args): void {
        if ($total <= self::PER_PAGE) {
            return;
        }

        $start = (($paged - 1) * self::PER_PAGE) + 1;
        $end = min($paged * self::PER_PAGE, $total);

        $page_links = paginate_links([
            'base' => admin_url('admin.php') . '?' . http_build_query(array_merge($base_args, ['paged' => '%#%'])),
            'format' => '',
            'current' => $paged,
            'total' => $total_pages,
            'prev_text' => '&laquo;',
            'next_text' => '&raquo;',
        ]);

        ?>
        <div class="tbc-er-pagination">
            <span class="tbc-er-entry-count">
                <?php printf(
                    esc_html__('Showing %1$d–%2$d of %3$d entries', 'tbc-entry-review'),
                    $start, $end, $total
                ); ?>
            </span>
            <?php if ($page_links) : ?>
                <div class="tbc-er-page-links"><?php echo $page_links; ?></div>
            <?php endif; ?>
        </div>
        <?php
    }

    private function get_form_steps(): array {
        $steps = get_option('tbc_cp_steps', []);
        return array_filter($steps, fn($s) => $s['type'] === 'form' && !empty($s['approval_required']));
    }

    private function get_tab_counts(array $form_steps): array {
        if ($this->tab_counts !== null) {
            return $this->tab_counts;
        }

        $counts = [
            'pending' => 0,
            'spirit_pharmacist' => 0,
            'phone_screening' => 0,
            'upcoming_calls' => 0,
            'all' => 0,
        ];

        foreach ($form_steps as $step) {
            $entries = GFAPI::get_entries($step['form_id'], ['status' => 'active'], [], ['offset' => 0, 'page_size' => 999]);
            if (empty($entries)) {
                continue;
            }

            foreach ($entries as $entry) {
                $approval_status = (int) gform_get_meta($entry['id'], 'is_approved');
                $phone_screening = gform_get_meta($entry['id'], 'tbc_cp_phone_screening') ?: '';
                $spirit_pharmacist = gform_get_meta($entry['id'], 'tbc_cp_spirit_pharmacist') ?: '';

                $counts['all']++;

                if (!in_array($approval_status, [1, 2], true)) {
                    $counts['pending']++;
                }
                if ($spirit_pharmacist === 'required') {
                    $counts['spirit_pharmacist']++;
                }
                if ($phone_screening === 'required') {
                    $counts['phone_screening']++;
                    $screening_date = gform_get_meta($entry['id'], 'tbc_cp_phone_screening_date') ?: '';
                    if (!empty($screening_date)) {
                        $counts['upcoming_calls']++;
                    }
                }
            }
        }

        $this->tab_counts = $counts;
        return $counts;
    }

    private function get_entries_for_review(array $form_steps, string $filter, array $filters = [], string $sort_by = 'updated', string $sort_order = 'desc'): array {
        $all_entries = [];
        $search = $filters['search'] ?? '';
        $filter_meds = $filters['meds'] ?? '';
        $filter_blocked = $filters['blocked'] ?? '';
        $filter_approval = $filters['approval'] ?? '';
        $filter_screening = $filters['screening'] ?? '';
        $filter_spirit = $filters['spirit'] ?? '';

        foreach ($form_steps as $step) {
            $gf_search = ['status' => 'active'];
            $sorting = ['key' => 'date_created', 'direction' => 'DESC'];
            $paging = ['offset' => 0, 'page_size' => 999];
            $entries = GFAPI::get_entries($step['form_id'], $gf_search, $sorting, $paging);

            if (empty($entries)) {
                continue;
            }

            $phone_screening_enabled = !empty($step['phone_screening_enabled']);
            $spirit_pharmacist_enabled = !empty($step['spirit_pharmacist_enabled']);
            $consult_notes_field_map = [1 => 18, 16 => 119];
            $consult_notes_field_id = $consult_notes_field_map[(int) $step['form_id']] ?? null;
            $consult_notes_enabled = $consult_notes_field_id !== null;

            foreach ($entries as $entry) {
                $approval_status = (int) gform_get_meta($entry['id'], 'is_approved');
                $phone_screening = gform_get_meta($entry['id'], 'tbc_cp_phone_screening') ?: '';
                $spirit_pharmacist = gform_get_meta($entry['id'], 'tbc_cp_spirit_pharmacist') ?: '';

                // Tab filters
                if ($filter === 'pending' && in_array($approval_status, [1, 2], true)) {
                    continue;
                }
                if ($filter === 'phone_screening' && $phone_screening !== 'required') {
                    continue;
                }
                if ($filter === 'spirit_pharmacist' && $spirit_pharmacist !== 'required') {
                    continue;
                }
                if ($filter === 'upcoming_calls') {
                    if ($phone_screening !== 'required') {
                        continue;
                    }
                    $upcoming_date = gform_get_meta($entry['id'], 'tbc_cp_phone_screening_date') ?: '';
                    if (empty($upcoming_date)) {
                        continue;
                    }
                }

                // Approval dropdown filter
                if ($filter_approval !== '') {
                    if ($filter_approval === 'unapproved' && in_array($approval_status, [1, 2], true)) {
                        continue;
                    } elseif ($filter_approval !== 'unapproved' && $approval_status !== (int) $filter_approval) {
                        continue;
                    }
                }

                // Screening dropdown filter
                if ($filter_screening !== '') {
                    if ($filter_screening === 'not_set' && $phone_screening !== '') {
                        continue;
                    } elseif ($filter_screening !== 'not_set' && $phone_screening !== $filter_screening) {
                        continue;
                    }
                }

                // Spirit pharmacist dropdown filter
                if ($filter_spirit !== '') {
                    if ($filter_spirit === 'not_set' && $spirit_pharmacist !== '') {
                        continue;
                    } elseif ($filter_spirit !== 'not_set' && $spirit_pharmacist !== $filter_spirit) {
                        continue;
                    }
                }

                $user = get_userdata($entry['created_by']);
                $user_name = $user ? $user->display_name : __('Unknown', 'tbc-entry-review');
                $user_email = $user ? $user->user_email : '';
                $is_blocked = $user && in_array('church_user', $user->roles, true);

                // Search filter
                if ($search !== '' && stripos($user_name . ' ' . $user_email, $search) === false) {
                    continue;
                }

                // Blocked filter
                if ($filter_blocked === '1' && !$is_blocked) {
                    continue;
                }
                if ($filter_blocked === '0' && $is_blocked) {
                    continue;
                }

                // Medications filter
                $medications = $this->get_medications_value($entry, $step['form_id']);
                if ($filter_meds !== '') {
                    $has_meds = (stripos($medications, 'yes') !== false);
                    if ($filter_meds === 'yes' && !$has_meds) {
                        continue;
                    }
                    if ($filter_meds === 'no' && $has_meds) {
                        continue;
                    }
                }

                $all_entries[] = [
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
                    'phone_screening_date' => gform_get_meta($entry['id'], 'tbc_cp_phone_screening_date') ?: '',
                    'phone_screening_note' => gform_get_meta($entry['id'], 'tbc_cp_phone_screening_note') ?: '',
                    'spirit_pharmacist' => $spirit_pharmacist,
                    'spirit_pharmacist_enabled' => $spirit_pharmacist_enabled,
                    'consult_notes_enabled' => $consult_notes_enabled,
                    'consult_notes' => $consult_notes_enabled && isset($entry[$consult_notes_field_id]) ? stripslashes($entry[$consult_notes_field_id]) : '',
                    'consult_notes_field_id' => $consult_notes_field_id,
                    'submitted' => $entry['date_created'],
                    'updated' => $entry['date_updated'] ?: $entry['date_created'],
                    'is_blocked' => $is_blocked,
                    'medications' => $medications,
                ];
            }
        }

        // Sort upcoming calls by date ascending (overdue first, then soonest)
        // All other tabs: sort by chosen column and direction
        if ($filter === 'upcoming_calls') {
            // Pre-compute timestamps to avoid repeated strtotime in comparisons
            foreach ($all_entries as &$e) {
                $e['_sort_ts'] = strtotime($e['phone_screening_date']);
            }
            unset($e);
            usort($all_entries, fn($a, $b) => $a['_sort_ts'] - $b['_sort_ts']);
        } else {
            $key = $sort_by === 'submitted' ? 'submitted' : 'updated';
            $desc = $sort_order === 'desc';
            foreach ($all_entries as &$e) {
                $e['_sort_ts'] = strtotime($e[$key]);
            }
            unset($e);
            usort($all_entries, fn($a, $b) => $desc ? $b['_sort_ts'] - $a['_sort_ts'] : $a['_sort_ts'] - $b['_sort_ts']);
        }

        return $all_entries;
    }

    private function get_medications_value(array $entry, int $form_id): string {
        // Try to find the medications field by label
        $form = GFAPI::get_form($form_id);
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
            <td>
                <strong>
                    <a href="<?php echo esc_url(get_edit_user_link($data['user_id'])); ?>" target="_blank">
                        <?php echo esc_html($data['user_name']); ?>
                    </a>
                </strong>
                <br><small><?php echo esc_html($data['user_email']); ?></small>
            </td>
            <td><?php echo esc_html($data['form_title']); ?></td>
            <td><?php echo esc_html(date_i18n(get_option('date_format') . ' ' . get_option('time_format'), strtotime($data['submitted']))); ?></td>
            <td><?php echo esc_html(date_i18n(get_option('date_format') . ' ' . get_option('time_format'), strtotime($data['updated']))); ?></td>
            <td>
                <?php
                $meds = $data['medications'];
                if (!empty($meds)) {
                    $meds_lower = strtolower($meds);
                    $is_yes = (strpos($meds_lower, 'yes') !== false);
                    $badge_class = $is_yes ? 'tbc-er-meds-yes' : 'tbc-er-meds-no';
                    echo '<span class="tbc-er-meds-badge ' . esc_attr($badge_class) . '">' . esc_html($meds) . '</span>';
                } else {
                    echo '<span class="tbc-er-meds-badge tbc-er-meds-unknown">—</span>';
                }
                ?>
            </td>
            <td>
                <button type="button" class="button button-small tbc-er-block-toggle" data-user-id="<?php echo esc_attr($data['user_id']); ?>" data-blocked="<?php echo $data['is_blocked'] ? '1' : '0'; ?>">
                    <?php echo $data['is_blocked'] ? esc_html__('Blocked', 'tbc-entry-review') : esc_html__('Allowed', 'tbc-entry-review'); ?>
                </button>
            </td>
            <td>
                <?php if ($data['spirit_pharmacist_enabled']) : ?>
                    <select class="tbc-er-spirit-dropdown" data-entry-id="<?php echo $entry_id; ?>">
                        <option value="" <?php selected($data['spirit_pharmacist'], ''); ?>><?php esc_html_e('Not set', 'tbc-entry-review'); ?></option>
                        <option value="not_required" <?php selected($data['spirit_pharmacist'], 'not_required'); ?>><?php esc_html_e('Not required', 'tbc-entry-review'); ?></option>
                        <option value="required" <?php selected($data['spirit_pharmacist'], 'required'); ?>><?php esc_html_e('Required', 'tbc-entry-review'); ?></option>
                        <option value="completed" <?php selected($data['spirit_pharmacist'], 'completed'); ?>><?php esc_html_e('Completed', 'tbc-entry-review'); ?></option>
                    </select>
                <?php else : ?>
                    <span class="tbc-er-screening-na"><?php esc_html_e('N/A', 'tbc-entry-review'); ?></span>
                <?php endif; ?>
            </td>
            <td>
                <?php if ($data['phone_screening_enabled']) : ?>
                    <div class="tbc-er-screening-cell">
                        <select class="tbc-er-screening-dropdown" data-entry-id="<?php echo $entry_id; ?>">
                            <option value="" <?php selected($data['phone_screening'], ''); ?>><?php esc_html_e('Not set', 'tbc-entry-review'); ?></option>
                            <option value="not_required" <?php selected($data['phone_screening'], 'not_required'); ?>><?php esc_html_e('Not required', 'tbc-entry-review'); ?></option>
                            <option value="required" <?php selected($data['phone_screening'], 'required'); ?>><?php esc_html_e('Required', 'tbc-entry-review'); ?></option>
                            <option value="completed" <?php selected($data['phone_screening'], 'completed'); ?>><?php esc_html_e('Completed', 'tbc-entry-review'); ?></option>
                        </select>
                        <?php if ($data['phone_screening'] === 'required') : ?>
                            <div class="tbc-er-schedule-info" data-entry-id="<?php echo $entry_id; ?>">
                                <?php if (!empty($data['phone_screening_date'])) :
                                    $sched_time = strtotime($data['phone_screening_date']);
                                    $is_overdue = $sched_time < time();
                                    $badge_class = $is_overdue ? 'tbc-er-schedule-overdue' : 'tbc-er-schedule-set';
                                ?>
                                    <span class="tbc-er-schedule-badge <?php echo esc_attr($badge_class); ?>">
                                        <?php if ($is_overdue) : ?>
                                            <?php echo esc_html(__('Overdue', 'tbc-entry-review') . ': ' . date_i18n('M j, g:i A', $sched_time)); ?>
                                        <?php else : ?>
                                            &#128222; <?php echo esc_html(date_i18n('M j, g:i A', $sched_time)); ?>
                                        <?php endif; ?>
                                    </span>
                                    <button type="button" class="tbc-er-schedule-call tbc-er-schedule-edit"
                                        data-entry-id="<?php echo $entry_id; ?>"
                                        data-user-name="<?php echo esc_attr($data['user_name']); ?>"
                                        data-current-date="<?php echo esc_attr($data['phone_screening_date']); ?>"
                                        data-current-note="<?php echo esc_attr($data['phone_screening_note']); ?>"
                                        title="<?php esc_attr_e('Edit Schedule', 'tbc-entry-review'); ?>">&#9998;</button>
                                    <button type="button" class="tbc-er-schedule-copy"
                                        data-user-name="<?php echo esc_attr($data['user_name']); ?>"
                                        data-date="<?php echo esc_attr(date_i18n('l, F j, Y \a\t g:i A', $sched_time)); ?>"
                                        title="<?php esc_attr_e('Copy scheduling message', 'tbc-entry-review'); ?>">&#128203;</button>
                                <?php else : ?>
                                    <button type="button" class="button button-small tbc-er-schedule-call"
                                        data-entry-id="<?php echo $entry_id; ?>"
                                        data-user-name="<?php echo esc_attr($data['user_name']); ?>"
                                        data-current-date=""
                                        data-current-note="">
                                        <?php esc_html_e('Schedule Call', 'tbc-entry-review'); ?>
                                    </button>
                                <?php endif; ?>
                            </div>
                        <?php elseif ($data['phone_screening'] === 'completed' && !empty($data['phone_screening_date'])) : ?>
                            <div class="tbc-er-schedule-info">
                                <span class="tbc-er-schedule-badge tbc-er-schedule-completed">
                                    <?php echo esc_html(__('Was', 'tbc-entry-review') . ': ' . date_i18n('M j, g:i A', strtotime($data['phone_screening_date']))); ?>
                                </span>
                            </div>
                        <?php endif; ?>
                    </div>
                <?php else : ?>
                    <span class="tbc-er-screening-na"><?php esc_html_e('N/A', 'tbc-entry-review'); ?></span>
                <?php endif; ?>
            </td>
            <td>
                <?php if ($data['consult_notes_enabled']) : ?>
                    <button type="button" class="button button-small tbc-er-edit-notes <?php echo $has_notes ? 'tbc-er-notes-filled' : ''; ?>" data-entry-id="<?php echo $entry_id; ?>" data-user-name="<?php echo esc_attr($data['user_name']); ?>">
                        <?php echo $has_notes ? esc_html__('Edit Notes', 'tbc-entry-review') : esc_html__('Add Notes', 'tbc-entry-review'); ?>
                    </button>
                    <textarea class="tbc-er-notes-data" style="display:none;"><?php echo esc_textarea($data['consult_notes']); ?></textarea>
                <?php else : ?>
                    &mdash;
                <?php endif; ?>
            </td>
            <td>
                <?php
                $disabled_attr = !$can_change_approval
                    ? 'disabled title="' . esc_attr__('Set required statuses and add consult notes before changing approval', 'tbc-entry-review') . '"'
                    : '';
                // Map GravityView approval values: 1=Approved, 2=Disapproved, 3/0=Unapproved
                $approval_val = in_array($data['approval_status'], [1, 2, 3], true) ? $data['approval_status'] : 3;
                ?>
                <select class="tbc-er-approval-dropdown" data-entry-id="<?php echo $entry_id; ?>" <?php echo $disabled_attr; ?>>
                    <option value="3" <?php selected($approval_val, 3); ?>><?php esc_html_e('Unapproved', 'tbc-entry-review'); ?></option>
                    <option value="1" <?php selected($approval_val, 1); ?>><?php esc_html_e('Approved', 'tbc-entry-review'); ?></option>
                    <option value="2" <?php selected($approval_val, 2); ?>><?php esc_html_e('Disapproved', 'tbc-entry-review'); ?></option>
                </select>
            </td>
            <td class="tbc-er-actions">
                <button type="button" class="button button-small tbc-er-view-entry" data-entry-id="<?php echo $entry_id; ?>" data-form-id="<?php echo esc_attr($data['form_id']); ?>" data-user-name="<?php echo esc_attr($data['user_name']); ?>">
                    <?php esc_html_e('View', 'tbc-entry-review'); ?>
                </button>
                <button type="button" class="button button-small tbc-er-copy-entry" data-entry-id="<?php echo $entry_id; ?>" data-form-id="<?php echo esc_attr($data['form_id']); ?>">
                    <?php esc_html_e('Copy', 'tbc-entry-review'); ?>
                </button>
            </td>
        </tr>
        <?php
    }

    private function can_change_approval(array $data): bool {
        // Must have consult notes before any approval action (only for forms with notes field)
        if (!empty($data['consult_notes_enabled']) && empty($data['consult_notes'])) {
            return false;
        }

        // If phone screening is enabled, must be set (not empty) before any approval action
        if ($data['phone_screening_enabled'] && $data['phone_screening'] === '') {
            return false;
        }

        // If spirit pharmacist is enabled, must be set (not empty) before any approval action
        if ($data['spirit_pharmacist_enabled'] && $data['spirit_pharmacist'] === '') {
            return false;
        }

        return true;
    }

    private function render_entry_modal(): void {
        ?>
        <div id="tbc-er-entry-modal" class="tbc-er-modal" style="display: none;">
            <div class="tbc-er-modal-content tbc-er-modal-wide">
                <div class="tbc-er-modal-header">
                    <h2 id="tbc-er-entry-modal-title"><?php esc_html_e('Entry Details', 'tbc-entry-review'); ?></h2>
                    <button type="button" class="tbc-er-modal-close">&times;</button>
                </div>
                <div class="tbc-er-modal-body" id="tbc-er-entry-fields">
                    <div class="tbc-er-loading"><?php esc_html_e('Loading entry...', 'tbc-entry-review'); ?></div>
                </div>
                <div class="tbc-er-modal-footer">
                    <button type="button" class="button tbc-er-modal-close"><?php esc_html_e('Close', 'tbc-entry-review'); ?></button>
                </div>
            </div>
        </div>
        <?php
    }

    private function render_upcoming_calls_banner(array $form_steps): void {
        $items = [];
        $now = time();
        $cutoff = $now + (48 * 3600); // 48 hours from now

        foreach ($form_steps as $step) {
            $entries = GFAPI::get_entries($step['form_id'], ['status' => 'active'], [], ['offset' => 0, 'page_size' => 999]);
            if (empty($entries)) {
                continue;
            }

            foreach ($entries as $entry) {
                $phone_screening = gform_get_meta($entry['id'], 'tbc_cp_phone_screening') ?: '';
                if ($phone_screening !== 'required') {
                    continue;
                }

                $screening_date = gform_get_meta($entry['id'], 'tbc_cp_phone_screening_date') ?: '';
                if (empty($screening_date)) {
                    continue;
                }

                $sched_time = strtotime($screening_date);
                if ($sched_time === false) {
                    continue;
                }

                // Include if overdue or within next 48 hours
                if ($sched_time <= $cutoff) {
                    $user = get_userdata($entry['created_by']);
                    $user_name = $user ? $user->display_name : __('Unknown', 'tbc-entry-review');
                    $is_overdue = $sched_time < $now;

                    $items[] = [
                        'name' => $user_name,
                        'time' => $sched_time,
                        'overdue' => $is_overdue,
                    ];
                }
            }
        }

        if (empty($items)) {
            return;
        }

        // Sort by time ascending
        usort($items, fn($a, $b) => $a['time'] - $b['time']);

        $parts = [];
        foreach ($items as $item) {
            $formatted = date_i18n('M j, g:i A', $item['time']);
            if ($item['overdue']) {
                $parts[] = '<span class="tbc-er-overdue-item">' . esc_html($item['name']) . ' (overdue — ' . esc_html($formatted) . ')</span>';
            } else {
                $parts[] = esc_html($item['name']) . ' (' . esc_html($formatted) . ')';
            }
        }

        ?>
        <div class="tbc-er-upcoming-banner">
            <strong><?php esc_html_e('Upcoming Calls:', 'tbc-entry-review'); ?></strong>
            <?php echo implode(', ', $parts); ?>
        </div>
        <?php
    }

    private function render_schedule_modal(): void {
        ?>
        <div id="tbc-er-schedule-modal" class="tbc-er-modal" style="display: none;">
            <div class="tbc-er-modal-content">
                <div class="tbc-er-modal-header">
                    <h2 id="tbc-er-schedule-modal-title"><?php esc_html_e('Schedule Phone Screening', 'tbc-entry-review'); ?></h2>
                    <button type="button" class="tbc-er-modal-close">&times;</button>
                </div>
                <div class="tbc-er-modal-body">
                    <div class="tbc-er-schedule-field">
                        <label for="tbc-er-schedule-datetime"><?php esc_html_e('Date & Time', 'tbc-entry-review'); ?></label>
                        <input type="datetime-local" id="tbc-er-schedule-datetime" style="width:100%;">
                    </div>
                    <div class="tbc-er-schedule-field" style="margin-top: 12px;">
                        <label for="tbc-er-schedule-note"><?php esc_html_e('Note (optional)', 'tbc-entry-review'); ?></label>
                        <input type="text" id="tbc-er-schedule-note" style="width:100%;"
                            placeholder="<?php esc_attr_e('e.g. Available after 5pm weekdays', 'tbc-entry-review'); ?>">
                    </div>
                </div>
                <div class="tbc-er-modal-footer">
                    <button type="button" class="button tbc-er-modal-close"><?php esc_html_e('Cancel', 'tbc-entry-review'); ?></button>
                    <button type="button" class="button" id="tbc-er-clear-schedule" style="color: #a00;"><?php esc_html_e('Clear Schedule', 'tbc-entry-review'); ?></button>
                    <button type="button" class="button button-primary" id="tbc-er-save-schedule"><?php esc_html_e('Save Schedule', 'tbc-entry-review'); ?></button>
                </div>
            </div>
        </div>
        <?php
    }

    private function render_notes_modal(): void {
        ?>
        <div id="tbc-er-notes-modal" class="tbc-er-modal" style="display: none;">
            <div class="tbc-er-modal-content">
                <div class="tbc-er-modal-header">
                    <h2 id="tbc-er-notes-modal-title"><?php esc_html_e('Consultation Notes', 'tbc-entry-review'); ?></h2>
                    <button type="button" class="tbc-er-modal-close">&times;</button>
                </div>
                <div class="tbc-er-modal-body">
                    <p class="description">
                        <?php esc_html_e('These notes are included in the automated message sent to the user when their entry is approved.', 'tbc-entry-review'); ?>
                    </p>
                    <textarea id="tbc-er-notes-textarea" rows="8" style="width:100%;"></textarea>
                </div>
                <div class="tbc-er-modal-footer">
                    <button type="button" class="button tbc-er-modal-close"><?php esc_html_e('Cancel', 'tbc-entry-review'); ?></button>
                    <button type="button" class="button button-primary" id="tbc-er-save-notes"><?php esc_html_e('Save Notes', 'tbc-entry-review'); ?></button>
                </div>
            </div>
        </div>
        <?php
    }
}
