<?php
/**
 * Participant Details Table - Helper Functions
 * 
 * Pure business logic functions that return DATA ONLY (no HTML output).
 * Each function corresponds to one table column and returns an array of data.
 * 
 * Display logic lives in participant-details-display.php
 * 
 * @package TBC_Participant_Frontend
 * @since 3.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

// ============================================================================
// DATABASE QUERIES
// ============================================================================

/**
 * Get all customers who purchased a specific product on a specific date
 */
function tbc_pf_get_customers_by_product_and_date($product_id, $event_date) {
    global $wpdb;
    
    if (empty($event_date)) {
        return [];
    }

    $query = "
        SELECT order_items.order_id, SUM(order_itemmeta.meta_value) as quantity
        FROM {$wpdb->prefix}woocommerce_order_items as order_items
        JOIN {$wpdb->prefix}woocommerce_order_itemmeta as order_itemmeta 
            ON order_items.order_item_id = order_itemmeta.order_item_id
        JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_product
            ON order_items.order_item_id = meta_product.order_item_id
        JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_date
            ON order_items.order_item_id = meta_date.order_item_id
        WHERE order_itemmeta.meta_key = '_qty'
        AND meta_product.meta_key = '_product_id'
        AND meta_product.meta_value = %d
        AND meta_date.meta_key = '_tbc_wc_event_start_date'
        AND meta_date.meta_value = %s
        GROUP BY order_items.order_id
    ";

    $results = $wpdb->get_results($wpdb->prepare($query, $product_id, $event_date), ARRAY_A);
    $customers = [];

    foreach ($results as $result) {
        $order = wc_get_order($result['order_id']);
        if (!$order instanceof WC_Order) {
            continue;
        }
        
        $customers[] = [
            'name' => $order->get_billing_first_name() . ' ' . $order->get_billing_last_name(),
            'order_status' => $order->get_status(),
            'order_id' => $result['order_id'],
            'quantity' => $result['quantity'],
            'event_date' => $event_date
        ];
    }

    return $customers;
}

/**
 * Get Gravity Forms entry by user ID
 */
function tbc_pf_get_gravity_entry_by_user($user_id, $form_id = 1) {
    $search_criteria = [
        'field_filters' => [
            ['key' => 'created_by', 'value' => $user_id]
        ]
    ];
    $entries = GFAPI::get_entries($form_id, $search_criteria);

    return (!empty($entries) && is_array($entries)) ? $entries[0] : null;
}

/**
 * Get user display name by ID
 * Used by dashboard and team-management-helpers.php
 */
function tbc_pf_get_user_name_by_id($user_id) {
    $user = get_userdata($user_id);
    return $user ? $user->display_name : 'Unknown';
}

// ============================================================================
// COLUMN VISIBILITY PREFERENCES
// ============================================================================

/**
 * Get default column visibility for product type
 */
function tbc_pf_get_default_columns($product_id) {
    $is_ceremony = has_term('ceremony', 'product_cat', $product_id);
    $is_sapo_or_ceremony = has_term(['sapo', 'ceremony'], 'product_cat', $product_id);
    
    return [
        'chat' => $is_ceremony,
        'quantity' => true,
        'amount' => true,
        'order_num' => true,
        'status' => true,
        'pre_course' => $is_sapo_or_ceremony,
        'waiver' => $is_sapo_or_ceremony,
        'medications' => true,
        'consult' => true,
        'notes' => true,
        'post_course' => $is_ceremony
    ];
}

/**
 * Get user's saved column preferences
 */
function tbc_pf_get_user_column_prefs($product_id) {
    $user_id = get_current_user_id();
    if (!$user_id) {
        return tbc_pf_get_default_columns($product_id);
    }
    
    $saved = get_user_meta($user_id, 'tbc_pf_table_columns', true);
    if (empty($saved) || !is_array($saved)) {
        return tbc_pf_get_default_columns($product_id);
    }
    
    return array_merge(tbc_pf_get_default_columns($product_id), $saved);
}

/**
 * Get available column options for product type
 */
