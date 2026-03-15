<?php
/**
 * TBC WooCommerce Calendar - Recurring Events Admin Interface
 * 
 * Manages complex recurring event patterns including intervals and individual dates.
 * Provides admin UI for setting up daily/weekly/monthly/yearly patterns with exceptions.
 * 
 * @package TBC_WC_Calendar
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * =============================================================================
 * HELPER FUNCTIONS
 * =============================================================================
 */

/**
 * Get recurring settings with defaults applied
 * 
 * @param int $product_id Product ID
 * @return array Recurring settings
 */
function tbc_wc_get_recurring_settings($product_id) {
    $settings = tbc_wc_get_event_settings($product_id);
    return $settings['recurring'];
}

/**
 * =============================================================================
 * FORM DATA PROCESSING
 * =============================================================================
 */

/**
 * Build date-specific settings array from form data
 * 
 * @param array $post_data POST data
 * @param string $prefix Field prefix
 * @param int $index Array index
 * @return array Date settings
 */
function tbc_wc_build_date_settings_array($post_data, $prefix, $index) {
    $rsvp_modes = $post_data["{$prefix}_rsvp_mode"] ?? [];
    $rsvp_deadlines = $post_data["{$prefix}_rsvp_deadline"] ?? [];
    $deadline_types = $post_data["{$prefix}_deadline_type"] ?? [];
    $deadline_rules = $post_data["{$prefix}_deadline_rule"] ?? [];
    
    $progress_modes = $post_data["{$prefix}_progress_mode"] ?? [];
    $goal_types = $post_data["{$prefix}_progress_goal_type"] ?? [];
    $goals = $post_data["{$prefix}_progress_goal"] ?? [];
    $thresholds = $post_data["{$prefix}_progress_inventory_threshold"] ?? [];
    $show_percentage_indexes = array_map('absint', (array) ($post_data["{$prefix}_progress_show_percentage"] ?? []));
    $background_colors = $post_data["{$prefix}_progress_background_color"] ?? [];
    $fill_colors = $post_data["{$prefix}_progress_fill_color"] ?? [];
    $text_colors = $post_data["{$prefix}_progress_text_color"] ?? [];
    $subscriber_timeframes = $post_data["{$prefix}_subscriber_timeframe"] ?? [];

    $rsvp_mode = sanitize_text_field($rsvp_modes[$index] ?? 'global');
    $progress_mode = sanitize_text_field($progress_modes[$index] ?? 'global');
    
    return [
        'rsvp_mode' => $rsvp_mode,
        'rsvp_enabled' => $rsvp_mode === 'custom',
        'rsvp_deadline' => sanitize_text_field($rsvp_deadlines[$index] ?? ''),
        'deadline_type' => sanitize_text_field($deadline_types[$index] ?? 'date'),
        'deadline_rule' => sanitize_text_field($deadline_rules[$index] ?? '1_week'),
        'progress_mode' => $progress_mode,
        'progress_enabled' => $progress_mode === 'custom',
        'progress_goal_type' => sanitize_text_field($goal_types[$index] ?? 'sales'),
        'progress_goal' => absint($goals[$index] ?? 0),
        'progress_inventory_threshold' => absint($thresholds[$index] ?? 0),
        'progress_show_percentage' => in_array($index, $show_percentage_indexes),
        'progress_background_color' => sanitize_hex_color($background_colors[$index] ?? '#F0F0F0'),
        'progress_fill_color' => sanitize_hex_color($fill_colors[$index] ?? '#007CFF'),
        'progress_text_color' => sanitize_hex_color($text_colors[$index] ?? '#000000'),
        'subscriber_timeframe' => sanitize_text_field($subscriber_timeframes[$index] ?? 'all_time')
    ];
}

/**
 * Process individual dates array from form submission
 * 
 * @return array Processed individual dates
 */
function tbc_wc_process_individual_dates_array() {
    $start_dates = $_POST['_tbc_wc_individual_dates_start'] ?? [];
    $end_dates = $_POST['_tbc_wc_individual_dates_end'] ?? [];
    $closed_indexes = array_map('absint', (array) ($_POST['_tbc_wc_individual_date_closed'] ?? []));
    $hidden_indexes = array_map('absint', (array) ($_POST['_tbc_wc_individual_date_hidden'] ?? []));
    
    $individual_dates = [];
    
    for ($i = 0; $i < count($start_dates); $i++) {
        if (empty($start_dates[$i])) continue;
        
        $start = sanitize_text_field($start_dates[$i]);
        $end = sanitize_text_field($end_dates[$i] ?? $start);
        $is_closed = in_array($i, $closed_indexes);
        $is_hidden = in_array($i, $hidden_indexes);
        
        $date_settings = tbc_wc_build_date_settings_array($_POST, '_tbc_wc_individual_date', $i);
        
        $individual_dates[] = array_merge([
            'start' => $start,
            'end' => $end,
            'is_closed' => $is_closed,
            'is_hidden' => $is_hidden
        ], $date_settings);
    }
    
    return $individual_dates;
}

