<?php
if (!defined('ABSPATH')) {
    exit;
}

class WMP_SubscribersTable {
    
    public static function display($selected_level) {
        global $wpdb;
        
        $perk_levels_table = $wpdb->prefix . 'perk_levels';
        $imported_subscribers_table = $wpdb->prefix . 'imported_subscribers';

        $levels = $wpdb->get_results(
            "SELECT * FROM {$perk_levels_table} ORDER BY min_amount ASC",
            ARRAY_A
        );
        
        $defined_roles = wp_list_pluck($levels, 'role');
        $imported_subscribers = $wpdb->get_results(
            "SELECT * FROM {$imported_subscribers_table}",
            ARRAY_A
        );

        self::render_table_header($selected_level, $levels);

        $subscriptions = function_exists('wcs_get_subscriptions') ? 
            wcs_get_subscriptions(array(
                'subscriptions_per_page' => -1,
                'subscription_status' => 'active'
            )) : array();

        echo "<table class='wp-list-table widefat striped member-perks-table'>";
        echo "<thead><tr><th>Full Name</th><th>Email</th><th>Phone</th><th>Amount</th><th>Renewals</th><th>Role</th></tr></thead>";
        echo "<tbody>";

        self::render_woocommerce_subscriptions($subscriptions, $selected_level, $levels, $defined_roles);
        self::render_imported_subscribers($imported_subscribers, $selected_level, $levels, $defined_roles);

        echo "</tbody></table>";
    }

    private static function render_table_header($selected_level, $levels) {
        if ($selected_level == -1) {
            echo "<h3>All Subscribers</h3>";
            return;
        }

        foreach ($levels as $level) {
            if ($selected_level == $level['min_amount']) {
                $min_renewals = (int) $level['min_amount'];
                $max_renewals = ($level['max_amount'] == 0) ? '∞' : (int) $level['max_amount'];
                $level_range = "{$min_renewals} - {$max_renewals} Renewals";
                echo "<h3>" . esc_html($level['name']) . " ({$level_range})</h3>";
                break;
            }
        }
    }

    private static function render_woocommerce_subscriptions($subscriptions, $selected_level, $levels, $defined_roles) {
        foreach ($subscriptions as $subscription) {
            $renewal_count = $subscription->get_payment_count();
            
            if (!self::is_in_selected_level($renewal_count, $selected_level, $levels)) {
                continue;
            }

            $user_id = $subscription->get_user_id();
            $user = get_userdata($user_id);
            
            if (!$user) {
                continue;
            }

            $phone = get_user_meta($user_id, 'billing_phone', true);
            $user_role_name = self::get_user_role_name($user->roles, $defined_roles);
            $profile_url = function_exists('bp_core_get_user_domain') ? 
                bp_core_get_user_domain($user_id) : 
                admin_url('user-edit.php?user_id=' . $user_id);

            echo "<tr>";
            echo "<td><a href='" . esc_url($profile_url) . "'>" . esc_html($user->display_name) . "</a></td>";
            echo "<td>" . esc_html($user->user_email) . "</td>";
            echo "<td>" . esc_html($phone) . "</td>";
            echo "<td>$" . number_format($subscription->get_total(), 2) . "</td>";
            echo "<td>" . intval($renewal_count) . "</td>";
            echo "<td>" . self::render_role_dropdown($user_id, $user_role_name, $defined_roles) . "</td>";
            echo "</tr>";
        }
    }

    private static function render_imported_subscribers($imported_subscribers, $selected_level, $levels, $defined_roles) {
        foreach ($imported_subscribers as $subscriber) {
            $renewal_count = $subscriber['renewal_count'];
            
            if (!self::is_in_selected_level($renewal_count, $selected_level, $levels)) {
                continue;
            }

            $user_id = $subscriber['user_id'];
            $user = $user_id ? get_userdata($user_id) : null;
            $user_role_name = $user ? self::get_user_role_name($user->roles, $defined_roles) : '';
            
            $full_name = $subscriber['first_name'] . ' ' . $subscriber['last_name'];
            
            if ($user && function_exists('bp_core_get_user_domain')) {
                $profile_url = bp_core_get_user_domain($user_id);
                $name_display = "<a href='" . esc_url($profile_url) . "'>" . esc_html($full_name) . "</a>";
            } elseif ($user) {
                $profile_url = admin_url('user-edit.php?user_id=' . $user_id);
                $name_display = "<a href='" . esc_url($profile_url) . "'>" . esc_html($full_name) . "</a>";
            } else {
                $name_display = esc_html($full_name);
            }

            echo "<tr>";
            echo "<td>{$name_display}</td>";
            echo "<td>" . esc_html($subscriber['email']) . "</td>";
            echo "<td>" . esc_html($subscriber['phone']) . "</td>";
            echo "<td>$" . number_format($subscriber['subscription_amount'], 2) . "</td>";
            echo "<td>" . intval($renewal_count) . "</td>";
            echo "<td>" . self::render_role_dropdown($user_id, $user_role_name, $defined_roles) . "</td>";
            echo "</tr>";
        }
    }

    private static function is_in_selected_level($renewal_count, $selected_level, $levels) {
        if ($selected_level == -1) {
            return true;
        }

        foreach ($levels as $level) {
            if ($selected_level == $level['min_amount']) {
                return $renewal_count >= $level['min_amount'] && 
                       ($renewal_count <= $level['max_amount'] || $level['max_amount'] == 0);
            }
        }

        return false;
    }

    private static function get_user_role_name($user_roles, $defined_roles) {
        foreach ($user_roles as $role) {
            if (in_array($role, $defined_roles)) {
                return $role;
            }
        }
        return '';
    }

    private static function render_role_dropdown($user_id, $current_role, $defined_roles) {
        if (!$user_id) {
            return '<span class="description">No User ID</span>';
        }

        $nonce = wp_create_nonce('update_user_role_nonce');
        $output = "<select class='role-dropdown' data-user-id='{$user_id}' data-nonce='{$nonce}'>";
        $output .= "<option value=''>Select Role</option>";
        
        foreach ($defined_roles as $role) {
            if (empty($role)) continue;
            $selected = ($role === $current_role) ? 'selected' : '';
            $output .= "<option value='" . esc_attr($role) . "' {$selected}>" . esc_html($role) . "</option>";
        }
        
        $output .= "</select>";
        return $output;
    }

    public static function handle_role_update() {
        check_ajax_referer('update_user_role_nonce', 'nonce');

        $user_id = intval($_POST['user_id']);
        $new_role = sanitize_text_field($_POST['new_role']);

        if (!$user_id || !$new_role) {
            wp_send_json_error('Invalid parameters');
        }

        $user = get_user_by('ID', $user_id);
        if (!$user) {
            wp_send_json_error('User not found');
        }

        // Get defined roles
        global $wpdb;
        $perk_levels_table = $wpdb->prefix . 'perk_levels';
        $defined_roles = $wpdb->get_col("SELECT DISTINCT role FROM {$perk_levels_table} WHERE role != ''");

        // Remove existing perk roles
        foreach ($user->roles as $role) {
            if (in_array($role, $defined_roles)) {
                $user->remove_role($role);
            }
        }

        // Add new role
        $user->add_role($new_role);

        wp_send_json_success('Role updated successfully');
    }
}

// Register AJAX handler
add_action('wp_ajax_update_user_role', array('WMP_SubscribersTable', 'handle_role_update'));