<?php
/**
 * WooCommerce Subscriptions compatibility — handles subscription-specific donation behavior.
 *
 * @package TBC\WooDonations\Compat
 */

declare(strict_types=1);

namespace TBC\WooDonations\Compat;

use TBC\WooDonations\Helpers;
use WC_Product;

defined( 'ABSPATH' ) || exit;

final class Subscriptions {

	public static function init(): void {
		// When a subscription product is saved, set its price to 0 if it's a donation.
		add_action( 'woocommerce_admin_process_product_object', [ __CLASS__, 'set_subscription_price' ], 30 );

		// Ensure subscription price is set from donation price in cart.
		add_filter( 'woocommerce_subscriptions_product_price', [ __CLASS__, 'filter_subscription_price' ], 10, 2 );
	}

	/**
	 * Set subscription price to 0 when a donation subscription is saved.
	 * This allows custom donation pricing to override at cart/checkout time.
	 */
	public static function set_subscription_price( WC_Product $product ): void {
		if ( ! $product->is_type( [ 'subscription', 'variable-subscription' ] ) ) {
			return;
		}

		if ( Helpers::is_donation( $product ) ) {
			$product->update_meta_data( '_subscription_price', 0 );
		}
	}

	/**
	 * Filter subscription product price to use the donation price.
	 */
	public static function filter_subscription_price( string $price, WC_Product $product ): string {
		if ( Helpers::is_donation( $product ) ) {
			// Let the cart handler manage the price — return 0 as base.
			return '0';
		}
		return $price;
	}
}
