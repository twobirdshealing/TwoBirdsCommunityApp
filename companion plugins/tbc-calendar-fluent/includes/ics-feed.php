<?php
/**
 * TBC WooCommerce Calendar - ICS Calendar Feed
 * 
 * Generates RFC 5545 compliant subscription feed at: /calendar-feed.ics
 * 
 * @package TBC_WC_Calendar
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * =============================================================================
 * URL REWRITE SYSTEM
 * =============================================================================
 */

add_action('init', 'tbc_wc_ics_feed_rewrite');
function tbc_wc_ics_feed_rewrite() {
    add_rewrite_rule('^calendar-feed\.ics$', 'index.php?tbc_wc_ics_feed=1', 'top');
}

add_filter('query_vars', function($vars) {
    $vars[] = 'tbc_wc_ics_feed';
    return $vars;
});

add_filter('redirect_canonical', function ($redirect_url, $requested_url) {
    $path = parse_url($requested_url, PHP_URL_PATH);
    if ($path === '/calendar-feed.ics') {
        return false;
    }
    return $redirect_url;
}, 10, 2);

/**
 * =============================================================================
 * HELPER FUNCTIONS
 * =============================================================================
 */

/**
 * Escape text for ICS format with RFC 5545 line folding
 */
function tbc_wc_ics_escape($text) {
    $text = strip_tags((string)$text);
    $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $text = str_replace(['\\', ',', ';', "\r\n", "\n", "\r"], ['\\\\', '\\,', '\\;', '\\n', '\\n', ''], $text);
    $text = preg_replace('/[\x00-\x1F\x7F]/', '', $text);

    // Fold at 73 characters per RFC 5545
    $out = '';
    $len = mb_strlen($text, 'UTF-8');
    $i = 0;
    while ($i < $len) {
        $chunk = mb_substr($text, $i, 73, 'UTF-8');
        $i += 73;
        $out .= $chunk . ($i < $len ? "\r\n " : "");
    }
    return $out;
}

/**
 * Check if user has access to content
 */
function tbc_wc_has_access_to_content($product_id) {
    $product = wc_get_product($product_id);
    if (!$product) return false;
    return !post_password_required($product_id);
}

/**
 * =============================================================================
 * ICS FEED GENERATION
 * =============================================================================
 */

add_action('template_redirect', 'tbc_wc_generate_ics_feed', 1);
function tbc_wc_generate_ics_feed() {
    if (!get_query_var('tbc_wc_ics_feed')) return;

    header('HTTP/1.0 200 OK', true, 200);
    header('Content-type: text/calendar; charset=UTF-8');
    header('Content-Disposition: attachment; filename="calendar-feed.ics"');
    header('X-Robots-Tag: noindex, nofollow');

    try {
        $today = current_time('Y-m-d');
        $end_date = date('Y-m-t', strtotime('+3 months', strtotime($today)));

        $events = tbc_wc_get_events(null, [
            'start_date' => $today,
            'end_date'   => $end_date
        ]);

        $ics = tbc_wc_build_ics_calendar($events);

        $ics = preg_replace("~\r?\n~", "\r\n", $ics);
        if (substr($ics, -2) !== "\r\n") $ics .= "\r\n";

        echo $ics;
    } catch (Exception $e) {
        error_log('ICS Feed Error: ' . $e->getMessage());
        echo tbc_wc_build_empty_ics_calendar();
    }
    exit;
}

/**
 * Build VTIMEZONE component
 */
function tbc_wc_build_vtimezone($tz) {
    if ($tz !== 'America/Chicago') return '';

    return "BEGIN:VTIMEZONE\r\n"
        . "TZID:America/Chicago\r\n"
        . "BEGIN:STANDARD\r\n"
        . "TZOFFSETFROM:-0500\r\n"
        . "TZOFFSETTO:-0600\r\n"
        . "TZNAME:CST\r\n"
        . "DTSTART:20241103T020000\r\n"
        . "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU\r\n"
        . "END:STANDARD\r\n"
        . "BEGIN:DAYLIGHT\r\n"
        . "TZOFFSETFROM:-0600\r\n"
        . "TZOFFSETTO:-0500\r\n"
        . "TZNAME:CDT\r\n"
        . "DTSTART:20250309T020000\r\n"
        . "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU\r\n"
        . "END:DAYLIGHT\r\n"
        . "END:VTIMEZONE\r\n";
}

