<?php
// Exit if accessed directly
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Renders the non-refundable deposit checkbox.
 */
function display_non_refundable_deposit() {
    global $product;
    
    if ( ! $product instanceof WC_Product ) {
        return;
    }

    // Only show if enabled on the product
    if ( 'yes' !== get_post_meta( $product->get_id(), '_enable_non_refundable_deposit', true ) ) {
        return;
    }

    $product_id             = $product->get_id();
    $non_refundable_deposit = (float) get_post_meta( $product_id, '_non_refundable_deposit', true );
    $cancellation_policy    = get_post_meta( $product_id, '_cancellation_policy', true );

    echo '<div class="non-refundable-deposit-wrapper" data-deposit-enabled="yes" data-deposit-amount="' . esc_attr( $non_refundable_deposit ) . '">';

    echo '<h4 class="deposit-heading">' . esc_html__( 'Non-refundable Deposit', 'woocommerce' ) . '</h4>';

    echo '<div class="custom-deposit-container"><div class="non-refundable-deposit-checkbox">';

    /* translators: %1$s = deposit amount, %2$s = raw cancellation-policy content for data attribute */
    printf(
        wp_kses(
            '<input type="checkbox" id="non_refundable_deposit" name="non_refundable_deposit" value="yes" required />
             <label for="non_refundable_deposit">'
            . __( 'I understand the %1$s deposit is non-refundable and have read the <a href="#" class="cancellation-policy-link" data-policy="%2$s">cancellation policy</a>.', 'woocommerce' )
            . '</label>',
            [
                'input' => [
                    'type'     => true,
                    'id'       => true,
                    'name'     => true,
                    'value'    => true,
                    'required' => true,
                ],
                'label' => [
                    'for' => true,
                ],
                'a'     => [
                    'href'        => true,
                    'class'       => true,
                    'data-policy' => true,
                ],
            ]
        ),
        wc_price( $non_refundable_deposit ),
        esc_attr( $cancellation_policy )
    );

    echo '</div></div></div>';
}

// Hook after variations table, before other addons
add_action( 'woocommerce_before_add_to_cart_button', 'display_non_refundable_deposit', 5 );

/**
 * Adds combined non-refundable deposit fee to the cart.
 */
function apply_combined_non_refundable_deposit_to_cart() {
    if ( is_admin() && ! defined( 'DOING_AJAX' ) ) {
        return;
    }

    $cart          = WC()->cart;
    $total_deposit = 0;

    if ( $cart ) {
        foreach ( $cart->get_cart_contents() as $cart_item ) {
            $product_id = $cart_item['product_id'];
            if ( 'yes' === get_post_meta( $product_id, '_enable_non_refundable_deposit', true ) ) {
                $deposit = (float) get_post_meta( $product_id, '_non_refundable_deposit', true );
                if ( $deposit > 0 ) {
                    $total_deposit += $deposit * $cart_item['quantity'];
                }
            }
        }

        if ( $total_deposit > 0 ) {
            $cart->add_fee( esc_html__( 'Non-refundable Deposit', 'woocommerce' ), $total_deposit );
        }
    }
}
add_action( 'woocommerce_cart_calculate_fees', 'apply_combined_non_refundable_deposit_to_cart', 10 );