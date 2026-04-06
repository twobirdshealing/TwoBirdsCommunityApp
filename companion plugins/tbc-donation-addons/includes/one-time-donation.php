<?php
function display_one_time_purchase_option() {
    global $product;
    if ($product->is_type('subscription') && 'yes' === $product->get_meta('_subscription_once_checkbox'))
 {
        echo '<div class="donation-options">
                <label class="frequency-title">' . esc_html__('Donation Frequency', 'woocommerce') . '</label><br>
                <div class="donation-frequency-container">
                    <input type="radio" name="purchase_option" id="one_time_purchase" value="one_time" checked />
                    <label for="one_time_purchase">' . esc_html__('One-Time Donation', 'woocommerce') . ' - <span class="price one-time-price"></span></label><br />
                    <input type="radio" name="purchase_option" id="subscription_purchase" value="subscription" />
                    <label for="subscription_purchase">' . esc_html__('Recurring', 'woocommerce') . ' - <span class="price subscription-price"></span> / month</label>
                </div>
              </div>';
    }
}
add_action('woocommerce_before_add_to_cart_button', 'display_one_time_purchase_option');

function switch_to_simple_product_type($cart_item_data, $product_id) {
    if (!empty($_POST['purchase_option'])) {
        $cart_item_data['purchase_option'] = wc_clean($_POST['purchase_option']);
    }
    return $cart_item_data;
}
add_filter('woocommerce_add_cart_item_data', 'switch_to_simple_product_type', 10, 2);

function adjust_price_for_one_time_purchase($cart_item_data) {
    if (isset($cart_item_data['data'], $cart_item_data['purchase_option']) && 
        $cart_item_data['purchase_option'] === 'one_time' && 
        $cart_item_data['data']->is_type('subscription')) {
            $cart_item_data['data']->set_price($cart_item_data['data']->get_regular_price());
    }
    return $cart_item_data;
}
add_filter('woocommerce_get_cart_item_from_session', 'adjust_price_for_one_time_purchase', 10, 1);

function filter_is_subscription($is_subscription, $product_id) {
    if ((is_cart() || is_checkout()) && WC()->cart) {
        foreach (WC()->cart->get_cart() as $cart_item) {
            if ($product_id === $cart_item['product_id'] && 
                isset($cart_item['purchase_option']) && 
                $cart_item['purchase_option'] === 'one_time') {
                    return false;
            }
        }
    }
    return $is_subscription;
}
add_filter('woocommerce_is_subscription', 'filter_is_subscription', 10, 2);