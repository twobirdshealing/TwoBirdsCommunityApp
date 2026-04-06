<?php
/**
 * Event Dashboard Display
 * 
 * Displays the compact event header with metrics and team info.
 * 
 * @package TBC_Participant_Frontend
 * @since 3.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

function tbc_pf_display_event_dashboard($product_id, $product_name, $event_date = '', $formatted_date = '', $status_tag = '') {
    $results = tbc_pf_calculate_income_and_donors($product_id, $event_date);
    $order_ids = $results['order_ids'] ?? [];
    
    $quantity_display = $results['active_quantities'];
    if ($results['canceled_quantities'] > 0) {
        $quantity_display .= ' + ' . $results['canceled_quantities'] . ' canceled';
    }
    
    // Pass product_id and event_date to get correct line item data
    $current_group_id = tbc_pf_tm_get_common_group_id($order_ids, $product_id, $event_date);
    $current_facilitators = (array)(TBC_PF_Event_Team_Members::get_instance()->get_common_facilitators($order_ids, $product_id, $event_date) ?? []);
    
    $groups = tbc_pf_is_groups_active() ? tbc_pf_get_available_groups() : [];
    
    $event_end_date = $event_date;

    if (function_exists('tbc_wc_get_events')) {
        $events = tbc_wc_get_events($product_id, [
            'start_date' => $event_date,
            'end_date' => $event_date,
        ]);
        
        foreach ($events as $e) {
            if ($e['start'] === $event_date) {
                $event_end_date = $e['end'];
                break;
            }
        }
    }

    $date_display = $formatted_date;
    if (!empty($event_end_date) && $event_end_date !== $event_date) {
        $formatted_end_date = date('F j, Y', strtotime($event_end_date));
        
        $start_month = date('F', strtotime($event_date));
        $end_month = date('F', strtotime($event_end_date));
        $start_year = date('Y', strtotime($event_date));
        $end_year = date('Y', strtotime($event_end_date));
        
        if ($start_month === $end_month && $start_year === $end_year) {
            $start_day = date('j', strtotime($event_date));
            $end_day = date('j', strtotime($event_end_date));
            $date_display = $start_month . ' ' . $start_day . '-' . $end_day . ', ' . $start_year;
        } else {
            $date_display = $formatted_date . ' - ' . $formatted_end_date;
        }
    }
    
    echo '<div class="tbc-pf-details-dashboard">';
    
    echo '<table class="tbc-pf-full-width tbc-pf-combined-header-table">';
    
    echo '<tr>';
    echo '<th colspan="2" class="tbc-pf-event-title-header">';
    echo esc_html($product_name);
    if ($date_display) {
        echo ' - ' . esc_html($date_display);
    }
    echo ' ' . $status_tag . ' - Attendee List';
    echo '</th>';
    echo '</tr>';
    
    $total_income_formatted = wc_price($results['total_income']);
    echo '<tr>';
    echo '<th class="tbc-pf-center-text tbc-pf-metric-label">Total Donations</th>';
    echo '<th class="tbc-pf-center-text tbc-pf-metric-label">Total Donors</th>';
    echo '</tr>';
    echo '<tr>';
    echo '<td class="tbc-pf-center-text tbc-pf-metric-value">' . $total_income_formatted . '</td>';
    echo '<td class="tbc-pf-center-text tbc-pf-metric-value">' . $quantity_display . '</td>';
    echo '</tr>';
    
    $facilitators_display = tbc_pf_tm_format_team_members($current_facilitators);
    
    if (empty($current_group_id)) {
        $group_display = 'None';
    } else {
        $group_name = $groups[$current_group_id] ?? 'Group ID: ' . $current_group_id;
        
        if (tbc_pf_is_fluent_active() && class_exists('FluentCommunity\App\Models\BaseSpace')) {
            $space = \FluentCommunity\App\Models\BaseSpace::withoutGlobalScopes()->find($current_group_id);
            if ($space) {
                $group_url = $space->getPermalink();
                $group_display = '<a href="' . esc_url($group_url) . '" target="_blank">' . esc_html($group_name) . '</a>';
            } else {
                $group_display = esc_html($group_name);
            }
        } else {
            $group_display = esc_html($group_name);
        }
    }
    
    echo '<tr>';
    echo '<td colspan="2" class="tbc-pf-team-info-combined">';
    echo '<div class="tbc-pf-team-info-row"><strong>Facilitators:</strong> ' . $facilitators_display . '</div>';
    echo '<div class="tbc-pf-team-info-row"><strong>Chat Group:</strong> ' . $group_display . '</div>';
    echo '</td>';
    echo '</tr>';
    
    echo '</table>';
    echo '</div>';
}