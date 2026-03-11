<?php
/**
 * Cover Donation Fees (3.5%)
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Displays the "Cover Donation Fees" checkbox when enabled.
 */
function display_recover_donor_fees_checkbox() {
    global $product;
    
    if ( ! $product instanceof WC_Product ) {
        return;
    }

    // Only show if enabled per-product
    if ( get_post_meta( $product->get_id(), '_recover_donor_fees', true ) !== 'yes' ) {
        return;
    }

    $pct       = 0.035; // 3.5%
    $type      = $product->is_type( array( 'variable', 'variable-subscription' ) ) ? 'variable' : 'simple';
    $basePrice = ( $type === 'simple' ) ? (float) $product->get_price() : 0.0;

    // Non-refundable deposit (stored on parent product)
    $deposit = 0.0;
    if ( 'yes' === get_post_meta( $product->get_id(), '_enable_non_refundable_deposit', true ) ) {
        $deposit_meta = get_post_meta( $product->get_id(), '_non_refundable_deposit', true );
        $deposit      = $deposit_meta !== '' ? (float) $deposit_meta : 0.0;
    }
    ?>
    <h4 class="donor-fees-heading"><?php esc_html_e( 'Cover Donation Fees', 'woocommerce' ); ?></h4>
    <div
        class="recover-donor-fees-container"
        data-percent="<?php echo esc_attr( $pct ); ?>"
        data-deposit="<?php echo esc_attr( $deposit ); ?>"
        data-base-price="<?php echo esc_attr( $basePrice ); ?>"
        data-product-type="<?php echo esc_attr( $type ); ?>"
    >
        <div class="recover-donor-fees-wrapper">
            <input type="checkbox" id="add_extra_fee" name="add_extra_fee" value="1" />
            <label for="add_extra_fee" class="recover-donor-fees-label">
                <?php
                echo wp_kses_post(
                    __( 'Help cover the donation fee of <span class="donation-fee-amount">$0.00</span> (3.5%)', 'woocommerce' )
                );
                ?>
            </label>
        </div>
    </div>
    <?php
}

// Hook after variations table, deposit, and donate extra
add_action( 'woocommerce_before_add_to_cart_button', 'display_recover_donor_fees_checkbox', 9 );

/**
 * Adds the "add_extra_fee" flag to cart item when checkbox is checked.
 */
function add_recover_donor_fee_to_cart( $cart_item_data, $product_id ) {
    if ( ! empty( $_POST['add_extra_fee'] ) && $_POST['add_extra_fee'] === '1' ) {
        $cart_item_data['add_extra_fee'] = true;
    }
    return $cart_item_data;
}
add_filter( 'woocommerce_add_cart_item_data', 'add_recover_donor_fee_to_cart', 10, 2 );

/**
 * Calculates and adds the Donation Fee (3.5%) on (price + deposit) for each opted-in item.
 */
function calculate_recover_donor_fee( $cart ) {
    if ( is_admin() && ! defined( 'DOING_AJAX' ) ) {
        return;
    }
    if ( ! $cart || ! method_exists( $cart, 'get_cart' ) ) {
        return;
    }

    $pct       = 0.035;
    $total_fee = 0.0;

    foreach ( $cart->get_cart() as $cart_item ) {
        if ( empty( $cart_item['add_extra_fee'] ) ) {
            continue;
        }

        $qty        = isset( $cart_item['quantity'] ) ? (int) $cart_item['quantity'] : 1;
        $product    = ( isset( $cart_item['data'] ) && $cart_item['data'] instanceof WC_Product ) ? $cart_item['data'] : null;
        $product_id = isset( $cart_item['product_id'] ) ? (int) $cart_item['product_id'] : 0;

        if ( ! $product || $qty <= 0 || $product_id <= 0 ) {
            continue;
        }

        // Current price (handles variations)
        $price = (float) $product->get_price();

        // Optional per-product deposit (stored on parent product)
        $deposit = 0.0;
        if ( 'yes' === get_post_meta( $product_id, '_enable_non_refundable_deposit', true ) ) {
            $deposit_meta = get_post_meta( $product_id, '_non_refundable_deposit', true );
            $deposit      = $deposit_meta !== '' ? (float) $deposit_meta : 0.0;
        }

        // Fee = (price + deposit) × pct × qty
        $total_fee += ( $price + $deposit ) * $pct * $qty;
    }

    if ( $total_fee > 0 ) {
        $cart->add_fee( __( 'Donation Fee (3.5%)', 'woocommerce' ), $total_fee, false );
    }
}
add_action( 'woocommerce_cart_calculate_fees', 'calculate_recover_donor_fee', 20 );