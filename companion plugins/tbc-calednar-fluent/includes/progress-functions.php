<?php
/**
 * TBC WooCommerce Calendar - Progress Bar Functions
 * 
 * Handles donation goal tracking, progress calculations, and UI generation.
 * Supports revenue, sales count, and subscriber metrics with date-specific overrides.
 * 
 * @package TBC_WC_Calendar
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * =============================================================================
 * DATABASE QUERY FUNCTIONS
 * =============================================================================
 */

/**
 * Get total sales count for event
 * 
 * @param int $product_id Product ID
 * @param string $event_date Event date
 * @return int Total sales count
 */
function tbc_wc_get_sale_count($product_id, $event_date) {
    global $wpdb;
      
    if (empty($event_date)) {
        return 0;
    }
    
    $query = "
        SELECT SUM(meta_qty.meta_value) as total_sales
        FROM {$wpdb->prefix}woocommerce_order_items as items
        JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_product
            ON items.order_item_id = meta_product.order_item_id
        JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_date
            ON items.order_item_id = meta_date.order_item_id
        JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_qty
            ON items.order_item_id = meta_qty.order_item_id
        JOIN {$wpdb->prefix}wc_orders AS orders
            ON items.order_id = orders.id
        WHERE meta_product.meta_key = '_product_id'
        AND meta_product.meta_value = %d
        AND meta_date.meta_key = '_tbc_wc_event_start_date'
        AND meta_date.meta_value = %s
        AND meta_qty.meta_key = '_qty'
        AND orders.type = 'shop_order'
        AND orders.status IN ('wc-completed', 'wc-processing')
        AND items.order_item_type = 'line_item'
    ";
    
    $result = $wpdb->get_var($wpdb->prepare($query, $product_id, $event_date));
    return $result ? intval($result) : 0;
}

/**
 * Get total revenue for event
 * 
 * @param int $product_id Product ID
 * @param string $event_date Event date
 * @return float Total revenue
 */
function tbc_wc_get_revenue($product_id, $event_date) {
    global $wpdb;
       
    if (empty($event_date)) {
        return 0;
    }
    
    $query = "
        SELECT SUM(meta_total.meta_value) as total_revenue
        FROM {$wpdb->prefix}woocommerce_order_items as items
        JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_product
            ON items.order_item_id = meta_product.order_item_id
        JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_date
            ON items.order_item_id = meta_date.order_item_id
        JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_total
            ON items.order_item_id = meta_total.order_item_id
        JOIN {$wpdb->prefix}wc_orders AS orders
            ON items.order_id = orders.id
        WHERE meta_product.meta_key = '_product_id'
        AND meta_product.meta_value = %d
        AND meta_date.meta_key = '_tbc_wc_event_start_date'
        AND meta_date.meta_value = %s
        AND meta_total.meta_key = '_line_total'
        AND orders.type = 'shop_order'
        AND orders.status IN ('wc-completed', 'wc-processing')
        AND items.order_item_type = 'line_item'
    ";
    
    $result = $wpdb->get_var($wpdb->prepare($query, $product_id, $event_date));
    return $result ? floatval($result) : 0;
}

/**
 * Get subscriber count with timeframe filtering
 * 
 * @param int $product_id Product ID
 * @param string $event_date Event date
 * @return int Subscriber count
 */
function tbc_wc_get_subscriber_count($product_id, $event_date = '') {
    global $wpdb;

    $settings = tbc_wc_get_event_settings($product_id);
    $progress = $settings['progress'] ?? [];

    $date_settings = null;
    if ($event_date) {
        $date_settings = tbc_wc_get_progress_settings($product_id, $event_date);
    }
    
    $subscriber_timeframe = $date_settings['subscriber_timeframe'] ?? 
                           $progress['subscriber_timeframe'] ?? 
                           'all_time';

    $sql = "
        SELECT COUNT(DISTINCT orders.id)
        FROM {$wpdb->prefix}woocommerce_order_items AS items
        INNER JOIN {$wpdb->prefix}woocommerce_order_itemmeta AS meta_product
            ON items.order_item_id = meta_product.order_item_id
           AND meta_product.meta_key   = '_product_id'
           AND meta_product.meta_value = %s
        INNER JOIN {$wpdb->prefix}wc_orders AS orders
            ON items.order_id = orders.id
           AND orders.type    = 'shop_subscription'
        WHERE items.order_item_type = 'line_item'
    ";
    $params = [$product_id];

    if ($event_date) {
        $sql .= "
            AND EXISTS (
                SELECT 1
                FROM {$wpdb->prefix}woocommerce_order_itemmeta AS meta_date
                WHERE meta_date.order_item_id = items.order_item_id
                  AND meta_date.meta_key      = '_tbc_wc_event_start_date'
                  AND meta_date.meta_value    = %s
            )
        ";
        $params[] = $event_date;
    }

    $time_filters = [
        'last_30_days' => '-30 days',
        'last_90_days' => '-90 days',
        'current_month' => 'first day of this month',
        'current_year' => 'first day of January this year'
    ];

    if (isset($time_filters[$subscriber_timeframe])) {
        if (in_array($subscriber_timeframe, ['last_30_days', 'last_90_days'])) {
            $start = date('Y-m-d H:i:s', strtotime($time_filters[$subscriber_timeframe], strtotime(current_time('mysql', true))));
            $sql .= " AND orders.date_created_gmt BETWEEN %s AND %s";
            $params[] = $start;
            $params[] = current_time('mysql', true);
        } else {
            $first_local = date('Y-m-d 00:00:00', strtotime($time_filters[$subscriber_timeframe], current_time('timestamp')));
            $start = get_gmt_from_date($first_local);
            $sql .= " AND orders.date_created_gmt >= %s";
            $params[] = $start;
        }
    }

    $count = $wpdb->get_var($wpdb->prepare($sql, $params));
    return intval($count);
}

