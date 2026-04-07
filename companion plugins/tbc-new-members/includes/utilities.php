<?php
/**
 * Shared utility functions — Fluent Community native
 */

function tbc_nm_get_quick_date_ranges() {
    $timezone = wp_timezone();
    $now = new DateTime('now', $timezone);
    $ranges = [];

    $ranges['current_month'] = [
        'label' => 'Current Month',
        'from' => $now->format('Y-m-01'),
        'to' => $now->format('Y-m-t')
    ];

    $last_month = clone $now;
    $last_month->modify('first day of last month');
    $ranges['last_month'] = [
        'label' => 'Last Month',
        'from' => $last_month->format('Y-m-01'),
        'to' => $last_month->format('Y-m-t')
    ];

    $three_months = clone $now;
    $three_months->modify('-2 months');
    $ranges['last_3_months'] = [
        'label' => 'Last 3 Months',
        'from' => $three_months->format('Y-m-01'),
        'to' => $now->format('Y-m-t')
    ];

    $ranges['year_to_date'] = [
        'label' => 'Year to Date',
        'from' => $now->format('Y-01-01'),
        'to' => $now->format('Y-m-t')
    ];

    $ranges['custom'] = [
        'label' => 'Custom Range',
        'from' => '',
        'to' => ''
    ];

    return $ranges;
}

function tbc_nm_get_default_date_range() {
    $ranges = tbc_nm_get_quick_date_ranges();
    return ['from' => $ranges['current_month']['from'], 'to' => $ranges['current_month']['to']];
}

/**
 * Convert a local date range to UTC-formatted strings for DB queries.
 * Returns [$from_utc, $to_utc] as 'Y-m-d H:i:s' strings.
 */
function tbc_nm_date_range_to_utc($from_date, $to_date) {
    $site_tz = wp_timezone();
    $utc_tz = new DateTimeZone('UTC');
    $from_dt = new DateTime($from_date . ' 00:00:00', $site_tz);
    $to_dt = new DateTime($to_date . ' 23:59:59', $site_tz);
    $from_dt->setTimezone($utc_tz);
    $to_dt->setTimezone($utc_tz);
    return [$from_dt->format('Y-m-d H:i:s'), $to_dt->format('Y-m-d H:i:s')];
}

/**
 * Full member rows for the members list tab
 */
function tbc_nm_get_members_in_range($from_date, $to_date) {
    global $wpdb;

    list($from_utc, $to_utc) = tbc_nm_date_range_to_utc($from_date, $to_date);

    return $wpdb->get_results($wpdb->prepare("
        SELECT u.*, GROUP_CONCAT(um.meta_value) as user_roles
        FROM {$wpdb->users} u
        LEFT JOIN {$wpdb->usermeta} um ON u.ID = um.user_id
        WHERE u.user_registered >= %s
        AND u.user_registered < %s
        AND um.meta_key = %s
        GROUP BY u.ID
        ORDER BY u.user_registered DESC
    ", $from_utc, $to_utc, $wpdb->prefix . 'capabilities'));
}

/**
 * Count-only query for dashboard stats (avoids SELECT * just to count)
 */
function tbc_nm_count_members_in_range($from_date, $to_date) {
    global $wpdb;

    list($from_utc, $to_utc) = tbc_nm_date_range_to_utc($from_date, $to_date);

    return (int) $wpdb->get_var($wpdb->prepare("
        SELECT COUNT(DISTINCT u.ID)
        FROM {$wpdb->users} u
        WHERE u.user_registered >= %s
        AND u.user_registered < %s
    ", $from_utc, $to_utc));
}

/**
 * Batch-fetch Fluent Community profile URLs for a list of user IDs.
 * Returns [user_id => url] map.
 */
function tbc_nm_get_profile_urls($user_ids) {
    if (empty($user_ids)) {
        return [];
    }

    global $wpdb;
    $table = $wpdb->prefix . 'fcom_xprofile';
    $placeholders = implode(',', array_fill(0, count($user_ids), '%d'));

    $results = $wpdb->get_results($wpdb->prepare(
        "SELECT user_id, username FROM {$table} WHERE user_id IN ({$placeholders})",
        ...$user_ids
    ));

    $base_url = '';
    if (class_exists('\FluentCommunity\App\Services\Helper')) {
        $base_url = \FluentCommunity\App\Services\Helper::baseUrl('u/');
    }

    $urls = [];
    foreach ($results as $row) {
        $urls[$row->user_id] = $base_url
            ? $base_url . $row->username
            : get_author_posts_url($row->user_id);
    }

    // Fallback for users not in fcom_xprofile
    foreach ($user_ids as $id) {
        if (!isset($urls[$id])) {
            $urls[$id] = get_author_posts_url($id);
        }
    }

    return $urls;
}

/**
 * Parse date range from $_GET with defaults
 */
function tbc_nm_get_request_date_range() {
    $defaults = tbc_nm_get_default_date_range();
    return [
        'from' => isset($_GET['from_date']) ? sanitize_text_field($_GET['from_date']) : $defaults['from'],
        'to' => isset($_GET['to_date']) ? sanitize_text_field($_GET['to_date']) : $defaults['to'],
    ];
}
