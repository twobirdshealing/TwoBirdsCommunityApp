<?php
/**
 * TBC WooCommerce Calendar - REST API
 * 
 * Endpoints for mobile app and external integrations.
 * Returns complete event data with all server-side logic applied.
 * 
 * Endpoints:
 *   GET /wp-json/tbc-wc/v1/events          - Main calendar / series view
 *   GET /wp-json/tbc-wc/v1/events/featured - Featured events widget
 *   GET /wp-json/tbc-wc/v1/user/booked     - User's upcoming booked events
 * 
 * @package TBC_WC_Calendar
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * =============================================================================
 * ROUTE REGISTRATION
 * =============================================================================
 */

add_action('rest_api_init', 'tbc_wc_register_api_routes');

function tbc_wc_register_api_routes() {
    
    // GET /wp-json/tbc-wc/v1/events
    register_rest_route('tbc-wc/v1', '/events', [
        'methods'             => 'GET',
        'callback'            => 'tbc_wc_api_get_events',
        'permission_callback' => '__return_true',
        'args'                => [
            'product_id' => [
                'type'              => 'integer',
                'sanitize_callback' => 'absint',
            ],
            'month' => [
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
                'validate_callback' => function($value) {
                    return empty($value) || preg_match('/^\d{4}-\d{2}$/', $value);
                },
            ],
            'limit' => [
                'type'              => 'integer',
                'default'           => 50,
                'sanitize_callback' => 'absint',
            ],
            'category' => [
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ],
        ],
    ]);
    
    // GET /wp-json/tbc-wc/v1/events/featured
    register_rest_route('tbc-wc/v1', '/events/featured', [
        'methods'             => 'GET',
        'callback'            => 'tbc_wc_api_get_featured_events',
        'permission_callback' => '__return_true',
        'args'                => [
            'limit' => [
                'type'              => 'integer',
                'default'           => 3,
                'sanitize_callback' => 'absint',
            ],
        ],
    ]);
    
    // GET /wp-json/tbc-wc/v1/user/waitlist
    register_rest_route('tbc-wc/v1', '/user/waitlist', [
        'methods'             => 'GET',
        'callback'            => 'tbc_wc_api_get_user_waitlist',
        'permission_callback' => 'is_user_logged_in',
    ]);
    
    // POST /wp-json/tbc-wc/v1/waitlist/join
    register_rest_route('tbc-wc/v1', '/waitlist/join', [
        'methods'             => 'POST',
        'callback'            => 'tbc_wc_api_join_waitlist',
        'permission_callback' => 'is_user_logged_in',
        'args'                => [
            'product_id' => [
                'required'          => true,
                'type'              => 'integer',
                'sanitize_callback' => 'absint',
            ],
            'event_date' => [
                'required'          => true,
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
                'validate_callback' => function($value) {
                    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value);
                },
            ],
        ],
    ]);
    
    // GET /wp-json/tbc-wc/v1/user/booked
    register_rest_route('tbc-wc/v1', '/user/booked', [
        'methods'             => 'GET',
        'callback'            => 'tbc_wc_api_get_user_booked',
        'permission_callback' => 'is_user_logged_in',
        'args'                => [
            'limit' => [
                'type'              => 'integer',
                'default'           => 3,
                'sanitize_callback' => 'absint',
            ],
        ],
    ]);

    // POST /wp-json/tbc-wc/v1/waitlist/leave
    register_rest_route('tbc-wc/v1', '/waitlist/leave', [
        'methods'             => 'POST',
        'callback'            => 'tbc_wc_api_leave_waitlist',
        'permission_callback' => 'is_user_logged_in',
        'args'                => [
            'product_id' => [
                'required'          => true,
                'type'              => 'integer',
                'sanitize_callback' => 'absint',
            ],
            'event_date' => [
                'required'          => true,
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
                'validate_callback' => function($value) {
                    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value);
                },
            ],
        ],
    ]);
}

/**
 * =============================================================================
 * MAIN EVENTS ENDPOINT
 * =============================================================================
 */

/**
 * Handle GET /tbc-wc/v1/events
 * 
 * @param WP_REST_Request $request
 * @return WP_REST_Response
 */
