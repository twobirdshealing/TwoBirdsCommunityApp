<?php
/**
 * Participant Details Display
 * 
 * Pure HTML rendering for participant details table.
 * All data comes from helper functions in participant-details-helpers.php
 * 
 * @package TBC_Participant_Frontend
 * @since 3.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

function tbc_pf_display_participant_details_page($product_slug, $event_date) {
    $post_product = get_page_by_path($product_slug, OBJECT, 'product');
    if (!$post_product) {
        echo '<div class="tbc-pf-centered">';
        echo '<p>Product not found for slug: ' . esc_html($product_slug) . '</p>';
        echo '<div class="tbc-pf-back-button-container">';
        echo '<a href="' . esc_url(get_permalink()) . '" class="button tbc-pf-back-button">&larr; Back to Events</a>';
        echo '</div>';
        echo '</div>';
        return;
    }

    $product = wc_get_product($post_product->ID);
    if (!$product) {
        echo '<div class="tbc-pf-centered">';
        echo '<p>WooCommerce product not found for slug: ' . esc_html($product_slug) . '</p>';
        echo '<div class="tbc-pf-back-button-container">';
        echo '<a href="' . esc_url(get_permalink()) . '" class="button tbc-pf-back-button">&larr; Back to Events</a>';
        echo '</div>';
        echo '</div>';
        return;
    }

    $product_id = $product->get_id();
    $product_name = $product->get_name();
    
    $formatted_date = !empty($event_date) ? date_i18n(get_option('date_format'), strtotime($event_date)) : '';
    $is_draft = $product->get_status() === 'draft';
    $status_tag = $is_draft ? '<span class="tbc-pf-archived-tag">Archived</span>' : '<span class="tbc-pf-active-tag">Active</span>';
    
    $customers = tbc_pf_get_customers_by_product_and_date($product_id, $event_date);

    if (empty($customers)) {
        echo '<div class="tbc-pf-centered">';
        echo '<div class="tbc-pf-back-button-container">';
        echo '<a href="' . esc_url(get_permalink()) . '" class="button tbc-pf-back-button">&larr; Back to Events</a>';
        echo '</div>';
        echo '<h2>' . esc_html($product_name) . ($formatted_date ? ' - ' . esc_html($formatted_date) : '') . ' ' . $status_tag . '</h2>';
        echo '<p>No customers found for this event.</p>';
        echo '</div>';
        return;
    }

    tbc_pf_render_participant_details_template($customers, $product_id, $product_name, $event_date, $formatted_date, $status_tag);
}

/**
 * Display unified alert banner if there are any alerts
 * 
 * @param int $product_id Product ID
 * @param string $event_date Event date
 */
function tbc_pf_display_unified_alert_banner($product_id, $event_date) {
    $alerts = tbc_pf_get_event_alert_summary($product_id, $event_date);
    
    if ($alerts['medical_count'] === 0 && $alerts['team_count'] === 0) {
        return;
    }
    
    echo '<div class="tbc-pf-unified-alert-banner">';
    echo '<span class="tbc-pf-alert-icon">⚠️</span>';
    echo '<span class="tbc-pf-alert-title">Action Required</span>';
    echo '<div class="tbc-pf-alert-items">';
    
    if ($alerts['medical_count'] > 0) {
        $participant_text = $alerts['medical_count'] === 1 ? 'participant has' : 'participants have';
        echo '<span class="tbc-pf-alert-item tbc-pf-alert-medical">🩺 ' . $alerts['medical_count'] . ' ' . $participant_text . ' overdue medical follow-ups</span>';
    }
    
    if ($alerts['team_count'] > 0) {
        $order_text = $alerts['team_count'] === 1 ? 'order needs' : 'orders need';
        echo '<span class="tbc-pf-alert-item tbc-pf-alert-team">👥 ' . $alerts['team_count'] . ' ' . $order_text . ' team settings</span>';
    }
    
    echo '</div>';
    echo '</div>';
}

