<?php
/**
 * Messaging Center Database Schema
 * Creates tables for message storage and scheduler batches
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Create unified messages table for SMS, calls, and voicemail
 * Stores all incoming and outgoing messages with metadata
 */
function tbc_mc_create_messages_table() {
    global $wpdb;
    
    $table_name = $wpdb->prefix . 'tbc_mc_messages';
    $charset_collate = $wpdb->get_charset_collate();
    
    $sql = "CREATE TABLE $table_name (
        id mediumint(9) NOT NULL AUTO_INCREMENT,
        type varchar(10) NOT NULL,
        sender_number varchar(15) DEFAULT '' NOT NULL,
        content text NOT NULL,
        date_created datetime DEFAULT '0000-00-00 00:00:00' NOT NULL,
        media_url text,
        notes text,
        marked tinyint(1) DEFAULT 0 NOT NULL,
        is_read tinyint(1) DEFAULT 0 NOT NULL,
        is_reply tinyint(1) DEFAULT 0 NOT NULL,
        PRIMARY KEY (id),
        KEY type_date (type, date_created),
        KEY sender_date (sender_number, date_created),
        KEY read_status (is_read),
        KEY marked_status (marked)
    ) $charset_collate;";
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
    
    error_log('TBC Messaging Center: Messages table created - ' . $table_name);
}

/**
 * Create scheduler batches table
 * Handles immediate, scheduled, and recurring message batches
 */
function tbc_mc_create_scheduler_table() {
    global $wpdb;
    
    $table_name = $wpdb->prefix . 'tbc_mc_scheduler_batches';
    $charset_collate = $wpdb->get_charset_collate();
    
    $sql = "CREATE TABLE $table_name (
        batch_id varchar(36) NOT NULL,
        parent_id varchar(36) NOT NULL,
        chunk_index int(11) NOT NULL DEFAULT 0,
        total_chunks int(11) NOT NULL DEFAULT 1,
        message text NOT NULL,
        message_title varchar(255) DEFAULT '',
        recipients longtext NOT NULL,
        media_url text DEFAULT '',
        send_as_mms tinyint(1) DEFAULT 0,
        include_opt_out tinyint(1) DEFAULT 1,
        opt_out_message text DEFAULT '',
        include_in_log tinyint(1) DEFAULT 1,
        created_date datetime DEFAULT CURRENT_TIMESTAMP,
        status varchar(20) DEFAULT 'pending',
        processed_at datetime NULL,
        error_message text DEFAULT '',
        schedule_type varchar(20) DEFAULT 'immediate',
        cron_expression varchar(100) DEFAULT '',
        action_scheduler_id bigint(20) NULL,
        PRIMARY KEY (batch_id),
        KEY parent_id (parent_id),
        KEY status (status),
        KEY created_date (created_date),
        KEY action_scheduler_id (action_scheduler_id)
    ) $charset_collate;";
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
    
    error_log('TBC Messaging Center: Scheduler batches table created - ' . $table_name);
}