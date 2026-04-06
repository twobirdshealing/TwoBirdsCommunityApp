<?php
function add_donor_wall_tab($tabs) {
    global $product;
    if ($product && get_post_meta($product->get_id(), '_donor_wall', true) == 'yes') {
        $tabs['donor_wall_tab'] = [
            'title' => __('Donor Wall', 'woocommerce'),
            'priority' => 50,
            'callback' => 'display_donor_wall',
        ];
    }
    return $tabs;
}
add_filter('woocommerce_product_tabs', 'add_donor_wall_tab');

/**
 * Get orders containing a specific product (efficient single-query approach)
 */
function get_orders_for_product($product_id, $args = []) {
    $args = wp_parse_args($args, [
        'limit' => -1,
        'status' => ['completed', 'processing'],
        'type' => 'shop_order',
        'date_created' => '>' . date('Y-01-01'),
    ]);
    
    $orders = (new WC_Order_Query($args))->get_orders();
    
    // Filter orders that contain this product
    return array_filter($orders, function($order) use ($product_id) {
        foreach ($order->get_items() as $item) {
            if ($item->get_product_id() == $product_id) {
                return true;
            }
        }
        return false;
    });
}

/**
 * Get BuddyBoss profile link if user has it enabled
 */
function get_buddyboss_profile_link_by_id($user_id) {
    return (function_exists('bp_core_get_user_domain') && $user_id) ? bp_core_get_user_domain($user_id) : '';
}

/**
 * Get donor display name respecting BuddyBoss privacy settings
 * Pulls from xProfile fields and checks Last Name privacy
 * Falls back to WooCommerce billing name for guest checkouts
 */
function get_donor_display_name($user_id, $order = null) {
    // Guest checkout (no user account) - use WooCommerce billing name
    if (!$user_id && $order) {
        $billing_first = $order->get_billing_first_name();
        $billing_last = $order->get_billing_last_name();
        return trim($billing_first . ' ' . $billing_last) ?: 'Anonymous Donor';
    }
    
    // No user ID and no order - shouldn't happen but just in case
    if (!$user_id) {
        return 'Anonymous Donor';
    }
    
    // If BuddyBoss not active, fall back to WP display name or billing name
    if (!function_exists('bp_is_active') || !bp_is_active('xprofile')) {
        $user = get_userdata($user_id);
        if ($user && $user->display_name) {
            return $user->display_name;
        }
        // Last resort: use billing name if order provided
        if ($order) {
            $billing_first = $order->get_billing_first_name();
            $billing_last = $order->get_billing_last_name();
            return trim($billing_first . ' ' . $billing_last) ?: 'Anonymous Donor';
        }
        return 'Anonymous Donor';
    }
    
    // Get First Name from xProfile (Field ID: 1)
    $first_name = xprofile_get_field_data(1, $user_id);
    
    // Get Last Name from xProfile (Field ID: 2)
    $last_name = xprofile_get_field_data(2, $user_id);
    
    // Fallback if xProfile fields are empty
    if (empty($first_name) && empty($last_name)) {
        $user = get_userdata($user_id);
        if ($user && $user->display_name) {
            return $user->display_name;
        }
        // Use billing name as last resort
        if ($order) {
            $billing_first = $order->get_billing_first_name();
            $billing_last = $order->get_billing_last_name();
            return trim($billing_first . ' ' . $billing_last) ?: 'Anonymous Donor';
        }
        return 'Anonymous Donor';
    }
    
    // Use first name only if that's all they have
    if (empty($last_name)) {
        return $first_name;
    }
    
    // Check Last Name field visibility (Field ID: 2)
    $last_name_visibility = xprofile_get_field_visibility_level(2, $user_id);
    
    // Get current viewing user
    $viewing_user_id = get_current_user_id();
    
    // Determine if last name should be shown
    $show_last_name = false;
    
    switch ($last_name_visibility) {
        case 'public':
            $show_last_name = true;
            break;
            
        case 'loggedin':
            $show_last_name = is_user_logged_in();
            break;
            
        case 'friends':
            // Check if viewing user is friends with donor
            if (function_exists('friends_check_friendship') && $viewing_user_id) {
                $show_last_name = friends_check_friendship($viewing_user_id, $user_id);
            }
            break;
            
        case 'adminsonly':
            // Only show to the user themselves or site admins
            $show_last_name = ($viewing_user_id == $user_id) || user_can($viewing_user_id, 'manage_options');
            break;
            
        default:
            $show_last_name = false;
    }
    
    // Return appropriate name format
    return $show_last_name ? trim($first_name . ' ' . $last_name) : $first_name;
}

/**
 * Display donor wall with privacy-respecting names
 */
function display_donor_wall() {
    global $product;
    if (!$product || get_post_meta($product->get_id(), '_donor_wall', true) !== 'yes') {
        return;
    }

    $orders = get_orders_for_product($product->get_id());
    
    if (empty($orders)) {
        echo '<p>No donors found.</p>';
        return;
    }

    $donors = [];
    foreach ($orders as $order) {
        if (!$order || $order->get_total() <= 0) continue;

        $user_id = $order->get_customer_id();
        
        $date_key = $order->get_date_created()->format('Y-m');
        $donors[$date_key][] = [
            'name' => get_donor_display_name($user_id, $order),
            'donation_date' => $order->get_date_created()->format('F jS, Y'),
            'avatar' => get_avatar($user_id, 64),
            'profile_link' => get_buddyboss_profile_link_by_id($user_id),
            'is_subscription' => function_exists('wcs_order_contains_subscription') && wcs_order_contains_subscription($order),
            'is_renewal' => function_exists('wcs_order_contains_renewal') && wcs_order_contains_renewal($order)
        ];
    }

    krsort($donors);
    
    echo '<div class="donor-wall-tabs">';
    foreach (array_keys($donors) as $index => $key) {
        $date = DateTime::createFromFormat('Y-m', $key);
        $label = $date ? $date->format('F Y') : $key;
        $active_class = $index === 0 ? 'active' : '';
        printf(
            '<button class="donor-wall-tab %s" data-tab="%d" data-key="%s">%s</button>',
            esc_attr($active_class),
            esc_attr($index),
            esc_attr($key),
            esc_html($label)
        );
    }
    echo '</div><div class="donor-wall-content"><div class="donor-grid"></div></div>';
    echo '<script>window.donorsData = ' . wp_json_encode($donors) . ';</script>';
}