/**
 * Process interval exceptions array from form submission
 * 
 * @return array Processed exceptions
 */
function tbc_wc_process_interval_exceptions_array() {
    $exception_dates = $_POST['_tbc_wc_interval_exception_dates'] ?? [];
    $closed_indexes = array_map('absint', (array) ($_POST['_tbc_wc_interval_exception_closed'] ?? []));
    $hidden_indexes = array_map('absint', (array) ($_POST['_tbc_wc_interval_exception_hidden'] ?? []));
    
    $exceptions = [];
    
    for ($i = 0; $i < count($exception_dates); $i++) {
        if (empty($exception_dates[$i])) continue;
        
        $date = sanitize_text_field($exception_dates[$i]);
        $is_closed = in_array($i, $closed_indexes);
        $is_hidden = in_array($i, $hidden_indexes);
        
        $date_settings = tbc_wc_build_date_settings_array($_POST, '_tbc_wc_interval_exception', $i);
        
        $exceptions[] = array_merge([
            'date' => $date,
            'is_closed' => $is_closed,
            'is_hidden' => $is_hidden
        ], $date_settings);
    }
    
    return $exceptions;
}

/**
 * =============================================================================
 * ADMIN UI RENDERING
 * =============================================================================
 */

/**
 * Display recurring event settings interface
 */
