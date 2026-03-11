<?php
/**
 * TBC WooCommerce Calendar - Event Settings Management
 * 
 * Core data management and admin UI for event settings.
 * 
 * @package TBC_WC_Calendar
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * =============================================================================
 * DATA MANAGEMENT FUNCTIONS
 * =============================================================================
 */

/**
 * Get complete event settings for a product
 * 
 * @param int $product_id Product ID
 * @return array Complete event settings with defaults applied
 */
function tbc_wc_get_event_settings($product_id) {
    $default_settings = [
        'excerpt' => '',
        'calendar_color' => '#28a745',
        'single_day_event' => true,
        'dates' => [
            'start_date' => '',
            'end_date' => '',
            'start_time' => '',
            'end_time' => '',
            'is_closed' => false,
            'is_hidden' => false
        ],
        'location' => [
            'business_name' => '',
            'address' => '',
            'map_enabled' => false
        ],
        'rsvp' => [
            'enabled' => false,
            'deadline_type' => 'date',
            'deadline' => '',
            'deadline_rule' => '1_week',
            'show_countdown' => true
        ],
        'progress' => [
            'enabled' => false,
            'inventory_threshold' => 0,
            'goal_type' => 'sales',
            'goal' => 0,
            'show_percentage' => false,
            'background_color' => '#F0F0F0',
            'fill_color' => '#007CFF',
            'text_color' => '#000000',
            'above_text' => '',
            'subscriber_timeframe' => 'all_time'
        ],
        'recurring' => [
            'type' => 'single',
            'interval' => [
                'frequency' => 'weekly',
                'count' => 1,
                'weekly_days' => [],
                'monthly' => [
                    'type' => 'day',
                    'day' => 1,
                    'week' => 'first',
                    'weekday' => 'monday'
                ],
                'yearly_month' => 1,
                'end' => [
                    'type' => 'never',
                    'pattern_end_date' => '',
                    'count' => 0
                ],
                'exceptions' => []
            ],
            'individual_dates' => []
        ]
    ];
    
    $settings = get_post_meta($product_id, '_tbc_wc_event_settings', true);
    
    if (empty($settings) || !is_array($settings)) {
        $settings = [];
    }
    
    return array_replace_recursive($default_settings, $settings);
}

/**
 * Update a specific section of event settings
 * 
 * @param int $product_id Product ID
 * @param string $section Settings section to update
 * @param array $new_values New values for the section
 * @return bool Success or failure
 */
function tbc_wc_update_settings_section($product_id, $section, $new_values) {
    $settings = tbc_wc_get_event_settings($product_id);
    
    if (isset($settings[$section])) {
        if (is_array($settings[$section]) && is_array($new_values)) {
            $settings[$section] = array_replace_recursive($settings[$section], $new_values);
        } else {
            $settings[$section] = $new_values;
        }
        
        return update_post_meta($product_id, '_tbc_wc_event_settings', $settings);
    }
    
    return false;
}

/**
 * Update entire event settings
 * 
 * @param int $product_id Product ID
 * @param array $settings Complete settings array
 * @return bool Success or failure
 */
function tbc_wc_update_event_settings($product_id, $settings) {
    return update_post_meta($product_id, '_tbc_wc_event_settings', $settings);
}

/**
 * =============================================================================
 * EVENT PRODUCT CHECK
 * =============================================================================
 */

/**
 * Check if product is an event product
 * 
 * @param int|WC_Product|WP_Post $product Product ID, object, or post object
 * @return bool True if event product
 */
function tbc_wc_is_event_product($product) {
    if ($product instanceof WP_Post) {
        return get_post_meta($product->ID, '_tbc_wc_is_event', true) === 'yes';
    }
    
    if (is_numeric($product)) {
        return get_post_meta($product, '_tbc_wc_is_event', true) === 'yes';
    }
    
    if (is_a($product, 'WC_Product')) {
        return $product->get_meta('_tbc_wc_is_event', true) === 'yes';
    }
    
    return false;
}

/**
 * Add "Event Product" checkbox to product type options
 */
function tbc_wc_add_is_event_checkbox($options) {
    global $post;
    
    if ($post instanceof WP_Post && 'product' !== $post->post_type) {
        return $options;
    }
    
    $options['tbc_wc_is_event'] = [
        'id'            => '_tbc_wc_is_event',
        'wrapper_class' => '',
        'label'         => __('Event Product', 'tbc-wc-calendar'),
        'description'   => __('Enable calendar event features for this product.', 'tbc-wc-calendar'),
        'default'       => 'no',
    ];
    
    return $options;
}

/**
 * Save "Event Product" checkbox value
 */
function tbc_wc_save_is_event_checkbox($product) {
    $is_event = isset($_POST['_tbc_wc_is_event']) ? 'yes' : 'no';
    $product->update_meta_data('_tbc_wc_is_event', $is_event);
}

/**
 * =============================================================================
 * ADMIN UI FUNCTIONS
 * =============================================================================
 */

/**
 * Add calendar tab to product data tabs
 */
function tbc_wc_add_product_data_tab($product_data_tabs) {
    global $post;
    
    if (!tbc_wc_is_event_product($post)) {
        return $product_data_tabs;
    }
    
    $product_data_tabs['tbc_wc_calendar'] = [
        'label'  => __('WooCalendar', 'tbc-wc-calendar'),
        'target' => 'tbc_wc_calendar_data',
        'class'  => [],
        'icon'   => 'dashicons-calendar-alt',
    ];
    
    return $product_data_tabs;
}

/**
 * Display calendar tab content
 */
function tbc_wc_product_data_fields() {
    global $post;
    
    if (!tbc_wc_is_event_product($post)) {
        return;
    }
    
    echo '<div id="tbc_wc_calendar_data" class="panel woocommerce_options_panel">';
    
    tbc_wc_add_excerpt_field();
    tbc_wc_add_date_time_fields();
    tbc_wc_add_location_fields();
    tbc_wc_add_rsvp_fields();
    tbc_wc_progress_settings();
    tbc_wc_add_recurring_dates_field();
    
    echo '</div>';
}

/**
 * Add custom tab icon style
 */
function tbc_wc_add_icon_style() {
    ?>
    <style>
        #woocommerce-product-data ul.wc-tabs li.tbc_wc_calendar_options a::before {
            font-family: Dashicons;
            content: "\f145";
        }
    </style>
    <?php
}

/**
 * =============================================================================
 * HOOK REGISTRATIONS
 * =============================================================================
 */

add_filter('product_type_options', 'tbc_wc_add_is_event_checkbox');
add_action('woocommerce_admin_process_product_object', 'tbc_wc_save_is_event_checkbox');

add_filter('woocommerce_product_data_tabs', 'tbc_wc_add_product_data_tab', 99);
add_action('woocommerce_product_data_panels', 'tbc_wc_product_data_fields');
add_action('admin_head', 'tbc_wc_add_icon_style');

add_action('woocommerce_process_product_meta', 'tbc_wc_save_date_time_fields', 10, 1);
add_action('woocommerce_process_product_meta', 'tbc_wc_save_recurring_settings', 10, 1);
add_action('woocommerce_process_product_meta', 'tbc_wc_save_location_fields', 10, 1);
add_action('woocommerce_process_product_meta', 'tbc_wc_save_excerpt_field', 10, 1);
add_action('woocommerce_process_product_meta', 'tbc_wc_save_rsvp_fields', 10, 1);
add_action('woocommerce_process_product_meta', 'tbc_wc_progress_save_settings', 10, 1);