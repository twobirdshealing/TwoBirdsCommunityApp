<?php
/**
 * SMS Tab for Participant Details Management Panel
 *
 * Enables sending SMS to event participants directly from the participant list page.
 * Uses the Message Center plugin's SMS form template and API.
 *
 * @package TBC_Participant_Frontend
 * @since 3.1.0
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Generate contact list HTML for event participants
 *
 * @param int $product_id Product/event ID
 * @param string $event_date Event date (Y-m-d format)
 * @return array Contains 'html', 'total_users', 'opted_out_count'
 */
function tbc_pf_generate_sms_contact_list($product_id, $event_date) {
    $customers = tbc_pf_get_customers_by_product_and_date($product_id, $event_date);

    if (empty($customers)) {
        return [
            'html' => '<p>' . esc_html__('No participants found for this event.', 'twobirdschurch') . '</p>',
            'total_users' => 0,
            'opted_out_count' => 0
        ];
    }

    $total_users = 0;
    $opted_out_count = 0;
    $seen_user_ids = [];
    $seen_phones = [];

    $check_all_html = '<label for="check_all"><input id="check_all" type="checkbox" /> ' . esc_html__('Check/Uncheck All', 'twobirdschurch') . '</label>';
    $list_html = '<ul class="tbc-mc-contact-list">';

    foreach ($customers as $customer) {
        if ($customer['order_status'] === 'cancelled') {
            continue;
        }

        $order = wc_get_order($customer['order_id']);
        if (!$order) {
            continue;
        }

        $user_id = $order->get_user_id();
        $is_guest = empty($user_id);
        $phone = '';
        $full_name = '';
        $is_sms_out = false;

        if ($is_guest) {
            // Guest user: get phone from WooCommerce billing data
            $billing_phone = $order->get_billing_phone();
            $phone = function_exists('tbc_mc_format_phone')
                ? tbc_mc_format_phone($billing_phone)
                : '';

            if (empty($phone)) {
                continue;
            }

            $full_name = trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name());
        } else {
            // Registered user: deduplicate by user ID
            if (in_array($user_id, $seen_user_ids)) {
                continue;
            }
            $seen_user_ids[] = $user_id;

            $phone = function_exists('tbc_mc_get_phone_from_profile')
                ? tbc_mc_get_phone_from_profile($user_id)
                : '';

            if (empty($phone)) {
                continue;
            }

            $first_name = get_user_meta($user_id, 'first_name', true);
            $last_name = get_user_meta($user_id, 'last_name', true);
            $full_name = trim("{$first_name} {$last_name}") ?: $customer['name'];

            $user_data = get_userdata($user_id);
            $user_roles = $user_data ? (array) $user_data->roles : [];
            $is_sms_out = in_array('sms_out', $user_roles, true);
        }

        // Deduplicate by phone number (covers both guest and registered)
        if (in_array($phone, $seen_phones)) {
            continue;
        }
        $seen_phones[] = $phone;

        $total_users++;
        $guest_label = $is_guest ? ' (Guest)' : '';
        $display_name = esc_html("{$full_name}{$guest_label} - {$phone}");

        if ($is_sms_out) {
            $opted_out_count++;
            $list_html .= "<li class='tbc-pf-sms-opted-out'>";
            $list_html .= "<input type='checkbox' name='members[]' value='" . esc_attr($phone) . "' ";
            $list_html .= "data-phone='" . esc_attr($phone) . "' data-name='" . esc_attr($full_name) . "' ";
            $list_html .= "class='user-checkbox tbc-pf-opted-out-checkbox' disabled> ";
            $list_html .= "{$display_name}</li>";
        } else {
            $list_html .= "<li><input type='checkbox' name='members[]' value='" . esc_attr($phone) . "' ";
            $list_html .= "data-phone='" . esc_attr($phone) . "' data-name='" . esc_attr($full_name) . "' ";
            $list_html .= "class='user-checkbox'> {$display_name}</li>";
        }
    }

    $list_html .= '</ul>';

    $html = $check_all_html;

    if ($opted_out_count > 0) {
        $html .= '<div class="tbc-pf-sms-override-container">';
        $html .= '<label for="tbc_pf_override_opt_out" class="tbc-pf-override-label">';
        $html .= '<input type="checkbox" id="tbc_pf_override_opt_out" class="tbc-pf-override-checkbox"> ';
        $html .= esc_html__('Override Opt-Out', 'twobirdschurch');
        $html .= '</label>';
        $html .= '<span class="tbc-pf-override-warning">';
        $html .= esc_html__('Enables selection of opted-out participants for important messages.', 'twobirdschurch');
        $html .= '</span>';
        $html .= '</div>';
    }

    $html .= $list_html;

    return [
        'html' => $html,
        'total_users' => $total_users,
        'opted_out_count' => $opted_out_count
    ];
}

/**
 * Display the SMS tab content in Management Panel
 *
 * @param int $product_id Product/event ID
 * @param string $event_date Event date
 */
function tbc_pf_display_sms_tab($product_id, $event_date) {
    if (!function_exists('tbc_mc_render_sms_form')) {
        echo '<div class="tbc-pf-sms-unavailable">';
        echo '<p>' . esc_html__('The Message Center plugin is required for SMS functionality.', 'twobirdschurch') . '</p>';
        echo '</div>';
        return;
    }

    $contact_list_data = tbc_pf_generate_sms_contact_list($product_id, $event_date);

    echo '<div id="feedback"></div>';

    if ($contact_list_data['total_users'] > 0) {
        $message = sprintf(
            esc_html__('%d participants loaded! %d have opted out.', 'twobirdschurch'),
            $contact_list_data['total_users'],
            $contact_list_data['opted_out_count']
        );
        echo tbc_mc_feedback_html('success', $message);
    }

    echo '<div class="tbc-mc-sms-group-container">' . tbc_mc_render_sms_form(
        'tbc_pf_send_sms_action',
        'tbc_pf_send_sms_nonce',
        $contact_list_data['html']
    ) . '</div>';
}
