<?php
/**
 * Plugin Name: TBC - Checkout Prerequisites
 * Plugin URI: https://twobirdscode.com
 * Description: Displays prerequisite steps customers must complete before checkout
 * Version: 3.7.28
 * Author: Two Birds Code
 * Author URI: https://twobirdscode.com
 * Text Domain: tbc-checkout-prerequisites
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

define('TBC_CP_VERSION', '3.7.28');
define('TBC_CP_DIR', plugin_dir_path(__FILE__));
define('TBC_CP_URL', plugin_dir_url(__FILE__));

// Gravity Forms field types to skip when iterating input fields
define('TBC_CP_SKIP_FIELD_TYPES', ['html', 'section', 'page', 'captcha', 'hidden']);

require_once TBC_CP_DIR . 'includes/class-tbc-cp-settings.php';
require_once TBC_CP_DIR . 'includes/class-tbc-cp-course-status.php';
require_once TBC_CP_DIR . 'includes/class-tbc-cp-form-status.php';
require_once TBC_CP_DIR . 'includes/class-tbc-cp-dashboard.php';
require_once TBC_CP_DIR . 'includes/class-tbc-cp-entry-review.php';
require_once TBC_CP_DIR . 'includes/class-tbc-cp-entry-review-ajax.php';
require_once TBC_CP_DIR . 'includes/class-tbc-cp-messaging.php';

function tbc_cp_get_steps(): array {
    static $steps = null;
    if ($steps === null) {
        $steps = get_option('tbc_cp_steps', []);
    }
    return $steps;
}

add_action('plugins_loaded', function() {
    if (is_admin()) {
        new TBC_CP_Settings();
    }

    // Entry review: shortcode (frontend) + AJAX handlers (logged-in users)
    if (class_exists('GFAPI')) {
        new TBC_CP_Entry_Review();
        new TBC_CP_Entry_Review_Ajax();
        new TBC_CP_Messaging();
    }

    TBC_CP_Dashboard::init();
    TBC_CP_Form_Status::init_global_hooks();
});

add_action('wp_enqueue_scripts', function() {
    if (!is_checkout()) {
        return;
    }
    
    add_action('wp_footer', function() {
        if (!defined('TBC_CP_IONICONS_LOADED')) {
            define('TBC_CP_IONICONS_LOADED', true);
            echo '<script type="module" src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js"></script>';
            echo '<script nomodule src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.js"></script>';
        }
    });

    wp_enqueue_style('tbc-cp-navigation', TBC_CP_URL . 'css/tbc-cp-navigation.css', [], TBC_CP_VERSION);
    wp_enqueue_style('tbc-cp-courses', TBC_CP_URL . 'css/tbc-cp-courses.css', [], TBC_CP_VERSION);
    wp_enqueue_style('tbc-cp-forms', TBC_CP_URL . 'css/tbc-cp-forms.css', [], TBC_CP_VERSION);

    wp_enqueue_script('tbc-cp-utils', TBC_CP_URL . 'js/tbc-cp-utils.js', ['jquery'], TBC_CP_VERSION, true);
    wp_enqueue_script('tbc-cp-courses', TBC_CP_URL . 'js/tbc-cp-courses.js', ['jquery', 'tbc-cp-utils'], TBC_CP_VERSION, true);
    wp_enqueue_script('tbc-cp-navigation', TBC_CP_URL . 'js/tbc-cp-navigation.js', ['jquery', 'tbc-cp-utils'], TBC_CP_VERSION, true);

    wp_localize_script('tbc-cp-utils', 'tbc_cp_vars', [
        'ajaxurl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('tbc_cp_nonce'),
        'steps' => tbc_cp_get_steps(),
    ]);
});

add_action('wp_ajax_tbc_cp_content_action', 'tbc_cp_ajax_content_handler');

function tbc_cp_ajax_content_handler() {
    check_ajax_referer('tbc_cp_nonce', 'nonce');

    $user_id = get_current_user_id();
    if ($user_id === 0) {
        wp_send_json_error('Not logged in');
    }

    $action_type = sanitize_text_field($_POST['action_type'] ?? '');
    
    switch ($action_type) {
        case 'load_course':
            $course = new TBC_CP_Course_Status($user_id, intval($_POST['course_id']));
            wp_send_json_success(['content' => $course->render_course()]);
            break;
            
        case 'load_lesson':
            $course = new TBC_CP_Course_Status($user_id, intval($_POST['course_id']));
            $content = $course->render_lesson_content(intval($_POST['content_id']));
            wp_send_json_success(['content' => $content]);
            break;

        case 'mark_complete':
            $course = new TBC_CP_Course_Status($user_id, intval($_POST['course_id']));
            $result = $course->mark_content_complete(intval($_POST['content_id']));
            wp_send_json_success($result);
            break;
            
        case 'load_step':
            $step_num = intval($_POST['step'] ?? 0);
            if ($step_num < 1) {
                wp_send_json_error('Invalid step number');
            }
            $dashboard = new TBC_CP_Dashboard($step_num);
            wp_send_json_success($dashboard->render_step_parts());
            break;

        case 'load_form':
            $form_id = intval($_POST['form_id']);
            $steps = tbc_cp_get_steps();
            $step_data = null;
            
            foreach ($steps as $step) {
                if ($step['type'] === 'form' && $step['form_id'] === $form_id) {
                    $step_data = $step;
                    break;
                }
            }
            
            if (!$step_data) {
                wp_send_json_error('Form step not found');
            }
            
            $form = new TBC_CP_Form_Status($user_id, $form_id, $step_data);
            $status = $form->get_form_status();
            wp_send_json_success([
                'content' => $form->render_form(),
                'status' => $status,
            ]);
            break;
            
        default:
            wp_send_json_error('Invalid action type');
    }
}

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

    if (!$entry_id || $token !== tbc_cp_calendar_token($entry_id)) {
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
        . "PRODID:-//Two Birds Church//Checkout Prerequisites//EN\r\n"
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
function tbc_cp_calendar_token(int $entry_id): string {
    return substr(wp_hash($entry_id . 'tbc_calendar'), 0, 16);
}

/**
 * Get the public calendar download URL for an entry.
 */
function tbc_cp_calendar_url(int $entry_id): string {
    return add_query_arg([
        'tbc_calendar' => $entry_id,
        'token' => tbc_cp_calendar_token($entry_id),
    ], home_url('/'));
}

register_activation_hook(__FILE__, function() {
    if (!get_option('tbc_cp_steps')) {
        update_option('tbc_cp_steps', []);
    }
});