function tbc_pf_render_management_panel($product_id, $event_date) {
    echo '<div class="tbc-pf-management-panel-container">';
    echo '<div class="tbc-pf-management-panel-header">';
    echo '<span>Management Settings</span>';
    echo '<button type="button" id="tbc-pf-toggle-management-panel" class="tbc-pf-toggle-panel-btn">Show</button>';
    echo '</div>';
    
    echo '<div class="tbc-pf-management-panel-content" style="display:none;">';
    
    echo '<div class="tbc-pf-management-tabs">';
    echo '<button class="tbc-pf-tab-btn active" data-tab="team">Team Settings</button>';
    echo '<button class="tbc-pf-tab-btn" data-tab="posts">Post Management</button>';
    echo '<button class="tbc-pf-tab-btn" data-tab="post-settings">Post Settings</button>';
    echo '<button class="tbc-pf-tab-btn" data-tab="columns">Table Columns</button>';
    echo '<button class="tbc-pf-tab-btn" data-tab="sms">SMS</button>';
    echo '</div>';
    
    echo '<div class="tbc-pf-tab-content-wrapper">';
    
    echo '<div class="tbc-pf-tab-content active" id="tbc-pf-tab-team">';
    tbc_pf_display_team_management($product_id, $event_date);
    echo '</div>';
    
    echo '<div class="tbc-pf-tab-content" id="tbc-pf-tab-posts">';
    tbc_pf_display_post_management($product_id, $event_date);
    echo '</div>';
    
    echo '<div class="tbc-pf-tab-content" id="tbc-pf-tab-post-settings">';
    tbc_pf_display_post_settings();
    echo '</div>';
    
    echo '<div class="tbc-pf-tab-content" id="tbc-pf-tab-columns">';
    tbc_pf_render_column_toggles_content($product_id);
    echo '</div>';

    echo '<div class="tbc-pf-tab-content" id="tbc-pf-tab-sms">';
    tbc_pf_display_sms_tab($product_id, $event_date);
    echo '</div>';

    echo '</div>';
    echo '</div>';
    echo '</div>';
}

function tbc_pf_render_column_toggles_content($product_id) {
    $columns = tbc_pf_get_available_columns($product_id);
    $prefs = tbc_pf_get_user_column_prefs($product_id);
    
    echo '<div class="tbc-pf-column-checkboxes" data-column-prefs="' . esc_attr(json_encode($prefs)) . '">';
    
    foreach ($columns as $key => $label) {
        $checked = !empty($prefs[$key]) ? 'checked' : '';
        echo '<label><input type="checkbox" class="tbc-pf-column-toggle" data-column="' . esc_attr($key) . '" ' . $checked . '> ' . esc_html($label) . '</label>';
    }
    
    echo '</div>';
    echo '<div class="tbc-pf-column-save-feedback"></div>';
}

function tbc_pf_render_participant_details_template($customers, $product_id, $product_name, $event_date, $formatted_date, $status_tag) {
    echo '<div class="tbc-pf-centered">';
    
    echo '<div class="tbc-pf-back-button-container">';
    echo '<a href="' . esc_url(get_permalink()) . '" class="button tbc-pf-back-button">&larr; Back to Events</a>';
    echo '</div>';

    echo '<div class="tbc-pf-details-container">';
    
    tbc_pf_display_event_dashboard($product_id, $product_name, $event_date, $formatted_date, $status_tag);
    tbc_pf_display_unified_alert_banner($product_id, $event_date);
    tbc_pf_render_management_panel($product_id, $event_date);
    
    echo '</div>';

    echo '<div class="tbc-pf-table-wrapper">';
    echo '<table class="tbc-pf-table">';
    
    tbc_pf_render_table_header($product_id);
    tbc_pf_render_table_rows($customers, $product_id, $event_date, $product_name);
    
    echo '</table>';
    echo '</div>';
    echo '</div>';
}