/**
 * Build complete ICS calendar
 */
function tbc_wc_build_ics_calendar($events) {
    $tz_string = wp_timezone_string() ?: 'UTC';

    $ics  = "BEGIN:VCALENDAR\r\n";
    $ics .= "VERSION:2.0\r\n";
    $ics .= "PRODID:-//Two Birds Church//Events Calendar//EN\r\n";
    $ics .= "CALSCALE:GREGORIAN\r\n";
    $ics .= "METHOD:PUBLISH\r\n";
    $ics .= "X-WR-CALNAME:Two Birds Church Events\r\n";
    $ics .= "X-ORIGINAL-URL:" . home_url('/') . "\r\n";
    $ics .= "X-WR-CALDESC:Events for Two Birds Church\r\n";
    $ics .= "X-WR-TIMEZONE:{$tz_string}\r\n";
    $ics .= "REFRESH-INTERVAL;VALUE=DURATION:PT1H\r\n";
    $ics .= "X-PUBLISHED-TTL:PT1H\r\n";
    $ics .= "X-Robots-Tag:noindex\r\n";

    $ics .= tbc_wc_build_vtimezone($tz_string);

    foreach ($events as $event) {
        $ics .= tbc_wc_build_ics_event($event);
    }

    $ics .= "END:VCALENDAR\r\n";
    return $ics;
}

/**
 * Build single VEVENT component
 */
function tbc_wc_build_ics_event($event) {
    $product = $event['product'];
    $product_id = $product->get_id();

    $start_date = $event['start'];
    $end_date = $event['end'];

    $start_time = !empty($event['start_time']) ? $event['start_time'] : '18:00';
    $end_time = !empty($event['end_time']) ? $event['end_time'] : '21:00';

    $tzid = wp_timezone_string();
    $sdt = new DateTime("$start_date $start_time", new DateTimeZone($tzid));
    $edt = new DateTime("$end_date $end_time", new DateTimeZone($tzid));

    $DTSTART = $sdt->format('Ymd\THis');
    $DTEND = $edt->format('Ymd\THis');
    $DTSTAMP = gmdate('Ymd\THis\Z');

    $created_ts = get_post_time('U', true, $product_id);
    $modified_ts = get_post_modified_time('U', true, $product_id);
    $CREATED = gmdate('Ymd\THis\Z', $created_ts);
    $LAST_MODIFIED = gmdate('Ymd\THis\Z', $modified_ts);

    $uid = $product_id . '-' . $start_date . '@' . ( parse_url( home_url(), PHP_URL_HOST ) ?: 'localhost' );
    
    $sequence = floor($modified_ts / 86400) % 1000;

    $location_parts = array_filter([$event['business_name'] ?? '', $event['location'] ?? '']);
    $location_str = !empty($location_parts) ? tbc_wc_ics_escape(implode(', ', $location_parts)) : '';

    $title = $product->get_name();
    $desc = tbc_wc_build_event_description($event);

    $event_url = tbc_wc_get_event_url($product_id, $start_date);

    $ve  = "BEGIN:VEVENT\r\n";
    $ve .= "UID:" . tbc_wc_ics_escape($uid) . "\r\n";
    $ve .= "DTSTAMP:{$DTSTAMP}\r\n";
    $ve .= "DTSTART;TZID={$tzid}:{$DTSTART}\r\n";
    $ve .= "DTEND;TZID={$tzid}:{$DTEND}\r\n";
    $ve .= "CREATED:{$CREATED}\r\n";
    $ve .= "LAST-MODIFIED:{$LAST_MODIFIED}\r\n";
    $ve .= "SUMMARY:" . tbc_wc_ics_escape($title) . "\r\n";
    
    if ($location_str) {
        $ve .= "LOCATION:" . $location_str . "\r\n";
    }
    
    if ($desc) {
        $ve .= "DESCRIPTION:" . tbc_wc_ics_escape($desc) . "\r\n";
    }
    
    $ve .= "URL:" . tbc_wc_ics_escape($event_url) . "\r\n";

    $product_cats = wp_get_object_terms($product_id, 'product_cat', ['fields' => 'names']);
    if (!is_wp_error($product_cats) && !empty($product_cats)) {
        $ve .= "CATEGORIES:" . tbc_wc_ics_escape(implode(',', $product_cats)) . "\r\n";
    }

    if (has_post_thumbnail($product_id)) {
        $thumbnail_id = get_post_thumbnail_id($product_id);
        $thumbnail_url = wp_get_attachment_url($thumbnail_id);
        $thumbnail_mime = get_post_mime_type($thumbnail_id);
        if ($thumbnail_url && $thumbnail_mime) {
            $ve .= sprintf("ATTACH;FMTTYPE=%s:%s\r\n", $thumbnail_mime, $thumbnail_url);
        }
    }

    $church_email = get_option('admin_email');
    $ve .= sprintf("ORGANIZER;CN=\"Two Birds Church\":MAILTO:%s\r\n", $church_email);
    
    $ve .= "STATUS:CONFIRMED\r\n";
    $ve .= "SEQUENCE:{$sequence}\r\n";
    $ve .= "END:VEVENT\r\n";

    return $ve;
}