function tbc_wc_add_recurring_dates_field() {
    global $post;
    
    $settings = tbc_wc_get_event_settings($post->ID);
    $dates = $settings['dates'];
    $recurring = $settings['recurring'];
    
    $days = [
        'sunday'    => __('Sunday', 'tbc-wc-calendar'),
        'monday'    => __('Monday', 'tbc-wc-calendar'),
        'tuesday'   => __('Tuesday', 'tbc-wc-calendar'),
        'wednesday' => __('Wednesday', 'tbc-wc-calendar'),
        'thursday'  => __('Thursday', 'tbc-wc-calendar'),
        'friday'    => __('Friday', 'tbc-wc-calendar'),
        'saturday'  => __('Saturday', 'tbc-wc-calendar')
    ];

    echo '<div class="options_group tbc-wc-recurring-settings">';
    echo '<h4>' . __('Recurring Event Settings', 'tbc-wc-calendar') . '</h4>';

    woocommerce_wp_select([
        'id'          => '_tbc_wc_recurring_type',
        'label'       => __('Recurring Type', 'tbc-wc-calendar'),
        'options'     => [
            'single'     => __('Single Event', 'tbc-wc-calendar'),
            'individual' => __('Individual Dates', 'tbc-wc-calendar'),
            'interval'   => __('Interval', 'tbc-wc-calendar')
        ],
        'value'       => $recurring['type'],
        'description' => __('Select whether to add specific dates (Individual) or a repeating pattern (Interval).', 'tbc-wc-calendar'),
        'desc_tip'    => true
    ]);

    $interval_display = $recurring['type'] === 'interval' ? '' : 'style="display:none;"';
    echo '<div id="tbc-wc-interval-settings" class="tbc-wc-interval-settings" ' . $interval_display . '>';
    
    woocommerce_wp_select([
        'id'          => '_tbc_wc_recurring_frequency',
        'label'       => __('Happens', 'tbc-wc-calendar'),
        'options'     => [
            'daily'   => __('Daily', 'tbc-wc-calendar'),
            'weekly'  => __('Weekly', 'tbc-wc-calendar'),
            'monthly' => __('Monthly', 'tbc-wc-calendar'),
            'yearly'  => __('Yearly', 'tbc-wc-calendar')
        ],
        'value'       => $recurring['interval']['frequency'] ?? 'weekly',
        'description' => __('How frequently the event repeats.', 'tbc-wc-calendar'),
        'desc_tip'    => true
    ]);

    $every_count_value = (int) ($recurring['interval']['count'] ?? 1);
    echo '<p class="form-field _tbc_wc_recurring_count_field">';
    echo '<label for="_tbc_wc_recurring_count">' . esc_html__('Every', 'tbc-wc-calendar') . '</label>';
    echo '<input type="number" min="1" step="1" id="_tbc_wc_recurring_count" name="_tbc_wc_recurring_count" value="' . esc_attr($every_count_value) . '" class="short" />';
    echo '<span id="tbc-wc-every-unit-label" class="tbc-wc-every-unit-label"></span>';
    echo '</p>';

    echo '<div id="tbc-wc-weekly-options" class="tbc-wc-interval-options">';
    woocommerce_wp_select([
        'id'          => '_tbc_wc_recurring_weekly_days',
        'name'        => '_tbc_wc_recurring_weekly_days[]',
        'label'       => __('On', 'tbc-wc-calendar'),
        'value'       => $recurring['interval']['weekly_days'] ?? [],
        'options'     => $days,
        'description' => __('Select which days of the week this event occurs.', 'tbc-wc-calendar'),
        'desc_tip'    => true,
        'class'       => 'wc-enhanced-select',
        'custom_attributes' => [
            'multiple' => 'multiple',
            'data-placeholder' => __('Choose days...', 'tbc-wc-calendar')
        ]
    ]);
    echo '</div>';

    $monthly_settings = $recurring['interval']['monthly'] ?? [
        'type' => 'day',
        'day' => 1,
        'week' => 'first',
        'weekday' => 'monday'
    ];
    
    echo '<div id="tbc-wc-monthly-options" class="tbc-wc-interval-options">';
    
    woocommerce_wp_select([
        'id'          => '_tbc_wc_recurring_monthly_type',
        'label'       => __('On the', 'tbc-wc-calendar'),
        'options'     => [
            'day'  => __('Day of month', 'tbc-wc-calendar'),
            'week' => __('Day of week', 'tbc-wc-calendar')
        ],
        'value'       => $monthly_settings['type'],
        'description' => __('Choose day of the month or day of the week.', 'tbc-wc-calendar'),
        'desc_tip'    => true
    ]);

    echo '<div id="tbc-wc-monthly-day">';
    woocommerce_wp_select([
        'id'          => '_tbc_wc_recurring_monthly_day',
        'label'       => __('Day', 'tbc-wc-calendar'),
        'options'     => array_combine(range(1, 31), range(1, 31)),
        'value'       => $monthly_settings['day']
    ]);
    echo '</div>';

    echo '<div id="tbc-wc-monthly-week">';
    woocommerce_wp_select([
        'id'          => '_tbc_wc_recurring_monthly_week',
        'label'       => __('Week', 'tbc-wc-calendar'),
        'options'     => [
            'first'  => __('First', 'tbc-wc-calendar'),
            'second' => __('Second', 'tbc-wc-calendar'),
            'third'  => __('Third', 'tbc-wc-calendar'),
            'fourth' => __('Fourth', 'tbc-wc-calendar'),
            'last'   => __('Last', 'tbc-wc-calendar')
        ],
        'value'       => $monthly_settings['week']
    ]);
    woocommerce_wp_select([
        'id'          => '_tbc_wc_recurring_monthly_weekday',
        'label'       => __('Day', 'tbc-wc-calendar'),
        'options'     => $days,
        'value'       => $monthly_settings['weekday']
    ]);
    echo '</div>';
    echo '</div>';

    echo '<div id="tbc-wc-yearly-options" class="tbc-wc-interval-options">';
    woocommerce_wp_select([
        'id'          => '_tbc_wc_recurring_yearly_month',
        'label'       => __('In', 'tbc-wc-calendar'),
        'options'     => array_combine(range(1, 12), [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ]),
        'value'       => $recurring['interval']['yearly_month'] ?? 1
    ]);
    echo '</div>';

    $end_settings = $recurring['interval']['end'] ?? [
        'type' => 'never',
        'pattern_end_date' => '',
        'count' => ''
    ];
    
    woocommerce_wp_select([
        'id'          => '_tbc_wc_recurring_end_type',
        'label'       => __('Ends', 'tbc-wc-calendar'),
        'options'     => [
            'never'       => __('Never', 'tbc-wc-calendar'),
            'date'        => __('On Date', 'tbc-wc-calendar'),
            'occurrences' => __('After Occurrences', 'tbc-wc-calendar')
        ],
        'value'       => $end_settings['type']
    ]);

    echo '<div id="tbc-wc-recurring-end-date">';
    woocommerce_wp_text_input([
        'id'          => '_tbc_wc_recurring_end_date',
        'label'       => __('Pattern End Date', 'tbc-wc-calendar'),
        'type'        => 'text',
        'class'       => 'tbc-wc-date-picker',
        'value'       => $end_settings['pattern_end_date']
    ]);
    echo '</div>';

    echo '<div id="tbc-wc-end-count">';
    woocommerce_wp_text_input([
        'id'                => '_tbc_wc_recurring_end_count',
        'label'             => __('Number of Occurrences', 'tbc-wc-calendar'),
        'type'              => 'number',
        'custom_attributes' => ['min' => '1', 'step' => '1'],
        'value'             => !empty($end_settings['count']) ? $end_settings['count'] : 1
    ]);
    echo '</div>';

    echo '<div class="tbc-wc-interval-exceptions-container">';
    echo '<h4>' . __('Date Exceptions', 'tbc-wc-calendar') . '</h4>';
    echo '<p class="description">' . __('Add exceptions to customize specific dates in the recurring pattern.', 'tbc-wc-calendar') . '</p>';
    
    echo '<table id="tbc-wc-interval-exceptions-table" class="widefat">';
    echo '<thead><tr>';
    echo '<th style="width:5%"></th><th style="width:30%">' . __('Exception Date', 'tbc-wc-calendar') . '</th>';
    echo '<th style="width:20%">' . __('Donors', 'tbc-wc-calendar') . '</th>';
    echo '<th style="width:15%">' . __('Settings', 'tbc-wc-calendar') . '</th>';
    echo '</tr></thead>';
    
    echo '<tbody class="sortable tbc-wc-interval-exceptions">';
    
    if (!empty($recurring['interval']['exceptions'])) {
        foreach ($recurring['interval']['exceptions'] as $index => $exception) {
            if (empty($exception['date'])) continue;
            
            $row_id = 'exception-' . $index;
            $sales_count = tbc_wc_get_sale_count($post->ID, $exception['date']);
            
            echo tbc_wc_render_exception_row($exception, $index, $row_id, $sales_count, $post->ID);
        }
    }
    
    echo '</tbody></table>';
    echo '<p><a href="#" class="button tbc-wc-add-exception-date">' . __('Add Exception', 'tbc-wc-calendar') . '</a></p>';
    echo '</div>';
    echo '</div>';

    $individual_display = $recurring['type'] === 'individual' ? '' : 'style="display:none;"';
    echo '<div id="tbc-wc-individual-dates-container" class="tbc-wc-individual-dates-container" ' . $individual_display . '>';
    echo '<table id="tbc-wc-individual-dates-table" class="widefat">';
    echo '<thead><tr>';
    echo '<th style="width:5%"></th><th style="width:30%">' . __('Start Date', 'tbc-wc-calendar') . '</th>';
    echo '<th style="width:30%" class="tbc-wc-end-date-header">' . __('End Date', 'tbc-wc-calendar') . '</th>';
    echo '<th style="width:20%">' . __('Donors', 'tbc-wc-calendar') . '</th>';
    echo '<th style="width:15%">' . __('Settings', 'tbc-wc-calendar') . '</th>';
    echo '</tr></thead>';
    
    echo '<tbody class="sortable tbc-wc-individual-dates">';
    
    $main_start_date = $dates['start_date'];
    if (!empty($main_start_date)) {
        $main_sales_count = tbc_wc_get_sale_count($post->ID, $main_start_date);
        
        echo '<tr class="tbc-wc-date-row tbc-wc-main-date" data-row-id="main-date">';
        echo '<td class="tbc-wc-sort"><span class="dashicons dashicons-star-filled"></span></td>';
        echo '<td class="tbc-wc-date-field"><input type="text" class="tbc-wc-date-picker tbc-wc-main-date-field" name="_tbc_wc_event_main_start_date" value="' . esc_attr($main_start_date) . '" readonly/></td>';
        echo '<td class="tbc-wc-end-date-field"><input type="text" class="tbc-wc-date-picker tbc-wc-main-date-field" name="_tbc_wc_event_main_end_date" value="' . esc_attr($dates['end_date']) . '" readonly/></td>';
        echo '<td class="tbc-wc-sales-count">' . $main_sales_count . '</td>';
        echo '<td class="tbc-wc-settings-cell"><em class="tbc-wc-primary-event-label">' . __('Primary', 'tbc-wc-calendar') . '</em></td>';
        echo '</tr>';
    }
    
    if (!empty($recurring['individual_dates'])) {
        foreach ($recurring['individual_dates'] as $index => $date_pair) {
            if (empty($date_pair['start'])) continue;
            
            $row_id = 'individual-' . $index;
            $sales_count = tbc_wc_get_sale_count($post->ID, $date_pair['start']);
            
            echo tbc_wc_render_individual_date_row($date_pair, $index, $row_id, $sales_count, $post->ID);
        }
    }
    
    echo '</tbody></table>';
    echo '<p><a href="#" class="button tbc-wc-add-individual-date">' . __('Add Date', 'tbc-wc-calendar') . '</a></p>';
    echo '</div>';
    echo '</div>';
}

