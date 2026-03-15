<?php
/**
 * TBC WooCommerce Calendar - Core Functions
 * 
 * FAT EVENT API - Returns complete, display-ready event objects.
 * Internal status calculation, calendar display helpers, product collection.
 * 
 * @package TBC_WC_Calendar
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * =============================================================================
 * FAT EVENT API - SINGLE SOURCE OF TRUTH
 * =============================================================================
 */

/**
 * Get complete event objects for display
 * 
 * SINGLE SOURCE OF TRUTH for all event data retrieval.
 * Returns complete, display-ready event objects with all metadata.
 * Templates should ONLY call this function - never fetch settings separately.
 *
 * @param int|array|null $product_id Single product ID, array of IDs, or null for all products
 * @param array $options Filter options (start_date, end_date OR month_filter, limit)
 * @return array Array of complete event objects ready for display
 */
function tbc_wc_get_events($product_id = null, $options = []) {
    $options = wp_parse_args($options, [
        'start_date'   => current_time('Y-m-d'),
        'end_date'     => null,
        'month_filter' => null,
        'limit'        => null
    ]);

    if (!empty($options['month_filter'])) {
        $monthStart = date('Y-m-01', strtotime($options['month_filter'] . '-01'));
        $monthEnd   = date('Y-m-t',  strtotime($options['month_filter'] . '-01'));

        $today = current_time('Y-m-d');
        if (date('Y-m', strtotime($today)) === $options['month_filter']) {
            $monthStart = max($monthStart, $today);
        }

        $options['start_date'] = $monthStart;
        $options['end_date']   = $monthEnd;
    }

    if (empty($options['end_date'])) {
        error_log(sprintf(
            'TBC ERROR: tbc_wc_get_events() called without end_date. Product ID: %s',
            $product_id ?? 'null'
        ));
        return [];
    }

    // Multiple products
    if (is_array($product_id)) {
        $query = new WP_Query([
            'post_type'      => 'product',
            'posts_per_page' => -1,
            'post__in'       => $product_id,
            'meta_query'     => [
                [
                    'key'   => '_tbc_wc_is_event',
                    'value' => 'yes',
                ]
            ]
        ]);

        $products   = $query->have_posts() ? $query->posts : [];
        $all_events = [];

        foreach ($products as $product_post) {
            $product = wc_get_product($product_post->ID);
            if (!$product) continue;

            $product_events = tbc_wc_get_events($product_post->ID, $options);

            foreach ($product_events as $event) {
                $all_events[] = array_merge($event, [
                    'product_id' => $product_post->ID,
                    'product'    => $product
                ]);
            }
        }

        usort($all_events, fn($a,$b) => strtotime($a['start']) - strtotime($b['start']));
        if (!empty($options['limit'])) $all_events = array_slice($all_events, 0, $options['limit']);
        return $all_events;
    }

    // All products
    if ($product_id === null) {
        $query = new WP_Query([
            'post_type'      => 'product',
            'posts_per_page' => -1,
            'meta_query'     => [
                [
                    'key'   => '_tbc_wc_is_event',
                    'value' => 'yes',
                ]
            ]
        ]);

        $products   = $query->have_posts() ? $query->posts : [];
        $all_events = [];

        foreach ($products as $product_post) {
            $product = wc_get_product($product_post->ID);
            if (!$product) continue;

            $product_events = tbc_wc_get_events($product_post->ID, $options);

            foreach ($product_events as $event) {
                $all_events[] = array_merge($event, [
                    'product_id' => $product_post->ID,
                    'product'    => $product
                ]);
            }
        }

        usort($all_events, fn($a,$b) => strtotime($a['start']) - strtotime($b['start']));
        if (!empty($options['limit'])) $all_events = array_slice($all_events, 0, $options['limit']);
        return $all_events;
    }

    // Single product - Returns complete event objects
    $settings        = tbc_wc_get_event_settings($product_id);
    $dates           = [];
    $main_start_date = $settings['dates']['start_date'];
    $main_end_date   = $settings['dates']['end_date'];
    $recurring       = $settings['recurring'];
    $recurring_type  = $recurring['type'] ?? 'single';
    
    $settings_data = [
        'start_time'     => $settings['dates']['start_time'] ?? '',
        'end_time'       => $settings['dates']['end_time'] ?? '',
        'business_name'  => $settings['location']['business_name'] ?? '',
        'location'       => $settings['location']['address'] ?? '',
        'map_enabled'    => !empty($settings['location']['map_enabled']),
        'excerpt'        => $settings['excerpt'] ?? '',
        'recurring_type' => $recurring_type
    ];

    // Main Date
    if (!empty($main_start_date) && tbc_wc_date_meets_filter($main_start_date, $options)) {
        $status = _tbc_wc_calculate_event_status($product_id, $main_start_date, $settings);
        if ($status !== 'hidden') {
            $dates[] = array_merge([
                'start'        => $main_start_date,
                'end'          => $main_end_date ?: $main_start_date,
                'status'       => $status,
                'rsvp_enabled' => !empty($settings['rsvp']['enabled'])
            ], $settings_data);
        }
    }

    // Individual Recurring Dates
    if ($recurring_type === 'individual' && !empty($recurring['individual_dates'])) {
        foreach ($recurring['individual_dates'] as $date_pair) {
            if (empty($date_pair['start'])) continue;

            if (tbc_wc_date_meets_filter($date_pair['start'], $options)) {
                $status = _tbc_wc_calculate_event_status($product_id, $date_pair['start'], $settings);
                if ($status !== 'hidden') {
                    $dates[] = array_merge([
                        'start'        => $date_pair['start'],
                        'end'          => $date_pair['end'] ?: $date_pair['start'],
                        'status'       => $status,
                        'rsvp_enabled' => isset($date_pair['rsvp_enabled'])
                            ? $date_pair['rsvp_enabled']
                            : !empty($settings['rsvp']['enabled'])
                    ], $settings_data);
                }
            }
        }
    }

    // Interval Recurrence
    if ($recurring_type === 'interval' && !empty($recurring['interval'])) {
        $interval_dates = tbc_wc_generate_interval_dates(
            $recurring['interval'],
            $options['start_date'],
            $options['end_date'],
            $main_start_date
        );

        foreach ($interval_dates as $date) {
            if (!tbc_wc_date_meets_filter($date, $options)) continue;
            $status = _tbc_wc_calculate_event_status($product_id, $date, $settings);
            if ($status === 'hidden') continue;

            $dates[] = array_merge([
                'start'        => $date,
                'end'          => $date,
                'status'       => $status,
                'rsvp_enabled' => !empty($settings['rsvp']['enabled'])
            ], $settings_data);
        }
    }

    usort($dates, fn($a,$b) => strtotime($a['start']) - strtotime($b['start']));
    if (!empty($options['limit'])) $dates = array_slice($dates, 0, $options['limit']);

    return $dates;
}

