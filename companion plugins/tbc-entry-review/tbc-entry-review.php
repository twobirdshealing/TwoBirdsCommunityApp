<?php
/**
 * Plugin Name: TBC - Entry Review
 * Plugin URI: https://twobirdscode.com
 * Description: Admin page for reviewing Gravity Forms entries, managing phone screening status, consultation notes, and approval
 * Version: 1.9.1
 * Author: Two Birds Code
 * Author URI: https://twobirdscode.com
 * Text Domain: tbc-entry-review
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

define('TBC_ER_VERSION', '1.9.1');
define('TBC_ER_DIR', plugin_dir_path(__FILE__));
define('TBC_ER_URL', plugin_dir_url(__FILE__));

require_once TBC_ER_DIR . 'includes/class-tbc-er-page.php';
require_once TBC_ER_DIR . 'includes/class-tbc-er-ajax.php';

add_action('plugins_loaded', function() {
    if (!class_exists('GFAPI')) {
        add_action('admin_notices', function() {
            echo '<div class="notice notice-error"><p><strong>TBC Entry Review</strong> requires Gravity Forms to be active.</p></div>';
        });
        return;
    }

    if (is_admin()) {
        new TBC_ER_Page();
        new TBC_ER_Ajax();
    }
});

/**
 * Dynamic ICS calendar endpoint.
 * URL: site.com/?tbc_calendar=ENTRY_ID&token=HASH
 */
add_action('template_redirect', function() {
    if (!isset($_GET['tbc_calendar']) || !isset($_GET['token'])) {
        return;
    }

    if (!class_exists('GFAPI')) {
        return;
    }

    $entry_id = absint($_GET['tbc_calendar']);
    $token = sanitize_text_field($_GET['token']);

    if (!$entry_id || $token !== tbc_er_calendar_token($entry_id)) {
        status_header(403);
        exit('Invalid link.');
    }

    $date = gform_get_meta($entry_id, 'tbc_cp_phone_screening_date');
    if (empty($date)) {
        status_header(404);
        exit('No consultation scheduled.');
    }

    $entry = GFAPI::get_entry($entry_id);
    if (is_wp_error($entry)) {
        status_header(404);
        exit('Entry not found.');
    }

    $user = get_userdata($entry['created_by']);
    $user_name = $user ? $user->display_name : 'Participant';
    $first_name = explode(' ', $user_name)[0];

    $start = new DateTime($date, new DateTimeZone(wp_timezone_string()));
    $end = clone $start;
    $end->modify('+30 minutes');
    $alarm = new DateTime($date, new DateTimeZone(wp_timezone_string()));
    $alarm->modify('-1 hour');

    $uid = 'tbc-consult-' . $entry_id . '@' . parse_url(home_url(), PHP_URL_HOST);
    $now = gmdate('Ymd\THis\Z');
    $dtstart = $start->format('Ymd\THis');
    $dtend = $end->format('Ymd\THis');
    $tzid = wp_timezone_string();

    $zoom_link = 'https://us02web.zoom.us/j/9301696301?pwd=VzFsdndNcFJiblRsZ2pJMFlKOC9qdz09';
    $description = "Phone Consultation with Two Birds Church\\n\\n"
        . "Join Zoom:\\n$zoom_link\\n\\n"
        . "Meeting ID: 930 169 6301\\n"
        . "Passcode: love";

    $ics = "BEGIN:VCALENDAR\r\n"
        . "VERSION:2.0\r\n"
        . "PRODID:-//Two Birds Church//Entry Review//EN\r\n"
        . "CALSCALE:GREGORIAN\r\n"
        . "METHOD:PUBLISH\r\n"
        . "BEGIN:VEVENT\r\n"
        . "UID:$uid\r\n"
        . "DTSTAMP:$now\r\n"
        . "DTSTART;TZID=$tzid:$dtstart\r\n"
        . "DTEND;TZID=$tzid:$dtend\r\n"
        . "SUMMARY:Phone Consultation — $first_name / Two Birds Church\r\n"
        . "DESCRIPTION:$description\r\n"
        . "URL:$zoom_link\r\n"
        . "LOCATION:$zoom_link\r\n"
        . "BEGIN:VALARM\r\n"
        . "TRIGGER:-PT1H\r\n"
        . "ACTION:DISPLAY\r\n"
        . "DESCRIPTION:Phone consultation in 1 hour\r\n"
        . "END:VALARM\r\n"
        . "END:VEVENT\r\n"
        . "END:VCALENDAR\r\n";

    header('Content-Type: text/calendar; charset=utf-8');
    header('Content-Disposition: attachment; filename="consultation-' . $entry_id . '.ics"');
    echo $ics;
    exit;
});

/**
 * Generate a secure token for calendar download links.
 */
function tbc_er_calendar_token(int $entry_id): string {
    return substr(wp_hash($entry_id . 'tbc_calendar'), 0, 16);
}

/**
 * Get the public calendar download URL for an entry.
 */
function tbc_er_calendar_url(int $entry_id): string {
    return add_query_arg([
        'tbc_calendar' => $entry_id,
        'token' => tbc_er_calendar_token($entry_id),
    ], home_url('/'));
}
