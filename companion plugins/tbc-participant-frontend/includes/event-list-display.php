<?php
/**
 * Event List Display
 * 
 * Displays the main event list page with Current/Past event tabs.
 * 
 * @package TBC_Participant_Frontend
 * @since 3.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_PF_Event_List_Display {
    
    public function __construct() {
        add_shortcode('tbc_pf_participant_list', [$this, 'display_participant_list']);
    }

    public function display_participant_list() {
        // Sub-page: participant details view (product_slug in URL)
        $product_slug = isset($_GET['product_slug']) ? sanitize_text_field($_GET['product_slug']) : '';
        $event_date = isset($_GET['event_date']) ? sanitize_text_field($_GET['event_date']) : '';

        if ($product_slug) {
            ob_start();
            tbc_pf_display_participant_details_page($product_slug, $event_date);
            return ob_get_clean();
        }

        $current_page_url = get_permalink();

        $output = '<div id="tbc-pf-participant-list-tabs">
                    <button class="tbc-pf-tab-link active" data-status="current">Current Events</button>
                    <button class="tbc-pf-tab-link" data-status="past">Past Events</button>';

        if (current_user_can('manage_options')) {
            $output .= '<button class="tbc-pf-tab-link" data-status="settings">⚙️ Settings</button>';
        }

        $output .= '</div>';

        $output .= '<div id="tbc-pf-product-list">' . $this->get_product_list_html('current', $current_page_url) . '</div>';

        return $output;
    }

    public function get_product_list_html($status_type, $baseUrl) {
        $today = date('Y-m-d');
        $current_year = date('Y');
        
        $html = '<table class="tbc-pf-event-date-list">';
        $html .= '<thead><tr>
                    <th>Event</th>
                    <th>Event Date</th>
                    <th>Donations</th>
                    <th>Attendees</th>
                    <th>Actions</th>
                    <th>Alerts</th>
                </tr></thead>';
        $html .= '<tbody>';
        
        if ($status_type === 'past') {
            $html .= $this->generate_year_filters_html($current_year);
        }

        if (!function_exists('tbc_wc_get_events') || !function_exists('tbc_wc_get_historical_dates')) {
            $html .= '<tr><td colspan="6">Calendar plugin not available</td></tr>';
            $html .= '</tbody></table>';
            return $html;
        }

        $category_ids = tbc_pf_get_event_category_ids();
        if (empty($category_ids)) {
            $html .= '<tr><td colspan="6">No event categories configured.';
            if (current_user_can('manage_options')) {
                $html .= ' Open the <strong>⚙️ Settings</strong> tab to choose which product categories appear here.';
            }
            $html .= '</td></tr>';
            $html .= '</tbody></table>';
            return $html;
        }

        $allowed_products = tbc_pf_get_product_ids_by_categories($category_ids);
        if (empty($allowed_products)) {
            $html .= '<tr><td colspan="6">No products found in the selected categories.</td></tr>';
            $html .= '</tbody></table>';
            return $html;
        }

        if ($status_type === 'current') {
            $all_product_dates = tbc_wc_get_events($allowed_products, [
                'start_date' => date('Y-m-d', strtotime('-7 days')),
                'end_date' => '2099-12-31',
                'limit' => null
            ]);
        } else {
            $all_product_dates = tbc_wc_get_historical_dates($allowed_products, [
                'start_date' => '2000-01-01',
                'end_date' => $today,
                'limit' => null
            ]);
        }    

        $all_events = [];
    
        foreach ($all_product_dates as $event_data) {
            $date = $event_data['start'];
            $event_end_date = $event_data['end'] ?? $date;
            $product = $event_data['product'];
            $product_id = $event_data['product_id'];
            
            $date_obj = new DateTime($date);
            $end_date_obj = new DateTime($event_end_date);
            $year = $date_obj->format('Y');
            
            $is_current = $end_date_obj->format('Y-m-d') >= $today;
            
            if (($status_type === 'current' && !$is_current) || 
                ($status_type === 'past' && $is_current)) {
                continue;
            }
            
            $formatted_date = date_i18n(get_option('date_format'), strtotime($date));
            
            if (!empty($event_end_date) && $event_end_date !== $date) {
                $start_month = date('F', strtotime($date));
                $end_month = date('F', strtotime($event_end_date));
                $start_year = date('Y', strtotime($date));
                $end_year = date('Y', strtotime($event_end_date));
                
                if ($start_month === $end_month && $start_year === $end_year) {
                    $start_day = date('j', strtotime($date));
                    $end_day = date('j', strtotime($event_end_date));
                    $formatted_date = $start_month . ' ' . $start_day . '-' . $end_day . ', ' . $start_year;
                } else {
                    $formatted_end_date = date_i18n(get_option('date_format'), strtotime($event_end_date));
                    $formatted_date = $formatted_date . ' - ' . $formatted_end_date;
                }
            }
            
            $product_url = add_query_arg([
                'product_slug' => $product->get_slug(),
                'event_date' => $date
            ], $baseUrl);
            
            $metrics = tbc_pf_calculate_income_and_donors($product_id, $date);
            
            $donation_display = wc_price($metrics['total_income']);
            $attendee_display = $metrics['active_quantities'];
            if ($metrics['canceled_quantities'] > 0) {
                $attendee_display .= ' + ' . $metrics['canceled_quantities'] . ' canceled';
            }
            
            $alerts = tbc_pf_get_event_alert_summary($product_id, $date);
            
            $all_events[] = [
                'date' => $date,
                'year' => $year,
                'formatted_date' => $formatted_date,
                'product_name' => $product->get_name(),
                'product_url' => $product_url,
                'donation_display' => $donation_display,
                'attendee_display' => $attendee_display,
                'medical_count' => $alerts['medical_count'],
                'team_count' => $alerts['team_count']
            ];
        }

        $all_events = tbc_pf_sort_events($all_events, $status_type);
        
        if (empty($all_events)) {
            $html .= '<tr><td colspan="6">No events found.</td></tr>';
        } else {
            foreach ($all_events as $event) {
                $year_class = 'tbc-pf-event-row year-' . $event['year'];
                $visible_class = ($status_type === 'past' && $event['year'] != $current_year) ? ' style="display:none;"' : '';
                
                $html .= '<tr class="' . $year_class . '"' . $visible_class . ' data-year="' . esc_attr($event['year']) . '">';
                $html .= '<td>' . esc_html($event['product_name']) . '</td>';
                $html .= '<td>' . esc_html($event['formatted_date']) . '</td>';
                $html .= '<td>' . $event['donation_display'] . '</td>';
                $html .= '<td>' . $event['attendee_display'] . '</td>';
                $html .= '<td class="tbc-pf-action-cell">';
                $html .= '<a href="' . esc_url($event['product_url']) . '" class="button">View Participants</a>';
                $html .= '</td>';
                
                $alerts_html = '';
                if ($event['medical_count'] > 0 || $event['team_count'] > 0) {
                    if ($event['medical_count'] > 0) {
                        $alerts_html .= '<span class="tbc-pf-alert-badge tbc-pf-alert-medical">🩺 ' . $event['medical_count'] . '</span>';
                    }
                    if ($event['team_count'] > 0) {
                        $alerts_html .= '<span class="tbc-pf-alert-badge tbc-pf-alert-team">👥 ' . $event['team_count'] . '</span>';
                    }
                } else {
                    $alerts_html = '—';
                }
                $html .= '<td class="tbc-pf-alerts-cell">' . $alerts_html . '</td>';
                
                $html .= '</tr>';
            }
        }

        $html .= '</tbody></table>';
        
        return $html;
    }

    public function get_settings_html() {
        if (!current_user_can('manage_options')) {
            return '<p>You do not have permission to view settings.</p>';
        }

        $selected_ids = tbc_pf_get_event_category_ids();
        $selected_product_count = !empty($selected_ids)
            ? count(tbc_pf_get_product_ids_by_categories($selected_ids))
            : 0;

        $terms = get_terms([
            'taxonomy'   => 'product_cat',
            'hide_empty' => false,
            'orderby'    => 'name',
            'order'      => 'ASC',
        ]);

        $nonce = wp_create_nonce('tbc_pf_event_settings');

        $html  = '<div class="tbc-pf-settings-form" data-nonce="' . esc_attr($nonce) . '">';
        $html .= '<h3>Event Categories</h3>';
        $html .= '<p class="tbc-pf-settings-help">Select which WooCommerce product categories appear in the event list. Products only need to belong to <em>one</em> of the selected categories to show up.</p>';

        if (is_wp_error($terms) || empty($terms)) {
            $html .= '<p><em>No product categories found.</em></p>';
            $html .= '</div>';
            return $html;
        }

        $html .= '<label for="tbc-pf-event-categories"><strong>Categories:</strong></label><br>';
        $html .= '<select id="tbc-pf-event-categories" name="tbc_pf_event_categories[]" multiple="multiple" style="width:100%;max-width:560px;">';
        foreach ($terms as $term) {
            $is_selected = in_array((int) $term->term_id, $selected_ids, true) ? ' selected' : '';
            $html .= '<option value="' . esc_attr($term->term_id) . '"' . $is_selected . '>'
                  . esc_html($term->name) . ' (' . (int) $term->count . ')'
                  . '</option>';
        }
        $html .= '</select>';

        $html .= '<div class="tbc-pf-settings-actions">';
        $html .= '<button type="button" class="button button-primary" id="tbc-pf-save-settings">Save Settings</button>';
        $html .= '<span class="tbc-pf-settings-status" id="tbc-pf-settings-status"></span>';
        $html .= '</div>';

        $html .= '<p class="tbc-pf-settings-summary">Currently matching <strong>' . (int) $selected_product_count . '</strong> product' . ($selected_product_count === 1 ? '' : 's') . '.</p>';

        $html .= '</div>';
        return $html;
    }

    private function generate_year_filters_html($current_year) {
        $years = range(2020, $current_year);
        $years = array_reverse($years);
        
        $html = '<tr class="tbc-pf-year-filters">';
        $html .= '<td colspan="6">';
        $html .= '<label for="tbc-pf-year-filter"><strong>Filter by Year:</strong> </label>';
        $html .= '<select id="tbc-pf-year-filter">';
        $html .= '<option value="all">All Years</option>';
        foreach ($years as $year) {
            $selected = ($year == $current_year) ? 'selected' : '';
            $html .= '<option value="' . $year . '" ' . $selected . '>' . $year . '</option>';
        }
        $html .= '</select>';
        $html .= '</td>';
        $html .= '</tr>';
        
        return $html;
    }
}