function tbc_wc_api_get_events(WP_REST_Request $request) {
    $product_id = $request->get_param('product_id');
    $month      = $request->get_param('month');
    $limit      = $request->get_param('limit');
    $category   = $request->get_param('category');
    
    $current_date = current_time('Y-m-d');
    $user_id      = get_current_user_id();
    
    // Build query options
    $options = [
        'limit' => $limit,
    ];
    
    // Month filter
    if (!empty($month)) {
        $options['month_filter'] = $month;
        $options['start_date']   = date('Y-m-01', strtotime($month . '-01'));
        $options['end_date']     = date('Y-m-t', strtotime($month . '-01'));
        
        // If current month, start from today
        if (date('Y-m', strtotime($current_date)) === $month) {
            $options['start_date'] = $current_date;
        }
    } else {
        // Default: today through +2 months
        $options['start_date'] = $current_date;
        $options['end_date']   = date('Y-m-t', strtotime('+2 months'));
    }
    
    // Product filter (series view)
    $query_product_id = !empty($product_id) ? $product_id : null;
    
    // Category filter - get product IDs in category
    if (!empty($category) && empty($product_id)) {
        $category_product_ids = tbc_wc_api_get_products_in_category($category);
        if (empty($category_product_ids)) {
            return new WP_REST_Response([
                'events' => [],
                'meta'   => [
                    'total'              => 0,
                    'user_authenticated' => $user_id > 0,
                    'filters'            => [
                        'category' => $category,
                        'month'    => $month,
                    ],
                ],
            ], 200);
        }
        $query_product_id = $category_product_ids;
    }
    
    // Get events using unified function
    $events = tbc_wc_get_events($query_product_id, $options);
    
    // For single product queries, events don't have product/product_id - add them
    if (!empty($product_id) && is_numeric($product_id)) {
        $product = wc_get_product($product_id);
        if ($product) {
            foreach ($events as &$event) {
                $event['product_id'] = $product_id;
                $event['product']    = $product;
            }
            unset($event); // Break reference
        }
    }
    
    // Transform to API response format
    $response_events = [];
    foreach ($events as $event) {
        $formatted = tbc_wc_api_format_event($event, $user_id);
        if ($formatted !== null) {
            $response_events[] = $formatted;
        }
    }
    
    return new WP_REST_Response([
        'events' => $response_events,
        'meta'   => [
            'total'              => count($response_events),
            'user_authenticated' => $user_id > 0,
            'filters'            => [
                'product_id' => $product_id,
                'category'   => $category,
                'month'      => $month,
                'limit'      => $limit,
            ],
        ],
    ], 200);
}

/**
 * =============================================================================
 * FEATURED EVENTS ENDPOINT
 * =============================================================================
 */

/**
 * Handle GET /tbc-wc/v1/events/featured
 * 
 * Returns one open event per featured product, sorted by date.
 * 
 * @param WP_REST_Request $request
 * @return WP_REST_Response
 */
function tbc_wc_api_get_featured_events(WP_REST_Request $request) {
    $limit        = $request->get_param('limit');
    $current_date = current_time('Y-m-d');
    $user_id      = get_current_user_id();
    
    // Query featured products
    $args = [
        'post_type'      => 'product',
        'posts_per_page' => -1,
        'tax_query'      => [
            [
                'taxonomy' => 'product_visibility',
                'field'    => 'name',
                'terms'    => 'featured',
            ],
        ],
    ];
    
    $featured_products = new WP_Query($args);
    $upcoming_events   = [];
    
    if ($featured_products->have_posts()) {
        while ($featured_products->have_posts()) {
            $featured_products->the_post();
            
            $product_id = get_the_ID();
            
            if (!tbc_wc_is_event_product($product_id)) {
                continue;
            }
            
            // Get upcoming events for this product
            $next_dates = tbc_wc_get_events($product_id, [
                'start_date' => $current_date,
                'end_date'   => date('Y-m-t', strtotime('+2 months')),
                'limit'      => 5,
            ]);
            
            if (empty($next_dates)) {
                continue;
            }
            
            // Find first OPEN event (skip closed/booked/waitlist)
            $available_event = null;
            foreach ($next_dates as $event) {
                if ($event['status'] === 'open') {
                    $available_event = $event;
                    break;
                }
            }
            
            if (!$available_event) {
                continue;
            }
            
            // Add product data to event
            $product = wc_get_product($product_id);
            $available_event['product_id'] = $product_id;
            $available_event['product']    = $product;
            
            $upcoming_events[] = [
                'event'          => $available_event,
                'sort_timestamp' => strtotime($available_event['start']),
            ];
        }
    }
    
    wp_reset_postdata();
    
    // Sort by date and limit
    usort($upcoming_events, function($a, $b) {
        return $a['sort_timestamp'] - $b['sort_timestamp'];
    });
    $upcoming_events = array_slice($upcoming_events, 0, $limit);
    
    // Transform to API response format
    $response_events = [];
    foreach ($upcoming_events as $item) {
        $formatted = tbc_wc_api_format_event($item['event'], $user_id);
        if ($formatted !== null) {
            $response_events[] = $formatted;
        }
    }
    
    return new WP_REST_Response([
        'events' => $response_events,
        'meta'   => [
            'total'              => count($response_events),
            'user_authenticated' => $user_id > 0,
        ],
    ], 200);
}