function tbc_pf_render_table_header($product_id) {
    $is_ceremony = has_term('ceremony', 'product_cat', $product_id);
    $is_sapo_or_ceremony = has_term(['sapo', 'ceremony'], 'product_cat', $product_id);
    
    echo '<tr>';
    echo '<th data-column="name">Name</th>';
    echo '<th data-column="info">Participant Info</th>';
    if ($is_ceremony) echo '<th data-column="chat">Chat</th>';
    echo '<th data-column="quantity">Quantity</th>';
    echo '<th data-column="amount">Amount</th>';
    echo '<th data-column="order_num">Order #</th>';
    echo '<th data-column="status">Order Status</th>';
    if ($is_sapo_or_ceremony) echo '<th data-column="pre_course">Pre Course %</th>';
    if ($is_sapo_or_ceremony) echo '<th data-column="waiver">Waiver</th>';
    echo '<th data-column="medications">Medications</th>';
    echo '<th data-column="consult">Medical Consult</th>';
    echo '<th data-column="notes">Event Notes</th>';
    if ($is_ceremony) echo '<th data-column="post_course">Post Course %</th>';
    echo '</tr>';
}

function tbc_pf_render_table_rows($customers, $product_id, $event_date, $product_name) {
    echo '<tr><td colspan="13" class="tbc-pf-order-section-header">Active Orders</td></tr>';
    foreach ($customers as $customer) {
        if (in_array($customer['order_status'], ['processing', 'completed'])) {
            tbc_pf_render_customer_row($customer, $product_id, $event_date, $product_name);
        }
    }

    echo '<tr><td colspan="13" class="tbc-pf-order-section-header">Canceled Orders</td></tr>';
    foreach ($customers as $customer) {
        if ($customer['order_status'] === 'cancelled') {
            tbc_pf_render_customer_row($customer, $product_id, $event_date, $product_name);
        }
    }
}

function tbc_pf_render_customer_row($customer, $product_id, $event_date, $product_name) {
    $order = wc_get_order($customer['order_id']);
    $user_id = $order->get_user_id();
    $entry = tbc_pf_get_gravity_entry_by_user($user_id);
    
    $name_data = tbc_pf_get_name_column_data($user_id, $customer['name']);
    $info_data = tbc_pf_get_participant_info_column_data($entry);
    $chat_data = tbc_pf_get_chat_column_data($order, $user_id, $product_id, $event_date);
    $quantity_data = tbc_pf_get_quantity_column_data($customer, $order);
    $amount_data = tbc_pf_get_amount_column_data($order, $customer['order_status']);
    $order_num_data = tbc_pf_get_order_number_column_data($customer['order_id']);
    $status_data = tbc_pf_get_order_status_column_data($customer['order_status']);
    $precourse_data = tbc_pf_get_precourse_column_data($user_id, $product_id);
    $waiver_data = tbc_pf_get_waiver_column_data($user_id);
    $meds_data = tbc_pf_get_medications_column_data($entry);
    $consult_data = tbc_pf_get_medical_consult_column_data($entry, $event_date);
    $notes_data = tbc_pf_get_event_notes_column_data($order, $user_id);
    $postcourse_data = tbc_pf_get_postcourse_column_data($user_id);
    
    $is_ceremony = has_term('ceremony', 'product_cat', $product_id);
    $is_sapo_or_ceremony = has_term(['sapo', 'ceremony'], 'product_cat', $product_id);
    
    echo '<tr>';
    
    tbc_pf_render_name_cell($name_data);
    tbc_pf_render_participant_info_cell($info_data, $name_data['display_name'], $user_id, $product_id, $event_date, $customer['order_id']);
    
    if ($is_ceremony) {
        tbc_pf_render_chat_cell($chat_data, $user_id);
    }
    
    tbc_pf_render_quantity_cell($quantity_data);
    tbc_pf_render_amount_cell($amount_data);
    tbc_pf_render_order_number_cell($order_num_data);
    tbc_pf_render_order_status_cell($status_data, $customer['order_id']);
    
    if ($is_sapo_or_ceremony) {
        tbc_pf_render_course_cell($precourse_data, $user_id);
    }
    
    if ($is_sapo_or_ceremony) {
        tbc_pf_render_waiver_cell($waiver_data);
    }
    
    tbc_pf_render_medications_cell($meds_data);
    tbc_pf_render_medical_consult_cell($consult_data, $name_data['display_name'], $event_date, $product_name);
    tbc_pf_render_event_notes_cell($notes_data, $customer['order_id'], $name_data['display_name']);
    
    if ($is_ceremony) {
        tbc_pf_render_course_cell($postcourse_data, $user_id);
    }
    
    echo '</tr>';
}

