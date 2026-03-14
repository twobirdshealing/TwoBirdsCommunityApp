<?php
/**
 * AJAX Handlers for Book Club Plugin
 */

if (!defined('ABSPATH')) {
    exit;
}

class Tbc_Bc_Ajax_Handlers {
    
    const MODERATOR_ACHIEVEMENT_ID = 30956;
    
    public function __construct() {
        add_action('wp_ajax_tbc_bc_save_book', array($this, 'ajax_save_book'));
        add_action('wp_ajax_tbc_bc_delete_book', array($this, 'ajax_delete_book'));
        add_action('wp_ajax_tbc_bc_set_current_book', array($this, 'ajax_set_current_book'));
        add_action('wp_ajax_tbc_bc_reorder_books', array($this, 'ajax_reorder_books'));
        add_action('wp_ajax_tbc_bc_search_users', array($this, 'ajax_search_users'));
        add_action('wp_ajax_tbc_bc_award_moderator', array($this, 'ajax_award_moderator'));

    }

    public function ajax_save_book() {
        check_ajax_referer('tbc-bc-admin-nonce', 'nonce');
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Insufficient permissions');
        }

        global $wpdb;
        
        $book_id = isset($_POST['book_id']) ? intval($_POST['book_id']) : 0;
        
        $chapters = json_decode(stripslashes($_POST['chapters']), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            wp_send_json_error('Invalid chapter data');
        }

        $schedule_data = json_decode(stripslashes($_POST['schedule_data']), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            wp_send_json_error('Invalid schedule data');
        }

        usort($chapters, function($a, $b) {
            return $a['time'] - $b['time'];
        });

        // Build moderator_data - preserve existing award status if updating
        $moderator_data = null;
        $moderator_user_id = !empty($_POST['moderator_user_id']) ? intval($_POST['moderator_user_id']) : null;
        
        if ($moderator_user_id) {
            $existing_moderator_data = null;
            
            if ($book_id > 0) {
                $existing_book = $wpdb->get_row($wpdb->prepare(
                    "SELECT moderator_data FROM {$wpdb->prefix}tbc_bc_books WHERE id = %d",
                    $book_id
                ));
                if ($existing_book && $existing_book->moderator_data) {
                    $existing_moderator_data = json_decode($existing_book->moderator_data, true);
                }
            }
            
            $moderator_data = array(
                'user_id' => $moderator_user_id,
                'awarded' => false,
                'awarded_at' => null,
                'awarded_by' => null
            );
            
            // Preserve award status if same moderator
            if ($existing_moderator_data && $existing_moderator_data['user_id'] === $moderator_user_id) {
                $moderator_data['awarded'] = $existing_moderator_data['awarded'] ?? false;
                $moderator_data['awarded_at'] = $existing_moderator_data['awarded_at'] ?? null;
                $moderator_data['awarded_by'] = $existing_moderator_data['awarded_by'] ?? null;
            }
        }

        $data = array(
            'title' => sanitize_text_field($_POST['title']),
            'author' => sanitize_text_field($_POST['author']),
            'description' => wp_kses_post($_POST['description']),
            'cover_image' => esc_url_raw($_POST['cover_image']),
            'single_audio_url' => esc_url_raw($_POST['single_audio_url']),
            'chapters' => wp_json_encode($chapters),
            'schedule_data' => wp_json_encode($schedule_data),
            'meeting_link' => esc_url_raw($_POST['meeting_link']),
            'meeting_id' => sanitize_text_field($_POST['meeting_id']),
            'meeting_passcode' => sanitize_text_field($_POST['meeting_passcode']),
            'moderator_data' => $moderator_data ? wp_json_encode($moderator_data) : null
        );

        if ($book_id > 0) {
            $result = $wpdb->update(
                $wpdb->prefix . 'tbc_bc_books',
                $data,
                array('id' => $book_id)
            );
        } else {
            $wpdb->query("UPDATE {$wpdb->prefix}tbc_bc_books SET display_order = display_order + 1");
            $data['display_order'] = 1;
            
            $result = $wpdb->insert(
                $wpdb->prefix . 'tbc_bc_books',
                $data
            );
            $book_id = $wpdb->insert_id;
        }

        if ($result === false) {
            wp_send_json_error('Database error: ' . $wpdb->last_error);
        }