/**
 * =============================================================================
 * EVENT FORMATTING
 * =============================================================================
 */

/**
 * Format single event for API response
 * 
 * Applies all server-side logic (progress threshold, RSVP, user status).
 * 
 * @param array $event Event data from tbc_wc_get_events()
 * @param int $user_id Current user ID (0 if not logged in)
 * @return array|null Formatted event for JSON response, or null if invalid
 */
function tbc_wc_api_format_event($event, $user_id = 0) {
    // Defensive check - ensure we have product data
    if (empty($event['product']) && empty($event['product_id'])) {
        return null;
    }
    
    $product    = $event['product'] ?? wc_get_product($event['product_id']);
    $product_id = $event['product_id'] ?? $product->get_id();
    $start_date = $event['start'];
    
    // Skip if product doesn't exist
    if (!$product) {
        return null;
    }
    
    // Get categories
    $categories = wp_get_post_terms($product_id, 'product_cat', ['fields' => 'slugs']);
    
    // Get calendar color from settings
    $settings = tbc_wc_get_event_settings($product_id);
    $calendar_color = $settings['calendar_color'] ?? '#28a745';
    
    // Build base response
    $response = [
        'product_id'     => $product_id,
        'title'          => $product->get_name(),
        'start'          => $start_date,
        'end'            => $event['end'],
        'start_time'     => $event['start_time'] ?: null,
        'end_time'       => $event['end_time'] ?: null,
        'status'         => $event['status'],
        'location'       => [
            'business_name' => $event['business_name'] ?: null,
            'address'       => $event['location'] ?: null,
        ],
        'excerpt'        => $event['excerpt'] ?: null,
        'price'          => $product->get_price_html(),
        'price_raw'      => (float) $product->get_price(),
        'deposit'        => ('yes' === get_post_meta($product_id, '_enable_non_refundable_deposit', true))
                            ? (float) get_post_meta($product_id, '_non_refundable_deposit', true)
                            : null,
        'image'          => tbc_wc_api_get_product_image($product_id),
        'categories'     => $categories ?: [],
        'url'            => tbc_wc_get_event_url($product_id, $start_date),
        'recurring_type' => $event['recurring_type'] ?? 'single',
        'calendar_color' => $calendar_color,
        'rsvp'           => tbc_wc_api_get_rsvp_data($product_id, $start_date),
        'progress'       => tbc_wc_api_get_progress_data($product_id, $start_date),
        'user'           => null,
    ];
    
    // Add user-specific data if authenticated
    if ($user_id > 0) {
        $booked_qty = tbc_wc_get_user_booked_quantity($user_id, $product_id, $start_date);
        $is_on_waitlist = class_exists('TBC_WC_Waitlist') 
            ? TBC_WC_Waitlist::is_user_on_waitlist($product_id, $start_date, $user_id)
            : false;
        
        $response['user'] = [
            'is_booked'       => $booked_qty > 0,
            'booked_quantity' => $booked_qty > 0 ? $booked_qty : null,
            'is_on_waitlist'  => $is_on_waitlist,
        ];
    }
    
    return $response;
}

/**
 * =============================================================================
 * DATA HELPERS
 * =============================================================================
 */

/**
 * Get RSVP data for API response
 * 
 * @param int $product_id Product ID
 * @param string $event_date Event date
 * @return array|null RSVP data or null if not enabled
 */
function tbc_wc_api_get_rsvp_data($product_id, $event_date) {
    if (!function_exists('tbc_wc_get_rsvp_information')) {
        return null;
    }
    
    $rsvp_info = tbc_wc_get_rsvp_information($product_id, $event_date);
    
    if (empty($rsvp_info)) {
        return null;
    }
    
    return [
        'enabled'            => true,
        'deadline'           => $rsvp_info['deadline'],
        'formatted_deadline' => $rsvp_info['formatted_deadline'],
        'days_remaining'     => $rsvp_info['days_remaining'],
        'deadline_passed'    => $rsvp_info['deadline_passed'],
        'show_countdown'     => $rsvp_info['show_countdown'],
    ];
}

