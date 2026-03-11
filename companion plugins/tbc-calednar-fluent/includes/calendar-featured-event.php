<?php
/**
 * TBC WooCommerce Calendar - Featured Events Display
 * 
 * Displays the next 3 upcoming events from featured products.
 * 
 * @package TBC_WC_Calendar
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Display featured events section
 */
function tbc_wc_display_featured_events() {
    $args = [
        'post_type' => 'product',
        'posts_per_page' => -1,
        'tax_query' => [
            [
                'taxonomy' => 'product_visibility',
                'field' => 'name',
                'terms' => 'featured',
            ],
        ]
    ];
    
    $featured_products = new WP_Query($args);
    $upcoming_events = [];
    $current_date = current_time('Y-m-d');
    
    if ($featured_products->have_posts()) {
        while ($featured_products->have_posts()) {
            $featured_products->the_post();
            global $product;
            
            $product_id = $product->get_id();
            $product_title = get_the_title();
            $product_link = get_permalink();
            $product_image = get_the_post_thumbnail_url($product_id, 'medium');
            
            if (!tbc_wc_is_event_product($product_id)) {
                continue;
            }
         
            $next_dates = tbc_wc_get_events($product_id, [
                'start_date' => $current_date,
                'end_date'   => date('Y-m-t', strtotime('+2 months')),
                'limit'      => 5
            ]);
            
            if (!empty($next_dates)) {
                $available_date = null;
                foreach ($next_dates as $event) {
                    if ($event['status'] === 'open') {
                        $available_date = $event;
                        break;
                    }
                }
                
                if ($available_date) {
                    $upcoming_events[] = [
                        'product_id' => $product_id,
                        'product_name' => $product_title,
                        'product_link' => $product_link,
                        'product_image' => $product_image,
                        'event_date' => $available_date['start'],
                        'end_date' => $available_date['end'],
                        'sort_timestamp' => strtotime($available_date['start'])
                    ];
                }
            }
        }
    }
    
    wp_reset_postdata();
    
    usort($upcoming_events, function($a, $b) {
        return $a['sort_timestamp'] - $b['sort_timestamp'];
    });
    $upcoming_events = array_slice($upcoming_events, 0, 3);
    
    if (!empty($upcoming_events)) {
        echo '<div class="tbc-wc-featured-events-container">';
        echo '<h2 class="tbc-wc-featured-events-title">' . esc_html__('Featured Events', 'tbc-wc-calendar') . '</h2>';
        echo '<div class="tbc-wc-featured-events-list">';
        
        foreach ($upcoming_events as $event) {
            tbc_wc_render_featured_event_item($event);
        }
        
        echo '</div>';
        echo '</div>';
    }
}

/**
 * Render individual featured event item
 * 
 * @param array $event Event data
 */
function tbc_wc_render_featured_event_item($event) {
    $product_id = $event['product_id'];
    $product_name = $event['product_name'];
    $product_link = $event['product_link'];
    $product_image = $event['product_image'];
    $event_date = $event['event_date'];
    $event_end_date = $event['end_date'] ?? $event_date;
    
    $product = wc_get_product($product_id);
    if (!$product) return;
    
    $event_url = tbc_wc_get_event_url($product_id, $event_date);
    
    $date_obj = new DateTime($event_date);
    $day_of_week = $date_obj->format('l');
    $day_number = $date_obj->format('j');
    $day_suffix = $date_obj->format('S');
    $month = $date_obj->format('F');
    
    echo '<div class="tbc-wc-featured-event-box">';
    echo '<a href="' . esc_url($event_url) . '">';
    
    if ($product_image) {
        echo '<div class="tbc-wc-featured-event-image-wrapper">';
        echo '<img src="' . esc_url($product_image) . '" alt="' . esc_attr($product_name) . '" class="tbc-wc-featured-event-image" />';
        echo '</div>';
    }
    
    echo '<div class="tbc-wc-featured-event-name">' . esc_html($product_name) . '</div>';
    
    echo '<div class="tbc-wc-featured-event-date-wrapper">';
    echo '<div class="tbc-wc-featured-event-date">';
    echo '<span class="tbc-wc-event-day">' . esc_html($day_of_week) . '</span>';
    echo '<span class="tbc-wc-event-date">' . esc_html($day_number) . '<sup>' . esc_html($day_suffix) . '</sup></span>';
    echo '<span class="tbc-wc-event-month">' . esc_html($month) . '</span>';
    echo '</div>';
    echo '</div>';
    
    echo '<div class="tbc-wc-read-more-button">Learn More</div>';
    
    echo '</a>';
    echo '</div>';
}