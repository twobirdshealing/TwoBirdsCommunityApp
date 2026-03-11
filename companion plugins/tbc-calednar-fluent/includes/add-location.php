<?php
/**
 * TBC WooCommerce Calendar - Event Location Fields
 * 
 * Admin fields for event location and Google Maps integration.
 * 
 * @package TBC_WC_Calendar
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Display location fields in admin
 */
function tbc_wc_add_location_fields() {
    global $post;
    
    $settings = tbc_wc_get_event_settings($post->ID);
    $location = $settings['location'];
    
    echo '<div class="options_group">';
    echo '<h4>' . __('Event Location', 'tbc-wc-calendar') . '</h4>';
    
    woocommerce_wp_text_input([
        'id'          => '_tbc_wc_business_name',
        'label'       => __('Business Name', 'tbc-wc-calendar'),
        'description' => __('Enter the business name for this event.', 'tbc-wc-calendar'),
        'desc_tip'    => true,
        'value'       => $location['business_name']
    ]);

    woocommerce_wp_text_input([
        'id'          => '_tbc_wc_location',
        'label'       => __('Event Address', 'tbc-wc-calendar'),
        'description' => __('Enter the address for this event.', 'tbc-wc-calendar'),
        'desc_tip'    => true,
        'value'       => $location['address']
    ]);

    woocommerce_wp_checkbox([
        'id'          => '_tbc_wc_map_enabled',
        'label'       => __('Enable Google Map', 'tbc-wc-calendar'),
        'description' => __('Check this box to display a Google Map for the event location.', 'tbc-wc-calendar'),
        'desc_tip'    => true,
        'value'       => $location['map_enabled'] ? 'yes' : 'no'
    ]);

    echo '</div>';
}

/**
 * Save location fields
 * 
 * @param int $post_id Product ID
 */
function tbc_wc_save_location_fields($post_id) {
    if (!tbc_wc_is_event_product($post_id)) {
        return;
    }
    
    $settings = tbc_wc_get_event_settings($post_id);
    
    $settings['location'] = [
        'business_name' => isset($_POST['_tbc_wc_business_name']) ? sanitize_text_field($_POST['_tbc_wc_business_name']) : '',
        'address'       => isset($_POST['_tbc_wc_location']) ? sanitize_text_field($_POST['_tbc_wc_location']) : '',
        'map_enabled'   => isset($_POST['_tbc_wc_map_enabled'])
    ];
    
    tbc_wc_update_event_settings($post_id, $settings);
}

/**
 * Generate Google Map HTML
 * 
 * @param string $business_name Business name
 * @param string $address Event address
 * @return string Map HTML
 */
function tbc_wc_generate_google_map($business_name, $address) {
    $map_id = 'tbc-wc-google-map-' . uniqid();
    $map_info = [
        'business' => sanitize_text_field($business_name),
        'address'  => sanitize_text_field($address),
    ];
    $data_attr = esc_attr(json_encode($map_info));
    $html = '<div id="' . esc_attr($map_id) . '" class="tbc-wc-google-map" data-map-info="' . $data_attr . '"></div>';
    
    wp_enqueue_script('tbc-wc-google-maps-script');
    
    return $html;
}

/**
 * Display event map on product page
 * 
 * @param int $product_id Product ID
 * @param string|null $event_address Override address
 * @return string Map HTML or empty string
 */
function tbc_wc_display_map($product_id, $event_address = null) {
    $settings = tbc_wc_get_event_settings($product_id);
    $location = $settings['location'];
    
    $address = $event_address ?: $location['address'];
    
    if ($location['map_enabled'] && !empty($address)) {
        return tbc_wc_generate_google_map($location['business_name'], $address);
    }
    
    return '';
}