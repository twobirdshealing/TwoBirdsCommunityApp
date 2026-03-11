<?php
/**
 * TBC WooCommerce Calendar - Event Details Template
 * 
 * Displays detailed information about a specific event date.
 * Uses a single `selected_date` parameter – end dates are derived from settings.
 * 
 * @package TBC_WC_Calendar
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Display event details when viewing a product with selected_date
 */
function tbc_wc_display_event_details() {
    global $product;
    if (!$product instanceof WC_Product) return;

    $selected_date = isset($_GET['selected_date']) ? sanitize_text_field($_GET['selected_date']) : '';
    if (empty($selected_date)) return;

    $event_details = tbc_wc_get_event_details($product, $selected_date);
    if ($event_details) echo $event_details;
}

/**
 * Get event details for a specific product and date
 *
 * @param WC_Product $product The product object
 * @return string HTML content of event details
 */
function tbc_wc_get_event_details($product) {
    $current_event = $GLOBALS['tbc_wc_current_event'] ?? null;
    
    if (!$current_event) {
        return '';
    }
    
    $display_date = $current_event['start'];
    $display_end_date = $current_event['end'];

    $start_time = $current_event['start_time'];
    $end_time = $current_event['end_time'];
    $business_name = $current_event['business_name'];
    $event_location = $current_event['location'];
    $map_enabled = $current_event['map_enabled'];

    $event_details = '';

    // Date/Time
    $event_details .= '<div class="tbc-wc-event-details-time">';
    $event_details .= '<span class="tbc-wc-time-text"><span class="tbc-wc-icon">📅</span> ';

    $formatted_time = tbc_wc_get_formatted_time($display_date, $display_end_date, [
        'start_time' => $start_time,
        'end_time'   => $end_time,
    ]);

    if ($formatted_time) {
        $event_details .= esc_html($formatted_time);
    } else {
        $display_start = DateTime::createFromFormat('Y-m-d', $display_date);
        if ($display_start) {
            $event_details .= esc_html($display_start->format('F jS, Y'));
        }
    }

    $event_details .= '</span></div>';

    // Location
    if (!empty($business_name) || !empty($event_location)) {
        $event_details .= '<div class="tbc-wc-event-details-location">';
        $event_details .= '<span class="tbc-wc-location-text"><span class="tbc-wc-icon">📍</span> ';

        $location_parts = array_filter([$business_name, $event_location]);
        $event_details .= esc_html(implode(': ', $location_parts));

        $event_details .= '</span>';

        if ($map_enabled) {
            $event_details .= '<button class="tbc-wc-map-toggle-btn" aria-expanded="false"><span class="tbc-wc-toggle-icon">+</span></button>';
        }

        $event_details .= '</div>';

        if ($map_enabled) {
            $event_details .= '<div class="tbc-wc-map-container">';
            $event_details .= tbc_wc_display_map($product->get_id(), $event_location);
            $event_details .= '</div>';
        }
    }

    // Price
    $event_details .= '<div class="tbc-wc-event-details-price">';
    $event_details .= '<span class="tbc-wc-icon">💳</span>';
    $event_details .= $product->get_price_html();
    $event_details .= '</div>';

    // RSVP info
    $rsvp_info = tbc_wc_get_rsvp_information($product->get_id(), $display_date);
    if (!empty($rsvp_info)) {
        $event_details .= '<div class="tbc-wc-event-details-rsvp">';
        $event_details .= '<span class="tbc-wc-rsvp-text"><span class="tbc-wc-icon">⏰</span> ';

        if (!empty($rsvp_info['deadline_passed'])) {
            $event_details .= 'RSVP by ' . esc_html($rsvp_info['formatted_deadline']);
            $event_details .= '<span class="tbc-wc-rsvp-closed"> (Deadline Passed)</span>';
        } else {
            $event_details .= 'RSVP by ' . esc_html($rsvp_info['formatted_deadline']);

            if (!empty($rsvp_info['show_countdown']) && isset($rsvp_info['days_remaining'])) {
                if ($rsvp_info['days_remaining'] > 0) {
                    $days_text = ($rsvp_info['days_remaining'] === 1) ? 'day' : 'days';
                    $event_details .= '<span class="tbc-wc-rsvp-countdown"> (' . intval($rsvp_info['days_remaining']) . ' ' . $days_text . ' remaining)</span>';
                } else {
                    $event_details .= '<span class="tbc-wc-rsvp-countdown"> (Last day to RSVP!)</span>';
                }
            }
        }

        $event_details .= '</span></div>';
    }

    return $event_details;
}

/**
 * Attach event details to product page
 */
function tbc_wc_add_event_details_to_product() {
    if (!is_product()) return;
    global $product;
    if (!$product instanceof WC_Product || !tbc_wc_is_event_product($product)) return;
    tbc_wc_display_event_details();
}

/**
 * Hide checkout UI if event is booked or closed
 */
function tbc_wc_check_event_closure_for_details() {
    if (!is_product()) return;
    global $product;
    if (!$product instanceof WC_Product || !tbc_wc_is_event_product($product)) return;

    $date = isset($_GET['selected_date']) ? sanitize_text_field($_GET['selected_date']) : '';
    if (empty($date)) return;

    $current_event = $GLOBALS['tbc_wc_current_event'] ?? null;
    if (!$current_event) return;
    
    $status = $current_event['status'];

    if ($status === 'booked') {
        $qty = tbc_wc_get_user_booked_quantity(get_current_user_id(), $product->get_id(), $date);
        $spot_text = $qty === 1 ? 'spot' : 'spots';
        printf(
            '<div class="bp-feedback success tbc-wc-event-booked-message"><span class="bp-icon"></span><p>%s</p></div>',
            esc_html(sprintf('You are currently registered for this event – %d %s', $qty, $spot_text))
        );
        echo '<style>form.cart,.single_add_to_cart_button,.quantity,.variations{display:none!important}</style>';
    } elseif ($status === 'closed') {
        echo '<div class="bp-feedback error tbc-wc-goal-reached-message"><span class="bp-icon"></span><p>This event is currently full.</p></div>';
        echo '<style>form.cart,.single_add_to_cart_button,.quantity,.variations{display:none!important}</style>';
        if (class_exists('TBC_WC_Waitlist')) {
            do_action('display_waitlist_button', $product->get_id(), $date);
        }
    }
}

add_action('woocommerce_single_product_summary', 'tbc_wc_remove_duplicate_price', 5);
add_action('woocommerce_single_product_summary', 'tbc_wc_add_event_details_to_product', 8);
add_action('woocommerce_single_product_summary', 'tbc_wc_check_event_closure_for_details', 25);

/**
 * Remove WooCommerce default price for event products
 */
function tbc_wc_remove_duplicate_price() {
    if (!is_product()) return;
    global $product;
    if ($product instanceof WC_Product && tbc_wc_is_event_product($product)) {
        remove_action('woocommerce_single_product_summary', 'woocommerce_template_single_price', 10);
    }
}