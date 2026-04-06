<?php
/**
 * Post Settings Helpers
 * 
 * Business logic for post template management including database CRUD operations.
 * 
 * @package TBC_Participant_Frontend
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Create post types table on plugin activation
 */
function tbc_pf_ps_create_post_types_table() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'tbc_pf_event_post_types';
    $charset_collate = $wpdb->get_charset_collate();

    $sql = "CREATE TABLE IF NOT EXISTS $table_name (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        post_title VARCHAR(255) NOT NULL,
        content LONGTEXT NOT NULL,
        author_user_id BIGINT NOT NULL,
        schedule_timing VARCHAR(50) NOT NULL,
        media_images TEXT,
        media_videos TEXT,
        is_active TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_active (is_active),
        INDEX idx_schedule (schedule_timing)
    ) $charset_collate;";

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta($sql);
}

/**
 * Get all active post type templates
 */
function tbc_pf_ps_get_all_post_types() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'tbc_pf_event_post_types';
    
    $results = $wpdb->get_results(
    "SELECT * FROM $table_name WHERE is_active = 1 ORDER BY id ASC",
    ARRAY_A
);    
    if (!$results) {
        return [];
    }
    
    foreach ($results as &$row) {
        $row['media_images'] = !empty($row['media_images']) ? json_decode($row['media_images'], true) : [];
        $row['media_videos'] = !empty($row['media_videos']) ? json_decode($row['media_videos'], true) : [];
    }
    
    return $results;
}

/**
 * Get single post type template by ID
 */
function tbc_pf_ps_get_post_type($id) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'tbc_pf_event_post_types';
    
    $result = $wpdb->get_row(
        $wpdb->prepare("SELECT * FROM $table_name WHERE id = %d", $id),
        ARRAY_A
    );
    
    if (!$result) {
        return null;
    }
    
    $result['media_images'] = !empty($result['media_images']) ? json_decode($result['media_images'], true) : [];
    $result['media_videos'] = !empty($result['media_videos']) ? json_decode($result['media_videos'], true) : [];
    
    return $result;
}

/**
 * Create new post type template
 */
function tbc_pf_ps_create_post_type($data) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'tbc_pf_event_post_types';
    
    $insert_data = [
        'title' => sanitize_text_field($data['title']),
        'post_title' => sanitize_text_field($data['post_title']),
        'content' => $data['content'],
        'author_user_id' => intval($data['author_user_id']),
        'schedule_timing' => sanitize_text_field($data['schedule_timing']),
        'media_images' => !empty($data['media_images']) ? wp_json_encode($data['media_images']) : '',
        'media_videos' => !empty($data['media_videos']) ? wp_json_encode($data['media_videos']) : ''
    ];
    
    $result = $wpdb->insert($table_name, $insert_data);
    
    return $result ? $wpdb->insert_id : false;
}

/**
 * Update post type template
 */
function tbc_pf_ps_update_post_type($id, $data) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'tbc_pf_event_post_types';
    
    $update_data = [
        'title' => sanitize_text_field($data['title']),
        'post_title' => sanitize_text_field($data['post_title']),
        'content' => $data['content'],
        'author_user_id' => intval($data['author_user_id']),
        'schedule_timing' => sanitize_text_field($data['schedule_timing']),
        'media_images' => !empty($data['media_images']) ? wp_json_encode($data['media_images']) : '',
        'media_videos' => !empty($data['media_videos']) ? wp_json_encode($data['media_videos']) : ''
    ];
    
    $result = $wpdb->update($table_name, $update_data, ['id' => $id]);
    
    return $result !== false;
}

/**
 * Delete post type template (soft delete)
 */
function tbc_pf_ps_delete_post_type($id) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'tbc_pf_event_post_types';
    
    $result = $wpdb->update($table_name, ['is_active' => 0], ['id' => $id]);
    
    return $result !== false;
}

/**
 * Get schedule timing options
 */
function tbc_pf_ps_get_schedule_options() {
    return [
        'immediate' => 'Send Immediately',
        '2weeks_before' => '2 Weeks Before Event',
        '1week_before' => '1 Week Before Event',
        '2days_before' => '2 Days Before Event',
        'day_of_event' => 'Day of Event',
        '1day_after' => '1 Day After Event',
        '3days_after' => '3 Days After Event',
        '1week_after' => '1 Week After Event',
        '2weeks_after' => '2 Weeks After Event',
        '1month_after' => '1 Month After Event',
        '2months_after' => '2 Months After Event',
        '3months_after' => '3 Months After Event',
        '4months_after' => '4 Months After Event',
        '1year_after' => '1 Year After Event'
    ];
}