/**
 * Get progress data for API response
 * 
 * Applies threshold logic server-side. Returns null if progress shouldn't show.
 * 
 * @param int $product_id Product ID
 * @param string $event_date Event date
 * @return array|null Progress data or null if not enabled/threshold not met
 */
function tbc_wc_api_get_progress_data($product_id, $event_date) {
    if (!function_exists('tbc_wc_is_progress_enabled') || 
        !function_exists('tbc_wc_get_progress_settings')) {
        return null;
    }
    
    // Check if progress is enabled for this event
    if (!tbc_wc_is_progress_enabled($product_id, $event_date)) {
        return null;
    }
    
    $settings = tbc_wc_get_progress_settings($product_id, $event_date);
    
    if (!$settings['enabled'] || $settings['goal'] <= 0) {
        return null;
    }
    
    // Get current value based on goal type
    $current = 0;
    switch ($settings['goal_type']) {
        case 'revenue':
            $current = tbc_wc_get_revenue($product_id, $event_date);
            break;
        case 'subscribers':
            $current = tbc_wc_get_subscriber_count($product_id, $event_date);
            break;
        case 'sales':
        default:
            $current = tbc_wc_get_sale_count($product_id, $event_date);
            break;
    }
    
    // Apply threshold logic (only for sales goal type)
    $inventory_threshold = intval($settings['inventory_threshold']);
    if ($inventory_threshold > 0 && $settings['goal_type'] === 'sales') {
        $remaining = $settings['goal'] - $current;
        if ($remaining > $inventory_threshold) {
            // Threshold not met - don't show progress
            return null;
        }
    }
    
    // Calculate percentage
    $percentage = ($current / $settings['goal']) * 100;
    $percentage = max(0, min(100, round($percentage)));
    
    // Process above_text placeholder
    $above_text = str_replace('{month}', date('F'), $settings['above_text']);
    
    return [
        'goal_type'       => $settings['goal_type'],
        'goal'            => (int) $settings['goal'],
        'current'         => $settings['goal_type'] === 'revenue' ? (float) $current : (int) $current,
        'percentage'      => (int) $percentage,
        'show_percentage' => (bool) $settings['show_percentage'],
        'above_text'      => $above_text ?: null,
    ];
}

/**
 * Get product image URL
 * 
 * @param int $product_id Product ID
 * @return string|null Image URL or null
 */
function tbc_wc_api_get_product_image($product_id) {
    $image_id = get_post_thumbnail_id($product_id);
    
    if (!$image_id) {
        return null;
    }
    
    $image_url = wp_get_attachment_image_url($image_id, 'large');
    
    return $image_url ?: null;
}

/**
 * Get product IDs in a category
 * 
 * @param string $category_slug Category slug
 * @return array Product IDs
 */
function tbc_wc_api_get_products_in_category($category_slug) {
    $args = [
        'post_type'      => 'product',
        'posts_per_page' => -1,
        'fields'         => 'ids',
        'tax_query'      => [
            [
                'taxonomy' => 'product_cat',
                'field'    => 'slug',
                'terms'    => $category_slug,
            ],
        ],
        'meta_query'     => [
            [
                'key'   => '_tbc_wc_is_event',
                'value' => 'yes',
            ],
        ],
    ];
    
    $query = new WP_Query($args);
    
    return $query->posts ?: [];
}

/**
 * =============================================================================
 * USER BOOKED EVENTS ENDPOINT
 * =============================================================================
 */

/**
 * Handle GET /tbc-wc/v1/user/booked
 *
 * Returns upcoming events the current user has booked (purchased).
 * Uses a single DB query to find all booked product_id + event_date pairs,
 * then formats each using the standard event formatter.
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response
 */