function tbc_pf_get_available_columns($product_id) {
    $is_ceremony = has_term('ceremony', 'product_cat', $product_id);
    $is_sapo_or_ceremony = has_term(['sapo', 'ceremony'], 'product_cat', $product_id);
    
    $columns = [
        'quantity' => 'Quantity',
        'amount' => 'Amount',
        'order_num' => 'Order #',
        'status' => 'Order Status',
        'medications' => 'Medications',
        'consult' => 'Medical Consult',
        'notes' => 'Event Notes'
    ];
    
    if ($is_ceremony) {
        $columns = ['chat' => 'Chat'] + $columns;
    }
    
    if ($is_sapo_or_ceremony) {
        $columns['pre_course'] = 'Pre Course %';
        $columns['waiver'] = 'Waiver';
    }
    
    if ($is_ceremony) {
        $columns['post_course'] = 'Post Course %';
    }
    
    return $columns;
}

// ============================================================================
// COLUMN DATA FUNCTIONS
// ============================================================================

/**
 * COLUMN 1: Name - participant name with gender styling and profile link
 */
function tbc_pf_get_name_column_data($user_id, $fallback_name) {
    $gender_class = '';
    $profile_url = null;
    $display_name = $fallback_name;

    if (!$user_id) {
        return [
            'display_name' => $display_name,
            'gender_class' => $gender_class,
            'profile_url' => $profile_url
        ];
    }

    $display_name = get_the_author_meta('display_name', $user_id);

    // Get profile URL from Fluent Community XProfile
    if (tbc_pf_is_fluent_active() && class_exists('FluentCommunity\App\Models\XProfile')) {
        $xprofile = \FluentCommunity\App\Models\XProfile::where('user_id', $user_id)->first();
        $profile_url = $xprofile ? $xprofile->getPermalink() : '';
    }

    // Get gender from Fluent Community XProfile custom_fields (_gender)
    // Values: 'Male', 'Female', 'Non-Binary', 'Other', 'Prefer not to say'
    $gender = '';
    if (isset($xprofile) && $xprofile) {
        $custom_fields = $xprofile->custom_fields;
        if (is_array($custom_fields) && !empty($custom_fields['_gender'])) {
            $gender = $custom_fields['_gender'];
        }
    } elseif (tbc_pf_is_fluent_active() && class_exists('FluentCommunity\App\Models\XProfile')) {
        $xp = \FluentCommunity\App\Models\XProfile::where('user_id', $user_id)->first();
        if ($xp) {
            $custom_fields = $xp->custom_fields;
            if (is_array($custom_fields) && !empty($custom_fields['_gender'])) {
                $gender = $custom_fields['_gender'];
            }
        }
    }
    if ($gender === 'Male') {
        $gender_class = 'tbc-pf-gender-male';
    } elseif ($gender === 'Female') {
        $gender_class = 'tbc-pf-gender-female';
    } elseif (!empty($gender)) {
        $gender_class = 'tbc-pf-gender-other';
    }

    return [
        'display_name' => $display_name,
        'gender_class' => $gender_class,
        'profile_url' => $profile_url
    ];
}

/**
 * COLUMN 2: Participant Info - button and modal data
 */
function tbc_pf_get_participant_info_column_data($entry) {
    if (empty($entry) || empty($entry['id'])) {
        return ['has_entry' => false];
    }
    
    return [
        'has_entry' => true,
        'entry_id' => $entry['id'],
        'button_text' => 'View',
        'button_class' => 'tbc-pf-view-info',
        'entry' => $entry
    ];
}

/**
 * COLUMN 3: Chat - group button data (conditional)
 * 
 * Reads group from LINE ITEM meta (not order meta) to support multiple events per order.
 */
