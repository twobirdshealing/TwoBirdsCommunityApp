<?php
/**
 * Push Notification Log - lightweight delivery tracking
 *
 * Logs each batch sent via Expo Push API for admin visibility.
 * Auto-prunes entries older than 90 days via daily cron.
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_Push_Log {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('tbc_ca_daily_cleanup', [$this, 'cleanup']);
    }

    /**
     * Get the log table name
     */
    private function table() {
        global $wpdb;
        return $wpdb->prefix . 'tbc_ca_push_log';
    }

    /**
     * Log a push notification batch result
     *
     * @param string $type       Notification type ID
     * @param string $title      Notification title
     * @param string $body       Notification body
     * @param int    $recipients Intended recipient count
     * @param int    $sent       Successfully sent count
     * @param int    $failed     Failed send count
     * @param string $source     'hook' or 'manual'
     * @param int    $created_by User ID who triggered (0 for hook-triggered)
     */
    public function log($type, $title, $body, $recipients, $sent, $failed, $source = 'hook', $created_by = 0) {
        global $wpdb;

        $wpdb->insert($this->table(), [
            'type'       => sanitize_key($type),
            'title'      => sanitize_text_field($title),
            'body'       => sanitize_textarea_field($body),
            'recipients' => absint($recipients),
            'sent'       => absint($sent),
            'failed'     => absint($failed),
            'source'     => in_array($source, ['hook', 'manual'], true) ? $source : 'hook',
            'created_by' => absint($created_by),
            'created_at' => current_time('mysql'),
        ], ['%s', '%s', '%s', '%d', '%d', '%d', '%s', '%d', '%s']);
    }

    /**
     * Get recent log entries for admin display
     *
     * @param int $limit  Number of entries to return
     * @param int $offset Offset for pagination
     * @return array
     */
    public function get_recent($limit = 50, $offset = 0) {
        global $wpdb;
        $table = $this->table();

        return $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$table} ORDER BY created_at DESC LIMIT %d OFFSET %d",
            $limit,
            $offset
        ));
    }

    /**
     * Get aggregate stats for a given period
     *
     * @param int $days Number of days to look back
     * @return array
     */
    public function get_stats($days = 30) {
        global $wpdb;
        $table = $this->table();
        $since = gmdate('Y-m-d H:i:s', strtotime("-{$days} days"));

        $totals = $wpdb->get_row($wpdb->prepare(
            "SELECT
                COUNT(*) as total_batches,
                COALESCE(SUM(recipients), 0) as total_recipients,
                COALESCE(SUM(sent), 0) as total_sent,
                COALESCE(SUM(failed), 0) as total_failed
            FROM {$table}
            WHERE created_at >= %s",
            $since
        ));

        $by_type = $wpdb->get_results($wpdb->prepare(
            "SELECT type, COUNT(*) as batches, SUM(sent) as sent, SUM(failed) as failed
            FROM {$table}
            WHERE created_at >= %s
            GROUP BY type
            ORDER BY sent DESC",
            $since
        ));

        return [
            'totals' => $totals,
            'by_type' => $by_type,
        ];
    }

    /**
     * Get total log entry count (for pagination)
     */
    public function get_total_count() {
        global $wpdb;
        return (int) $wpdb->get_var("SELECT COUNT(*) FROM {$this->table()}");
    }

    /**
     * Auto-prune old log entries (called by daily cron)
     *
     * @param int $days Entries older than this are deleted
     */
    public function cleanup($days = 90) {
        global $wpdb;
        $table = $this->table();
        $cutoff = gmdate('Y-m-d H:i:s', strtotime("-{$days} days"));

        $wpdb->query($wpdb->prepare(
            "DELETE FROM {$table} WHERE created_at < %s",
            $cutoff
        ));
    }

    /**
     * Create the log table (called from plugin activation)
     */
    public static function create_table() {
        global $wpdb;
        $table_name = $wpdb->prefix . 'tbc_ca_push_log';
        $charset_collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE IF NOT EXISTS $table_name (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            type varchar(50) NOT NULL,
            title varchar(255) NOT NULL DEFAULT '',
            body text,
            recipients int unsigned NOT NULL DEFAULT 0,
            sent int unsigned NOT NULL DEFAULT 0,
            failed int unsigned NOT NULL DEFAULT 0,
            source varchar(20) NOT NULL DEFAULT 'hook',
            created_by bigint(20) unsigned NOT NULL DEFAULT 0,
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY type (type),
            KEY created_at (created_at)
        ) $charset_collate;";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta($sql);
    }
}
