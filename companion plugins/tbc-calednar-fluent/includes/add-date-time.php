<?php
/**
 * TBC WooCommerce Calendar - Event Date & Time Fields
 * 
 * Admin fields for event start/end dates and times.
 * 
 * @package TBC_WC_Calendar
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Display event date/time fields in admin
 */
function tbc_wc_add_date_time_fields() {
    global $post;
    
    $settings = tbc_wc_get_event_settings($post->ID);
    $dates = $settings['dates'];
    $single_day_event = $settings['single_day_event'];
    
    echo '<div class="options_group">';
    echo '<h4>' . __('Event Date & Time', 'tbc-wc-calendar') . '</h4>';
    
    woocommerce_wp_checkbox([
        'id'          => '_tbc_wc_single_day_event',
        'label'       => __('Single Day Event', 'tbc-wc-calendar'),
        'description' => __('Check if this is a single day event.', 'tbc-wc-calendar'),
        'desc_tip'    => true,
        'value'       => $single_day_event ? 'yes' : 'no'
    ]);
    
    echo '<div class="tbc-wc-date-time-group">';
    
    echo '<div class="tbc-wc-date-time-pair tbc-wc-start-date-time">';
    echo '<div class="tbc-wc-date-field">';
    woocommerce_wp_text_input([
        'id'          => '_tbc_wc_start_date',
        'type'        => 'text',
        'label'       => __('Start Date', 'tbc-wc-calendar'),
        'description' => __('Select the start date for this event.', 'tbc-wc-calendar'),
        'desc_tip'    => true,
        'class'       => 'tbc-wc-date-picker',
        'value'       => $dates['start_date']
    ]);
    echo '</div>';
    
    echo '<div class="tbc-wc-time-field tbc-wc-start-time">';
    woocommerce_wp_text_input([
        'id'          => '_tbc_wc_start_time',
        'label'       => __('Start Time', 'tbc-wc-calendar'),
        'placeholder' => 'HH:MM',
        'desc_tip'    => true,
        'description' => __('Enter the event start time in 24-hour format (e.g., 14:30 for 2:30 PM).', 'tbc-wc-calendar'),
        'value'       => $dates['start_time']
    ]);
    echo '</div>';
    
    echo '<div class="tbc-wc-time-field tbc-wc-end-time">';
    woocommerce_wp_text_input([
        'id'          => '_tbc_wc_end_time',
        'label'       => __('End Time', 'tbc-wc-calendar'),
        'placeholder' => 'HH:MM',
        'desc_tip'    => true,
        'description' => __('Enter the event end time in 24-hour format (e.g., 16:00 for 4:00 PM).', 'tbc-wc-calendar'),
        'value'       => $dates['end_time']
    ]);
    echo '</div>';
    echo '</div>';
    
    echo '<div class="tbc-wc-date-time-pair" id="tbc-wc-end-date-time-pair">';
    echo '<div class="tbc-wc-date-field">';
    woocommerce_wp_text_input([
        'id'          => '_tbc_wc_end_date',
        'type'        => 'text',
        'label'       => __('End Date', 'tbc-wc-calendar'),
        'description' => __('Select the end date for this event.', 'tbc-wc-calendar'),
        'desc_tip'    => true,
        'class'       => 'tbc-wc-date-picker',
        'value'       => $dates['end_date']
    ]);
    echo '</div>';
    echo '</div>';
    
    echo '<div class="tbc-wc-main-date-status">';
    
    woocommerce_wp_checkbox([
        'id'          => '_tbc_wc_main_date_closed',
        'label'       => __('Date Closed', 'tbc-wc-calendar'),
        'description' => __('Check to manually mark this date as closed/unavailable.', 'tbc-wc-calendar'),
        'desc_tip'    => true,
        'value'       => !empty($dates['is_closed']) ? 'yes' : 'no'
    ]);
    
    woocommerce_wp_checkbox([
        'id'          => '_tbc_wc_main_date_hidden',
        'label'       => __('Date Hidden', 'tbc-wc-calendar'),
        'description' => __('Check to hide this date from calendar views (still accessible by direct URL).', 'tbc-wc-calendar'),
        'desc_tip'    => true,
        'value'       => !empty($dates['is_hidden']) ? 'yes' : 'no'
    ]);
    
    echo '</div>';
    echo '</div>';
    echo '</div>';
    
    ?>
    <script>
    jQuery(document).ready(function($) {
        function toggleEndDateVisibility() {
            if ($('#_tbc_wc_single_day_event').is(':checked')) {
                $('#tbc-wc-end-date-time-pair').hide();
            } else {
                $('#tbc-wc-end-date-time-pair').show();
            }
        }
        
        $('#_tbc_wc_single_day_event').on('change', toggleEndDateVisibility);
        toggleEndDateVisibility();
    });
    </script>
    <?php
}

/**
 * Save event date/time fields
 * 
 * @param int $post_id Product ID
 */
function tbc_wc_save_date_time_fields($post_id) {
    if (!tbc_wc_is_event_product($post_id)) {
        return;
    }
    
    $settings = tbc_wc_get_event_settings($post_id);
    
    $settings['single_day_event'] = isset($_POST['_tbc_wc_single_day_event']);
    
    $dates = [
        'start_date' => isset($_POST['_tbc_wc_start_date']) ? sanitize_text_field($_POST['_tbc_wc_start_date']) : '',
        'end_date'   => isset($_POST['_tbc_wc_end_date']) ? sanitize_text_field($_POST['_tbc_wc_end_date']) : '',
        'start_time' => isset($_POST['_tbc_wc_start_time']) ? sanitize_text_field($_POST['_tbc_wc_start_time']) : '',
        'end_time'   => isset($_POST['_tbc_wc_end_time']) ? sanitize_text_field($_POST['_tbc_wc_end_time']) : '',
        'is_closed'  => isset($_POST['_tbc_wc_main_date_closed']),
        'is_hidden'  => isset($_POST['_tbc_wc_main_date_hidden'])
    ];
    
    if ($settings['single_day_event']) {
        $dates['end_date'] = $dates['start_date'];
    }
    
    $settings['dates'] = $dates;
    
    tbc_wc_update_event_settings($post_id, $settings);
}