function tbc_pf_render_name_cell($data) {
    $content = $data['profile_url'] ? 
        '<a href="' . esc_url($data['profile_url']) . '">' . esc_html($data['display_name']) . '</a>' : 
        esc_html($data['display_name']);
    echo '<td class="' . esc_attr($data['gender_class']) . '" data-column="name">' . $content . '</td>';
}

function tbc_pf_render_participant_info_cell($data, $display_name, $user_id, $product_id, $event_date, $order_id) {
    if (!$data['has_entry']) {
        echo '<td data-column="info">No information</td>';
        return;
    }
    
    echo '<td data-column="info">';
    echo '<button class="tbc-pf-open-gravity-form-modal ' . esc_attr($data['button_class']) . '" data-entry-id="' . esc_attr($data['entry_id']) . '">' . esc_html($data['button_text']) . '</button>';
    echo '<div class="tbc-pf-modal" id="tbc-pf-modal-form-entry-' . esc_attr($data['entry_id']) . '">';
    echo '<div class="tbc-pf-modal-content">';
    echo '<button type="button" class="tbc-pf-close-modal-top">X</button>';
    echo '<h3>Participant Info for ' . esc_html($display_name) . '</h3>';
    
    $prev_orders = tbc_pf_get_previous_participant_orders($user_id, $product_id, $event_date, $order_id);
    $groups = tbc_pf_get_previous_participant_groups($user_id);
    
    if ($prev_orders['is_repeat'] || !empty($groups)) {
        echo '<div class="tbc-pf-previous-participation-section" style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #ddd;">';
        
        if ($prev_orders['is_repeat']) {
            echo '<h4 style="margin-top: 0;">Previous Participation (' . esc_html($prev_orders['count']) . ')</h4>';
            echo '<ul style="margin: 10px 0; padding-left: 20px;">';
            foreach ($prev_orders['orders'] as $prev_order) {
                echo '<li>';
                echo esc_html($prev_order['formatted_date']) . ' - ';
                echo esc_html($prev_order['status_name']) . ' - ';
                echo '<a href="' . esc_url($prev_order['edit_url']) . '" target="_blank">Order #' . esc_html($prev_order['order_number']) . '</a>';
                echo '</li>';
            }
            echo '</ul>';
        } else {
            echo '<p><em>First time participant</em></p>';
        }
        
        if (!empty($groups)) {
            echo '<h4>Groups (' . count($groups) . ')</h4>';
            echo '<div class="tbc-pf-participant-groups-grid">';
            foreach ($groups as $group) {
                echo '<div class="tbc-pf-group-item">';
                if (!empty($group['cover_image'])) {
                    if (!empty($group['group_url'])) {
                        echo '<a href="' . esc_url($group['group_url']) . '" target="_blank">';
                        echo '<img src="' . esc_url($group['cover_image']) . '" alt="' . esc_attr($group['group_name']) . '" class="tbc-pf-group-cover-thumb">';
                        echo '</a>';
                    } else {
                        echo '<img src="' . esc_url($group['cover_image']) . '" alt="' . esc_attr($group['group_name']) . '" class="tbc-pf-group-cover-thumb">';
                    }
                }
                echo '<div class="tbc-pf-group-name">';
                if (!empty($group['group_url'])) {
                    echo '<a href="' . esc_url($group['group_url']) . '" target="_blank">' . esc_html($group['group_name']) . '</a>';
                } else {
                    echo esc_html($group['group_name']);
                }
                echo '</div>';
                echo '</div>';
            }
            echo '</div>';
        }
        
        echo '</div>';
    }
    
    echo tbc_pf_display_gravity_form_entry($data['entry']);
    echo '<button type="button" class="tbc-pf-close-modal">Close</button>';
    echo '</div></div>';
    echo '</td>';
}

