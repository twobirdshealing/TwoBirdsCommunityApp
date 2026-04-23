<?php
/**
 * TBC WooCommerce Calendar - Main Calendar View
 * 
 * Complete main calendar display system with navigation, product processing, and rendering.
 * 
 * @package TBC_WC_Calendar
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * =============================================================================
 * DASHBOARD FUNCTION
 * =============================================================================
 */

/**
 * Generates the event dashboard HTML
 */
function tbc_wc_dashboard() {
    $current_user = wp_get_current_user();
    $is_logged_in = is_user_logged_in();

    // Simplified perk roles - just the discount text
    $perk_roles = [
        'church_subscriber_1' => '5% OFF',
        'church_subscriber_2' => '10% OFF',
        'church_subscriber_3' => '15% OFF',
        'church_subscriber_4' => '20% OFF',
        'church_subscriber_5' => '25% OFF',
    ];

    $perk_text = __('Not Active', 'tbc-wc-calendar');
    $has_perk = false;

    if ($is_logged_in) {
        foreach ($perk_roles as $role => $discount) {
            if (in_array($role, $current_user->roles, true)) {
                $perk_text = $discount;
                $has_perk = true;
                break;
            }
        }
    }

    $categories = [
        'all'            => 'All',
        'sunday-service' => 'Sunday Service',
        'ceremony'       => 'Sacred Ceremony',
        'sapo'           => 'Kambo Circle',
        'book-club'      => 'Book Club',
        'sound-healing'  => 'Sound Journey',
        'special-event'  => 'Special Event'
    ];

    $current_view = isset($_GET['calendar_view']) ? sanitize_text_field($_GET['calendar_view']) : 'list';
    $current_view = in_array($current_view, ['list', 'month']) ? $current_view : 'list';

    ob_start();
    ?>
    <?php $waitlist_url = get_option('tbc_wc_waitlist_url', ''); ?>
    <div class="tbc-wc-toolbar">
        <?php if ($is_logged_in && $waitlist_url): ?>
        <a href="<?php echo esc_url($waitlist_url); ?>" class="tbc-wc-toolbar-link">
            <svg class="tbc-wc-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
            <span><?php echo esc_html__('Waitlist', 'tbc-wc-calendar'); ?></span>
        </a>
        <?php endif; ?>
        <?php if ($is_logged_in): ?>
        <?php if ($has_perk) : ?>
        <span class="tbc-wc-perk-badge tbc-wc-perk-active">
            <?php echo esc_html($perk_text); ?>
        </span>
        <?php endif; ?>
        <?php endif; ?>

        <div class="tbc-wc-toolbar-controls">
            <select id="tbc-wc-category-select" class="tbc-wc-toolbar-select" aria-label="<?php echo esc_attr__('Filter by category', 'tbc-wc-calendar'); ?>">
                <?php foreach ($categories as $slug => $name): ?>
                    <option value="<?php echo esc_attr($slug); ?>" data-category="<?php echo esc_attr($slug); ?>">
                        <?php echo esc_html($name); ?>
                    </option>
                <?php endforeach; ?>
            </select>
            <div class="tbc-wc-view-toggle">
                <button type="button" class="tbc-wc-view-btn <?php echo $current_view === 'list' ? 'tbc-wc-view-active' : ''; ?>" data-view="list" aria-label="<?php echo esc_attr__('List view', 'tbc-wc-calendar'); ?>">
                    <svg class="tbc-wc-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
                </button>
                <button type="button" class="tbc-wc-view-btn <?php echo $current_view === 'month' ? 'tbc-wc-view-active' : ''; ?>" data-view="month" aria-label="<?php echo esc_attr__('Month view', 'tbc-wc-calendar'); ?>">
                    <svg class="tbc-wc-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="4" x2="9" y2="22"/><line x1="15" y1="4" x2="15" y2="22"/></svg>
                </button>
            </div>
        </div>
    </div>
    <?php
    return ob_get_clean();
}

/**
 * =============================================================================
 * MAIN CALENDAR DISPLAY
 * =============================================================================
 */

/**
 * Main function that displays the event calendar
 */