function tbc_pf_get_chat_column_data($order, $user_id, $product_id = 0, $event_date = '') {
    // Get group from line item meta
    $group_id = '';
    if ($product_id && $event_date) {
        $group_id = tbc_pf_tm_get_line_item_meta($order, $product_id, $event_date, '_tbc_pf_event_group');
    }
    
    if (empty($group_id) || !is_scalar($group_id)) {
        return ['has_group' => false, 'column' => 'chat'];
    }
    
    $group_id = intval($group_id);
    $is_member = tbc_pf_is_fluent_active()
        ? \FluentCommunity\App\Services\Helper::isUserInSpace($user_id, $group_id)
        : false;
    
    return [
        'has_group' => true,
        'group_id' => $group_id,
        'is_member' => $is_member,
        'button_text' => $is_member ? 'Joined' : 'Not Joined',
        'button_class' => $is_member ? 'tbc-pf-chat-button tbc-pf-joined' : 'tbc-pf-chat-button tbc-pf-not-joined',
        'column' => 'chat'
    ];
}

/**
 * COLUMN 4: Quantity - with variation info
 */
function tbc_pf_get_quantity_column_data($customer, $order) {
    $quantity = intval($customer['quantity']);
    $has_variation = false;
    $variation_text = '';
    
    foreach ($order->get_items() as $item) {
        if (!$item->get_variation_id()) {
            continue;
        }
        
        $product = $item->get_product();
        if (!$product || !$product->is_type('variation')) {
            continue;
        }
        
        $attributes = $product->get_variation_attributes();
        $variation_parts = [];
        
        foreach ($attributes as $key => $value) {
            $label = str_replace(['attribute_', 'pa_'], '', $key);
            $label = ucwords(str_replace(['-', '_'], ' ', $label));
            $variation_parts[] = $label . ': ' . $value;
        }
        
        if (!empty($variation_parts)) {
            $has_variation = true;
            $variation_text = implode('  -  ', $variation_parts);
            break;
        }
    }
    
    return [
        'quantity' => $quantity,
        'has_variation' => $has_variation,
        'variation_text' => $variation_text,
        'column' => 'quantity'
    ];
}

/**
 * COLUMN 5: Amount - with refund handling
 */
function tbc_pf_get_amount_column_data($order, $order_status) {
    $order_total = $order->get_total();
    $total_refunded = $order->get_total_refunded();
    $net_payment = $order_total - $total_refunded;
    $show_refund = ($order_status === 'cancelled' || $total_refunded > 0);
    
    return [
        'order_total' => $order_total,
        'total_refunded' => $total_refunded,
        'net_payment' => $net_payment,
        'show_refund' => $show_refund,
        'column' => 'amount'
    ];
}

/**
 * COLUMN 6: Order Number - with admin edit URL
 */
function tbc_pf_get_order_number_column_data($order_id) {
    return [
        'order_id' => $order_id,
        'edit_url' => admin_url('admin.php?page=wc-orders&action=edit&id=' . $order_id),
        'column' => 'order_num'
    ];
}

/**
 * COLUMN 7: Order Status - dropdown data
 */
function tbc_pf_get_order_status_column_data($current_status) {
    return [
        'current_status' => $current_status,
        'statuses' => ['processing', 'completed', 'cancelled'],
        'column' => 'status'
    ];
}

/**
 * COLUMN 8: Pre Course % - Fluent Community course enrollment and progress (conditional)
 */
function tbc_pf_get_precourse_column_data($user_id, $product_id) {
    $course_id = has_term('sapo', 'product_cat', $product_id)
        ? TBC_PF_COURSE_SAPO_PRE
        : TBC_PF_COURSE_CEREMONY_PRE;

    $is_enrolled = false;
    $progress_percent = 0;

    if (tbc_pf_is_fluent_active() && class_exists('FluentCommunity\Modules\Course\Services\CourseHelper') && $course_id) {
        $is_enrolled = \FluentCommunity\Modules\Course\Services\CourseHelper::isEnrolled($course_id, $user_id);
        if ($is_enrolled) {
            $progress_percent = (int) \FluentCommunity\Modules\Course\Services\CourseHelper::getCourseProgress($course_id, $user_id);
        }
    }

    return [
        'is_enrolled' => $is_enrolled,
        'progress_percent' => $progress_percent,
        'course_id' => $course_id,
        'column' => 'pre_course'
    ];
}

/**
 * COLUMN 9: Waiver - Gravity Forms form 5 status (conditional)
 */