/**
 * =============================================================================
 * ROW RENDERING FUNCTIONS
 * =============================================================================
 */

/**
 * Render exception date row with settings panel
 * 
 * @param array $exception Exception data
 * @param int $index Array index
 * @param string $row_id Row ID
 * @param int $sales_count Sales count
 * @param int $product_id Product ID
 * @return string HTML
 */
function tbc_wc_render_exception_row($exception, $index, $row_id, $sales_count, $product_id) {
    ob_start();
    ?>
    <tr class="tbc-wc-date-row tbc-wc-exception-date-row" data-row-id="<?php echo $row_id; ?>">
        <td class="tbc-wc-sort"><span class="dashicons dashicons-menu"></span></td>
        <td class="tbc-wc-date-field"><input type="text" class="tbc-wc-date-picker" name="_tbc_wc_interval_exception_dates[]" value="<?php echo esc_attr($exception['date']); ?>"/></td>
        <td class="tbc-wc-sales-count"><?php echo $sales_count; ?></td>
        <td class="tbc-wc-settings-cell">
            <a href="#" class="tbc-wc-toggle-date-settings dashicons dashicons-admin-generic" aria-expanded="false"></a>
        </td>
    </tr>
    
    <tr class="tbc-wc-date-settings-row tbc-wc-exception-settings-row" data-row-id="<?php echo $row_id; ?>" style="display:none;">
        <td colspan="4" class="tbc-wc-settings-panel">
            <div class="tbc-wc-date-settings-panel">
                <?php echo tbc_wc_render_settings_groups('_tbc_wc_interval_exception', $index, $row_id, $exception, $product_id); ?>
            </div>
        </td>
    </tr>
    <?php
    return ob_get_clean();
}

