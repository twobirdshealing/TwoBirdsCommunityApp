<?php
/**
 * Appends '+ Deposit' to the given product price along with the actual deposit amount.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Append the deposit suffix to a price HTML string if a deposit is configured.
 */
function custom_append_deposit_to_price( $price_html, $product ) {
    if ( ! $product instanceof WC_Product ) {
        return $price_html;
    }

    // Use parent product ID for variations
    $product_id = $product->is_type( 'variation' ) ? $product->get_parent_id() : $product->get_id();

    // Check if deposit is enabled
    if ( 'yes' !== get_post_meta( $product_id, '_enable_non_refundable_deposit', true ) ) {
        return $price_html;
    }

    // Get deposit amount
    $deposit = get_post_meta( $product_id, '_non_refundable_deposit', true );
    if ( empty( $deposit ) || $deposit <= 0 ) {
        return $price_html;
    }

    // Avoid double-append if already added
    if ( strpos( $price_html, 'Deposit' ) !== false ) {
        return $price_html;
    }

    $formatted_deposit = wc_price( $deposit );
    return $price_html . " + {$formatted_deposit} Deposit";
}

/**
 * Main hook: affects product price HTML in all contexts
 */
add_filter( 'woocommerce_get_price_html', 'custom_append_deposit_to_price', 999, 2 );