function tbc_pf_render_chat_cell($data, $user_id) {
    $column = isset($data['column']) ? $data['column'] : 'chat';
    echo '<td data-column="' . esc_attr($column) . '">';
    if ($data['has_group']) {
        echo '<button class="' . esc_attr($data['button_class']) . '" data-user-id="' . esc_attr($user_id) . '" data-group-id="' . esc_attr($data['group_id']) . '">' . esc_html($data['button_text']) . '</button>';
    } else {
        echo 'No group assigned';
    }
    echo '</td>';
}

function tbc_pf_render_quantity_cell($data) {
    $column = isset($data['column']) ? $data['column'] : 'quantity';
    echo '<td data-column="' . esc_attr($column) . '">';
    echo esc_html($data['quantity']);
    if ($data['has_variation']) {
        echo '<br><small style="color: #666; font-size: 12px;">' . esc_html($data['variation_text']) . '</small>';
    }
    echo '</td>';
}

function tbc_pf_render_amount_cell($data) {
    $column = isset($data['column']) ? $data['column'] : 'amount';
    echo '<td data-column="' . esc_attr($column) . '">';
    if ($data['show_refund']) {
        echo '<span style="text-decoration: line-through;">' . wc_price($data['order_total']) . '</span> ';
        echo wc_price($data['net_payment']);
    } else {
        echo wc_price($data['order_total']);
    }
    echo '</td>';
}

function tbc_pf_render_order_number_cell($data) {
    $column = isset($data['column']) ? $data['column'] : 'order_num';
    echo '<td data-column="' . esc_attr($column) . '"><a href="' . esc_url($data['edit_url']) . '" target="_blank">' . esc_html($data['order_id']) . '</a></td>';
}

function tbc_pf_render_order_status_cell($data, $order_id) {
    $column = isset($data['column']) ? $data['column'] : 'status';
    echo '<td data-column="' . esc_attr($column) . '"><select class="tbc-pf-order-status-dropdown" data-order-id="' . esc_attr($order_id) . '">';
    foreach ($data['statuses'] as $status) {
        $selected = ($data['current_status'] == $status) ? ' selected' : '';
        echo '<option value="' . esc_attr($status) . '"' . $selected . '>' . ucfirst($status) . '</option>';
    }
    echo '</select></td>';
}

function tbc_pf_render_course_cell($data, $user_id) {
    $column = isset($data['column']) ? $data['column'] : 'course';
    echo '<td data-column="' . esc_attr($column) . '">';
    if ($data['is_enrolled']) {
        echo intval($data['progress_percent']) . '% Complete';
    } else {
        echo '<button class="tbc-pf-enroll-button" data-user-id="' . esc_attr($user_id) . '" data-course-id="' . esc_attr($data['course_id']) . '">Not Enrolled</button>';
    }
    echo '</td>';
}

function tbc_pf_render_waiver_cell($data) {
    $column = isset($data['column']) ? $data['column'] : 'waiver';
    echo '<td class="' . esc_attr($data['class']) . '" data-column="' . esc_attr($column) . '">' . esc_html($data['text']) . '</td>';
}

function tbc_pf_render_medications_cell($data) {
    $column = isset($data['column']) ? $data['column'] : 'medications';
    if (!$data['has_entry']) {
        echo '<td data-column="' . esc_attr($column) . '">No information</td>';
    } else {
        echo '<td class="' . esc_attr($data['class']) . '" data-column="' . esc_attr($column) . '">' . esc_html($data['status']) . '</td>';
    }
}