/**
 * Render individual date row with settings panel
 * 
 * @param array $date_pair Date pair data
 * @param int $index Array index
 * @param string $row_id Row ID
 * @param int $sales_count Sales count
 * @param int $product_id Product ID
 * @return string HTML
 */
function tbc_wc_render_individual_date_row($date_pair, $index, $row_id, $sales_count, $product_id) {
    ob_start();
    ?>
    <tr class="tbc-wc-date-row tbc-wc-individual-date-row" data-row-id="<?php echo $row_id; ?>">
        <td class="tbc-wc-sort"><span class="dashicons dashicons-menu"></span></td>
        <td class="tbc-wc-date-field"><input type="text" class="tbc-wc-date-picker" name="_tbc_wc_individual_dates_start[]" value="<?php echo esc_attr($date_pair['start']); ?>"/></td>
        <td class="tbc-wc-end-date-field"><input type="text" class="tbc-wc-date-picker" name="_tbc_wc_individual_dates_end[]" value="<?php echo esc_attr($date_pair['end']); ?>"/></td>
        <td class="tbc-wc-sales-count"><?php echo $sales_count; ?></td>
        <td class="tbc-wc-settings-cell">
            <a href="#" class="tbc-wc-toggle-date-settings dashicons dashicons-admin-generic" aria-expanded="false"></a>
        </td>
    </tr>
    
    <tr class="tbc-wc-date-settings-row tbc-wc-individual-settings-row" data-row-id="<?php echo $row_id; ?>" style="display:none;">
        <td colspan="5" class="tbc-wc-settings-panel">
            <div class="tbc-wc-date-settings-panel">
                <?php echo tbc_wc_render_settings_groups('_tbc_wc_individual_date', $index, $row_id, $date_pair, $product_id); ?>
            </div>
        </td>
    </tr>
    <?php
    return ob_get_clean();
}

/**
 * Render settings groups for date-specific overrides
 * 
 * @param string $prefix Field prefix
 * @param int $index Array index
 * @param string $row_id Row ID
 * @param array $date_data Date data
 * @param int $product_id Product ID
 * @return string HTML
 */