/**
 * =============================================================================
 * PROGRESS BAR SETTINGS & STATUS
 * =============================================================================
 */

/**
 * Check if progress bar is enabled for specific event date
 * 
 * @param int $product_id Product ID
 * @param string $event_date Event date
 * @return bool True if enabled
 */
function tbc_wc_is_progress_enabled($product_id, $event_date) {
    $settings = tbc_wc_get_event_settings($product_id);
    $progress = $settings['progress'] ?? [];
    
    if ($event_date === $settings['dates']['start_date']) {
        return $progress['enabled'] ?? false;
    }
    
    foreach ($settings['recurring']['individual_dates'] ?? [] as $date_pair) {
        if ($date_pair['start'] === $event_date) {
            $mode = $date_pair['progress_mode'] ?? 'global';
            return $mode === 'global' ? ($progress['enabled'] ?? false) : 
                   ($mode === 'custom' ? true : false);
        }
    }
    
    if ($settings['recurring']['type'] === 'interval') {
        foreach ($settings['recurring']['interval']['exceptions'] ?? [] as $exception) {
            if ($exception['date'] === $event_date) {
                $mode = $exception['progress_mode'] ?? 'global';
                return $mode === 'global' ? ($progress['enabled'] ?? false) : 
                       ($mode === 'custom' ? true : false);
            }
        }
    }
    
    return $progress['enabled'] ?? false;
}

/**
 * Get progress settings for specific event date
 * 
 * @param int $product_id Product ID
 * @param string $event_date Event date
 * @return array Progress settings
 */
function tbc_wc_get_progress_settings($product_id, $event_date) {
    $settings = tbc_wc_get_event_settings($product_id);
    $progress = $settings['progress'];
    
    $defaults = [
        'enabled' => $progress['enabled'] ?? false,
        'goal_type' => $progress['goal_type'] ?? 'sales',
        'goal' => $progress['goal'] ?? 0,
        'inventory_threshold' => $progress['inventory_threshold'] ?? 0,
        'show_percentage' => $progress['show_percentage'] ?? false,
        'background_color' => $progress['background_color'] ?? '#F0F0F0',
        'fill_color' => $progress['fill_color'] ?? '#007CFF',
        'text_color' => $progress['text_color'] ?? '#000000',
        'above_text' => $progress['above_text'] ?? '',
        'subscriber_timeframe' => $progress['subscriber_timeframe'] ?? 'all_time'
    ];
    
    if ($event_date === $settings['dates']['start_date']) {
        return $defaults;
    }
    
    foreach ($settings['recurring']['individual_dates'] ?? [] as $date_pair) {
        if ($date_pair['start'] === $event_date) {
            $mode = $date_pair['progress_mode'] ?? 'global';
            if ($mode === 'custom') {
                return [
                    'enabled' => true,
                    'goal_type' => $date_pair['progress_goal_type'] ?? $defaults['goal_type'],
                    'goal' => $date_pair['progress_goal'] ?? $defaults['goal'],
                    'inventory_threshold' => $date_pair['progress_inventory_threshold'] ?? $defaults['inventory_threshold'],
                    'show_percentage' => $date_pair['progress_show_percentage'] ?? $defaults['show_percentage'],
                    'background_color' => $date_pair['progress_background_color'] ?? $defaults['background_color'],
                    'fill_color' => $date_pair['progress_fill_color'] ?? $defaults['fill_color'],
                    'text_color' => $date_pair['progress_text_color'] ?? $defaults['text_color'],
                    'above_text' => $defaults['above_text'],
                    'subscriber_timeframe' => $date_pair['subscriber_timeframe'] ?? $defaults['subscriber_timeframe']
                ];
            } else if ($mode === 'off') {
                return array_merge($defaults, ['enabled' => false]);
            }
        }
    }
    
    if ($settings['recurring']['type'] === 'interval') {
        foreach ($settings['recurring']['interval']['exceptions'] ?? [] as $exception) {
            if ($exception['date'] === $event_date) {
                $mode = $exception['progress_mode'] ?? 'global';
                if ($mode === 'custom') {
                    return [
                        'enabled' => true,
                        'goal_type' => $exception['progress_goal_type'] ?? $defaults['goal_type'],
                        'goal' => $exception['progress_goal'] ?? $defaults['goal'],
                        'inventory_threshold' => $exception['progress_inventory_threshold'] ?? $defaults['inventory_threshold'],
                        'show_percentage' => $exception['progress_show_percentage'] ?? $defaults['show_percentage'],
                        'background_color' => $exception['progress_background_color'] ?? $defaults['background_color'],
                        'fill_color' => $exception['progress_fill_color'] ?? $defaults['fill_color'],
                        'text_color' => $exception['progress_text_color'] ?? $defaults['text_color'],
                        'above_text' => $defaults['above_text'],
                        'subscriber_timeframe' => $exception['subscriber_timeframe'] ?? $defaults['subscriber_timeframe']
                    ];
                } else if ($mode === 'off') {
                    return array_merge($defaults, ['enabled' => false]);
                }
            }
        }
    }
    
    return $defaults;
}