function tbc_pf_render_medical_consult_cell($data, $display_name, $event_date, $product_name) {
    $column = isset($data['column']) ? $data['column'] : 'consult';
    
    if (!$data['has_entry']) {
        echo '<td data-column="' . esc_attr($column) . '">Follow up not needed</td>';
        return;
    }
    
    echo '<td data-column="' . esc_attr($column) . '">';
    
    echo '<div class="tbc-pf-button-badge-wrapper">';
    echo '<button class="tbc-pf-open-medical-consult-modal ' . esc_attr($data['button_class']) . '" data-entry-id="' . esc_attr($data['entry_id']) . '">' . esc_html($data['button_text']) . '</button>';
    
    if (isset($data['has_alert']) && $data['has_alert']) {
        echo '<div class="tbc-pf-action-required-badge">⚠️ Action Required</div>';
    }
    echo '</div>';
    
    echo '<div class="tbc-pf-modal" id="tbc-pf-modal-medical-consult-' . esc_attr($data['entry_id']) . '">';
    echo '<div class="tbc-pf-modal-content">';
    echo '<button type="button" class="tbc-pf-close-modal-top">X</button>';
    echo '<h3>Medical Consult for ' . esc_html($display_name) . '</h3>';
    
    echo '<form class="tbc-pf-medical-consult-form" data-entry-id="' . esc_attr($data['entry_id']) . '" data-event-date="' . esc_attr($event_date) . '" data-event-name="' . esc_attr($product_name) . '">';
    echo '<h4>Medical Consult Notes:</h4>';
    echo '<textarea name="medical_consult">' . esc_textarea($data['medical_consult_value']) . '</textarea>';
    echo '<button type="submit" class="tbc-pf-save-medical-consult">Save Notes</button>';
    echo '</form>';
    
    echo '<div class="tbc-pf-followup-management">';
    echo '<h4>Follow-up Management:</h4>';
    echo '<p class="tbc-pf-followup-section-title"><strong>Add new follow-up for ' . esc_html($data['formatted_event_date']) . ':</strong></p>';
    
    echo '<div class="tbc-pf-add-followup-section"><div class="tbc-pf-quick-followup-buttons">';
    foreach (['one_week' => '1 week before', 'two_weeks' => '2 weeks before', 'one_month' => '1 month before', 'two_months' => '2 months before'] as $key => $label) {
        if (!empty($data['quick_dates'][$key])) {
            echo '<button type="button" class="tbc-pf-quick-followup-btn" data-date="' . esc_attr($data['quick_dates'][$key]) . '">' . esc_html($label) . '</button>';
        }
    }
    echo '</div>';
    
    echo '<div class="tbc-pf-custom-followup">';
    echo '<label>Custom date:</label>';
    echo '<input type="date" class="tbc-pf-followup-date-picker" id="tbc-pf-followup_date_' . esc_attr($data['entry_id']) . '">';
    echo '<label>Note (optional):</label>';
    echo '<textarea class="tbc-pf-followup-note-input" id="tbc-pf-followup_note_' . esc_attr($data['entry_id']) . '" placeholder="e.g., Follow up Adderall stop on this date"></textarea>';
    echo '<button type="button" class="tbc-pf-add-followup-btn" data-entry-id="' . esc_attr($data['entry_id']) . '">Add Follow-up</button>';
    echo '</div></div>';
    
    if (!empty($data['followups'])) {
        echo '<div class="tbc-pf-followup-history"><h4>Follow-up History:</h4>';
        foreach ($data['followups'] as $index => $followup) {
            $status_class = $followup['status'] === 'completed' ? 'tbc-pf-followup-completed' : 'tbc-pf-followup-pending';
            $formatted_followup_date = date('M j, Y', strtotime($followup['followup_date']));
            $formatted_event_date = date('M j, Y', strtotime($followup['event_date']));
            
            echo '<div class="tbc-pf-followup-container ' . $status_class . '">';
            echo '<div class="tbc-pf-followup-info">';
            echo '<strong>' . esc_html($followup['event_name']) . '</strong><br>';
            echo 'Event: ' . esc_html($formatted_event_date) . '<br>';
            echo 'Follow-up: ' . esc_html($formatted_followup_date);
            
            if ($followup['status'] === 'pending') {
                $days_remaining = floor((strtotime($followup['followup_date']) - time()) / (60 * 60 * 24));
                echo ' (' . ($days_remaining >= 0 ? $days_remaining . ' days' : abs($days_remaining) . ' days overdue') . ')';
            } else {
                echo '<br>Completed: ' . date('M j, Y', strtotime($followup['completed']));
            }
            
            if (isset($followup['note']) && !empty($followup['note'])) {
                echo '<br><span class="tbc-pf-followup-note">' . esc_html($followup['note']) . '</span>';
            }
            
            echo '</div><div class="tbc-pf-followup-buttons">';
            if ($followup['status'] === 'pending') {
                echo '<button type="button" class="tbc-pf-complete-followup-btn" data-entry-id="' . esc_attr($data['entry_id']) . '" data-index="' . esc_attr($index) . '">Y</button>';
            }
            echo '<button type="button" class="tbc-pf-remove-followup-btn" data-entry-id="' . esc_attr($data['entry_id']) . '" data-index="' . esc_attr($index) . '">X</button>';
            echo '</div></div>';
        }
        echo '</div>';
    }
    
    echo '</div>';
    echo '<button type="button" class="tbc-pf-close-modal">Close</button>';
    echo '</div></div>';
    echo '</td>';
}