        wp_send_json_success(array('book_id' => $book_id));
    }

    public function ajax_delete_book() {
        check_ajax_referer('tbc-bc-admin-nonce', 'nonce');
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Insufficient permissions');
        }

        global $wpdb;
        $book_id = isset($_POST['book_id']) ? intval($_POST['book_id']) : 0;
        
        if ($book_id <= 0) {
            wp_send_json_error('Invalid book ID');
        }

        $result = $wpdb->delete(
            $wpdb->prefix . 'tbc_bc_books',
            array('id' => $book_id)
        );

        if ($result === false) {
            wp_send_json_error('Database error: ' . $wpdb->last_error);
        }

        wp_send_json_success();
    }

    public function ajax_set_current_book() {
        check_ajax_referer('tbc-bc-admin-nonce', 'nonce');
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Insufficient permissions');
        }

        global $wpdb;
        $book_id = isset($_POST['book_id']) ? intval($_POST['book_id']) : 0;
        $is_current = isset($_POST['is_current']) ? intval($_POST['is_current']) : 0;

        if ($book_id <= 0) {
            wp_send_json_error('Invalid book ID');
        }

        $wpdb->update(
            $wpdb->prefix . 'tbc_bc_books',
            array('is_current' => 0),
            array('is_current' => 1)
        );

        if ($is_current) {
            $result = $wpdb->update(
                $wpdb->prefix . 'tbc_bc_books',
                array('is_current' => 1),
                array('id' => $book_id)
            );

            if ($result === false) {
                wp_send_json_error('Database error: ' . $wpdb->last_error);
            }
        }

        wp_send_json_success();
    }

    public function ajax_reorder_books() {
        check_ajax_referer('tbc-bc-admin-nonce', 'nonce');
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Insufficient permissions');
        }

        global $wpdb;
        $order = json_decode(stripslashes($_POST['order']));
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            wp_send_json_error('Invalid order data');
        }

        foreach ($order as $position => $book_id) {
            $wpdb->update(
                $wpdb->prefix . 'tbc_bc_books',
                array('display_order' => $position),
                array('id' => intval($book_id))
            );
        }

        wp_send_json_success();
    }

    public function ajax_search_users() {
        check_ajax_referer('tbc-bc-admin-nonce', 'nonce');
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Insufficient permissions');
        }

        $search = isset($_GET['search']) ? sanitize_text_field($_GET['search']) : '';
        
        if (strlen($search) < 2) {
            wp_send_json_success(array());
        }

        $users = get_users(array(
            'search' => '*' . $search . '*',
            'search_columns' => array('user_login', 'user_nicename', 'display_name', 'user_email'),
            'number' => 10,
            'fields' => array('ID', 'display_name', 'user_email')
        ));

        $results = array();
        foreach ($users as $user) {
            $results[] = array(
                'id' => $user->ID,
                'name' => $user->display_name,
                'email' => $user->user_email
            );
        }

        wp_send_json_success($results);
    }

    public function ajax_award_moderator() {
        check_ajax_referer('tbc-bc-admin-nonce', 'nonce');
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Insufficient permissions');
        }

        global $wpdb;
        
        $book_id = isset($_POST['book_id']) ? intval($_POST['book_id']) : 0;
        
        if ($book_id <= 0) {
            wp_send_json_error('Invalid book ID');
        }

        $book = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}tbc_bc_books WHERE id = %d",
            $book_id
        ));

        if (!$book) {
            wp_send_json_error('Book not found');
        }

        $moderator_data = json_decode($book->moderator_data, true);
        
        if (empty($moderator_data) || empty($moderator_data['user_id'])) {
            wp_send_json_error('No moderator assigned to this book');
        }

        if (!empty($moderator_data['awarded'])) {
            wp_send_json_error('Achievement already awarded for this book');
        }

        if (!function_exists('gamipress_award_achievement_to_user')) {
            wp_send_json_error('GamiPress not available');
        }

        // Award the achievement
        gamipress_award_achievement_to_user(self::MODERATOR_ACHIEVEMENT_ID, $moderator_data['user_id']);

        // Update moderator_data with award status
        $moderator_data['awarded'] = true;
        $moderator_data['awarded_at'] = current_time('mysql');
        $moderator_data['awarded_by'] = get_current_user_id();

        $result = $wpdb->update(
            $wpdb->prefix . 'tbc_bc_books',
            array('moderator_data' => wp_json_encode($moderator_data)),
            array('id' => $book_id)
        );

        if ($result === false) {
            wp_send_json_error('Failed to update award status');
        }

        $user = get_userdata($moderator_data['user_id']);

        wp_send_json_success(array(
            'message' => sprintf('Book Club Moderator achievement awarded to %s!', $user->display_name),
            'user_name' => $user->display_name
        ));
    }

}