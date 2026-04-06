<?php
/**
 * SMS Center Data Handlers
 * AJAX handlers for fetching contacts, products, customers, etc.
 *
 * NOTE: Legacy [tbc_mc_sms_center] shortcode removed - now part of unified Message Center
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

function tbc_mc_fetch_categories() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => 'Insufficient permissions']);
    }

    $categories = get_terms([
        'taxonomy' => 'product_cat',
        'hide_empty' => false,
    ]);

    if (is_wp_error($categories)) {
        tbc_mc_ajax_feedback('error', 'Error loading categories');
        return;
    }

    $category_data = [];
    foreach ($categories as $category) {
        $category_data[] = [
            'slug' => $category->slug,
            'name' => $category->name,
            'count' => $category->count
        ];
    }

    tbc_mc_ajax_feedback('success', 'Categories loaded', ['categories' => $category_data]);
}
add_action('wp_ajax_tbc_mc_fetch_categories', 'tbc_mc_fetch_categories');

/**
 * Fetch all WordPress user roles dynamically
 * Returns roles with their counts of users with valid phone numbers
 */
function tbc_mc_fetch_roles() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => 'Insufficient permissions']);
    }

    // Load get_editable_roles() if not available (required outside admin)
    if (!function_exists('get_editable_roles')) {
        require_once ABSPATH . 'wp-admin/includes/user.php';
    }

    $all_roles = get_editable_roles();
    $excluded_roles = ['administrator', 'sms_out'];
    $role_data = [];

    foreach ($all_roles as $role_slug => $role_info) {
        // Skip excluded roles
        if (in_array($role_slug, $excluded_roles)) {
            continue;
        }

        // Convert slug to human-readable name if no proper name exists
        $display_name = $role_info['name'];
        if ($display_name === $role_slug || empty($display_name)) {
            $display_name = ucwords(str_replace(['_', '-'], ' ', $role_slug));
        }

        // Count users with valid phone numbers (not opted out)
        $users = get_users(['role' => $role_slug, 'fields' => 'ID']);
        $valid_count = 0;
        foreach ($users as $user_id) {
            $phone = tbc_mc_get_phone_from_profile($user_id);
            if ($phone) {
                $user = get_userdata($user_id);
                if (!in_array('sms_out', $user->roles)) {
                    $valid_count++;
                }
            }
        }

        $role_data[] = [
            'slug' => $role_slug,
            'name' => $display_name,
            'count' => $valid_count
        ];
    }

    // Sort roles alphabetically by display name
    usort($role_data, function($a, $b) {
        return strcasecmp($a['name'], $b['name']);
    });

    tbc_mc_ajax_feedback('success', 'Roles loaded', ['roles' => $role_data]);
}
add_action('wp_ajax_tbc_mc_fetch_roles', 'tbc_mc_fetch_roles');

/**
 * Fetch products - two modes:
 * - simple_mode: flat list of all products (for "All Users of a Product")
 * - default: products with date counts (for "Ceremony Participants" three-level hierarchy)
 */
