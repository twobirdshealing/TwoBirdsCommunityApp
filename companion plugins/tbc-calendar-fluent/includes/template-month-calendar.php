<?php
/**
 * TBC WooCommerce Calendar - Month Calendar View
 * 
 * Displays events in a month grid calendar format.
 * 
 * @package TBC_WC_Calendar
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Display month calendar with grid layout
 */
function tbc_wc_display_month_calendar() {
    if (!is_shop()) return;

    tbc_wc_display_featured_events();

    echo '<hr>';

    $current_date = current_time('Y-m-d');
    $display_month = isset($_GET['display_month']) ? sanitize_text_field($_GET['display_month']) : '';
    $display_month = trim($display_month);

    if (!preg_match('/^\d{4}-\d{2}$/', $display_month)) {
        $display_month = date('Y-m', strtotime($current_date));
    }

    // Calendar header: toolbar + navigation
    echo '<div class="tbc-wc-calendar-header">';
    echo tbc_wc_dashboard();
    tbc_wc_template_display_navigation($display_month, $current_date);
    echo '</div>';

    $max_month = date('Y-m', strtotime('+2 months', strtotime($current_date)));
    if ($display_month > $max_month) {
        echo '<div class="tbc-wc-calendar-projection-limit-message">';
        echo '<div class="tbc-wc-limit-message-content">';
        echo '<h3>' . esc_html__('Calendar Projection Limit', 'tbc-wc-calendar') . '</h3>';
        echo '<p>' . esc_html__('We only project our calendar 2 months in advance to ensure accuracy and allow for any necessary scheduling changes.', 'tbc-wc-calendar') . '</p>';
        echo '<p>' . esc_html__('If you need to view dates or RSVP for events further in the future, please reach out to us directly.', 'tbc-wc-calendar') . '</p>';
        echo '<p><a href="' . esc_url(remove_query_arg('display_month')) . '" class="tbc-wc-back-to-current">' . esc_html__('← Back to Current Month', 'tbc-wc-calendar') . '</a></p>';
        echo '</div>';
        echo '</div>';

        return;
    }

    $has_events = tbc_wc_month_render_grid($display_month, $current_date);

    if (!$has_events) {
        echo '<div class="tbc-wc-empty-month-message">';
        echo '<p>' . esc_html__('There are no remaining events scheduled for', 'tbc-wc-calendar') . ' ';
        echo esc_html(date('F Y', strtotime($display_month))) . '.</p>';
        echo '</div>';
    }

    tbc_wc_template_display_navigation($display_month, $current_date);

    if ($has_events) {
        tbc_wc_display_subscription_button();
    }
}

/**
 * Render the month grid calendar
 */