/**
 * Get author options
 */
function tbc_pf_ps_get_author_options() {
    return [
        1 => 'Two Birds Church (Admin)',
        168 => 'James Elrod',
        2606 => 'Christina Titus'
    ];
}

/**
 * AJAX: Create post type template
 */
function tbc_pf_ajax_create_post_type() {
    if (!isset($_POST['title'], $_POST['post_title'], $_POST['content'])) {
        wp_send_json_error(['message' => 'Missing required fields']);
    }
    
    $data = [
        'title' => wp_unslash($_POST['title']),
        'post_title' => wp_unslash($_POST['post_title']),
        'content' => wp_unslash($_POST['content']),
        'author_user_id' => isset($_POST['author_user_id']) ? intval($_POST['author_user_id']) : 1,
        'schedule_timing' => isset($_POST['schedule_timing']) ? $_POST['schedule_timing'] : 'immediate',
        'media_images' => isset($_POST['media_images']) ? json_decode(stripslashes($_POST['media_images']), true) : [],
        'media_videos' => isset($_POST['media_videos']) ? json_decode(stripslashes($_POST['media_videos']), true) : []
    ];

    $id = tbc_pf_ps_create_post_type($data);
    
    if ($id) {
        wp_send_json_success(['message' => 'Template created', 'id' => $id]);
    } else {
        wp_send_json_error(['message' => 'Failed to create template']);
    }
}
add_action('wp_ajax_tbc_pf_create_post_type', 'tbc_pf_ajax_create_post_type');

/**
 * AJAX: Update post type template
 */
function tbc_pf_ajax_update_post_type() {
    if (!isset($_POST['id'], $_POST['title'], $_POST['post_title'], $_POST['content'])) {
        wp_send_json_error(['message' => 'Missing required fields']);
    }
    
    $id = intval($_POST['id']);
    $data = [
        'title' => wp_unslash($_POST['title']),
        'post_title' => wp_unslash($_POST['post_title']),
        'content' => wp_unslash($_POST['content']),
        'author_user_id' => isset($_POST['author_user_id']) ? intval($_POST['author_user_id']) : 1,
        'schedule_timing' => isset($_POST['schedule_timing']) ? $_POST['schedule_timing'] : 'immediate',
        'media_images' => isset($_POST['media_images']) ? json_decode(stripslashes($_POST['media_images']), true) : [],
        'media_videos' => isset($_POST['media_videos']) ? json_decode(stripslashes($_POST['media_videos']), true) : []
    ];

    $success = tbc_pf_ps_update_post_type($id, $data);
    
    if ($success) {
        wp_send_json_success(['message' => 'Template updated']);
    } else {
        wp_send_json_error(['message' => 'Failed to update template']);
    }
}
add_action('wp_ajax_tbc_pf_update_post_type', 'tbc_pf_ajax_update_post_type');

/**
 * AJAX: Delete post type template
 */
function tbc_pf_ajax_delete_post_type() {
    if (!isset($_POST['id'])) {
        wp_send_json_error(['message' => 'Missing template ID']);
    }
    
    $id = intval($_POST['id']);
    $success = tbc_pf_ps_delete_post_type($id);
    
    if ($success) {
        wp_send_json_success(['message' => 'Template deleted']);
    } else {
        wp_send_json_error(['message' => 'Failed to delete template']);
    }
}
add_action('wp_ajax_tbc_pf_delete_post_type', 'tbc_pf_ajax_delete_post_type');

/**
 * AJAX: Get post type template for editing
 */
function tbc_pf_ajax_get_post_type() {
    if (!isset($_POST['id'])) {
        wp_send_json_error(['message' => 'Missing template ID']);
    }
    
    $id = intval($_POST['id']);
    $template = tbc_pf_ps_get_post_type($id);
    
    if ($template) {
        wp_send_json_success($template);
    } else {
        wp_send_json_error(['message' => 'Template not found']);
    }
}
add_action('wp_ajax_tbc_pf_get_post_type', 'tbc_pf_ajax_get_post_type');