<?php
/**
 * Call Center AJAX Handlers
 * User search and Twilio call initiation
 *
 * NOTE: Legacy [tbc_mc_call_center] shortcode removed - now part of unified Message Center
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Function to handle the AJAX search request
function tbc_mc_search_users() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => 'Insufficient permissions']);
    }

    global $wpdb;

    $search = '%' . $wpdb->esc_like(sanitize_text_field($_REQUEST['term'])) . '%';

    $sql = $wpdb->prepare("SELECT ID, user_login, display_name FROM $wpdb->users WHERE display_name LIKE %s OR user_login LIKE %s LIMIT 10", $search, $search);
    $results = $wpdb->get_results($sql);

    $users_array = [];
    foreach ($results as $result) {
        $users_array[] = [
            'id' => $result->ID,
            'value' => $result->display_name,
            'label' => $result->display_name . ' (' . $result->user_login . ')'
        ];
    }

    echo json_encode($users_array);
    exit;
}
add_action('wp_ajax_tbc_mc_search_users', 'tbc_mc_search_users');

// AJAX Endpoint to get selected user's number
function tbc_mc_ajax_get_phone() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => 'Insufficient permissions']);
    }

    $user_id = intval($_POST['user_id']);

    $phone = tbc_mc_get_phone_from_profile($user_id);
    
    if ($phone) {
        tbc_mc_ajax_feedback('success', 'Phone number retrieved', ['phone' => $phone]);
    } else {
        tbc_mc_ajax_feedback('error', 'Phone number not found.');
    }
}
add_action('wp_ajax_tbc_mc_get_phone', 'tbc_mc_ajax_get_phone');

// AJAX Endpoint to initiate a Twilio call
function tbc_mc_ajax_initiate_call() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => 'Insufficient permissions']);
    }

    $destination_number = sanitize_text_field($_POST['destination_number']);
    $caller_number = tbc_mc_get_phone_from_profile(get_current_user_id());

    $response = tbc_mc_initiate_call($destination_number, $caller_number);
    
    // Convert to helper format
    if ($response['type'] === 'success') {
        tbc_mc_ajax_feedback('success', $response['message']);
    } else {
        tbc_mc_ajax_feedback('error', $response['message']);
    }
}
add_action('wp_ajax_tbc_mc_initiate_call', 'tbc_mc_ajax_initiate_call');