function tbc_mc_fetch_products() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => 'Insufficient permissions']);
    }

    $simple_mode = isset($_POST['simple_mode']) ? $_POST['simple_mode'] === 'true' : false;
    
    if ($simple_mode) {
        // Simple mode: flat list of all products, no dates
        $args = [
            'status' => 'publish',
            'limit' => -1,
        ];
        
        $products = wc_get_products($args);
        $product_data = [];
        
        foreach ($products as $product) {
            $product_data[] = [
                'id' => $product->get_id(),
                'name' => $product->get_name(),
                'date' => '',
                'product_id' => $product->get_id()
            ];
        }
        
        usort($product_data, function($a, $b) {
            return strcmp($a['name'], $b['name']);
        });
        
        tbc_mc_ajax_feedback('success', count($product_data) . ' Products loaded successfully!', ['products' => $product_data]);
        return;
    }

    // Ceremony Participants mode: return products with date counts for three-level hierarchy
    $included_categories = isset($_POST['included_categories']) ? 
        array_map('sanitize_text_field', $_POST['included_categories']) : 
        [];

    $args = [
        'status' => 'publish',
        'limit' => -1,
    ];

    if (!empty($included_categories)) {
        $args['tax_query'] = [
            [
                'taxonomy' => 'product_cat',
                'field'    => 'slug',
                'terms'    => $included_categories,
                'operator' => 'IN',
            ],
        ];
    }

    $products = wc_get_products($args);
    $product_data = [];

    foreach ($products as $product) {
        $product_id = $product->get_id();
        $product_name = $product->get_name();
        
        // Get date count within the 3-month window
        $event_dates = tbc_mc_get_product_dates($product_id);
        $date_count = count($event_dates);
        
        // Only include products that have dates with orders
        if ($date_count > 0) {
            $product_data[] = [
                'id' => $product_id,
                'name' => $product_name,
                'date_count' => $date_count
            ];
        }
    }

    // Sort alphabetically by name
    usort($product_data, function($a, $b) {
        return strcmp($a['name'], $b['name']);
    });

    tbc_mc_ajax_feedback('success', count($product_data) . ' products with upcoming events', ['products' => $product_data]);
}
add_action('wp_ajax_tbc_mc_fetch_products', 'tbc_mc_fetch_products');

/**
 * Fetch dates for a specific product (second level of hierarchy)
 */
function tbc_mc_fetch_dates_for_product() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => 'Insufficient permissions']);
    }

    $product_id = isset($_POST['product_id']) ? intval($_POST['product_id']) : 0;
    
    if (!$product_id) {
        tbc_mc_ajax_feedback('error', 'Invalid product ID.');
        return;
    }
    
    $dates = tbc_mc_get_product_dates($product_id);
    
    if (empty($dates)) {
        tbc_mc_ajax_feedback('error', 'No event dates found for this product.');
        return;
    }
    
    $date_data = [];
    foreach ($dates as $date) {
        $formatted_date = date_i18n(get_option('date_format'), strtotime($date));
        $date_data[] = [
            'date' => $date,
            'formatted' => $formatted_date,
            'composite_id' => $product_id . '|' . $date
        ];
    }
    
    tbc_mc_ajax_feedback('success', count($date_data) . ' dates loaded', ['dates' => $date_data]);
}
add_action('wp_ajax_tbc_mc_fetch_dates_for_product', 'tbc_mc_fetch_dates_for_product');

/**
 * Get all unique event dates from orders for a specific product
 * Limited to 3 months past and 3 months future
 * 
 * @param int $product_id The product ID
 * @return array Array of unique dates in YYYY-MM-DD format
 */
function tbc_mc_get_product_dates($product_id) {
    global $wpdb;
    
    // Calculate date range: 3 months past to 3 months future
    $date_start = date('Y-m-d', strtotime('-3 months'));
    $date_end = date('Y-m-d', strtotime('+3 months'));
    
    $query = "
        SELECT DISTINCT meta_date.meta_value
        FROM {$wpdb->prefix}woocommerce_order_items as order_items
        JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_product 
            ON order_items.order_item_id = meta_product.order_item_id
        JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_date
            ON order_items.order_item_id = meta_date.order_item_id
        WHERE meta_product.meta_key = '_product_id' 
        AND meta_product.meta_value = %d
        AND meta_date.meta_key = '_tbc_wc_event_start_date'
        AND meta_date.meta_value IS NOT NULL
        AND meta_date.meta_value != ''
        AND meta_date.meta_value >= %s
        AND meta_date.meta_value <= %s
        ORDER BY meta_date.meta_value DESC";
    
    $results = $wpdb->get_col($wpdb->prepare($query, $product_id, $date_start, $date_end));
    
    return $results;
}

/**
 * Fetch customers for a specific product+date combination (third level of hierarchy)
 */
