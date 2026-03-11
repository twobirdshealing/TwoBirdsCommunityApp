<?php
/**
 * TBC WooCommerce Calendar - Event Excerpt & Color Fields
 * 
 * Admin fields for event description and calendar color.
 * 
 * @package TBC_WC_Calendar
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Display excerpt and color fields in admin
 */
function tbc_wc_add_excerpt_field() {
    global $post;
    
    $settings = tbc_wc_get_event_settings($post->ID);
    $excerpt = $settings['excerpt'];
    $calendar_color = $settings['calendar_color'];
    
    echo '<div class="options_group">';
    echo '<h4>' . __('Event Details', 'tbc-wc-calendar') . '</h4>';
    
    echo '<div class="tbc-wc-summary"></div>';

    woocommerce_wp_textarea_input([
        'id'          => '_tbc_wc_excerpt',
        'label'       => __('Event Description', 'tbc-wc-calendar'),
        'description' => __('Enter a short description for this event.', 'tbc-wc-calendar'),
        'desc_tip'    => true,
        'rows'        => 5,
        'value'       => $excerpt,
        'placeholder' => __('Describe your event here...', 'tbc-wc-calendar'),
        'style'       => 'height: 150px;'
    ]);
    
    echo '<p class="form-field _tbc_wc_color_field">';
    echo '<label for="_tbc_wc_color">' . __('Calendar Color', 'tbc-wc-calendar') . '</label>';
    echo '<input type="text" id="_tbc_wc_color" name="_tbc_wc_color" value="' . esc_attr($calendar_color) . '" class="tbc-wc-color-picker" data-default-color="#28a745" />';
    echo '<span class="description">' . __('Choose the color for this event on the calendar.', 'tbc-wc-calendar') . '</span>';
    echo '</p>';
    
    wp_enqueue_style('wp-color-picker');
    wp_enqueue_script('wp-color-picker');
    
    echo '<script>
        jQuery(document).ready(function($) {
            $(".tbc-wc-color-picker").wpColorPicker();
        });
    </script>';
    
    echo '</div>';
}

/**
 * Save excerpt and color fields
 * 
 * @param int $post_id Product ID
 */
function tbc_wc_save_excerpt_field($post_id) {
    if (!tbc_wc_is_event_product($post_id)) {
        return;
    }
    
    $settings = tbc_wc_get_event_settings($post_id);
    
    if (isset($_POST['_tbc_wc_excerpt'])) {
        $settings['excerpt'] = sanitize_textarea_field($_POST['_tbc_wc_excerpt']);
    }
    
    if (isset($_POST['_tbc_wc_color'])) {
        $color = sanitize_text_field($_POST['_tbc_wc_color']);
        if (preg_match('/^#[a-f0-9]{6}$/i', $color)) {
            $settings['calendar_color'] = $color;
        }
    }
    
    tbc_wc_update_event_settings($post_id, $settings);
}