function tbc_pf_get_waiver_column_data($user_id) {
    $search_criteria = [
        'status' => 'active',
        'field_filters' => [
            ['key' => 'created_by', 'value' => $user_id]
        ]
    ];
    $entries = GFAPI::get_entries(5, $search_criteria);
    $signed = !empty($entries);
    
    return [
        'signed' => $signed,
        'text' => $signed ? 'Signed' : 'Not Signed',
        'class' => $signed ? 'tbc-pf-waiver-yes' : 'tbc-pf-waiver-no',
        'column' => 'waiver'
    ];
}

/**
 * COLUMN 10: Medications - from Gravity Forms field 51
 */
function tbc_pf_get_medications_column_data($entry) {
    if (empty($entry)) {
        return ['has_entry' => false, 'column' => 'medications'];
    }
    
    $status = $entry[51] ?? '';
    $class = ($status === 'Yes, I am on medication') ? 'tbc-pf-medication-yes' : 'tbc-pf-medication-no';
    
    return [
        'has_entry' => true,
        'status' => $status,
        'class' => $class,
        'column' => 'medications'
    ];
}

/**
 * COLUMN 11: Medical Consult - button data and follow-up information
 */
function tbc_pf_get_medical_consult_column_data($entry, $event_date) {
    if (empty($entry) || empty($entry['id'])) {
        return ['has_entry' => false, 'column' => 'consult'];
    }
    
    $entry_id = $entry['id'];
    $medical_consult_value = isset($entry[18]) ? stripslashes($entry[18]) : 'Not provided';
    $button_status = tbc_pf_get_followup_button_status($entry);
    
    // Parse follow-ups from field 56
    $followups = [];
    $followups_json = $entry[56] ?? '';
    if (!empty($followups_json)) {
        $parsed = json_decode($followups_json, true);
        if (is_array($parsed)) {
            usort($parsed, fn($a, $b) => strtotime($a['followup_date']) - strtotime($b['followup_date']));
            $followups = $parsed;
        }
    }
    
    // Calculate quick-set dates
    $quick_dates = [];
    if (!empty($event_date)) {
        $event_timestamp = strtotime($event_date);
        $quick_dates = [
            'one_week' => date('Y-m-d', strtotime('-1 week', $event_timestamp)),
            'two_weeks' => date('Y-m-d', strtotime('-2 weeks', $event_timestamp)),
            'one_month' => date('Y-m-d', strtotime('-1 month', $event_timestamp)),
            'two_months' => date('Y-m-d', strtotime('-2 months', $event_timestamp))
        ];
    }
    
    return [
        'has_entry' => true,
        'entry_id' => $entry_id,
        'medical_consult_value' => $medical_consult_value,
        'button_text' => $button_status['text'],
        'button_class' => $button_status['class'],
        'has_alert' => $button_status['has_alert'],
        'followups' => $followups,
        'quick_dates' => $quick_dates,
        'formatted_event_date' => !empty($event_date) ? date('M j, Y', strtotime($event_date)) : 'this event',
        'column' => 'consult'
    ];
}

/**
 * Helper: Get follow-up button status based on pending follow-ups
 */
function tbc_pf_get_followup_button_status($entry) {
    if (!$entry || empty($entry[18])) {
        return ['text' => 'Add Consult', 'class' => 'tbc-pf-add-consult', 'has_alert' => false];
    }
    
    $followups_json = $entry[56] ?? '';
    if (empty($followups_json)) {
        return ['text' => 'View Consult', 'class' => 'tbc-pf-view-consult', 'has_alert' => false];
    }
    
    $followups = json_decode($followups_json, true);
    if (!is_array($followups)) {
        return ['text' => 'View Consult', 'class' => 'tbc-pf-view-consult', 'has_alert' => false];
    }
    
    // Find nearest pending follow-up
    $nearest_pending = null;
    $current_time = time();
    
    foreach ($followups as $followup) {
        if ($followup['status'] !== 'pending') {
            continue;
        }
        $followup_time = strtotime($followup['followup_date']);
        if ($nearest_pending === null || $followup_time < strtotime($nearest_pending['followup_date'])) {
            $nearest_pending = $followup;
        }
    }
    
    if (!$nearest_pending) {
        return ['text' => 'View Consult', 'class' => 'tbc-pf-view-consult', 'has_alert' => false];
    }
    
    $days_remaining = floor((strtotime($nearest_pending['followup_date']) - $current_time) / 86400);
    $has_alert = ($days_remaining <= 0);
    
    return ['text' => 'View Consult', 'class' => 'tbc-pf-view-consult', 'has_alert' => $has_alert];
}