function tbc_mc_fetch_customers() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => 'Insufficient permissions']);
    }

    global $wpdb;

    $composite_id = isset($_POST['product_id']) ? sanitize_text_field($_POST['product_id']) : '';
    
    if (empty($composite_id)) {
        tbc_mc_ajax_feedback('error', 'Invalid product ID.');
        return;
    }
    
    $parts = explode('|', $composite_id);
    $product_id = intval($parts[0]);
    $event_date = isset($parts[1]) ? sanitize_text_field($parts[1]) : '';
    
    if (!$product_id) {
        tbc_mc_ajax_feedback('error', 'Invalid product ID format.');
        return;
    }
    
    $customer_list = [];
    $opted_out_count = 0;
    $guest_count = 0;
    
    if (!empty($event_date)) {
        $query = "
            SELECT order_items.order_id
            FROM {$wpdb->prefix}woocommerce_order_items as order_items
            JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_product
                ON order_items.order_item_id = meta_product.order_item_id
            JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_date
                ON order_items.order_item_id = meta_date.order_item_id
            WHERE meta_product.meta_key = '_product_id' 
            AND meta_product.meta_value = %d
            AND meta_date.meta_key = '_tbc_wc_event_start_date'
            AND meta_date.meta_value = %s
            GROUP BY order_items.order_id
        ";
        
        $order_ids = $wpdb->get_col($wpdb->prepare($query, $product_id, $event_date));
    } else {
        $query = "
            SELECT order_items.order_id
            FROM {$wpdb->prefix}woocommerce_order_items as order_items
            JOIN {$wpdb->prefix}woocommerce_order_itemmeta as meta_product
                ON order_items.order_item_id = meta_product.order_item_id
            WHERE meta_product.meta_key = '_product_id' 
            AND meta_product.meta_value = %d
            GROUP BY order_items.order_id
        ";
        
        $order_ids = $wpdb->get_col($wpdb->prepare($query, $product_id));
    }
    
    if (empty($order_ids)) {
        tbc_mc_ajax_feedback('error', 'No orders found for this event.');
        return;
    }
    
    foreach ($order_ids as $order_id) {
        $order = wc_get_order($order_id);
        
        if (!($order instanceof WC_Order)) {
            continue;
        }
        
        if ($order->get_status() === 'cancelled') {
            continue;
        }
        
        $customer_user_id = $order->get_customer_id();
        
        if ($customer_user_id) {
            // Registered user - phone from profile
            $first_name = get_user_meta($customer_user_id, 'first_name', true);
            $last_name = get_user_meta($customer_user_id, 'last_name', true);
            $phone = tbc_mc_get_phone_from_profile($customer_user_id);
            $full_name = trim("{$first_name} {$last_name}");
            
            if (empty($phone)) {
                continue;
            }
            
            $is_sms_out = in_array('sms_out', get_userdata($customer_user_id)->roles ?? []);
            if ($is_sms_out) {
                $opted_out_count++;
            }
            
            $display_name = esc_html($full_name . ' - ' . $phone);
            
            $customer_list[] = [
                'id' => $customer_user_id,
                'name' => $full_name,
                'display_name' => $display_name,
                'phone' => $phone,
                'is_sms_out' => $is_sms_out,
                'is_guest' => false,
            ];
        } else {
            // Guest order - phone from billing info
            $first_name = $order->get_billing_first_name();
            $last_name = $order->get_billing_last_name();
            $billing_phone = $order->get_billing_phone();
            $full_name = trim("{$first_name} {$last_name}");
            
            $phone = tbc_mc_format_phone($billing_phone);
            
            if (empty($phone)) {
                continue;
            }
            
            $guest_count++;
            
            $display_name = esc_html($full_name . ' - ' . $phone . ' (Guest)');
            
            $customer_list[] = [
                'id' => 'guest_' . $order_id,
                'name' => $full_name,
                'display_name' => $display_name,
                'phone' => $phone,
                'is_sms_out' => false,
                'is_guest' => true,
            ];
        }
    }
    
    // Deduplicate
    $unique_customers = [];
    $seen_user_ids = [];
    $seen_phones = [];
    
    foreach ($customer_list as $customer) {
        if ($customer['is_guest']) {
            if (!in_array($customer['phone'], $seen_phones)) {
                $seen_phones[] = $customer['phone'];
                $unique_customers[] = $customer;
            }
        } else {
            if (!in_array($customer['id'], $seen_user_ids)) {
                $seen_user_ids[] = $customer['id'];
                $seen_phones[] = $customer['phone'];
                $unique_customers[] = $customer;
            }
        }
    }
    
    $registered_count = count($unique_customers) - $guest_count;
    $message = count($unique_customers) . ' contacts. ' . $registered_count . ' registered, ' . $guest_count . ' guests. ' . $opted_out_count . ' opted out.';
    tbc_mc_ajax_feedback('success', $message, ['customerList' => $unique_customers]);
}

