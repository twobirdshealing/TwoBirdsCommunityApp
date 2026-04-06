<?php
/**
 * Plugin Name: TBC - Custom Donation Addons
 * Plugin URI: https://twobirdscode.com
 * Description: A plugin to add custom fees to WooCommerce products.
 * Version: 2.5.204
 * Author: Two Birds Code
 * Author URI: https://twobirdscode.com
 */

// Exit if accessed directly
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Initialize plugin after all other plugins have loaded.
 */
add_action( 'plugins_loaded', 'wc_custom_donation_addons_init', 20 );

function wc_custom_donation_addons_init() {
    // If WooCommerce isn't active, abort.
    if ( ! class_exists( 'WooCommerce' ) ) {
        return;
    }

    // Remove variations "Clear" button
    add_filter( 'woocommerce_reset_variations_link', '__return_empty_string' );
    
    // Remove "Additional Information" tab
    add_filter( 'woocommerce_product_tabs', function( $tabs ) {
        unset( $tabs['additional_information'] );
        return $tabs;
    }, 9999 );

// Remove variation price display below dropdowns
//add_filter( 'woocommerce_available_variation', function( $data, $product, $variation ) {
//    if ( is_product() ) {
//        $data['price_html'] = '';
//    }
//    return $data;
// }, 10, 3 );

    // Define version constant
    if ( ! defined( 'CUSTOM_DONATION_ADDONS_VERSION' ) ) {
        define( 'CUSTOM_DONATION_ADDONS_VERSION', '2.5.204' );
    }

    // Enqueue frontend scripts and styles
    add_action( 'wp_enqueue_scripts', 'give_extra_fee_frontend_scripts_and_styles', 20 );

    // Enqueue admin scripts and styles
    add_action( 'admin_enqueue_scripts', 'give_extra_fee_admin_scripts_and_styles', 20 );

    // Include fee-related files
    require_once plugin_dir_path( __FILE__ ) . 'includes/non-refundable-deposit.php';
    require_once plugin_dir_path( __FILE__ ) . 'includes/woocommerce-recover-donor-fees.php';
    require_once plugin_dir_path( __FILE__ ) . 'includes/give-extra-fee.php';
    require_once plugin_dir_path( __FILE__ ) . 'includes/append-deposit-to-price.php';
    require_once plugin_dir_path( __FILE__ ) . 'includes/donor-wall.php';
    require_once plugin_dir_path( __FILE__ ) . 'includes/settings.php';

    // If WooCommerce Subscriptions is active, include one-time-donation.php
    if ( class_exists( 'WC_Subscriptions' ) ) {
        require_once plugin_dir_path( __FILE__ ) . 'includes/one-time-donation.php';
    }
}

/**
 * Enqueue frontend scripts and styles
 */
function give_extra_fee_frontend_scripts_and_styles() {
    wp_enqueue_style( 'give-extra-fee-styles', plugin_dir_url( __FILE__ ) . 'css/styles.css', array(), CUSTOM_DONATION_ADDONS_VERSION );
    wp_enqueue_style( 'donor-wall-styles', plugin_dir_url( __FILE__ ) . 'css/donor-wall.css', array(), CUSTOM_DONATION_ADDONS_VERSION );
    wp_enqueue_style( 'one-time-donation-styles', plugin_dir_url( __FILE__ ) . 'css/onetimedonation.css', array(), CUSTOM_DONATION_ADDONS_VERSION );
    
    wp_enqueue_script( 'one-time-donation', plugin_dir_url( __FILE__ ) . 'js/one-time-donation.js', array( 'jquery' ), CUSTOM_DONATION_ADDONS_VERSION, true );
    wp_enqueue_script( 'update-fee-label', plugin_dir_url( __FILE__ ) . 'js/updateFeeLabel.js', array( 'jquery' ), CUSTOM_DONATION_ADDONS_VERSION, true );
    wp_enqueue_script( 'give-extra-fee', plugin_dir_url( __FILE__ ) . 'js/giveExtraFee.js', array( 'jquery' ), CUSTOM_DONATION_ADDONS_VERSION, true );
    wp_enqueue_script( 'cancellation-policy-popup', plugin_dir_url( __FILE__ ) . 'js/cancellationPolicyPopup.js', array( 'jquery' ), CUSTOM_DONATION_ADDONS_VERSION, true );
    wp_enqueue_script( 'donor-wall', plugin_dir_url( __FILE__ ) . 'js/donor-wall.js', array( 'jquery' ), CUSTOM_DONATION_ADDONS_VERSION, true );
}

/**
 * Enqueue admin scripts and styles
 */
function give_extra_fee_admin_scripts_and_styles() {
    $screen = get_current_screen();

    if ( 'product' === $screen->id ) {
        wp_enqueue_script( 'show-nonrefundable-deposit', plugin_dir_url( __FILE__ ) . 'js/show-nonrefundable-deposit.js', array( 'jquery' ), CUSTOM_DONATION_ADDONS_VERSION, true );
    }
}