/**
 * Check if a date meets the filter criteria
 * 
 * @param string $date Date to check
 * @param array $options Filter options
 * @return bool True if date meets filter
 */
function tbc_wc_date_meets_filter($date, $options) {
    if ($date < $options['start_date'] || $date > $options['end_date']) {
        return false;
    }
    
    if (!empty($options['month_filter'])) {
        $date_month = date('Y-m', strtotime($date));
        if ($date_month !== $options['month_filter']) {
            return false;
        }
    }
    
    return true;
}

/**
 * Get historical event dates from order meta
 * 
 * Returns dates that actually occurred (have orders), even if removed from product settings.
 * 
 * @param int|array|null $product_id Single product ID, array of IDs, or null for all products
 * @param array $options Filter options
 * @return array Array of date pairs from order meta
 */
function tbc_wc_get_historical_dates($product_id = null, $options = []) {
    global $wpdb;
    
    $options = wp_parse_args($options, [
        'start_date' => null,
        'end_date' => null,
        'limit' => null
    ]);
    
    if (is_array($product_id)) {
        if (empty($product_id)) {
            return [];
        }
        
        $placeholders = implode(',', array_fill(0, count($product_id), '%d'));
        $product_filter = "AND meta_product.meta_value IN ($placeholders)";
        $params = $product_id;
    } elseif ($product_id === null) {
        $product_filter = '';
        $params = [];
    } else {
        $product_filter = 'AND meta_product.meta_value = %d';
        $params = [$product_id];
    }
    
    $query = "
        SELECT 
            meta_date.meta_value as event_date,
            MAX(meta_end.meta_value) as event_end_date,
            meta_product.meta_value as product_id
        FROM {$wpdb->prefix}woocommerce_order_items as order_items
        JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_product
            ON order_items.order_item_id = meta_product.order_item_id
        JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_date
            ON order_items.order_item_id = meta_date.order_item_id
        LEFT JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_end
            ON order_items.order_item_id = meta_end.order_item_id
            AND meta_end.meta_key = '_tbc_wc_event_end_date'
        WHERE meta_product.meta_key = '_product_id'
        {$product_filter}
        AND meta_date.meta_key = '_tbc_wc_event_start_date'
    ";
    
    if (!empty($options['start_date'])) {
        $query .= " AND meta_date.meta_value >= %s";
        $params[] = $options['start_date'];
    }
    
    if (!empty($options['end_date'])) {
        $query .= " AND meta_date.meta_value <= %s";
        $params[] = $options['end_date'];
    }
    
    $query .= " GROUP BY meta_product.meta_value, meta_date.meta_value";
    $query .= " ORDER BY meta_date.meta_value DESC";
    
    if (!empty($options['limit'])) {
        $query .= " LIMIT " . intval($options['limit']);
    }
    
    if (!empty($params)) {
        $results = $wpdb->get_results($wpdb->prepare($query, $params), ARRAY_A);
    } else {
        $results = $wpdb->get_results($query, ARRAY_A);
    }
    
    $dates = [];
    
    foreach ($results as $row) {
        $event_date = $row['event_date'];
        $event_end_date = $row['event_end_date'] ?: $event_date;
        $prod_id = intval($row['product_id']);
        
        $date_entry = [
            'start' => $event_date,
            'end' => $event_end_date,
            'source' => 'order_meta',
            'status' => 'closed',
            'rsvp_enabled' => false
        ];
        
        if (is_array($product_id) || $product_id === null) {
            $product = wc_get_product($prod_id);
            $date_entry['product_id'] = $prod_id;
            $date_entry['product'] = $product;
        }
        
        $dates[] = $date_entry;
    }
    
    return $dates;
}

