<?php
/**
 * TBC WooCommerce Calendar - RSVP Settings Fields
 * 
 * Admin fields for RSVP deadline configuration.
 * 
 * @package TBC_WC_Calendar
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Display RSVP fields in admin
 */
function tbc_wc_add_rsvp_fields() {
    global $post;
    
    $settings = tbc_wc_get_event_settings($post->ID);
    $rsvp = $settings['rsvp'];
    
    echo '<div class="options_group">';
    echo '<h4>' . __('RSVP Settings', 'tbc-wc-calendar') . '</h4>';
    
    woocommerce_wp_checkbox([
        'id'          => '_tbc_wc_rsvp_enabled',
        'label'       => __('Enable RSVP Deadline', 'tbc-wc-calendar'),
        'description' => __('Check to enable RSVP deadline for this event.', 'tbc-wc-calendar'),
        'desc_tip'    => true,
        'value'       => $rsvp['enabled'] ? 'yes' : 'no'
    ]);

    woocommerce_wp_select([
        'id'            => '_tbc_wc_rsvp_deadline_type',
        'label'         => __('Deadline Type', 'tbc-wc-calendar'),
        'description'   => __('Choose how to set the RSVP deadline.', 'tbc-wc-calendar'),
        'desc_tip'      => true,
        'options'       => [
            'date' => __('Specific Date', 'tbc-wc-calendar'),
            'rule' => __('Time Before Event', 'tbc-wc-calendar')
        ],
        'value'         => isset($rsvp['deadline_type']) ? $rsvp['deadline_type'] : 'date',
        'wrapper_class' => $rsvp['enabled'] ? 'tbc-wc-rsvp-field-wrap' : 'tbc-wc-rsvp-field-wrap tbc-wc-hide-if-rsvp-disabled'
    ]);

    woocommerce_wp_text_input([
        'id'                => '_tbc_wc_rsvp_deadline',
        'label'             => __('RSVP By Date', 'tbc-wc-calendar'),
        'placeholder'       => 'YYYY-MM-DD',
        'description'       => __('Deadline for guests to RSVP.', 'tbc-wc-calendar'),
        'desc_tip'          => true,
        'class'             => 'tbc-wc-date-picker tbc-wc-rsvp-input',
        'custom_attributes' => ['autocomplete' => 'off'],
        'value'             => $rsvp['deadline'],
        'wrapper_class'     => ($rsvp['enabled'] && (!isset($rsvp['deadline_type']) || $rsvp['deadline_type'] === 'date')) 
                              ? 'tbc-wc-rsvp-field-wrap tbc-wc-deadline-date-field' 
                              : 'tbc-wc-rsvp-field-wrap tbc-wc-deadline-date-field tbc-wc-hide-if-rsvp-disabled'
    ]);
    
    woocommerce_wp_select([
        'id'            => '_tbc_wc_rsvp_deadline_rule',
        'label'         => __('RSVP By Rule', 'tbc-wc-calendar'),
        'description'   => __('Set deadline relative to event date.', 'tbc-wc-calendar'),
        'desc_tip'      => true,
        'options'       => [
            '1_day'   => __('1 Day Before', 'tbc-wc-calendar'),
            '3_days'  => __('3 Days Before', 'tbc-wc-calendar'),
            '1_week'  => __('1 Week Before', 'tbc-wc-calendar'),
            '2_weeks' => __('2 Weeks Before', 'tbc-wc-calendar'),
            '1_month' => __('1 Month Before', 'tbc-wc-calendar')
        ],
        'value'         => isset($rsvp['deadline_rule']) ? $rsvp['deadline_rule'] : '1_week',
        'wrapper_class' => ($rsvp['enabled'] && isset($rsvp['deadline_type']) && $rsvp['deadline_type'] === 'rule') 
                           ? 'tbc-wc-rsvp-field-wrap tbc-wc-deadline-rule-field' 
                           : 'tbc-wc-rsvp-field-wrap tbc-wc-deadline-rule-field tbc-wc-hide-if-rsvp-disabled'
    ]);
    
    woocommerce_wp_checkbox([
        'id'            => '_tbc_wc_rsvp_show_countdown',
        'label'         => __('Show Countdown', 'tbc-wc-calendar'),
        'description'   => __('Display days remaining until RSVP deadline.', 'tbc-wc-calendar'),
        'desc_tip'      => true,
        'value'         => $rsvp['show_countdown'] ? 'yes' : 'no',
        'wrapper_class' => $rsvp['enabled'] ? 'tbc-wc-rsvp-field-wrap' : 'tbc-wc-rsvp-field-wrap tbc-wc-hide-if-rsvp-disabled'
    ]);
    
    echo '</div>';
}

/**
 * Save RSVP fields
 * 
 * @param int $post_id Product ID
 */
function tbc_wc_save_rsvp_fields($post_id) {
    if (!tbc_wc_is_event_product($post_id)) {
        return;
    }
    
    $settings = tbc_wc_get_event_settings($post_id);
    
    $settings['rsvp'] = [
        'enabled'        => isset($_POST['_tbc_wc_rsvp_enabled']),
        'deadline_type'  => isset($_POST['_tbc_wc_rsvp_deadline_type']) 
                           ? sanitize_text_field($_POST['_tbc_wc_rsvp_deadline_type']) : 'date',
        'deadline'       => isset($_POST['_tbc_wc_rsvp_deadline']) 
                           ? sanitize_text_field($_POST['_tbc_wc_rsvp_deadline']) : '',
        'deadline_rule'  => isset($_POST['_tbc_wc_rsvp_deadline_rule']) 
                           ? sanitize_text_field($_POST['_tbc_wc_rsvp_deadline_rule']) : '1_week',
        'show_countdown' => isset($_POST['_tbc_wc_rsvp_show_countdown'])
    ];
    
    tbc_wc_update_event_settings($post_id, $settings);
}