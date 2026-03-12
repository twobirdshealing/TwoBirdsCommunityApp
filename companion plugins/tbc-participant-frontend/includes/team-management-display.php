<?php
/**
 * Team Management Display
 * 
 * Reads team settings from LINE ITEMS (not orders) to support multiple events per order.
 * 
 * @package TBC_Participant_Frontend
 * @since 3.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Display the team management section
 */
function tbc_pf_display_team_management($product_id, $event_date = '') {
    $results = tbc_pf_calculate_income_and_donors($product_id, $event_date);
    $order_ids = $results['order_ids'] ?? [];
    
    // Pass product_id and event_date to get correct line item data
    $current_group_id = tbc_pf_tm_get_common_group_id($order_ids, $product_id, $event_date);
    $current_facilitators = (array)(TBC_PF_Event_Team_Members::get_instance()->get_common_facilitators($order_ids, $product_id, $event_date) ?? []);
    
    $groups = tbc_pf_tm_is_groups_active() ? tbc_pf_tm_get_available_groups() : [];
    $facilitators = TBC_PF_Event_Team_Members::get_instance()->get_facilitator_options();
    
    $order_settings = [];
    $update_count = 0;
    
    foreach ($order_ids as $order_id) {
        $order = wc_get_order($order_id);
        if (!$order) {
            continue;
        }
        
        // Read from line item meta instead of order meta
        $order_data = [
            'order_number' => $order->get_order_number(),
            'customer' => $order->get_billing_first_name() . ' ' . $order->get_billing_last_name(),
            'date_created' => $order->get_date_created()->date('Y-m-d H:i:s'),
            'facilitators' => tbc_pf_tm_get_line_item_meta($order, $product_id, $event_date, '_tbc_pf_event_facilitators'),
            'group' => tbc_pf_tm_get_line_item_meta($order, $product_id, $event_date, '_tbc_pf_event_group')
        ];
        
        $issues = tbc_pf_tm_get_order_issues($order_data, $current_facilitators, $current_group_id);
        $order_data['needs_update'] = !empty($issues);
        $order_data['issues'] = $issues;
        
        if ($order_data['needs_update']) {
            $update_count++;
        }
        
        $order_settings[$order_id] = $order_data;
    }
    
    uasort($order_settings, fn($a, $b) => strtotime($b['date_created']) - strtotime($a['date_created']));
    
    echo '<div class="tbc-pf-team-management-content">';
    
    echo '<div class="tbc-pf-team-selectors-grid">';
    
    echo '<div class="tbc-pf-team-selector-column">';
    echo '<h4>Event Facilitators</h4>';
    echo '<select id="tbc-pf-facilitators-select" class="tbc-pf-team-dropdown tbc-pf-select2" multiple data-product-id="' . esc_attr($product_id) . '" data-event-date="' . esc_attr($event_date) . '" data-placeholder="Select facilitators...">';
    
    foreach ($facilitators as $id => $name) {
        $selected = in_array($id, $current_facilitators) ? 'selected' : '';
        echo '<option value="' . esc_attr($id) . '" ' . $selected . '>' . esc_html($name) . '</option>';
    }
    
    echo '</select></div>';
    
    echo '<div class="tbc-pf-team-selector-column">';
    echo '<h4>Chat Group</h4>';
    
    if (tbc_pf_tm_is_groups_active()) {
        echo '<select id="tbc-pf-chat-group-select" class="tbc-pf-team-dropdown tbc-pf-select2" data-product-id="' . esc_attr($product_id) . '" data-event-date="' . esc_attr($event_date) . '" data-placeholder="Search for a group...">';
        echo '<option value="">Select Chat Group</option>';
        
        foreach ($groups as $group_id => $group_name) {
            $selected = ($current_group_id == $group_id) ? 'selected' : '';
            echo '<option value="' . esc_attr($group_id) . '" ' . $selected . '>' . esc_html($group_name) . '</option>';
        }
        
        echo '</select>';
        
        if (empty($current_group_id)) {
            echo '<div class="tbc-pf-auto-generate-group-container">';
            echo '<button type="button" id="tbc-pf-auto-generate-group" class="tbc-pf-auto-generate-btn" data-product-id="' . esc_attr($product_id) . '" data-event-date="' . esc_attr($event_date) . '">Auto-Generate Chat Group</button>';
            echo '</div>';
        }
    } else {
        echo '<p>Fluent Community Spaces not available</p>';
    }
    
    echo '</div>';
    echo '</div>';
    
    echo '<div class="tbc-pf-orders-table-container">';
    echo '<table class="tbc-pf-orders-table">';
    echo '<thead><tr>';
    echo '<th><input type="checkbox" id="tbc-pf-select-all-checkbox"></th>';
    echo '<th>Order</th>';
    echo '<th>Customer</th>';
    echo '<th>Date</th>';
    echo '<th>Status</th>';
    echo '</tr></thead>';
    echo '<tbody>';
    
    if (empty($order_settings)) {
        echo '<tr><td colspan="5">No orders found for this event.</td></tr>';
    } else {
        foreach ($order_settings as $order_id => $data) {
            $row_class = $data['needs_update'] ? 'tbc-pf-needs-update' : '';
            $status_display = $data['needs_update'] ? implode(', ', $data['issues']) : 'Up to date';
            
            echo '<tr class="' . esc_attr($row_class) . '">';
            echo '<td><input type="checkbox" class="tbc-pf-order-checkbox" value="' . esc_attr($order_id) . '"></td>';
            echo '<td><a href="' . esc_url(admin_url('admin.php?page=wc-orders&action=edit&id=' . $order_id)) . '" target="_blank">#' . esc_html($data['order_number']) . '</a></td>';
            echo '<td>' . esc_html($data['customer']) . '</td>';
            echo '<td>' . esc_html(date('M j, Y', strtotime($data['date_created']))) . '</td>';
            echo '<td>' . esc_html($status_display) . '</td>';
            echo '</tr>';
        }
    }
    
    echo '</tbody></table></div>';
    
    echo '<div class="tbc-pf-team-update-section">';
    echo '<button type="button" id="tbc-pf-update-team-settings" class="tbc-pf-update-team-btn">Update Selected Orders</button>';
    echo '<div class="tbc-pf-save-feedback-container"></div>';
    echo '</div>';
    
    echo '</div>';
}