/**
 * =============================================================================
 * EVENT STATUS CALCULATION - INTERNAL USE ONLY
 * =============================================================================
 */

/**
 * Get the quantity of spots user has booked for this specific event date
 * 
 * @param int $user_id User ID
 * @param int $product_id Product ID
 * @param string $event_date Event date (Y-m-d format)
 * @return int Total quantity booked (0 if none)
 */
function tbc_wc_get_user_booked_quantity($user_id, $product_id, $event_date) {
    if (!$user_id || !$product_id || !$event_date) {
        return 0;
    }

    global $wpdb;

    $query = "
        SELECT COALESCE(SUM(CAST(oim_qty.meta_value AS UNSIGNED)), 0) as total_quantity
        FROM {$wpdb->prefix}woocommerce_order_items oi
        INNER JOIN {$wpdb->prefix}woocommerce_order_itemmeta oim_product 
            ON oi.order_item_id = oim_product.order_item_id 
            AND oim_product.meta_key = '_product_id'
        INNER JOIN {$wpdb->prefix}woocommerce_order_itemmeta oim_date 
            ON oi.order_item_id = oim_date.order_item_id 
            AND oim_date.meta_key = '_tbc_wc_event_start_date'
        INNER JOIN {$wpdb->prefix}woocommerce_order_itemmeta oim_qty 
            ON oi.order_item_id = oim_qty.order_item_id 
            AND oim_qty.meta_key = '_qty'
        INNER JOIN {$wpdb->prefix}wc_orders o
            ON oi.order_id = o.id
        WHERE o.type = 'shop_order'
            AND o.status IN ('wc-completed', 'wc-processing')
            AND o.customer_id = %d
            AND oim_product.meta_value = %d
            AND oim_date.meta_value = %s
    ";

    $quantity = (int) $wpdb->get_var($wpdb->prepare($query, $user_id, $product_id, $event_date));

    return $quantity;
}

/**
 * Calculate event status (INTERNAL USE ONLY)
 * 
 * @internal
 * @param int $product_id Product ID
 * @param string $event_date Event date
 * @param array $settings Pre-fetched settings (REQUIRED)
 * @return string 'open', 'closed', 'hidden', or 'booked'
 */