/**
 * COLUMN 12: Event Notes - button data and history
 */
function tbc_pf_get_event_notes_column_data($order, $user_id) {
    $notes = $order->get_meta('_tbc_pf_event_notes', true);
    $has_current_notes = !empty($notes);
    $has_previous_notes = tbc_pf_user_has_event_notes($user_id);
    $has_any_notes = $has_current_notes || $has_previous_notes;
    
    $history = $has_previous_notes ? tbc_pf_get_user_event_notes_history($user_id) : [];
    
    // Filter out current order from history
    $history = array_filter($history, fn($entry) => $entry['order_id'] != $order->get_id());
    
    return [
        'current_notes' => $notes,
        'has_current_notes' => $has_current_notes,
        'has_any_notes' => $has_any_notes,
        'button_text' => $has_any_notes ? 'View Notes' : 'Add Notes',
        'button_class' => $has_any_notes ? 'tbc-pf-view-notes' : 'tbc-pf-edit-notes',
        'history' => array_values($history),
        'column' => 'notes'
    ];
}

/**
 * Helper: Get user event notes history
 */
function tbc_pf_get_user_event_notes_history($user_id) {
    if (!$user_id) {
        return [];
    }
    
    $orders = wc_get_orders([
        'customer_id' => $user_id,
        'limit' => -1,
        'status' => ['wc-processing', 'wc-completed', 'wc-cancelled'],
        'meta_query' => [
            ['key' => '_tbc_pf_event_notes', 'compare' => 'EXISTS'],
            ['key' => '_tbc_pf_event_notes', 'value' => '', 'compare' => '!=']
        ],
        'orderby' => 'date',
        'order' => 'DESC'
    ]);
    
    $history = [];
    foreach ($orders as $order) {
        $notes = $order->get_meta('_tbc_pf_event_notes', true);
        if (empty($notes)) {
            continue;
        }
        
        $product_name = '';
        $event_date = '';
        foreach ($order->get_items() as $item) {
            $product_name = $item->get_name();
            $event_date = $item->get_meta('_tbc_wc_event_start_date', true);
            break;
        }
        
        $history[] = [
            'order_id' => $order->get_id(),
            'notes' => $notes,
            'product_name' => $product_name,
            'event_date' => $event_date,
            'order_date' => $order->get_date_created()->date('Y-m-d')
        ];
    }
    
    return $history;
}

/**
 * Helper: Check if user has any event notes
 */
function tbc_pf_user_has_event_notes($user_id) {
    if (!$user_id) {
        return false;
    }
    
    $orders = wc_get_orders([
        'customer_id' => $user_id,
        'limit' => 1,
        'status' => ['wc-processing', 'wc-completed', 'wc-cancelled'],
        'meta_query' => [
            ['key' => '_tbc_pf_event_notes', 'compare' => 'EXISTS'],
            ['key' => '_tbc_pf_event_notes', 'value' => '', 'compare' => '!=']
        ]
    ]);
    
    return !empty($orders);
}

/**
 * COLUMN 13: Post Course % - Fluent Community course enrollment and progress (conditional)
 */
function tbc_pf_get_postcourse_column_data($user_id) {
    $course_id = TBC_PF_COURSE_CEREMONY_POST;
    $is_enrolled = false;
    $progress_percent = 0;

    if (tbc_pf_is_fluent_active() && class_exists('FluentCommunity\Modules\Course\Services\CourseHelper') && $course_id) {
        $is_enrolled = \FluentCommunity\Modules\Course\Services\CourseHelper::isEnrolled($course_id, $user_id);
        if ($is_enrolled) {
            $progress_percent = (int) \FluentCommunity\Modules\Course\Services\CourseHelper::getCourseProgress($course_id, $user_id);
        }
    }

    return [
        'is_enrolled' => $is_enrolled,
        'progress_percent' => $progress_percent,
        'course_id' => $course_id,
        'column' => 'post_course'
    ];
}

