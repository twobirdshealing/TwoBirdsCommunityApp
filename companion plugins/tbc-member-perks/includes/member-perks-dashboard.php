<?php
if (!defined('ABSPATH')) {
    exit;
}

class WMP_Dashboard {
    public function __construct() {
        add_shortcode('member_perks', array($this, 'member_perks_shortcode'));
        add_action('admin_menu', array($this, 'add_menu_items'));
    }

    public function add_menu_items() {
        add_menu_page(
            'Member Perks Dashboard',
            'Member Perks',
            'manage_options',
            'member-perks-dashboard',
            array($this, 'dashboard_page_content'),
            'dashicons-groups',
            6
        );

        add_submenu_page(
            'member-perks-dashboard',
            'Member Perks Settings',
            'Settings',
            'manage_options',
            'member-perks-settings',
            array($this, 'display_settings_page')
        );
        
        remove_submenu_page('member-perks-dashboard', 'member-perks-dashboard');
    }

    public function dashboard_page_content() {
        echo do_shortcode('[member_perks]');
    }

    public function member_perks_shortcode() {
        if (!current_user_can('manage_options')) {
            return 'You do not have permission to view this content.';
        }

        ob_start();

        $data = $this->get_dashboard_data();
        if (empty($data['levels'])) {
            echo '<div class="member-perks-container">
                    <h1>Member Perks Dashboard</h1>
                    <p class="no-data">No levels defined. Please create perk levels to start managing member subscriptions.</p>
                  </div>';
            return ob_get_clean();
        }

        $this->render_dashboard($data);
        return ob_get_clean();
    }

    private function get_dashboard_data() {
        global $wpdb;
        
        $perk_levels_table = $wpdb->prefix . 'perk_levels';
        $imported_subscribers_table = $wpdb->prefix . 'imported_subscribers';

        // Get levels
        $levels = $wpdb->get_results(
            "SELECT * FROM {$perk_levels_table} ORDER BY min_amount ASC",
            ARRAY_A
        );

        if (empty($levels)) {
            return array('levels' => array());
        }

        // Initialize level data
        foreach ($levels as &$level) {
            $level['subscribers'] = 0;
            $level['revenue'] = 0.0;
        }

        // Get WooCommerce subscriptions
        $subscriptions = function_exists('wcs_get_subscriptions') ? 
            wcs_get_subscriptions(array(
                'subscriptions_per_page' => -1,
                'subscription_status' => 'active'
            )) : array();

        // Get imported subscribers
        $imported_subscribers = $wpdb->get_results(
            "SELECT * FROM {$imported_subscribers_table}",
            ARRAY_A
        );

        // Process WooCommerce subscriptions
        foreach ($subscriptions as $subscription) {
            $renewal_count = $subscription->get_payment_count();
            foreach ($levels as &$level) {
                if ($this->is_in_level_range($renewal_count, $level)) {
                    $level['subscribers']++;
                    $level['revenue'] += floatval($subscription->get_total());
                }
            }
        }

        // Process imported subscribers
        foreach ($imported_subscribers as $subscriber) {
            foreach ($levels as &$level) {
                if ($this->is_in_level_range($subscriber['renewal_count'], $level)) {
                    $level['subscribers']++;
                    $level['revenue'] += floatval($subscriber['subscription_amount']);
                }
            }
        }

        unset($level);

        return array(
            'levels' => $levels,
            'total_subscribers' => count($subscriptions) + count($imported_subscribers),
            'total_revenue' => array_sum(array_column($levels, 'revenue'))
        );
    }

    private function is_in_level_range($count, $level) {
        return $count >= $level['min_amount'] && 
               ($count <= $level['max_amount'] || $level['max_amount'] == 0);
    }

    private function render_dashboard($data) {
        echo '<div class="member-perks-container">';
        echo '<h1 class="dashboard-title">Member Perks Dashboard</h1><hr>';

        // Totals section
        echo '<div class="perk-totals">';
        echo '<section class="subscription-totals">';
        echo '<p>Total subscribers: ' . $data['total_subscribers'] . ', Total revenue: $' . number_format($data['total_revenue'], 2) . '</p>';
        echo '</section>';

        echo '<section class="level-details">';
        foreach ($data['levels'] as $level) {
            echo '<div class="level-info">';
            echo '<p>' . esc_html($level['name']) . ': ' . $level['subscribers'] . ' subscribers, $' . number_format($level['revenue'], 2) . ' revenue</p>';
            echo '</div>';
        }
        echo '</section>';
        echo '</div>';

        // Subscribers table section
        if (class_exists('WMP_SubscribersTable')) {
            $current_level = isset($_GET['level']) ? intval($_GET['level']) : -1;
            echo '<section class="member-subscriptions">';
            echo '<h2>Member Subscriptions by Level</h2>';
            
            $this->render_level_selector($data['levels'], $current_level);
            WMP_SubscribersTable::display($current_level);
            
            echo '</section>';
        }

        echo '</div>';
    }

    private function render_level_selector($levels, $current_level) {
        echo '<form method="get" class="level-select-form">';
        echo '<input type="hidden" name="page" value="member-perks-dashboard">';
        echo '<select name="level" onchange="this.form.submit()">';
        echo '<option value="-1"' . ($current_level == -1 ? ' selected' : '') . '>All Subscribers</option>';
        
        foreach ($levels as $level) {
            $min_renewals = (int)$level['min_amount'];
            $max_renewals = ($level['max_amount'] == 0) ? '∞' : (int)$level['max_amount'];
            $selected = ($current_level == $level['min_amount']) ? 'selected' : '';
            echo "<option value='{$level['min_amount']}' {$selected}>" . 
                 esc_html($level['name']) . " ({$min_renewals} - {$max_renewals} Renewals)</option>";
        }
        
        echo '</select>';
        echo '</form>';
    }

    public function display_settings_page() {
        if (class_exists('WMP_Settings')) {
            $settings_page = new WMP_Settings();
            $settings_page->display_settings_page();
        } else {
            echo '<div class="wrap"><h1>Member Perks Settings</h1><p>Settings functionality is not available.</p></div>';
        }
    }
}

new WMP_Dashboard();