function _tbc_wc_calculate_event_status($product_id, $event_date, $settings) {
    
    // Check if current user has already booked this event
    if (is_user_logged_in() && !empty($event_date)) {
        $user_id = get_current_user_id();
        
        $booked_quantity = tbc_wc_get_user_booked_quantity($user_id, $product_id, $event_date);
        if ($booked_quantity > 0) {
            return 'booked';
        }
    }
    
    $is_hidden = false;
    $is_manually_closed = false;
    
    // Check main date
    if ($event_date === $settings['dates']['start_date']) {
        $is_hidden = !empty($settings['dates']['is_hidden']);
        $is_manually_closed = !empty($settings['dates']['is_closed']);
    }
    
    // Check individual dates
    if (!$is_hidden && !$is_manually_closed && !empty($settings['recurring']['individual_dates'])) {
        foreach ($settings['recurring']['individual_dates'] as $date_pair) {
            if ($date_pair['start'] === $event_date) {
                $is_hidden = !empty($date_pair['is_hidden']);
                $is_manually_closed = !empty($date_pair['is_closed']);
                break;
            }
        }
    }
    
    // Check interval exceptions
    if (!$is_hidden && !$is_manually_closed && $settings['recurring']['type'] === 'interval' && !empty($settings['recurring']['interval']['exceptions'])) {
        foreach ($settings['recurring']['interval']['exceptions'] as $exception) {
            if ($exception['date'] === $event_date) {
                $is_hidden = !empty($exception['is_hidden']);
                $is_manually_closed = !empty($exception['is_closed']);
                break;
            }
        }
    }
    
    if ($is_hidden) {
        return 'hidden';
    }
    
    if ($is_manually_closed) {
        return 'closed';
    }
    
    if (function_exists('tbc_wc_is_rsvp_deadline_passed') && 
        function_exists('tbc_wc_is_rsvp_enabled') &&
        tbc_wc_is_rsvp_enabled($product_id, $event_date) &&
        tbc_wc_is_rsvp_deadline_passed($product_id, $event_date)) {
        return 'closed';
    }
    
    if (function_exists('tbc_wc_is_goal_reached') && 
        tbc_wc_is_goal_reached($product_id, $event_date)) {
        return 'closed';
    }
    
    if (current_user_can('church_user') && has_term('nouser', 'product_cat', $product_id)) {
        return 'closed';
    }
    
    return 'open';
}

/**
 * =============================================================================
 * DATE VALIDATION FUNCTIONS
 * =============================================================================
 */

/**
 * Validate selected_date parameter and redirect if invalid
 */
function tbc_wc_validate_selected_date() {
    if (!is_product() || !isset($_GET['selected_date'])) {
        return;
    }

    global $post;
    $product_id    = $post->ID;
    $selected_date = sanitize_text_field($_GET['selected_date']);

    $valid_dates = tbc_wc_get_events($product_id, [
        'start_date' => $selected_date,
        'end_date'   => $selected_date,
    ]);

    $matching_event = null;
    foreach ($valid_dates as $event) {
        if ($event['start'] === $selected_date) {
            $matching_event = $event;
            break;
        }
    }

    if (!$matching_event) {
        wp_redirect(get_permalink($product_id));
        exit;
    }

    $GLOBALS['tbc_wc_current_event'] = $matching_event;
}
add_action('template_redirect', 'tbc_wc_validate_selected_date', 5);

/**
 * =============================================================================
 * DATE AND TIME PROCESSING FUNCTIONS
 * =============================================================================
 */

/**
 * Creates a formatted time/date string for display
 *
 * @param string $start_date Event start date (YYYY-MM-DD format)
 * @param string $end_date Event end date (YYYY-MM-DD format)
 * @param array $meta Additional metadata containing time information
 * @return string Formatted date and time string for display
 */
function tbc_wc_get_formatted_time($start_date, $end_date, $meta) {
    if (empty($start_date)) return '';

    $start_datetime = new DateTime($start_date);
    $end_datetime   = $end_date ? new DateTime($end_date) : clone $start_datetime;

    if (!empty($meta['start_time'])) {
        $start_datetime->modify($meta['start_time']);
    }
    if (!empty($meta['end_time'])) {
        $end_datetime->modify($meta['end_time']);
    }

    $start_str = $start_datetime->format('F jS');
    $end_str   = $end_datetime->format('F jS');

    // Same day event
    if ($start_datetime->format('Y-m-d') === $end_datetime->format('Y-m-d')) {
        if (empty($meta['start_time'])) {
            return $start_str;
        }
        
        $time_range = $start_datetime->format('g:ia');
        if (!empty($meta['end_time'])) {
            $time_range .= ' - ' . $end_datetime->format('g:ia');
        }
        return $start_str . ' @ ' . $time_range;
    }

    // Multi-day event
    $output = $start_str;
    if (!empty($meta['start_time'])) {
        $output .= ' @ ' . $start_datetime->format('g:ia');
    }
    $output .= ' - ' . $end_str;
    if (!empty($meta['end_time'])) {
        $output .= ' @ ' . $end_datetime->format('g:ia');
    }

    return $output;
}