function tbc_wc_render_settings_groups($prefix, $index, $row_id, $date_data, $product_id) {
    $is_closed = $date_data['is_closed'] ?? false;
    $is_hidden = $date_data['is_hidden'] ?? false;
    $rsvp_mode = $date_data['rsvp_mode'] ?? 'global';
    $progress_mode = $date_data['progress_mode'] ?? 'global';
    $event_date = $date_data['date'] ?? $date_data['start'] ?? '';
    $row_type = strpos($prefix, 'exception') !== false ? 'exception' : 'individual';
    
    ob_start();
    ?>
    <div class="tbc-wc-setting-group tbc-wc-status-combined-group">
        <span class="tbc-wc-setting-label">Status:</span>
        <div class="tbc-wc-status-option">
            <label class="tbc-wc-event-close-toggle">
                <input type="checkbox" name="<?php echo $prefix; ?>_closed[]" value="<?php echo esc_attr($index); ?>" <?php checked($is_closed, true); ?> />
                Close Event
            </label>
        </div>
        <div class="tbc-wc-status-option">
            <label class="tbc-wc-event-hide-toggle">
                <input type="checkbox" name="<?php echo $prefix; ?>_hidden[]" value="<?php echo esc_attr($index); ?>" <?php checked($is_hidden, true); ?> />
                Hide Event
            </label>
        </div>
    </div>

    <div class="tbc-wc-setting-group tbc-wc-rsvp-combined-group">
        <span class="tbc-wc-setting-label">RSVP Settings:</span>
        <div class="tbc-wc-rsvp-option tbc-wc-rsvp-toggle-options">
            <label><input type="radio" name="<?php echo $prefix; ?>_rsvp_toggle_mode_<?php echo $row_id; ?>" data-index="<?php echo $index; ?>" data-target="rsvp" value="global" <?php checked($rsvp_mode, 'global'); ?> /> Use Global Settings</label>
            <label><input type="radio" name="<?php echo $prefix; ?>_rsvp_toggle_mode_<?php echo $row_id; ?>" data-index="<?php echo $index; ?>" data-target="rsvp" value="custom" <?php checked($rsvp_mode, 'custom'); ?> /> Custom Settings</label>
            <label><input type="radio" name="<?php echo $prefix; ?>_rsvp_toggle_mode_<?php echo $row_id; ?>" data-index="<?php echo $index; ?>" data-target="rsvp" value="off" <?php checked($rsvp_mode, 'off'); ?> /> Off</label>
        </div>
        <input type="hidden" name="<?php echo $prefix; ?>_rsvp_mode[]" value="<?php echo esc_attr($rsvp_mode); ?>" class="tbc-wc-rsvp-mode-field" />
        <?php echo tbc_wc_render_rsvp_options($prefix, $date_data, $rsvp_mode); ?>
    </div>
    
    <div class="tbc-wc-setting-group tbc-wc-progress-combined-group">
        <span class="tbc-wc-setting-label">Donation Goal:</span>
        <div class="tbc-wc-progress-option tbc-wc-progress-toggle-options">
            <label><input type="radio" name="<?php echo $prefix; ?>_progress_toggle_mode_<?php echo $row_id; ?>" data-index="<?php echo $index; ?>" data-target="progress" value="global" <?php checked($progress_mode, 'global'); ?> /> Use Global Settings</label>
            <label><input type="radio" name="<?php echo $prefix; ?>_progress_toggle_mode_<?php echo $row_id; ?>" data-index="<?php echo $index; ?>" data-target="progress" value="custom" <?php checked($progress_mode, 'custom'); ?> /> Custom Settings</label>
            <label><input type="radio" name="<?php echo $prefix; ?>_progress_toggle_mode_<?php echo $row_id; ?>" data-index="<?php echo $index; ?>" data-target="progress" value="off" <?php checked($progress_mode, 'off'); ?> /> Off</label>
        </div>
        <input type="hidden" name="<?php echo $prefix; ?>_progress_mode[]" value="<?php echo esc_attr($progress_mode); ?>" class="tbc-wc-progress-mode-field" />
        <?php echo tbc_wc_render_progress_options($prefix, $date_data, $progress_mode, $index); ?>
    </div>

    <div class="tbc-wc-setting-group">
        <span class="tbc-wc-setting-label">Actions:</span>
        <a href="/wp-admin/admin.php?page=wc-orders&event_date_filter=<?php echo esc_attr($event_date); ?>&filter_action=Filter" class="tbc-wc-view-orders button" target="_blank"><?php _e('View Orders', 'tbc-wc-calendar'); ?></a>
        <a href="<?php echo esc_url(tbc_wc_get_event_url($product_id, $event_date)); ?>" class="tbc-wc-view-event button" target="_blank"><?php _e('View Event', 'tbc-wc-calendar'); ?></a>
        <a href="#" class="tbc-wc-remove-<?php echo $row_type; ?>-date button"><?php _e('Remove', 'tbc-wc-calendar'); ?></a>
    </div>
    <?php
    return ob_get_clean();
}

