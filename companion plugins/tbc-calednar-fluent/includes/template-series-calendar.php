<?php
/**
 * TBC WooCommerce Calendar - Event Series Template
 *
 * Displays a list of upcoming dates for recurring events when no specific date is selected.
 * Uses template_include filter to work WITH Fluent Community's template system.
 *
 * @package TBC_WC_Calendar
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * =============================================================================
 * SERIES CONTENT HTML
 * =============================================================================
 */

/**
 * Generate HTML for event series page
 *
 * @param WC_Product $product The product object
 * @return string Complete HTML content for the event series
 */
function tbc_wc_get_event_series_html($product) {
    $today = current_time('Y-m-d');

    $upcoming_dates = tbc_wc_get_events($product->get_id(), [
        'start_date' => $today,
        'end_date'   => date('Y-m-t', strtotime('+2 months')),
        'limit'      => 5
    ]);

    ob_start();
    ?>
    <!-- Series Header -->
    <div class="tbc-wc-event-series-header">
        <h1 class="tbc-wc-event-series-title"><?php echo esc_html($product->get_name()); ?></h1>
        <div class="tbc-wc-event-series-image">
            <?php echo $product->get_image('large'); ?>
        </div>
    </div>

    <!-- Main Calendar Structure -->
    <div class="tbc-wc-calendar">
        <div class="tbc-wc-month-section">
            <ul class="tbc-wc-event-list">
                <?php if (!empty($upcoming_dates)): ?>
                    <?php foreach ($upcoming_dates as $event): ?>
                        <?php
                        $date_object = DateTime::createFromFormat('Y-m-d', $event['start']);

                        switch ($event['status']) {
                            case 'booked':
                                $label = 'Booked';
                                $class = 'tbc-wc-event-booked';
                                break;
                            case 'closed':
                                $label = 'Waitlist';
                                $class = 'tbc-wc-event-closed';
                                break;
                            case 'open':
                            default:
                                $label = 'Available';
                                $class = 'tbc-wc-event-open';
                                break;
                        }

                        $event_url = tbc_wc_get_event_url($product->get_id(), $event['start']);

                        $formatted_time = tbc_wc_get_formatted_time($event['start'], $event['end'], [
                            'start_time' => $event['start_time'],
                            'end_time' => $event['end_time']
                        ]);
                        ?>

                        <li class="tbc-wc-event-item">
                            <a href="<?php echo esc_url($event_url); ?>" class="tbc-wc-event-item-link">
                                <!-- Status indicator -->
                                <div class="tbc-wc-status-label <?php echo esc_attr($class); ?>">
                                    <?php echo esc_html($label); ?>
                                </div>

                                <!-- Event title -->
                                <h3 class="tbc-wc-event-title"><?php echo esc_html($product->get_name()); ?></h3>

                                <!-- Date and image container -->
                                <div class="tbc-wc-date-image-container">
                                    <span class="tbc-wc-event-date">
                                        <span class="tbc-wc-event-day"><?php echo esc_html($date_object->format('l')); ?></span>
                                        <span class="tbc-wc-event-day-number">
                                            <?php echo esc_html($date_object->format('j')); ?>
                                            <sup class="tbc-wc-event-day-suffix"><?php echo esc_html($date_object->format('S')); ?></sup>
                                        </span>
                                        <span class="tbc-wc-event-month"><?php echo esc_html($date_object->format('F')); ?></span>
                                    </span>
                                    <div class="tbc-wc-event-image-container">
                                        <div class="tbc-wc-event-image"><?php echo $product->get_image('woocommerce_thumbnail'); ?></div>
                                    </div>
                                </div>

                                <!-- Event details section -->
                                <div class="tbc-wc-event-details">
                                    <?php if ($formatted_time): ?>
                                        <span class="tbc-wc-event-time">
                                            <span class="tbc-wc-icon">📅</span>
                                            <?php echo esc_html($formatted_time); ?>
                                        </span>
                                    <?php endif; ?>

                                    <?php if ($event['business_name'] || $event['location']): ?>
                                        <span class="tbc-wc-event-location">
                                            <span class="tbc-wc-icon">📍</span>
                                            <?php
                                            $location_parts = array_filter([$event['business_name'], $event['location']]);
                                            echo esc_html(implode(': ', $location_parts));
                                            ?>
                                        </span>
                                    <?php endif; ?>

                                    <div class="tbc-wc-event-price">
                                        <span class="tbc-wc-icon" style="margin-right: 8px;">💳</span>
                                        <?php echo $product->get_price_html(); ?>
                                    </div>

                                    <?php if (!empty($event['excerpt'])): ?>
                                        <div class="tbc-wc-event-description"><?php echo wp_kses_post($event['excerpt']); ?></div>
                                    <?php endif; ?>
                                </div>
                            </a>
                        </li>
                    <?php endforeach; ?>
                <?php else: ?>
                    <!-- No upcoming events message -->
                    <li class="tbc-wc-event-item">
                        <div class="tbc-wc-event-series-empty">
                            <p><?php esc_html_e('No upcoming events are currently scheduled.', 'tbc-wc-calendar'); ?></p>
                            <p><?php esc_html_e('Please check back later.', 'tbc-wc-calendar'); ?></p>
                        </div>
                    </li>
                <?php endif; ?>
            </ul>
        </div>
    </div>
    <?php

    return ob_get_clean();
}

