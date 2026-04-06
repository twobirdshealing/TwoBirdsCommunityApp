<?php
/**
 * Braintree for WooCommerce compatibility — ensures custom donation prices
 * are correctly passed to the Braintree payment gateway.
 *
 * @package TBC\WooDonations\Compat
 */

declare(strict_types=1);

namespace TBC\WooDonations\Compat;

use TBC\WooDonations\Helpers;
use WC_Product;

defined( 'ABSPATH' ) || exit;

final class Braintree {

	public static function init(): void {
		// Disable Braintree's smart pay buttons on donation product pages
		// because the price isn't known until the customer enters it.
		add_filter( 'wc_braintree_paypal_product_page_enabled', [ __CLASS__, 'disable_smart_buttons' ], 10, 2 );
		add_filter( 'wc_braintree_paypal_cart_page_enabled', [ __CLASS__, 'maybe_disable_cart_buttons' ] );
	}

	/**
	 * Disable PayPal smart buttons on donation product pages.
	 */
	public static function disable_smart_buttons( bool $enabled, ?WC_Product $product = null ): bool {
		if ( $product && ( Helpers::is_donation( $product ) || Helpers::has_donation_variations( $product ) ) ) {
			return false;
		}
		return $enabled;
	}

	/**
	 * Disable PayPal smart buttons in cart if any donation item exists.
	 */
	public static function maybe_disable_cart_buttons( bool $enabled ): bool {
		if ( ! WC()->cart ) {
			return $enabled;
		}

		foreach ( WC()->cart->get_cart() as $cart_item ) {
			if ( isset( $cart_item['tbc_don_price'] ) ) {
				return false;
			}
		}

		return $enabled;
	}
}