/**
 * Render RSVP override options interface
 * 
 * @param string $prefix Field prefix
 * @param array $date_data Date data
 * @param string $mode Current mode
 * @return string HTML
 */
function tbc_wc_render_rsvp_options($prefix, $date_data, $mode) {
    $display_style = $mode === 'custom' ? '' : 'style="display:none;"';
    $deadline_type = $date_data['deadline_type'] ?? 'date';
    $deadline_rule = $date_data['deadline_rule'] ?? '1_week';
    $rsvp_deadline = $date_data['rsvp_deadline'] ?? '';
    
    ob_start();
    ?>
    <div class="tbc-wc-rsvp-option" <?php echo $display_style; ?>>
        <select name="<?php echo $prefix; ?>_deadline_type[]" class="tbc-wc-rsvp-deadline-type">
            <option value="date" <?php selected($deadline_type, 'date'); ?>>Specific Date</option>
            <option value="rule" <?php selected($deadline_type, 'rule'); ?>>Time Before Event</option>
        </select>
    </div>
    
    <div class="tbc-wc-rsvp-option tbc-wc-rsvp-deadline-date-container" <?php echo $deadline_type === 'rule' ? 'style="display:none;"' : $display_style; ?>>
        <input type="text" class="tbc-wc-date-picker tbc-wc-rsvp-deadline-date" name="<?php echo $prefix; ?>_rsvp_deadline[]" value="<?php echo esc_attr($rsvp_deadline); ?>" placeholder="YYYY-MM-DD">
    </div>
    
    <div class="tbc-wc-rsvp-option tbc-wc-rsvp-deadline-rule-container" <?php echo $deadline_type === 'date' ? 'style="display:none;"' : $display_style; ?>>
        <select name="<?php echo $prefix; ?>_deadline_rule[]" class="tbc-wc-rsvp-deadline-rule">
            <option value="1_day" <?php selected($deadline_rule, '1_day'); ?>>1 Day Before</option>
            <option value="3_days" <?php selected($deadline_rule, '3_days'); ?>>3 Days Before</option>
            <option value="1_week" <?php selected($deadline_rule, '1_week'); ?>>1 Week Before</option>
            <option value="2_weeks" <?php selected($deadline_rule, '2_weeks'); ?>>2 Weeks Before</option>
            <option value="1_month" <?php selected($deadline_rule, '1_month'); ?>>1 Month Before</option>
        </select>
    </div>
    <?php
    return ob_get_clean();
}

/**
 * Render progress bar override options interface
 * 
 * @param string $prefix Field prefix
 * @param array $date_data Date data
 * @param string $mode Current mode
 * @param int $index Array index
 * @return string HTML
 */