function tbc_wc_month_render_grid($display_month, $current_date) {
    $all_events = tbc_wc_get_events(null, [
        'start_date' => $current_date,
        'month_filter' => $display_month
    ]);

    if (empty($all_events)) {
        return false;
    }

    $events_by_date = [];
    $multi_day_events = [];
    
    foreach ($all_events as $event) {
        $start_date = $event['start'];
        $end_date = $event['end'];
        
        if ($start_date !== $end_date) {
            $multi_day_events[] = $event;
            
            $current = strtotime($start_date);
            $end = strtotime($end_date);
            
            while ($current <= $end) {
                $date_key = date('Y-m-d', $current);
                
                if (!isset($events_by_date[$date_key])) {
                    $events_by_date[$date_key] = [];
                }
                
                $events_by_date[$date_key][] = array_merge($event, [
                    'is_start' => ($date_key === $start_date),
                    'is_end' => ($date_key === $end_date),
                    'is_span' => true
                ]);
                
                $current = strtotime('+1 day', $current);
            }
        } else {
            if (!isset($events_by_date[$start_date])) {
                $events_by_date[$start_date] = [];
            }
            $events_by_date[$start_date][] = array_merge($event, ['is_span' => false]);
        }
    }

    $first_day = strtotime($display_month . '-01');
    $days_in_month = date('t', $first_day);
    $start_weekday = date('w', $first_day);
    $today = current_time('Y-m-d');

    echo '<div class="tbc-wc-month-calendar-container">';
    
    echo '<div class="tbc-wc-month-grid-wrapper">';
    echo '<div class="tbc-wc-month-grid">';
    
    $weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    foreach ($weekdays as $day) {
        echo '<div class="tbc-wc-month-grid-header">' . esc_html($day) . '</div>';
    }
    
    for ($i = 0; $i < $start_weekday; $i++) {
        $prev_month_date = date('Y-m-d', strtotime('-' . ($start_weekday - $i) . ' days', $first_day));
        $prev_day = date('j', strtotime($prev_month_date));
        echo '<div class="tbc-wc-month-grid-day tbc-wc-other-month">';
        echo '<span class="tbc-wc-day-number">' . esc_html($prev_day) . '</span>';
        echo '</div>';
    }
    
    for ($day = 1; $day <= $days_in_month; $day++) {
        $date = $display_month . '-' . sprintf('%02d', $day);
        $is_today = ($date === $today);
        $is_past = ($date < $today);
        $has_events = isset($events_by_date[$date]);
        
        $classes = ['tbc-wc-month-grid-day'];
        if ($is_today) $classes[] = 'tbc-wc-today';
        if ($is_past) $classes[] = 'tbc-wc-past';
        if ($has_events) $classes[] = 'tbc-wc-has-events';
        
        echo '<div class="' . esc_attr(implode(' ', $classes)) . '" data-date="' . esc_attr($date) . '">';
        echo '<span class="tbc-wc-day-number">' . esc_html($day) . '</span>';
        
        if ($has_events) {
            echo '<div class="tbc-wc-day-events">';
            $event_index = 0;
            foreach ($events_by_date[$date] as $event) {
                $product = $event['product'];
                $categories = wp_get_post_terms($product->get_id(), 'product_cat', ['fields' => 'slugs']);
                $category_classes = array_map(function($cat) {
                    return 'tbc-wc-category-' . sanitize_html_class($cat);
                }, $categories);
                
                $product_settings = tbc_wc_get_event_settings($product->get_id());
                $calendar_color = $product_settings['calendar_color'] ?? '#28a745';
                
                $event_time = '';
                if (!empty($event['start_time'])) {
                    if (isset($event['is_span']) && $event['is_span']) {
                        if (isset($event['is_start']) && $event['is_start']) {
                            $event_time = date('g:ia', strtotime($event['start_time']));
                        }
                    } else {
                        $event_time = date('g:ia', strtotime($event['start_time']));
                    }
                }
                
                $status_class = 'tbc-wc-status-' . esc_attr($event['status']);
                $event_url = tbc_wc_get_event_url($product->get_id(), $event['start']);
                
                $span_classes = [];
                if (isset($event['is_span']) && $event['is_span']) {
                    $span_classes[] = 'tbc-wc-event-span';
                    if (isset($event['is_start']) && $event['is_start']) {
                        $span_classes[] = 'tbc-wc-span-start';
                    }
                    if (isset($event['is_end']) && $event['is_end']) {
                        $span_classes[] = 'tbc-wc-span-end';
                    }
                    if ((!isset($event['is_start']) || !$event['is_start']) && (!isset($event['is_end']) || !$event['is_end'])) {
                        $span_classes[] = 'tbc-wc-span-middle';
                    }
                }
                
                $all_classes = array_merge($category_classes, [$status_class], $span_classes);
                
                ob_start();
                tbc_wc_template_render_product_item($product, $event);
                $event_html = ob_get_clean();
                
                echo '<div class="tbc-wc-day-event ' . esc_attr(implode(' ', $all_classes)) . '" style="background-color: ' . esc_attr($calendar_color) . ';" data-event-html="' . esc_attr($event_html) . '">';
                
                echo '<span class="tbc-wc-event-content-desktop">';
                if ($event_time) {
                    echo '<span class="tbc-wc-event-time">' . esc_html($event_time) . '</span> ';
                }
                echo '<span class="tbc-wc-event-title">' . esc_html($product->get_title()) . '</span>';
                echo '</span>';
                
                echo '<span class="tbc-wc-event-content-mobile"></span>';
                
                echo '</div>';
                $event_index++;
            }
            echo '</div>';
        }
        
        echo '</div>';
    }
    
    $total_cells = $start_weekday + $days_in_month;
    $remaining_cells = (7 - ($total_cells % 7)) % 7;
    for ($i = 1; $i <= $remaining_cells; $i++) {
        $next_month_date = date('Y-m-d', strtotime('+' . $i . ' days', strtotime($display_month . '-' . $days_in_month)));
        $next_day = date('j', strtotime($next_month_date));
        echo '<div class="tbc-wc-month-grid-day tbc-wc-other-month">';
        echo '<span class="tbc-wc-day-number">' . esc_html($next_day) . '</span>';
        echo '</div>';
    }
    
    echo '</div>'; // .tbc-wc-month-grid
    echo '</div>'; // .tbc-wc-month-grid-wrapper
    
    echo '<div class="tbc-wc-selected-day-details" style="display: none;">';
    echo '<div class="tbc-wc-details-header">';
    echo '<span class="tbc-wc-details-date"></span>';
    echo '<button class="tbc-wc-close-details">&times;</button>';
    echo '</div>';
    echo '<div class="tbc-wc-details-content"></div>';
    echo '</div>';
    
    echo '</div>'; // .tbc-wc-month-calendar-container

    return true;
}