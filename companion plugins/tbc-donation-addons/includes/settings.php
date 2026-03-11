<?php

// Exit if accessed directly
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}


// Add the custom product settings fields
function add_donation_fees_product_settings( $settings_tabs ) {
    $settings_tabs['donation_fees_settings'] = [
        'label' => __( 'Donation Addons', 'woocommerce-custom-donation-fees' ),
        'target' => 'donation_fees_settings',
        'class' => [ 'show_if_simple', 'show_if_variable' ],
    ];

    return $settings_tabs;
}
add_filter( 'woocommerce_product_data_tabs', 'add_donation_fees_product_settings', 99 );

// Display the custom product settings fields
function show_donation_fees_product_settings_fields() {
    global $post;

    echo '<div id="donation_fees_settings" class="panel woocommerce_options_panel hidden">
            <div class="options_group">';

    // Enable non-refundable deposit
    woocommerce_wp_checkbox([
        'id'          => '_enable_non_refundable_deposit',
        'label'       => __( 'Enable Non-refundable Deposit', 'woocommerce-custom-donation-fees' ),
        'desc_tip'    => 'true',
        'description' => __( 'Enable this to add a non-refundable deposit and cancellation policy on the product page.', 'woocommerce-custom-donation-fees' ),
    ]);

    // Non-refundable deposit
    woocommerce_wp_text_input([
        'id'          => '_non_refundable_deposit',
        'label'       => __( 'Non-refundable Deposit', 'woocommerce-custom-donation-fees' ),
        'desc_tip'    => 'true',
        'description' => __( 'Enter a fixed amount for the non-refundable deposit. Leave blank for no deposit.', 'woocommerce-custom-donation-fees' ),
        'type'        => 'number',
        'custom_attributes' => [
            'step' => 'any',
            'min'  => '0',
        ],
    ]);

    // Cancellation policy
    woocommerce_wp_textarea_input([
        'id'          => '_cancellation_policy',
        'label'       => __( 'Cancellation Policy', 'woocommerce-custom-donation-fees' ),
        'desc_tip'    => 'true',
        'description' => __( 'Enter the cancellation policy text to be displayed when clicking the cancellation policy link.', 'woocommerce-custom-donation-fees' ),
    ]);

    // Recover donor fees
    woocommerce_wp_checkbox([
        'id'          => '_recover_donor_fees',
        'label'       => __( 'Recover Donor Fees', 'woocommerce-custom-donation-fees' ),
        'desc_tip'    => 'true',
        'description' => __( 'Enable this to add a checkbox on the product page for customers to cover the transaction fees.', 'woocommerce-custom-donation-fees' ),
    ]);

    // Give extra option
    woocommerce_wp_checkbox([
        'id'          => '_give_extra_option',
        'label'       => __( 'Enable Give Extra Option', 'woocommerce-custom-donation-fees' ),
        'desc_tip'    => 'true',
        'description' => __( 'Enable this to add a checkbox on the product page for customers to give an extra donation.', 'woocommerce-custom-donation-fees' ),
    ]);

    // Donor wall
    woocommerce_wp_checkbox([
        'id'          => '_donor_wall',
        'label'       => __( 'Donor Wall', 'woocommerce' ),
        'description' => __( 'Enable donor wall for this product', 'woocommerce' ),
        'desc_tip'    => true,
    ]);

    // One-time donation option (for subscriptions)
    if ( class_exists( 'WC_Subscriptions' ) ) {
        $product = wc_get_product( $post->ID );
        if ( $product && ( $product->is_type( 'subscription' ) || $product->is_type( 'variable-subscription' ) ) ) {
            woocommerce_wp_checkbox([
                'id'          => '_subscription_once_checkbox',
                'label'       => __( 'One-time donation option', 'woocommerce' ),
                'desc_tip'    => 'true',
                'description' => __( 'Enable this option to allow customers to purchase this product once without subscribing.', 'woocommerce-custom-donation-fees' ),
            ]);
        }
    }

    echo '</div></div>';
}
add_action( 'woocommerce_product_data_panels', 'show_donation_fees_product_settings_fields' );

// Save the custom product settings fields values
function save_donation_fees_product_settings( $post_id ) {
    // Save checkbox fields
    $fields = [
        '_enable_non_refundable_deposit',
        '_recover_donor_fees',
        '_give_extra_option',
        '_donor_wall',
    ];

    foreach ( $fields as $field ) {
        $value = isset( $_POST[ $field ] ) ? 'yes' : 'no';
        update_post_meta( $post_id, $field, $value );
    }

    // Save non-refundable deposit value
    if ( isset( $_POST['_non_refundable_deposit'] ) ) {
        update_post_meta( $post_id, '_non_refundable_deposit', floatval( $_POST['_non_refundable_deposit'] ) );
    }

    // Save cancellation policy value
    if ( isset( $_POST['_cancellation_policy'] ) ) {
        update_post_meta( $post_id, '_cancellation_policy', wp_kses_post( $_POST['_cancellation_policy'] ) );
    }

    // Save one-time donation option value (for subscriptions)
    if ( class_exists( 'WC_Subscriptions' ) ) {
        $subscription_once_checkbox = isset( $_POST['_subscription_once_checkbox'] ) ? 'yes' : 'no';
        update_post_meta( $post_id, '_subscription_once_checkbox', $subscription_once_checkbox );
    }
}
add_action( 'woocommerce_process_product_meta', 'save_donation_fees_product_settings' );
add_action( 'woocommerce_process_product_meta_subscription', 'save_donation_fees_product_settings' );
add_action( 'woocommerce_process_product_meta_variable-subscription', 'save_donation_fees_product_settings' );