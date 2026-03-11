<?php
/**
 * Book Club - Database Creation
 */
if (!defined('ABSPATH')) {
    exit;
}

function tbc_bc_create_tables() {
    global $wpdb;
    $books_table = $wpdb->prefix . 'tbc_bc_books';
    $bookmarks_table = $wpdb->prefix . 'tbc_bc_bookmarks';
    $charset_collate = $wpdb->get_charset_collate();

    $sql_books = "CREATE TABLE IF NOT EXISTS $books_table (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        title varchar(255) NOT NULL,
        author varchar(255) NOT NULL,
        description text,
        chapters longtext,
        cover_image varchar(255),
        single_audio_url text,
        schedule_data longtext,
        meeting_link text,
        meeting_id varchar(255),
        meeting_passcode varchar(255),
        moderator_data longtext,
        display_order int NOT NULL DEFAULT 0,
        is_current tinyint(1) NOT NULL DEFAULT 0,
        created_at datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
    ) $charset_collate;";

    $sql_bookmarks = "CREATE TABLE IF NOT EXISTS $bookmarks_table (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        user_id bigint(20) NOT NULL,
        book_id bigint(20) NOT NULL,
        timestamp float NOT NULL,
        title varchar(255),
        created_at datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY book_id (book_id),
        CONSTRAINT tbc_bc_bookmarks_fk FOREIGN KEY (book_id) REFERENCES $books_table(id) ON DELETE CASCADE
    ) $charset_collate;";

    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    
    dbDelta($sql_books);
    dbDelta($sql_bookmarks);

    $books_columns = $wpdb->get_col("DESC {$books_table}");
    if (!in_array('moderator_data', $books_columns)) {
        $wpdb->query("ALTER TABLE {$books_table} ADD moderator_data longtext AFTER meeting_passcode");
    }
}