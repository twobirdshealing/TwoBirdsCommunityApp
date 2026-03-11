<?php
/**
 * Plugin Name: TBC - Checkout Prerequisites
 * Plugin URI: https://twobirdschurch.com
 * Description: Displays prerequisite steps customers must complete before checkout
 * Version: 3.0.8
 * Author: Two Birds Church
 * Author URI: https://twobirdschurch.com
 * Text Domain: tbc-checkout-prerequisites
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

define('TBC_CP_VERSION', '3.0.8');
define('TBC_CP_DIR', plugin_dir_path(__FILE__));
define('TBC_CP_URL', plugin_dir_url(__FILE__));

require_once TBC_CP_DIR . 'includes/class-tbc-cp-settings.php';
require_once TBC_CP_DIR . 'includes/class-tbc-cp-course-status.php';
require_once TBC_CP_DIR . 'includes/class-tbc-cp-form-status.php';
require_once TBC_CP_DIR . 'includes/class-tbc-cp-dashboard.php';

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
    TBC_CP_Dashboard::init();
    TBC_CP_Form_Status::init_global_hooks();
});

add_action('wp_enqueue_scripts', function() {
    if (!is_checkout()) {
        return;
    }
    
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

register_activation_hook(__FILE__, function() {
    if (!get_option('tbc_cp_steps')) {
        update_option('tbc_cp_steps', []);
    }
});