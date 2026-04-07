<?php
if (!defined('ABSPATH')) {
    exit;
}

// Apply discount to product prices
add_filter('woocommerce_product_get_price', 'wmp_apply_discount', 99, 2);
add_filter('woocommerce_product_variation_get_price', 'wmp_apply_discount', 99, 2);

function wmp_apply_discount($price, $product) {
    if (is_admin() || wmp_is_donation_product($product)) {
        return $price;
    }

    $base_price = $product->is_on_sale() ? $product->get_sale_price() : $product->get_regular_price();
    
    if (!is_numeric($base_price) || $base_price <= 0) {
        return $price;
    }

    $discount = wmp_get_user_discount();
    
    if ($discount > 0) {
        $discounted_price = $base_price * (1 - ($discount / 100));
        return floor($discounted_price);
    }

    return $price;
}

// Get highest discount for current user
function wmp_get_user_discount() {
    static $user_discount = null;
    
    if ($user_discount !== null) {
        return $user_discount;
    }
    
    $user = wp_get_current_user();
    if (!$user->ID) {
        $user_discount = 0;
        return $user_discount;
    }
    
    global $wpdb;
    $table_name = $wpdb->prefix . 'perk_levels';
    
    $roles_placeholder = implode(',', array_fill(0, count($user->roles), '%s'));
    $query = $wpdb->prepare(
        "SELECT MAX(discount) FROM $table_name WHERE role IN ($roles_placeholder)",
        $user->roles
    );
    
    $user_discount = (float) $wpdb->get_var($query) ?: 0;
    return $user_discount;
}

// Check if product is donation (noperk category)
function wmp_is_donation_product($product) {
    return has_term('noperk', 'product_cat', $product->get_id());
}

// Add custom sale badge
add_action('woocommerce_single_product_summary', 'wmp_add_sale_badge', 7);
function wmp_add_sale_badge() {
    global $product;
    
    if (wmp_is_donation_product($product)) {
        return;
    }

    $discount = wmp_get_user_discount();
    
    if ($discount > 0) {
        echo '<div class="custom-onsale">' . round($discount) . '% Off Perk</div>';
    }
}