function tbc_wc_render_progress_options($prefix, $date_data, $mode, $index) {
    $display_style = $mode === 'custom' ? '' : 'style="display:none;"';
    $progress_goal_type = $date_data['progress_goal_type'] ?? 'sales';
    $progress_goal = $date_data['progress_goal'] ?? 0;
    $progress_show_percentage = $date_data['progress_show_percentage'] ?? false;
    $progress_inventory_threshold = $date_data['progress_inventory_threshold'] ?? 0;
    $progress_background_color = $date_data['progress_background_color'] ?? '#F0F0F0';
    $progress_fill_color = $date_data['progress_fill_color'] ?? '#007CFF';
    $progress_text_color = $date_data['progress_text_color'] ?? '#000000';
    $subscriber_timeframe = $date_data['subscriber_timeframe'] ?? 'all_time';
    
    $subscriber_display = ($mode === 'custom' && $progress_goal_type === 'subscribers') ? '' : 'style="display:none;"';
    
    ob_start();
    ?>
    <div class="tbc-wc-progress-option" <?php echo $display_style; ?>>
        <select name="<?php echo $prefix; ?>_progress_goal_type[]" class="tbc-wc-progress-goal-type">
            <option value="revenue" <?php selected($progress_goal_type, 'revenue'); ?>>Amount Raised</option>
            <option value="sales" <?php selected($progress_goal_type, 'sales'); ?>>Number of Donors</option>
            <option value="subscribers" <?php selected($progress_goal_type, 'subscribers'); ?>>Number of Subscribers</option>
        </select>
    </div>
    
    <div class="tbc-wc-progress-option tbc-wc-subscriber-timeframe-field" <?php echo $subscriber_display; ?>>
        <select name="<?php echo $prefix; ?>_subscriber_timeframe[]" class="tbc-wc-subscriber-timeframe">
            <option value="all_time" <?php selected($subscriber_timeframe, 'all_time'); ?>>All Time</option>
            <option value="current_month" <?php selected($subscriber_timeframe, 'current_month'); ?>>Current Month</option>
            <option value="current_year" <?php selected($subscriber_timeframe, 'current_year'); ?>>Current Year</option>
            <option value="last_30_days" <?php selected($subscriber_timeframe, 'last_30_days'); ?>>Last 30 Days</option>
            <option value="last_90_days" <?php selected($subscriber_timeframe, 'last_90_days'); ?>>Last 90 Days</option>
        </select>
    </div>
    
    <div class="tbc-wc-progress-option" <?php echo $display_style; ?>>
        <label>Goal: <input type="number" name="<?php echo $prefix; ?>_progress_goal[]" value="<?php echo esc_attr($progress_goal); ?>" min="0" step="1"></label>
    </div>
    
    <div class="tbc-wc-progress-option" <?php echo $display_style; ?>>
        <label>Threshold: <input type="number" name="<?php echo $prefix; ?>_progress_inventory_threshold[]" value="<?php echo esc_attr($progress_inventory_threshold); ?>" min="0" step="1"></label>
    </div>
    
    <div class="tbc-wc-progress-option" <?php echo $display_style; ?>>
        <label><input type="checkbox" name="<?php echo $prefix; ?>_progress_show_percentage[]" value="<?php echo esc_attr($index); ?>" <?php checked($progress_show_percentage, true); ?> />Show %</label>
    </div>
    
    <div class="tbc-wc-progress-option" <?php echo $display_style; ?>>
        <label>BG: <input type="color" name="<?php echo $prefix; ?>_progress_background_color[]" value="<?php echo esc_attr($progress_background_color); ?>"></label>
        <label>Fill: <input type="color" name="<?php echo $prefix; ?>_progress_fill_color[]" value="<?php echo esc_attr($progress_fill_color); ?>"></label>
        <label>Text: <input type="color" name="<?php echo $prefix; ?>_progress_text_color[]" value="<?php echo esc_attr($progress_text_color); ?>"></label>
    </div>
    <?php
    return ob_get_clean();
}

/**
 * =============================================================================
 * SETTINGS PERSISTENCE
 * =============================================================================
 */

/**
 * Save recurring event settings to database
 * 
 * @param int $post_id Product ID
 */
function tbc_wc_save_recurring_settings($post_id) {
    if (!tbc_wc_is_event_product($post_id)) {
        return;
    }

    if (!isset($_POST['_tbc_wc_recurring_type'])) {
        return;
    }

    $settings = tbc_wc_get_event_settings($post_id);
    
    $settings['recurring']['type'] = sanitize_text_field($_POST['_tbc_wc_recurring_type']);
    
    if (isset($_POST['_tbc_wc_rsvp_deadline_main'])) {
        $settings['rsvp']['deadline'] = sanitize_text_field($_POST['_tbc_wc_rsvp_deadline_main']);
    }
    
    if ($settings['recurring']['type'] === 'interval') {
        $settings['recurring']['interval'] = [
            'frequency' => sanitize_text_field($_POST['_tbc_wc_recurring_frequency'] ?? 'weekly'),
            'count' => absint($_POST['_tbc_wc_recurring_count'] ?? 1),
            'weekly_days' => array_map('sanitize_text_field', (array) ($_POST['_tbc_wc_recurring_weekly_days'] ?? [])),
            'monthly' => [
                'type' => sanitize_text_field($_POST['_tbc_wc_recurring_monthly_type'] ?? 'day'),
                'day' => absint($_POST['_tbc_wc_recurring_monthly_day'] ?? 1),
                'week' => sanitize_text_field($_POST['_tbc_wc_recurring_monthly_week'] ?? 'first'),
                'weekday' => sanitize_text_field($_POST['_tbc_wc_recurring_monthly_weekday'] ?? 'monday')
            ],
            'yearly_month' => absint($_POST['_tbc_wc_recurring_yearly_month'] ?? 1),
            'end' => [
                'type' => sanitize_text_field($_POST['_tbc_wc_recurring_end_type'] ?? 'never'),
                'pattern_end_date' => sanitize_text_field($_POST['_tbc_wc_recurring_end_date'] ?? ''),
                'count' => absint($_POST['_tbc_wc_recurring_end_count'] ?? '')
            ],
            'exceptions' => tbc_wc_process_interval_exceptions_array()
        ];
    }

    if ($settings['recurring']['type'] === 'individual') {
        $settings['recurring']['individual_dates'] = tbc_wc_process_individual_dates_array();
    }

    tbc_wc_update_event_settings($post_id, $settings);
}