function tbc_wc_api_get_user_booked(WP_REST_Request $request) {
    global $wpdb;

    $user_id = get_current_user_id();
    $limit   = $request->get_param('limit');
    $today   = current_time('Y-m-d');

    // Single query: get all upcoming booked product_id + event_date pairs
    $query = "
        SELECT
            oim_product.meta_value AS product_id,
            oim_date.meta_value AS event_date
        FROM {$wpdb->prefix}woocommerce_order_items oi
        INNER JOIN {$wpdb->prefix}woocommerce_order_itemmeta oim_product
            ON oi.order_item_id = oim_product.order_item_id
            AND oim_product.meta_key = '_product_id'
        INNER JOIN {$wpdb->prefix}woocommerce_order_itemmeta oim_date
            ON oi.order_item_id = oim_date.order_item_id
            AND oim_date.meta_key = '_tbc_wc_event_start_date'
        INNER JOIN {$wpdb->prefix}wc_orders o
            ON oi.order_id = o.id
        WHERE o.type = 'shop_order'
            AND o.status IN ('wc-completed', 'wc-processing')
            AND o.customer_id = %d
            AND oim_date.meta_value >= %s
        GROUP BY oim_product.meta_value, oim_date.meta_value
        ORDER BY oim_date.meta_value ASC
    ";

    $rows = $wpdb->get_results($wpdb->prepare($query, $user_id, $today));

    if (empty($rows)) {
        return new WP_REST_Response([
            'events' => [],
            'meta'   => [
                'total'              => 0,
                'user_authenticated' => true,
            ],
        ], 200);
    }

    // Format each booked event using the standard formatter
    $response_events = [];

    foreach ($rows as $row) {
        $product_id = (int) $row->product_id;
        $event_date = $row->event_date;

        $product = wc_get_product($product_id);
        if (!$product || !tbc_wc_is_event_product($product_id)) {
            continue;
        }

        // Get the full event data for this specific date
        $events = tbc_wc_get_events($product_id, [
            'start_date' => $event_date,
            'end_date'   => $event_date,
        ]);

        if (empty($events)) {
            continue;
        }

        // Find the matching date
        $target_event = null;
        foreach ($events as $event) {
            if ($event['start'] === $event_date) {
                $target_event = $event;
                break;
            }
        }

        if (!$target_event) {
            continue;
        }

        // Add product data
        $target_event['product_id'] = $product_id;
        $target_event['product']    = $product;

        $formatted = tbc_wc_api_format_event($target_event, $user_id);
        if ($formatted !== null) {
            $response_events[] = $formatted;
        }

        // Stop once we have enough
        if (count($response_events) >= $limit) {
            break;
        }
    }

    return new WP_REST_Response([
        'events' => $response_events,
        'meta'   => [
            'total'              => count($response_events),
            'user_authenticated' => true,
        ],
    ], 200);
}

/**
 * =============================================================================
 * WAITLIST ENDPOINTS
 * =============================================================================
 */

/**
 * Handle GET /tbc-wc/v1/user/waitlist
 * 
 * Returns all waitlist entries for the current user.
 * 
 * @param WP_REST_Request $request
 * @return WP_REST_Response
 */
function tbc_wc_api_get_user_waitlist(WP_REST_Request $request) {
    global $wpdb;
    
    $user_id = get_current_user_id();
    $today   = current_time('Y-m-d');
    
    // Get all waitlist options
    $rows = $wpdb->get_results(
        "SELECT option_name, option_value FROM {$wpdb->options} WHERE option_name LIKE 'tbc_wc_waitlist_%'"
    );
    
    $items = [];
    
    foreach ($rows as $row) {
        // Extract product ID from option name
        if (!preg_match('/tbc_wc_waitlist_(\d+)$/', $row->option_name, $matches)) {
            continue;
        }
        
        $product_id = (int) $matches[1];
        $waitlist   = maybe_unserialize($row->option_value);
        
        if (!is_array($waitlist)) {
            continue;
        }
        
        foreach ($waitlist as $entry) {
            // Only include current user's entries
            if ((int) ($entry['user_id'] ?? 0) !== $user_id) {
                continue;
            }
            
            $start_date = $entry['event_date'] ?? '';
            
            // Skip past events
            if (!$start_date || $start_date < $today) {
                continue;
            }
            
            $end_date = $entry['event_end_date'] ?? $start_date;
            $product  = wc_get_product($product_id);
            
            if (!$product) {
                continue;
            }
            
            $items[] = [
                'product_id'  => $product_id,
                'title'       => $entry['product_title'] ?? $product->get_name(),
                'start'       => $start_date,
                'end'         => $end_date,
                'date_added'  => $entry['date_added'] ?? null,
                'url'         => tbc_wc_get_event_url($product_id, $start_date),
                'image'       => tbc_wc_api_get_product_image($product_id),
                'sort_timestamp' => strtotime($start_date),
            ];
        }
    }
    
    // Sort by event date
    usort($items, function($a, $b) {
        return $a['sort_timestamp'] - $b['sort_timestamp'];
    });
    
    // Remove sort_timestamp from response
    $items = array_map(function($item) {
        unset($item['sort_timestamp']);
        return $item;
    }, $items);
    
    return new WP_REST_Response([
        'waitlist' => $items,
        'meta'     => [
            'total' => count($items),
        ],
    ], 200);
}