function tbc_pf_render_event_notes_cell($data, $order_id, $display_name) {
    $column = isset($data['column']) ? $data['column'] : 'notes';
    echo '<td data-column="' . esc_attr($column) . '">';
    echo '<button class="tbc-pf-open-modal ' . esc_attr($data['button_class']) . '" data-order-id="' . esc_attr($order_id) . '">' . esc_html($data['button_text']) . '</button>';
    echo '<div class="tbc-pf-modal" id="tbc-pf-modal-' . esc_attr($order_id) . '">';
    echo '<div class="tbc-pf-modal-content">';
    echo '<button type="button" class="tbc-pf-close-modal-top">X</button>';
    echo '<h3>Event Notes for ' . esc_html($display_name) . '</h3>';
    
    if (!empty($data['history'])) {
        echo '<div class="tbc-pf-previous-notes-section"><h4>Previous Event Notes:</h4>';
        echo '<div class="tbc-pf-notes-history-container">';
        foreach ($data['history'] as $entry) {
            $display_date = !empty($entry['event_date']) ? 
                date('M j, Y', strtotime($entry['event_date'])) : 
                date('M j, Y', strtotime($entry['order_date']));
            echo '<div class="tbc-pf-history-entry">';
            echo '<strong>' . esc_html($entry['product_name']) . ' - ' . $display_date . '</strong>';
            echo '<p>' . nl2br(esc_html($entry['notes'])) . '</p>';
            echo '</div>';
        }
        echo '</div><hr></div>';
    }
    
    echo '<h4>' . ($data['has_current_notes'] ? 'Current Event Notes:' : 'Add Notes for This Event:') . '</h4>';
    echo '<form class="tbc-pf-event-notes-form" data-order-id="' . esc_attr($order_id) . '">';
    echo '<textarea name="event_notes" placeholder="Add notes for this event...">' . esc_textarea($data['current_notes']) . '</textarea>';
    echo '<button type="submit" class="tbc-pf-save-notes">Save</button>';
    echo '<button type="button" class="tbc-pf-close-modal">Close</button>';
    echo '</form>';
    echo '</div></div>';
    echo '</td>';
}