/**
 * Check if donation goal has been reached
 * 
 * @param int $product_id Product ID
 * @param string $event_date Event date
 * @return bool True if goal reached
 */
function tbc_wc_is_goal_reached($product_id, $event_date = '') {
    if (!tbc_wc_is_progress_enabled($product_id, $event_date)) {
        return false;
    }
    
    $date_settings = tbc_wc_get_progress_settings($product_id, $event_date);
    $goal = $date_settings['goal'] ?? 0;
    $goal_type = $date_settings['goal_type'] ?? 'sales';
    
    if ($goal <= 0) {
        return false;
    }
    
    $current = match($goal_type) {
        'revenue' => tbc_wc_get_revenue($product_id, $event_date),
        'subscribers' => tbc_wc_get_subscriber_count($product_id, $event_date),
        'sales' => tbc_wc_get_sale_count($product_id, $event_date),
        default => 0
    };
    
    return $current >= $goal;
}

/**
 * =============================================================================
 * HTML GENERATION & DISPLAY
 * =============================================================================
 */

/**
 * Generate complete progress bar HTML
 * 
 * @param int $product_id Product ID
 * @param string $event_date Event date
 * @return string HTML output
 */
function tbc_wc_generate_progress_html($product_id, $event_date = '') {
    if (!tbc_wc_is_progress_enabled($product_id, $event_date)) {
        return '';
    }
    
    $progress = tbc_wc_get_progress_settings($product_id, $event_date);
    
    if (!$progress['enabled']) {
        return '';
    }
    
    $goal = $progress['goal'];
    $goal_type = $progress['goal_type'];
    $above_text = str_replace('{month}', date('F'), $progress['above_text']);
    
    $count = match($goal_type) {
        'revenue' => tbc_wc_get_revenue($product_id, $event_date),
        'sales' => tbc_wc_get_sale_count($product_id, $event_date),
        'subscribers' => tbc_wc_get_subscriber_count($product_id, $event_date),
        default => 0
    };
    
    $percentage = $goal > 0 ? ($count / $goal) * 100 : 0;
    $percentage = max(0, min(100, $percentage));
    
    $percentage_text = $progress['show_percentage'] ? 
        '<span class="tbc-wc-progress-percentage tbc-wc-inside-fill-bar tbc-wc-percentage-text-color">' . 
        strval(round($percentage)) . '%</span>' : '';
    
    $percentage_str = strval(round($percentage)) . '%';
    
    $html = sprintf('<div class="tbc-wc-progress-above-text"><h5>%s</h5></div>', $above_text);
    
    $html .= sprintf(
        '<div class="tbc-wc-progress-wrapper">
            <div class="tbc-wc-progress-bar" style="background-color: %s;">
                <div class="tbc-wc-progress-fill" style="color: %s;background-color: %s;width: %s;">%s</div>
            </div>
        </div>',
        $progress['background_color'],
        $progress['text_color'], 
        $progress['fill_color'],
        $percentage_str,
        $percentage_text
    );
    
    $dollar = $goal_type === 'revenue' ? '$' : '';
    $donor = $goal_type !== 'revenue' ? ' Donors' : '';
    
    $html .= sprintf(
        '<div class="tbc-wc-progress-amounts">
            <span class="tbc-wc-progress-current">Currently: %s%s%s</span>
            <span class="tbc-wc-progress-goal">Goal: %s%s%s</span>
        </div>',
        $dollar,
        $goal_type === 'revenue' ? number_format($count, 0) : $count,
        $donor,
        $dollar,
        number_format($goal, 0),
        $donor
    );
    
    $html .= '<hr>';
    
    return $html;
}

