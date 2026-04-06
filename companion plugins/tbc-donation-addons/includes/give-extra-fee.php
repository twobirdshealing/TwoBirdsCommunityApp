<?php
/**
 * Give Extra Fee (Donate Extra)
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

function display_give_extra_fee() {
    global $product;

    if ( ! $product instanceof WC_Product ) {
        return;
    }

    // Only show if enabled per-product
    if ( get_post_meta( $product->get_id(), '_give_extra_option', true ) !== 'yes' ) {
        return;
    }
    ?>
    <h4 class="give-extra-heading"><?php esc_html_e( 'Help the Church Grow', 'woocommerce' ); ?></h4>
    <div class="give-extra-checkbox-container">
        <div class="give-extra-checkbox-wrapper">
            <input type="checkbox" name="give_extra_checkbox" id="give_extra_checkbox" value="1" />
            <label for="give_extra_checkbox" class="give-extra-label">
                <?php esc_html_e( 'Donate Extra', 'woocommerce' ); ?>
            </label>
        </div>

        <div class="give-extra-amount" style="display:none;">
            <label for="give_extra_amount" class="give-extra-amount-label">
                <?php esc_html_e( 'Amount (USD)', 'woocommerce' ); ?>
            </label>
            <input
                type="number"
                name="give_extra_amount"
                id="give_extra_amount"
                min="0"
                step="0.01"
                inputmode="decimal"
                placeholder="<?php esc_attr_e( '0.00', 'woocommerce' ); ?>"
            />
        </div>
    </div>
    <?php
}

// Hook after variations table
add_action( 'woocommerce_before_add_to_cart_button', 'display_give_extra_fee', 10 );

/**
 * Store the extra donation amount on the cart item when the box is checked.
 */
function add_extra_donation_data_to_cart_item( $cart_item_data, $product_id ) {
    if ( isset( $_POST['give_extra_checkbox'] ) && isset( $_POST['give_extra_amount'] ) ) {
        $amount = wc_format_decimal( wp_unslash( $_POST['give_extra_amount'] ), 2 );
        if ( $amount > 0 ) {
            $cart_item_data['give_extra_amount'] = (float) $amount;
        }
    }
    return $cart_item_data;
}
add_filter( 'woocommerce_add_cart_item_data', 'add_extra_donation_data_to_cart_item', 10, 2 );

/**
 * Add the extra donation as a single cart fee (first matching item).
 */
function add_extra_donation_fee_to_cart( $cart ) {
    if ( is_admin() && ! defined( 'DOING_AJAX' ) ) {
        return;
    }
    if ( ! $cart || ! method_exists( $cart, 'get_cart' ) ) {
        return;
    }

    foreach ( $cart->get_cart() as $cart_item ) {
        if ( ! empty( $cart_item['give_extra_amount'] ) ) {
            $amount = (float) $cart_item['give_extra_amount'];
            if ( $amount > 0 ) {
                $cart->add_fee( __( 'Extra Donation', 'woocommerce' ), $amount, false );
                break; // single fee line
            }
        }
    }
}
add_action( 'woocommerce_cart_calculate_fees', 'add_extra_donation_fee_to_cart', 20 );