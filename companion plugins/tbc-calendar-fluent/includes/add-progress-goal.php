<?php
/**
 * TBC WooCommerce Calendar - Donation Goal Progress Settings
 * 
 * Admin fields for progress bar configuration.
 * 
 * @package TBC_WC_Calendar
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Display progress bar settings in admin
 */
function tbc_wc_progress_settings() {
    wp_nonce_field('tbc_wc_progress_nonce', 'tbc_wc_progress_nonce');

    global $post;
    
    $settings = tbc_wc_get_event_settings($post->ID);
    $progress = $settings['progress'];
    
    $showed = $progress['enabled'];
    $class = $showed ? 'tbc-wc-dgp-show' : 'tbc-wc-dgp-hide';

    $background_color = $progress['background_color'] ?: '#F0F0F0';
    $fill_color = $progress['fill_color'] ?: '#007CFF';
    $text_color = $progress['text_color'] ?: '#000000';
    
    echo '<div class="options_group tbc-wc-donation-goal-settings">';
    echo '<h4>' . __('Donation Goal Settings', 'tbc-wc-calendar') . '</h4>';

    woocommerce_wp_checkbox([
        'id'            => 'tbc_wc_show_progress_bar',
        'wrapper_class' => 'test',
        'label'         => __('Enable Donation Goal', 'tbc-wc-calendar'),
        'description'   => __('Check to display the donation progress bar on this product.', 'tbc-wc-calendar'),
        'desc_tip'      => true,
        'value'         => $showed ? 'yes' : 'no'
    ]);

    woocommerce_wp_text_input([
        'id'            => 'tbc_wc_inventory_threshold',
        'type'          => 'number',
        'wrapper_class' => 'tbc-wc-dgp-input-wrap ' . $class,
        'label'         => __('Inventory Threshold', 'tbc-wc-calendar'),
        'description'   => __('Only show progress bar when there are this many spots left (or fewer). For example, with a goal of 7 and threshold of 2, the progress bar will only appear when you reach 5+ donors.', 'tbc-wc-calendar'),
        'desc_tip'      => true,
        'value'         => $progress['inventory_threshold']
    ]);

    woocommerce_wp_select([
        'id'            => 'tbc_wc_goal_type',
        'label'         => __('Goal Format', 'tbc-wc-calendar'),
        'description'   => __('Choose the goal type for this product.', 'tbc-wc-calendar'),
        'desc_tip'      => true,
        'options'       => [
            'revenue'     => __('Amount Raised', 'tbc-wc-calendar'),
            'sales'       => __('Number of Donors', 'tbc-wc-calendar'),
            'subscribers' => __('Number of Subscribers', 'tbc-wc-calendar'),
        ],
        'wrapper_class' => 'tbc-wc-dgp-input-wrap ' . $class,
        'value'         => $progress['goal_type']
    ]);

    woocommerce_wp_select([
        'id'            => 'tbc_wc_subscriber_timeframe',
        'label'         => __('Time Frame', 'tbc-wc-calendar'),
        'description'   => __('Choose the time frame for subscriber count.', 'tbc-wc-calendar'),
        'desc_tip'      => true,
        'options'       => [
            'all_time'      => __('All Time', 'tbc-wc-calendar'),
            'current_month' => __('Current Month', 'tbc-wc-calendar'),
            'current_year'  => __('Current Year', 'tbc-wc-calendar'),
            'last_30_days'  => __('Last 30 Days', 'tbc-wc-calendar'),
            'last_90_days'  => __('Last 90 Days', 'tbc-wc-calendar'),
        ],
        'wrapper_class' => 'tbc-wc-dgp-input-wrap tbc-wc-subscriber-timeframe ' . $class,
        'value'         => isset($progress['subscriber_timeframe']) ? $progress['subscriber_timeframe'] : 'all_time'
    ]);

    woocommerce_wp_text_input([
        'id'            => 'tbc_wc_goal',
        'type'          => 'number',
        'wrapper_class' => 'tbc-wc-dgp-input-wrap ' . $class,
        'label'         => __('Goal Amount', 'tbc-wc-calendar'),
        'description'   => __('Enter the donation goal for this product.', 'tbc-wc-calendar'),
        'desc_tip'      => true,
        'value'         => $progress['goal']
    ]);

    woocommerce_wp_checkbox([
        'id'            => 'tbc_wc_show_percentage_label',
        'wrapper_class' => 'tbc-wc-dgp-input-wrap ' . $class,
        'label'         => __('Show Percentage Label', 'tbc-wc-calendar'),
        'description'   => __('Check to show percentage label.', 'tbc-wc-calendar'),
        'desc_tip'      => true,
        'value'         => $progress['show_percentage'] ? 'yes' : 'no'
    ]);

    woocommerce_wp_text_input([
        'id'            => 'tbc_wc_background_color',
        'type'          => 'color',
        'wrapper_class' => 'tbc-wc-dgp-input-wrap ' . $class,
        'label'         => __('Goal Bar Background Color', 'tbc-wc-calendar'),
        'description'   => __('Enter the background color for the progress bar (e.g. #e5e5e5).', 'tbc-wc-calendar'),
        'desc_tip'      => true,
        'value'         => $background_color,
    ]);

    woocommerce_wp_text_input([
        'id'            => 'tbc_wc_fill_color',
        'type'          => 'color',
        'wrapper_class' => 'tbc-wc-dgp-input-wrap ' . $class,
        'label'         => __('Goal Bar Fill Color', 'tbc-wc-calendar'),
        'description'   => __('Enter the Fill color for the progress bar (e.g. #e5e5e5).', 'tbc-wc-calendar'),
        'desc_tip'      => true,
        'value'         => $fill_color,
    ]);

    woocommerce_wp_text_input([
        'id'            => 'tbc_wc_text_color',
        'type'          => 'color',
        'wrapper_class' => 'tbc-wc-dgp-input-wrap ' . $class,
        'label'         => __('Goal Bar Font Color', 'tbc-wc-calendar'),
        'description'   => __('Enter the Font color for the progress bar (e.g. #e5e5e5).', 'tbc-wc-calendar'),
        'desc_tip'      => true,
        'value'         => $text_color,
    ]);

    woocommerce_wp_text_input([
        'id'            => 'tbc_wc_progress_above_text',
        'type'          => 'text',
        'wrapper_class' => 'tbc-wc-dgp-input-wrap ' . $class,
        'label'         => __('Progress Above Text', 'tbc-wc-calendar'),
        'description'   => __('Enter the progress bar above text. Use {month} to insert the current month.', 'tbc-wc-calendar'),
        'desc_tip'      => true,
        'value'         => $progress['above_text']
    ]);
    
    echo '</div>';
}