/**
 * Display Gravity Forms entry in modal - formats fields as HTML
 */
function tbc_pf_display_gravity_form_entry($entry) {
    if (!$entry) {
        return '<p>No entry found.</p>';
    }
    
    $form = GFAPI::get_form($entry['form_id']);
    $output = '<div class="tbc-pf-gravity-form-entry">';

    foreach ($form['fields'] as $field) {
        $field_id = $field->id;
        $value = $entry[$field_id] ?? '';

        if ($field->type === 'address') {
            if (!empty($entry[$field_id . '.3'])) {
                $output .= '<p><strong>City:</strong> ' . esc_html($entry[$field_id . '.3']) . '</p>';
            }
            if (!empty($entry[$field_id . '.4'])) {
                $output .= '<p><strong>State:</strong> ' . esc_html($entry[$field_id . '.4']) . '</p>';
            }
            continue;
        }
        
        // Skip specific fields
        if (($field_id == '15' && empty($value)) || $field_id == '18' || $field_id == '48') {
            continue;
        }
        
        if (!empty($value)) {
            $output .= '<p><strong>' . esc_html($field->label) . ':</strong> ' . esc_html($value) . '</p>';
        }
    }
    
    $output .= '</div>';
    return $output;
}

// ============================================================================
// PREVIOUS PARTICIPATION DATA
// ============================================================================

/**
 * Get user's previous orders for a specific product (HPOS compatible)
 */
function tbc_pf_get_previous_participant_orders($user_id, $product_id, $current_event_date, $current_order_id) {
    if (!$user_id) {
        return ['is_repeat' => false, 'count' => 0, 'orders' => []];
    }
    
    $orders = wc_get_orders([
        'customer_id' => $user_id,
        'limit' => -1,
        'status' => 'any'
    ]);
    
    $previous_orders = [];
    
    foreach ($orders as $order) {
        if ($order->get_id() == $current_order_id) {
            continue;
        }
        
        $has_product = false;
        $event_date = null;
        
        foreach ($order->get_items() as $item) {
            if ($item->get_product_id() == $product_id) {
                $has_product = true;
                $event_date = $item->get_meta('_tbc_wc_event_start_date', true);
                break;
            }
        }
        
        if (!$has_product) {
            continue;
        }
        
        if (!empty($event_date) && !empty($current_event_date) && $event_date === $current_event_date) {
            continue;
        }
        
        $previous_orders[] = [
            'order_id' => $order->get_id(),
            'order_number' => $order->get_order_number(),
            'event_date' => $event_date,
            'formatted_date' => !empty($event_date) ? date_i18n('M j, Y', strtotime($event_date)) : 'No date',
            'status' => $order->get_status(),
            'status_name' => wc_get_order_status_name($order->get_status()),
            'edit_url' => admin_url('admin.php?page=wc-orders&action=edit&id=' . $order->get_id())
        ];
    }
    
    // Sort by event date (most recent first), null dates at end
    usort($previous_orders, function($a, $b) {
        if (empty($a['event_date']) && empty($b['event_date'])) return 0;
        if (empty($a['event_date'])) return 1;
        if (empty($b['event_date'])) return -1;
        return strcmp($b['event_date'], $a['event_date']);
    });
    
    return [
        'is_repeat' => count($previous_orders) > 0,
        'count' => count($previous_orders),
        'orders' => $previous_orders
    ];
}

/**
 * Get user's Fluent Community spaces
 */