function tbc_wc_display_main_calendar() {
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

    $has_events = tbc_wc_template_display_product_list($display_month, $current_date);

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
 * =============================================================================
 * VIEW ROUTING
 * =============================================================================
 */

/**
 * Main router that checks calendar_view parameter and loads appropriate template
 */
function tbc_wc_route_view() {
    if (!is_shop()) return;

    $calendar_view = isset($_GET['calendar_view']) ? sanitize_text_field($_GET['calendar_view']) : 'list';
    $calendar_view = in_array($calendar_view, ['list', 'month']) ? $calendar_view : 'list';

    if ($calendar_view === 'month') {
        tbc_wc_display_month_calendar();
    } else {
        tbc_wc_display_main_calendar();
    }
}

/**
 * =============================================================================
 * NAVIGATION
 * =============================================================================
 */

/**
 * Display calendar navigation with month controls
 */
function tbc_wc_template_display_navigation($display_month, $current_date) {
    $current_month = date('Y-m', strtotime($current_date));
    $prev_month = date('Y-m', strtotime('-1 month', strtotime($display_month)));
    $next_month = date('Y-m', strtotime('+1 month', strtotime($display_month)));
    
    echo '<div class="tbc-wc-month-navigation">';
    
    if ($display_month > $current_month) {
        printf(
            '<a href="%s" class="tbc-wc-nav-button tbc-wc-prev-month">&lt; %s</a>',
            esc_url(add_query_arg('display_month', $prev_month)),
            esc_html__('Back', 'tbc-wc-calendar')
        );
    } else {
        echo '<span class="tbc-wc-placeholder"></span>';
    }
    
    printf(
        '<span class="tbc-wc-current-month">%s</span>',
        esc_html(date('F Y', strtotime($display_month)))
    );
    
    printf(
        '<a href="%s" class="tbc-wc-nav-button tbc-wc-next-month">%s &gt;</a>',
        esc_url(add_query_arg('display_month', $next_month)),
        esc_html__('Next', 'tbc-wc-calendar')
    );
    
    echo '</div>';
}

/**
 * =============================================================================
 * TEMPLATE RENDERING
 * =============================================================================
 */

/**
 * Template function to render a single product item
 */
function tbc_wc_template_render_product_item($product, $event) {
    $date_object = DateTime::createFromFormat('Y-m-d', $event['start']);
    if (!$date_object) return;

    $formatted_time = tbc_wc_get_formatted_time($event['start'], $event['end'], [
        'start_time' => $event['start_time'],
        'end_time' => $event['end_time']
    ]);
    
    $item_link = tbc_wc_get_event_url($product->get_id(), $event['start']);
    
    echo sprintf('<a href="%s" class="tbc-wc-event-item-link">', esc_url($item_link));
    
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
    
    echo '<div class="tbc-wc-status-label ' . esc_attr($class) . '">' . esc_html($label) . '</div>';
    
    echo sprintf('<h3 class="tbc-wc-event-title">%s</h3>', 
        esc_html($product->get_title())
    );
    
    echo '<div class="tbc-wc-date-image-container">';
    echo '<span class="tbc-wc-event-date">';
    echo '<span class="tbc-wc-event-day">' . esc_html($date_object->format('l')) . '</span>';
    echo '<span class="tbc-wc-event-day-number">' . esc_html($date_object->format('j')) . '<sup class="tbc-wc-event-day-suffix">' . esc_html($date_object->format('S')) . '</sup></span>';
    echo '<span class="tbc-wc-event-month">' . esc_html($date_object->format('F')) . '</span>';
    echo '</span>';
    echo '<div class="tbc-wc-event-image-container">';
    echo '<div class="tbc-wc-event-image">' . $product->get_image('woocommerce_thumbnail') . '</div>';
    echo '</div>';
    echo '</div>';
    
    echo '<div class="tbc-wc-event-details">';

    if ($formatted_time) {
        echo '<span class="tbc-wc-event-time"><span class="tbc-wc-icon">📅</span> ' . esc_html($formatted_time) . '</span>';
    }

    if ($event['business_name'] || $event['location']) {
        $location_text = array_filter([
            $event['business_name'],
            $event['location']
        ]);
        echo '<span class="tbc-wc-event-location"><span class="tbc-wc-icon">📍</span> ' . esc_html(implode(': ', $location_text)) . '</span>';
    }

    echo '<div class="tbc-wc-event-price"><span class="tbc-wc-icon" style="margin-right: 8px;">💳</span>' . $product->get_price_html() . '</div>';

    if (!empty($event['excerpt'])) {
        echo '<div class="tbc-wc-event-description">' . wp_kses_post($event['excerpt']) . '</div>';
    }

    echo '</div>';
    
    echo '</a>';
}

/**
 * Main template function to display the list of products
 */
function tbc_wc_template_display_product_list($display_month, $current_date) {    
    echo '<div class="tbc-wc-calendar"><div class="tbc-wc-month-section"><ul class="tbc-wc-event-list">';
    
    $all_events = tbc_wc_get_events(null, [
        'start_date' => $current_date,
        'month_filter' => $display_month
    ]);
    
    $has_events = false;
    
    foreach ($all_events as $event) {
        $has_events = true;
        $product = $event['product'];
        $product_id = $product->get_id();
        
        $categories = wp_get_post_terms($product_id, 'product_cat', ['fields' => 'slugs']);
        $category_classes = array_map(function($cat) {
            return 'tbc-wc-category-' . sanitize_html_class($cat);
        }, $categories);

        printf(
            '<li class="tbc-wc-event-item %s">',
            esc_attr(implode(' ', $category_classes))
        );
        
        tbc_wc_template_render_product_item($product, $event);
        
        echo '</li>';
    }
    
    echo '</ul></div></div>';
    
    return $has_events;
}

/**
 * =============================================================================
 * HOOK REGISTRATION
 * =============================================================================
 */

add_action('woocommerce_before_shop_loop', 'tbc_wc_route_view', 25);