/**
 * =============================================================================
 * RECURRING DATE GENERATION - INTERVAL PATTERN SUPPORT
 * =============================================================================
 */

/**
 * Generate dates based on interval pattern settings
 * 
 * @param array $settings Interval pattern settings
 * @param string $month_start First day of projection period
 * @param string $month_end Last day of projection period
 * @param string $original_start Original event start date
 * @return array Generated dates within the specified period
 */
function tbc_wc_generate_interval_dates($settings, $month_start, $month_end, $original_start) {
    if (empty($settings['frequency']) || empty($settings['count'])) {
        return [];
    }

    if (!defined('DAY_IN_SECONDS')) {
        define('DAY_IN_SECONDS', 86400);
    }
    if (!defined('WEEK_IN_SECONDS')) {
        define('WEEK_IN_SECONDS', 604800);
    }
  
    $pattern_start = !empty($settings['pattern_start']) ? $settings['pattern_start'] : $original_start;
    $occurrence_limit = isset($settings['end']['type']) && $settings['end']['type'] === 'after' 
        ? (int)$settings['end']['count'] : PHP_INT_MAX;
    
    $start_ts = strtotime($original_start);
    $end_ts = strtotime($month_end);
    $current_ts = strtotime($pattern_start);

    $dates = [];
    $occurrence_count = 0;

    while ($current_ts <= $end_ts && $occurrence_count < $occurrence_limit) {
        $current_date = date('Y-m-d', $current_ts);

        $matches = false;
        switch ($settings['frequency']) {
            case 'daily':
                $days_diff = floor(($current_ts - $start_ts) / DAY_IN_SECONDS);
                $matches = ($days_diff % $settings['count'] === 0);
                $increment = '+1 day';
                break;

            case 'weekly':
                $day_of_week = strtolower(date('l', $current_ts));
                $week_diff = floor(($current_ts - $start_ts) / WEEK_IN_SECONDS);
                $matches = (in_array($day_of_week, $settings['weekly_days'], true) && 
                          ($week_diff % $settings['count'] === 0));
                $increment = '+1 day';
                break;

            case 'monthly':
                $current_month = (int)date('n', $current_ts);
                $current_year = (int)date('Y', $current_ts);
                $start_month = (int)date('n', $start_ts);
                $start_year = (int)date('Y', $start_ts);
                $months_diff = (($current_year - $start_year) * 12) + ($current_month - $start_month);

                if ($months_diff % $settings['count'] === 0) {
                    if ($settings['monthly']['type'] === 'day') {
                        $matches = ((int)date('j', $current_ts) === (int)$settings['monthly']['day']);
                    } else {
                        $current_day = strtolower(date('l', $current_ts));
                        if ($current_day === $settings['monthly']['weekday']) {
                            $day_of_month = (int)date('j', $current_ts);
                            
                            if ($settings['monthly']['week'] === 'last') {
                                $last_occurrence = strtotime('last ' . $settings['monthly']['weekday'] . ' of ' . 
                                    date('F Y', $current_ts));
                                $matches = (date('Y-m-d', $current_ts) === date('Y-m-d', $last_occurrence));
                            } else {
                                $week_number = (int)$settings['monthly']['week'];
                                $first_of_month = strtotime(date('Y-m-01', $current_ts));
                                $first_weekday = strtotime($settings['monthly']['weekday'], $first_of_month);
                                if ($first_weekday < $first_of_month) {
                                    $first_weekday = strtotime('+1 week', $first_weekday);
                                }
                                $target_date = strtotime('+' . ($week_number - 1) . ' weeks', $first_weekday);
                                $matches = (date('Y-m-d', $current_ts) === date('Y-m-d', $target_date));
                            }
                        }
                    }
                }
                $increment = '+1 day';
                break;
        }

        if ($matches && $current_date >= $month_start) {
            $dates[] = $current_date;
            $occurrence_count++;
        }

        $current_ts = strtotime($increment, $current_ts);
    }

    return $dates;
}

/**
 * =============================================================================
 * URL GENERATION HELPER
 * =============================================================================
 */

/**
 * Generate event URL with proper date parameters
 *
 * @param int $product_id Product ID
 * @param string $start_date Event start date (Y-m-d format)
 * @return string Complete event URL with date parameter
 */
function tbc_wc_get_event_url($product_id, $start_date) {
    return add_query_arg('selected_date', $start_date, get_permalink($product_id));
}