function tbc_pf_get_previous_participant_groups($user_id, $exclude_groups = []) {
    if (!$user_id || !tbc_pf_is_fluent_active()) {
        return [];
    }

    if (!class_exists('FluentCommunity\App\Models\SpaceUserPivot')) {
        return [];
    }

    $pivots = \FluentCommunity\App\Models\SpaceUserPivot::where('user_id', $user_id)
        ->where('status', 'active')
        ->get();

    // Collect space IDs (excluding filtered ones) and batch-load in one query
    $space_ids = [];
    foreach ($pivots as $pivot) {
        if (!empty($exclude_groups) && in_array($pivot->space_id, $exclude_groups)) {
            continue;
        }
        $space_ids[] = $pivot->space_id;
    }

    if (empty($space_ids)) {
        return [];
    }

    $spaces = \FluentCommunity\App\Models\BaseSpace::withoutGlobalScopes()
        ->whereIn('id', $space_ids)
        ->get()
        ->keyBy('id');

    $user_groups = [];
    foreach ($space_ids as $space_id) {
        $space = $spaces->get($space_id);
        if (!$space) {
            continue;
        }

        $user_groups[] = [
            'group_id'    => $space->id,
            'group_name'  => $space->title,
            'group_url'   => $space->getPermalink(),
            'cover_image' => $space->cover_photo ?? '',
        ];
    }

    return $user_groups;
}

// ============================================================================
// AJAX HANDLERS
// ============================================================================

/**
 * AJAX: Save event notes
 */
function tbc_pf_ajax_save_event_notes() {
    if (!isset($_POST['order_id'], $_POST['notes'])) {
        wp_send_json_error('Data missing');
    }
    
    $order_id = intval($_POST['order_id']);
    $notes = sanitize_textarea_field($_POST['notes']);
    
    if ($order_id <= 0) {
        wp_send_json_error('Invalid Order ID');
    }
    
    $order = wc_get_order($order_id);
    if (!$order) {
        wp_send_json_error('Invalid Order');
    }
    
    $order->update_meta_data('_tbc_pf_event_notes', $notes);
    $order->save();

    // Send email notification if available
    if (class_exists('TBC_PF_Event_Notes_Notification')) {
        TBC_PF_Event_Notes_Notification::instance()->send_event_note_notification(
            $order_id, 
            [1, 372, 168]
        );
    }
    
    wp_send_json_success('Notes saved');
}
add_action('wp_ajax_tbc_pf_save_event_notes', 'tbc_pf_ajax_save_event_notes');
add_action('wp_ajax_nopriv_tbc_pf_save_event_notes', 'tbc_pf_ajax_save_event_notes');

/**
 * AJAX: Update order status
 */
function tbc_pf_ajax_update_order_status() {
    $order_id = intval($_POST['order_id'] ?? 0);
    $new_status = sanitize_text_field($_POST['status'] ?? '');

    if (!$order_id || !$new_status) {
        wp_send_json_error('Failed to update order status');
    }
    
    $order = wc_get_order($order_id);
    if (!$order) {
        wp_send_json_error('Failed to update order status');
    }
    
    $order->update_status($new_status);
    wp_send_json_success('Order status updated');
}
add_action('wp_ajax_tbc_pf_update_order_status', 'tbc_pf_ajax_update_order_status');

/**
 * Helper: Get follow-ups array from Gravity Forms entry field 56
 */
function tbc_pf_get_followups_array($entry) {
    $followups_json = $entry[56] ?? '';
    if (empty($followups_json)) {
        return [];
    }
    $followups = json_decode($followups_json, true);
    return is_array($followups) ? $followups : [];
}

/**
 * AJAX: Save medical consult and manage follow-ups
 */