/**
 * Build event description text
 */
function tbc_wc_build_event_description($event) {
    $product = $event['product'];
    $product_id = $product->get_id();
    $start_date = $event['start'];

    $desc = '';
    $has_access = tbc_wc_has_access_to_content($product_id);

    if ($has_access) {
        $excerpt = $event['excerpt'] ?? '';
        if (!empty($excerpt)) {
            $desc .= trim(strip_tags($excerpt)) . "\n\n";
        }
    } else {
        $desc .= "This event requires a password to view full details.\n\n";
    }

    $price = (float) $product->get_price();
    if ($price <= 0) {
        $desc .= "💳 Love Donations\n";
    } else {
        $desc .= "💳 Registration Required\n";
    }

    if (function_exists('tbc_wc_get_rsvp_information')) {
        $rsvp = tbc_wc_get_rsvp_information($product_id, $start_date);
        if ($rsvp && empty($rsvp['deadline_passed']) && !empty($rsvp['formatted_deadline'])) {
            $desc .= "⏰ RSVP By: {$rsvp['formatted_deadline']}\n";
        }
    }

    $desc .= "\n";

    $loc_parts = array_filter([$event['business_name'] ?? '', $event['location'] ?? '']);
    if ($loc_parts) {
        $desc .= "📍 " . implode(', ', $loc_parts) . "\n\n";
    }

    $event_url = tbc_wc_get_event_url($product_id, $start_date);
    $desc .= ($price > 0 ? "Register:\n" : "Learn More:\n") . $event_url;

    return $desc;
}

/**
 * Build empty calendar for errors
 */
function tbc_wc_build_empty_ics_calendar() {
    return "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Two Birds Church//Events Calendar//EN\r\nCALSCALE:GREGORIAN\r\nX-WR-CALNAME:Two Birds Church Events\r\nEND:VCALENDAR\r\n";
}

/**
 * Flush rewrite rules
 */
function tbc_wc_flush_ics_feed_rules() {
    tbc_wc_ics_feed_rewrite();
    flush_rewrite_rules();
}

/**
 * =============================================================================
 * SUBSCRIBE BUTTON
 * =============================================================================
 */

/**
 * Display subscription button
 */
function tbc_wc_display_subscription_button() {
    $ics_https = set_url_scheme(home_url('/calendar-feed.ics'), 'https');
    $webcal    = preg_replace('#^https?://#i', 'webcal://', $ics_https);

    echo '<div class="tbc-wc-calendar-subscription-container">';
    echo '  <a class="tbc-wc-btn-subscribe-calendar"';
    echo '     href="' . esc_attr($webcal) . '"';
    echo '     data-ics="' . esc_attr($ics_https) . '"';
    echo '     data-webcal="' . esc_attr($webcal) . '">';
    echo '    <span class="tbc-wc-calendar-icon">📅</span> ';
    echo esc_html__('Subscribe to Calendar', 'tbc-wc-calendar');
    echo '  </a>';
    echo '  <p class="tbc-wc-subscription-help-text">';
    echo esc_html__('Get all upcoming events in your calendar app.', 'tbc-wc-calendar');
    echo '</p>';
    echo '</div>';
}