/**
 * Display progress bar on product pages
 */
function tbc_wc_display_progress() {
    global $product;
    
    if (!is_object($product)) {
        return;
    }

    if (!tbc_wc_is_event_product($product)) {
        return;
    }
    
    $event_date = isset($_GET['selected_date']) ? sanitize_text_field($_GET['selected_date']) : '';
    
    if (empty($event_date)) {
        return;
    }
    
    if (!tbc_wc_is_progress_enabled($product->get_id(), $event_date)) {
        return;
    }
    
    $progress = tbc_wc_get_progress_settings($product->get_id(), $event_date);
    $inventory_threshold = intval($progress['inventory_threshold']);
    
    $should_show = true;
    if ($inventory_threshold > 0 && $progress['goal_type'] === 'sales') {
        $current_sales = tbc_wc_get_sale_count($product->get_id(), $event_date);
        if (($progress['goal'] - $current_sales) > $inventory_threshold) {
            $should_show = false;
        }
    }
    
    if ($should_show) {
        echo tbc_wc_generate_progress_html($product->get_id(), $event_date);
    }
}

/**
 * =============================================================================
 * CART MANAGEMENT & CACHING
 * =============================================================================
 */

/**
 * Remove full events from cart to prevent overselling
 * 
 * @param bool $is_during_checkout Whether called during checkout
 */
function tbc_wc_remove_full_events_from_cart($is_during_checkout = false) {
    if (!WC()->cart) {
        return;
    }
    
    $removed_items = [];
    
    foreach (WC()->cart->get_cart() as $cart_item_key => $cart_item) {
        if (!isset($cart_item['tbc_wc_event_date'])) {
            continue;
        }
        
        $product_id = $cart_item['product_id'];
        $event_date = $cart_item['tbc_wc_event_date'];
        
        if (tbc_wc_is_goal_reached($product_id, $event_date)) {
            $product = wc_get_product($product_id);
            $product_name = $product ? $product->get_name() : "Event #$product_id";
            $formatted_date = date_i18n(get_option('date_format'), strtotime($event_date));
            
            WC()->cart->remove_cart_item($cart_item_key);
            
            $removed_items[] = [
                'name' => $product_name,
                'date' => $formatted_date
            ];
        }
    }
    
    if (!empty($removed_items)) {
        $message = 'The following events have become fully booked and were removed from your cart:<br>';
        
        foreach ($removed_items as $item) {
            $message .= 'â€¢ ' . esc_html($item['name']) . ' on ' . esc_html($item['date']) . '<br>';
        }
        
        wc_add_notice($message, 'error');
        
        if ($is_during_checkout) {
            throw new Exception("Items were removed from your cart. Please review and try again.");
        }
    }
}

/**
 * Disable caching for products with progress bars
 */
function tbc_wc_no_cache_for_progress() {
    if (!is_product()) {
        return;
    }
    
    $product_id = get_the_ID();
    if (!$product_id) return;

    if (!tbc_wc_is_event_product($product_id)) {
        return;
    }
    
    $settings = tbc_wc_get_event_settings($product_id);
    if (!isset($settings['progress']['enabled']) || !$settings['progress']['enabled']) return;
    
    header("Cache-Control: no-cache, no-store, must-revalidate, max-age=0");
    header("Pragma: no-cache");
    header("Expires: 0");
    header("X-LiteSpeed-Cache-Control: no-cache");
    
    if (function_exists('do_not_cache_page')) do_not_cache_page();
}

/**
 * =============================================================================
 * HOOK REGISTRATIONS
 * =============================================================================
 */

add_action('wp', function() {
    tbc_wc_remove_full_events_from_cart(false);
});

add_action('woocommerce_before_checkout_process', function() {
    tbc_wc_remove_full_events_from_cart(true);
}, 5);

add_action('template_redirect', 'tbc_wc_no_cache_for_progress');
add_action('woocommerce_single_product_summary', 'tbc_wc_display_progress', 20);