function tbc_pf_ajax_save_medical_consult() {
    if (!isset($_POST['entry_id'])) {
        wp_send_json_error('Entry ID missing');
    }

    $entry_id = intval($_POST['entry_id']);
    if ($entry_id <= 0) {
        wp_send_json_error('Invalid entry ID');
    }

    $entry = GFAPI::get_entry($entry_id);
    if (!$entry) {
        wp_send_json_error('Entry not found');
    }

    $followup_action = sanitize_text_field($_POST['followup_action'] ?? '');

    if ($followup_action) {
        $followups = tbc_pf_get_followups_array($entry);

        switch ($followup_action) {
            case 'add':
                $followup_date = sanitize_text_field($_POST['followup_date'] ?? '');
                $event_date = sanitize_text_field($_POST['event_date'] ?? '');
                $event_name = sanitize_text_field($_POST['event_name'] ?? '');
                $note = sanitize_textarea_field($_POST['followup_note'] ?? '');

                if (!$followup_date || !$event_date || !$event_name) {
                    wp_send_json_error('Missing follow-up data');
                }

                $followups[] = [
                    'followup_date' => $followup_date,
                    'status' => 'pending',
                    'created' => current_time('Y-m-d'),
                    'event_date' => $event_date,
                    'event_name' => $event_name,
                    'note' => $note
                ];
                break;

            case 'complete':
                $followup_index = intval($_POST['followup_index'] ?? -1);
                if ($followup_index >= 0 && isset($followups[$followup_index])) {
                    $followups[$followup_index]['status'] = 'completed';
                    $followups[$followup_index]['completed'] = current_time('Y-m-d');
                }
                break;

            case 'remove':
                $followup_index = intval($_POST['followup_index'] ?? -1);
                if ($followup_index >= 0 && isset($followups[$followup_index])) {
                    unset($followups[$followup_index]);
                    $followups = array_values($followups);
                }
                break;
        }

        $entry[56] = wp_json_encode($followups);
        $result = GFAPI::update_entry($entry);

        if ($result === true) {
            wp_send_json_success('Follow-up updated');
        } else {
            wp_send_json_error('Failed to update follow-up');
        }
    }

    if (isset($_POST['medical_consult'])) {
        $medical_consult_data = sanitize_textarea_field(wp_unslash($_POST['medical_consult']));
        $entry[18] = $medical_consult_data;
        
        $result = GFAPI::update_entry($entry);
        if ($result === true) {
            wp_send_json_success('Medical consult saved');
        } else {
            wp_send_json_error('Failed to update entry');
        }
    }

    wp_send_json_error('No action specified');
}
add_action('wp_ajax_tbc_pf_save_medical_consult', 'tbc_pf_ajax_save_medical_consult');

/**
 * AJAX: Enroll user in Fluent Community course
 */
function tbc_pf_ajax_enroll_user_to_course() {
    $user_id = intval($_POST['user_id'] ?? 0);
    $course_id = intval($_POST['course_id'] ?? 0);

    if (!$user_id || !$course_id) {
        wp_send_json_error(['error' => 'Invalid parameters']);
    }

    if (!tbc_pf_is_fluent_active() || !class_exists('FluentCommunity\Modules\Course\Services\CourseHelper')) {
        wp_send_json_error(['error' => 'Fluent Community Courses not available']);
    }

    $courseHelper = 'FluentCommunity\Modules\Course\Services\CourseHelper';

    if ($courseHelper::isEnrolled($course_id, $user_id)) {
        wp_send_json_error(['error' => 'Already enrolled']);
    }

    $course = \FluentCommunity\Modules\Course\Model\Course::find($course_id);
    if (!$course) {
        wp_send_json_error(['error' => 'Course not found']);
    }

    $courseHelper::enrollCourse($course, $user_id, 'admin');
    wp_send_json_success(['message' => 'Enrollment successful']);
}
add_action('wp_ajax_tbc_pf_enroll_user_to_course', 'tbc_pf_ajax_enroll_user_to_course');

/**
 * AJAX: Save column visibility preferences
 */
function tbc_pf_ajax_save_column_prefs() {
    $user_id = get_current_user_id();
    if (!$user_id) {
        wp_send_json_error('Not logged in');
    }
    
    if (!isset($_POST['columns']) || !is_array($_POST['columns'])) {
        wp_send_json_error('Invalid data');
    }
    
    $columns = array_map(fn($val) => $val === 'true' || $val === true, $_POST['columns']);
    
    update_user_meta($user_id, 'tbc_pf_table_columns', $columns);
    wp_send_json_success('Preferences saved');
}
add_action('wp_ajax_tbc_pf_save_column_prefs', 'tbc_pf_ajax_save_column_prefs');