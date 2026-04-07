<?php
if (!defined('ABSPATH')) {
    exit;
}

// Create perk levels table
add_action('init', 'wmp_create_perk_levels_table');
function wmp_create_perk_levels_table() {
    global $wpdb;
    
    $table_name = $wpdb->prefix . 'perk_levels';
    $charset_collate = $wpdb->get_charset_collate();

    $sql = "CREATE TABLE $table_name (
        id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        min_amount DECIMAL(10, 2) NOT NULL,
        max_amount DECIMAL(10, 2) NOT NULL,
        role VARCHAR(100) NOT NULL,
        discount DECIMAL(5, 2) NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        KEY idx_min_amount (min_amount),
        KEY idx_discount (discount)
    ) $charset_collate;";

    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
}

// Create imported subscribers table
add_action('init', 'wmp_create_imported_subscribers_table');
function wmp_create_imported_subscribers_table() {
    global $wpdb;
    
    $table_name = $wpdb->prefix . 'imported_subscribers';
    $charset_collate = $wpdb->get_charset_collate();

    $sql = "CREATE TABLE $table_name (
        ID int NOT NULL AUTO_INCREMENT,
        user_id int DEFAULT NULL,
        first_name varchar(255) NOT NULL,
        last_name varchar(255) NOT NULL,
        email varchar(255) NOT NULL,
        phone varchar(255) DEFAULT NULL,
        start_date date NOT NULL,
        subscription_amount decimal(10,2) NOT NULL,
        renewal_count int NOT NULL DEFAULT 0,
        PRIMARY KEY (ID),
        KEY idx_user_id (user_id),
        KEY idx_email (email),
        KEY idx_renewal_count (renewal_count)
    ) $charset_collate;";

    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
}