add_action('wp_ajax_tbc_mc_fetch_customers', 'tbc_mc_fetch_customers');

function tbc_mc_fetch_by_role() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => 'Insufficient permissions']);
    }

    $role = sanitize_text_field($_POST['role'] ?? '');
    $count_only = isset($_POST['count_only']) && $_POST['count_only'] === 'true';

    // If requesting all role counts
    if ($role === 'all' && $count_only) {
        // Load get_editable_roles() if not available
        if (!function_exists('get_editable_roles')) {
            require_once ABSPATH . 'wp-admin/includes/user.php';
        }

        $all_wp_roles = get_editable_roles();
        $excluded_roles = ['administrator', 'sms_out'];

        $counts = [];
        foreach ($all_wp_roles as $r => $role_info) {
            if (in_array($r, $excluded_roles)) {
                continue;
            }

            $users = get_users(['role' => $r, 'fields' => 'ID']);
            // Count only users with phone numbers who haven't opted out
            $valid_count = 0;
            foreach ($users as $user_id) {
                $phone = tbc_mc_get_phone_from_profile($user_id);
                if ($phone) {
                    $user = get_userdata($user_id);
                    if (!in_array('sms_out', $user->roles)) {
                        $valid_count++;
                    }
                }
            }
            $counts[$r] = $valid_count;
        }

        wp_send_json_success(['counts' => $counts]);
        return;
    }

    $users = get_users(['role' => $role]);

    if (empty($users)) {
        tbc_mc_ajax_feedback('error', 'No users found for role: ' . $role);
        return;
    }

    $opted_out_count = 0;
    $user_data = array_map(function($user) use (&$opted_out_count) {
        $first_name = get_user_meta($user->ID, 'first_name', true);
        $last_name = get_user_meta($user->ID, 'last_name', true);
        $full_name = trim("$first_name $last_name");
        $phone = tbc_mc_get_phone_from_profile($user->ID);
        $is_sms_out = in_array('sms_out', $user->roles);

        if ($is_sms_out) {
            $opted_out_count++;
        }

        $display_name = esc_html($full_name . ' - ' . $phone);

        return [
            'id' => $user->ID,
            'name' => $full_name,
            'display_name' => $display_name,
            'phone' => $phone ? $phone : 'N/A',
            'is_sms_out' => $is_sms_out
        ];
    }, $users);

    $user_count = count($users);
    $message = $user_count . ' Users fetched successfully! ' . $opted_out_count . ' users have opted out.';
    tbc_mc_ajax_feedback('success', $message, ['userList' => $user_data]);
}
add_action('wp_ajax_tbc_mc_fetch_by_role', 'tbc_mc_fetch_by_role');

/**
 * Fetch all active Fluent Community spaces with member counts
 */