/**
 * Handle POST /tbc-wc/v1/waitlist/join
 * 
 * Add current user to a waitlist.
 * 
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function tbc_wc_api_join_waitlist(WP_REST_Request $request) {
    if (!class_exists('TBC_WC_Waitlist')) {
        return new WP_Error(
            'tbc_wc_waitlist_unavailable',
            __('Waitlist functionality is not available.', 'tbc-wc-calendar'),
            ['status' => 500]
        );
    }
    
    $product_id = $request->get_param('product_id');
    $event_date = $request->get_param('event_date');
    $user_id    = get_current_user_id();
    
    // Validate product exists and is an event
    $product = wc_get_product($product_id);
    if (!$product) {
        return new WP_Error(
            'tbc_wc_invalid_product',
            __('Product not found.', 'tbc-wc-calendar'),
            ['status' => 404]
        );
    }
    
    if (!tbc_wc_is_event_product($product_id)) {
        return new WP_Error(
            'tbc_wc_not_event',
            __('This product is not an event.', 'tbc-wc-calendar'),
            ['status' => 400]
        );
    }
    
    // Check if event date is in the past
    if ($event_date < current_time('Y-m-d')) {
        return new WP_Error(
            'tbc_wc_past_event',
            __('Cannot join waitlist for past events.', 'tbc-wc-calendar'),
            ['status' => 400]
        );
    }
    
    // Check if already on waitlist
    if (TBC_WC_Waitlist::is_user_on_waitlist($product_id, $event_date, $user_id)) {
        return new WP_Error(
            'tbc_wc_already_on_waitlist',
            __('You are already on the waitlist for this event.', 'tbc-wc-calendar'),
            ['status' => 400]
        );
    }
    
    // Get end date for the event
    $event_end_date = $event_date;
    $events = tbc_wc_get_events($product_id, [
        'start_date' => $event_date,
        'end_date'   => $event_date,
    ]);
    
    foreach ($events as $event) {
        if ($event['start'] === $event_date) {
            $event_end_date = $event['end'];
            break;
        }
    }
    
    // Add to waitlist
    $result = TBC_WC_Waitlist::add_to_waitlist($product_id, $event_date, $user_id, $event_end_date);
    
    if (!$result) {
        return new WP_Error(
            'tbc_wc_waitlist_failed',
            __('Failed to join waitlist.', 'tbc-wc-calendar'),
            ['status' => 500]
        );
    }
    
    return new WP_REST_Response([
        'success' => true,
        'message' => __('Added to waitlist', 'tbc-wc-calendar'),
        'data'    => [
            'product_id' => $product_id,
            'event_date' => $event_date,
        ],
    ], 200);
}

/**
 * Handle POST /tbc-wc/v1/waitlist/leave
 * 
 * Remove current user from a waitlist.
 * 
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function tbc_wc_api_leave_waitlist(WP_REST_Request $request) {
    if (!class_exists('TBC_WC_Waitlist')) {
        return new WP_Error(
            'tbc_wc_waitlist_unavailable',
            __('Waitlist functionality is not available.', 'tbc-wc-calendar'),
            ['status' => 500]
        );
    }
    
    $product_id = $request->get_param('product_id');
    $event_date = $request->get_param('event_date');
    $user_id    = get_current_user_id();
    
    // Check if on waitlist
    if (!TBC_WC_Waitlist::is_user_on_waitlist($product_id, $event_date, $user_id)) {
        return new WP_Error(
            'tbc_wc_not_on_waitlist',
            __('You are not on the waitlist for this event.', 'tbc-wc-calendar'),
            ['status' => 400]
        );
    }
    
    // Remove from waitlist
    $result = TBC_WC_Waitlist::remove_from_waitlist($product_id, $event_date, $user_id);
    
    if (!$result) {
        return new WP_Error(
            'tbc_wc_waitlist_leave_failed',
            __('Failed to leave waitlist.', 'tbc-wc-calendar'),
            ['status' => 500]
        );
    }
    
    return new WP_REST_Response([
        'success' => true,
        'message' => __('Removed from waitlist', 'tbc-wc-calendar'),
        'data'    => [
            'product_id' => $product_id,
            'event_date' => $event_date,
        ],
    ], 200);
}