/**
 * =============================================================================
 * SERIES PAGE SETUP - Remove WooCommerce, Inject Series Content
 * =============================================================================
 */

/**
 * Detect series page and strip WooCommerce hooks/styles
 */
add_action('template_redirect', function() {
    if (!is_product()) {
        return;
    }

    $product = wc_get_product(get_queried_object_id());
    if (!$product instanceof WC_Product) {
        return;
    }

    if (!tbc_wc_is_event_product($product)) {
        return;
    }

    // If selected_date is set, let normal product page handle it
    if (isset($_GET['selected_date']) && !empty($_GET['selected_date'])) {
        return;
    }

    // Check if this is a recurring event
    $upcoming_dates = tbc_wc_get_events($product->get_id(), [
        'start_date' => current_time('Y-m-d'),
        'end_date'   => date('Y-m-t', strtotime('+2 months')),
        'limit'      => 1
    ]);

    if (empty($upcoming_dates) || $upcoming_dates[0]['recurring_type'] === 'single') {
        return;
    }

    // THIS IS A SERIES PAGE - strip WooCommerce

    // Remove WooCommerce styles (eliminates 2-column layout)
    add_filter('woocommerce_enqueue_styles', '__return_empty_array');

    // Remove all single product hooks
    remove_action('woocommerce_single_product_summary', 'woocommerce_template_single_title', 5);
    remove_action('woocommerce_single_product_summary', 'woocommerce_template_single_price', 10);
    remove_action('woocommerce_single_product_summary', 'woocommerce_template_single_excerpt', 20);
    remove_action('woocommerce_single_product_summary', 'woocommerce_template_single_add_to_cart', 30);
    remove_action('woocommerce_single_product_summary', 'woocommerce_template_single_meta', 40);
    remove_action('woocommerce_single_product_summary', 'woocommerce_template_single_sharing', 50);
    remove_action('woocommerce_before_single_product_summary', 'woocommerce_show_product_images', 20);
    remove_action('woocommerce_after_single_product_summary', 'woocommerce_output_product_data_tabs', 10);
    remove_action('woocommerce_after_single_product_summary', 'woocommerce_upsell_display', 15);
    remove_action('woocommerce_after_single_product_summary', 'woocommerce_output_related_products', 20);

    // Hide any remaining cart elements (external products use different template)
    add_action('wp_head', function() {
        echo '<style>.woocommerce div.product form.cart { display: none !important; }</style>';
    });

    // Store product for later
    $GLOBALS['tbc_wc_series_product'] = $product;

    // Add our series content
    add_action('woocommerce_before_single_product_summary', function() {
        $product = $GLOBALS['tbc_wc_series_product'] ?? wc_get_product(get_queried_object_id());
        if ($product) {
            echo tbc_wc_get_event_series_html($product);
        }
    }, 5);
});