function tbc_mc_fetch_spaces() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => 'Insufficient permissions']);
    }

    global $wpdb;

    $spaces_table = $wpdb->prefix . 'fcom_spaces';
    $space_user_table = $wpdb->prefix . 'fcom_space_user';

    // Check if Fluent Community tables exist
    if ($wpdb->get_var("SHOW TABLES LIKE '{$spaces_table}'") !== $spaces_table) {
        tbc_mc_ajax_feedback('error', 'Fluent Community is not installed or spaces table not found.');
        return;
    }

    // Get actual spaces (type='community', status='published') not space groups
    // Include parent group title for context
    $spaces = $wpdb->get_results("
        SELECT s.id, s.title, s.parent_id,
               COALESCE(g.title, '') as group_title,
               COUNT(su.user_id) as member_count
        FROM {$spaces_table} s
        LEFT JOIN {$spaces_table} g ON s.parent_id = g.id
        LEFT JOIN {$space_user_table} su ON s.id = su.space_id AND su.status = 'active'
        WHERE s.type = 'community' AND s.status = 'published'
        GROUP BY s.id
        ORDER BY g.title ASC, s.title ASC
    ");

    if (empty($spaces)) {
        tbc_mc_ajax_feedback('error', 'No spaces found.');
        return;
    }

    $space_data = [];
    foreach ($spaces as $space) {
        $space_data[] = [
            'id' => intval($space->id),
            'title' => $space->title,
            'group_title' => $space->group_title,
            'member_count' => intval($space->member_count),
        ];
    }

    tbc_mc_ajax_feedback('success', count($space_data) . ' spaces loaded', ['spaces' => $space_data]);
}
add_action('wp_ajax_tbc_mc_fetch_spaces', 'tbc_mc_fetch_spaces');

/**
 * Fetch members of a specific Fluent Community space with phone numbers
 */
function tbc_mc_fetch_space_members() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => 'Insufficient permissions']);
    }

    global $wpdb;

    $space_id = isset($_POST['space_id']) ? intval($_POST['space_id']) : 0;
    $sms_opt_in_only = isset($_POST['sms_opt_in']) && $_POST['sms_opt_in'] === 'true';

    if (!$space_id) {
        tbc_mc_ajax_feedback('error', 'Invalid space ID.');
        return;
    }

    $space_user_table = $wpdb->prefix . 'fcom_space_user';

    // Get all active members of this space
    $user_ids = $wpdb->get_col($wpdb->prepare(
        "SELECT user_id FROM {$space_user_table} WHERE space_id = %d AND status = 'active'",
        $space_id
    ));

    if (empty($user_ids)) {
        tbc_mc_ajax_feedback('error', 'No members found in this space.');
        return;
    }

    $member_list = [];
    $opted_out_count = 0;
    $seen_user_ids = [];

    foreach ($user_ids as $user_id) {
        $user_id = intval($user_id);

        // Deduplicate
        if (in_array($user_id, $seen_user_ids)) {
            continue;
        }
        $seen_user_ids[] = $user_id;

        $phone = tbc_mc_get_phone_from_profile($user_id);
        if (empty($phone)) {
            continue;
        }

        $user = get_userdata($user_id);
        if (!$user) {
            continue;
        }

        $is_sms_out = in_array('sms_out', $user->roles ?? []);
        if ($is_sms_out) {
            $opted_out_count++;
        }

        // If SMS opt-in filter is active, skip opted-out users entirely
        if ($sms_opt_in_only && $is_sms_out) {
            continue;
        }

        $first_name = get_user_meta($user_id, 'first_name', true);
        $last_name = get_user_meta($user_id, 'last_name', true);
        $full_name = trim("{$first_name} {$last_name}");

        $display_name = esc_html($full_name . ' - ' . $phone);

        $member_list[] = [
            'id' => $user_id,
            'name' => $full_name,
            'display_name' => $display_name,
            'phone' => $phone,
            'is_sms_out' => $is_sms_out,
        ];
    }

    $member_count = count($member_list);
    $message = $member_count . ' members with phone numbers. ' . $opted_out_count . ' opted out.';
    tbc_mc_ajax_feedback('success', $message, ['memberList' => $member_list]);
}
add_action('wp_ajax_tbc_mc_fetch_space_members', 'tbc_mc_fetch_space_members');