/**
 * Save progress bar settings
 * 
 * @param int $post_id Product ID
 */
function tbc_wc_progress_save_settings($post_id) {
    if (!tbc_wc_is_event_product($post_id)) {
        return;
    }
    
    if (!isset($_POST['tbc_wc_progress_nonce']) || !wp_verify_nonce($_POST['tbc_wc_progress_nonce'], 'tbc_wc_progress_nonce')) {
        return;
    }

    $settings = tbc_wc_get_event_settings($post_id);
    
    $settings['progress'] = [
        'enabled'              => isset($_POST['tbc_wc_show_progress_bar']),
        'goal_type'            => isset($_POST['tbc_wc_goal_type']) ? sanitize_text_field($_POST['tbc_wc_goal_type']) : '',
        'goal'                 => isset($_POST['tbc_wc_goal']) ? (int) $_POST['tbc_wc_goal'] : 0,
        'show_percentage'      => isset($_POST['tbc_wc_show_percentage_label']),
        'background_color'     => isset($_POST['tbc_wc_background_color']) ? sanitize_hex_color($_POST['tbc_wc_background_color']) : '#F0F0F0',
        'fill_color'           => isset($_POST['tbc_wc_fill_color']) ? sanitize_hex_color($_POST['tbc_wc_fill_color']) : '#007CFF',
        'text_color'           => isset($_POST['tbc_wc_text_color']) ? sanitize_hex_color($_POST['tbc_wc_text_color']) : '#000000',
        'above_text'           => isset($_POST['tbc_wc_progress_above_text']) ? sanitize_text_field($_POST['tbc_wc_progress_above_text']) : '',
        'inventory_threshold'  => isset($_POST['tbc_wc_inventory_threshold']) ? (int) $_POST['tbc_wc_inventory_threshold'] : 0,
        'subscriber_timeframe' => isset($_POST['tbc_wc_subscriber_timeframe']) ? sanitize_text_field($_POST['tbc_wc_subscriber_timeframe']) : 'all_time'
    ];
    
    tbc_wc_update_event_settings($post_id, $settings);
}