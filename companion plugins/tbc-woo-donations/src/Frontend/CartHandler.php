<?php
/**
 * Cart validation, pricing, session handling, and order-again support.
 *
 * Handles cart validation, pricing, session restore, and order-again.
 *
 * @package TBC\WooDonations\Frontend
 */

declare(strict_types=1);

namespace TBC\WooDonations\Frontend;

use TBC\WooDonations\Helpers;
use WC_Product;
use Exception;

defined( 'ABSPATH' ) || exit;

final class CartHandler {

	private static ?self $instance = null;

	public static function instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		// Cart — priority 5 ensures we run before most addons.
		add_filter( 'woocommerce_is_purchasable', [ $this, 'is_purchasable' ], 5, 2 );
		add_filter( 'woocommerce_add_cart_item_data', [ $this, 'add_cart_item_data' ], 5, 3 );
		add_filter( 'woocommerce_get_cart_item_from_session', [ $this, 'get_cart_item_from_session' ], 11, 2 );
		add_filter( 'woocommerce_add_cart_item', [ $this, 'set_cart_item' ], 11, 1 );
		add_filter( 'woocommerce_add_to_cart_validation', [ $this, 'validate_add_cart_item' ], 5, 6 );

		// Re-validate prices in cart (prevents smart pay bypass).
		add_action( 'woocommerce_check_cart_items', [ $this, 'check_cart_items' ] );

		// Order again.
		add_filter( 'woocommerce_order_again_cart_item_data', [ $this, 'order_again_cart_item_data' ], 5, 3 );
	}

	// -------------------------------------------------------------------------
	// Purchasability
	// -------------------------------------------------------------------------

	public function is_purchasable( bool $is_purchasable, WC_Product $product ): bool {
		if ( Helpers::is_donation( $product ) || Helpers::has_donation_variations( $product ) ) {
			return true;
		}
		return $is_purchasable;
	}

	// -------------------------------------------------------------------------
	// Add to Cart
	// -------------------------------------------------------------------------

	/**
	 * Store donation price in cart item data.
	 *
	 * @param array<string, mixed> $cart_item_data
	 */
	public function add_cart_item_data( array $cart_item_data, int $product_id, int $variation_id ): array {

		$don_id  = $variation_id ?: $product_id;
		$product = wc_get_product( $don_id );

		if ( ! $product || ! Helpers::is_donation( $product ) ) {
			return $cart_item_data;
		}

		// Handle edit-in-cart: remove old item, redirect to cart.
		// phpcs:disable WordPress.Security.NonceVerification
		if ( isset( $_POST['update-price'], $_POST['_tbc_don_nonce'] ) && wp_verify_nonce( sanitize_key( $_POST['_tbc_don_nonce'] ), 'tbc-don-nonce' ) ) {
			$updating_key = wc_clean( wp_unslash( $_POST['update-price'] ) );
			if ( WC()->cart->find_product_in_cart( $updating_key ) ) {
				WC()->cart->remove_cart_item( $updating_key );
				add_filter( 'woocommerce_add_to_cart_redirect', static fn() => wc_get_cart_url() );
				add_filter( 'wc_add_to_cart_message_html', static fn() => esc_html__( 'Cart updated.', 'tbc-woo-donations' ) );
			}
		}
		// phpcs:enable

		// Get posted price.
		$suffix = '';
		$posted = $cart_item_data['tbc_don_price'] ?? Helpers::get_posted_price( $product, $suffix );

		if ( $posted ) {
			$cart_item_data['tbc_don_price'] = (float) Helpers::standardize_number( $posted );
		}

		return $cart_item_data;
	}

	// -------------------------------------------------------------------------
	// Session Restore
	// -------------------------------------------------------------------------

	/**
	 * @param array<string, mixed> $cart_item
	 * @param array<string, mixed> $values
	 * @return array<string, mixed>
	 */
	public function get_cart_item_from_session( array $cart_item, array $values ): array {
		if ( isset( $values['tbc_don_price'] ) ) {
			$cart_item['tbc_don_price'] = $values['tbc_don_price'];
			$cart_item = $this->set_cart_item( $cart_item );
		}
		return $cart_item;
	}

	// -------------------------------------------------------------------------
	// Set Cart Item Price
	// -------------------------------------------------------------------------

	/**
	 * @param array<string, mixed> $cart_item
	 * @return array<string, mixed>
	 */
	public function set_cart_item( array $cart_item ): array {

		if ( ! isset( $cart_item['tbc_don_price'], $cart_item['data'] ) ) {
			return $cart_item;
		}

		/** @var WC_Product $product */
		$product = $cart_item['data'];
		$price   = (float) $cart_item['tbc_don_price'];

		$product->set_price( $price );
		$product->set_sale_price( $price );
		$product->set_regular_price( $price );

		// Subscription-specific: set subscription price meta.
		if ( $product->is_type( [ 'subscription', 'subscription_variation' ] ) ) {
			$product->update_meta_data( '_subscription_price', $price );
		}

		return $cart_item;
	}

	// -------------------------------------------------------------------------
	// Validation
	// -------------------------------------------------------------------------

	/**
	 * Validate donation price before adding to cart.
	 *
	 * @param bool $passed
	 * @param int $product_id
	 * @param int $quantity
	 * @param int|string $variation_id
	 * @param mixed $variations
	 * @param array<string, mixed> $cart_item_data
	 */
	public function validate_add_cart_item( $passed, $product_id, $quantity, $variation_id = 0, $variations = '', $cart_item_data = [] ): bool {

		// Skip on Store API requests — handled separately.
		if ( WC()->is_rest_api_request() ) {
			return (bool) $passed;
		}

		$don_id  = $variation_id ? (int) $variation_id : $product_id;
		$product = wc_get_product( $don_id );

		if ( ! $product || ! Helpers::is_donation( $product ) ) {
			return (bool) $passed;
		}

		$price = $cart_item_data['tbc_don_price'] ?? Helpers::get_posted_price( $product );

		try {
			Helpers::validate_price( $product, $price );
		} catch ( Exception $e ) {
			if ( $e->getMessage() ) {
				wc_add_notice(
					sprintf(
						/* translators: %1$s product title, %2$s error message */
						__( '&quot;%1$s&quot; could not be added to the cart. %2$s', 'tbc-woo-donations' ),
						$product->get_title(),
						$e->getMessage()
					),
					'error'
				);
			}
			return false;
		}

		return (bool) $passed;
	}

	/**
	 * Re-validate prices on cart load.
	 */
	public function check_cart_items(): void {

		if ( WC()->is_rest_api_request() ) {
			return;
		}

		foreach ( WC()->cart->cart_contents as $cart_item ) {
			if ( ! isset( $cart_item['tbc_don_price'] ) ) {
				continue;
			}

			try {
				Helpers::validate_price( $cart_item['data'], $cart_item['tbc_don_price'] );
			} catch ( Exception $e ) {
				if ( $e->getMessage() ) {
					wc_add_notice(
						sprintf(
							/* translators: %1$s product title, %2$s error message */
							__( '&quot;%1$s&quot; cannot be purchased. %2$s', 'tbc-woo-donations' ),
							$cart_item['data']->get_title(),
							$e->getMessage()
						),
						'error'
					);
				}
			}
		}
	}

	// -------------------------------------------------------------------------
	// Order Again
	// -------------------------------------------------------------------------

	/**
	 * Recover donation price from a previous order for "Order Again".
	 *
	 * @param array<string, mixed> $cart_item_data
	 * @param \WC_Order_Item_Product $line_item
	 * @param \WC_Order $order
	 * @return array<string, mixed>
	 */
	public function order_again_cart_item_data( array $cart_item_data, $line_item, $order ): array {

		$product = $line_item->get_product();

		if ( ! $product || ! Helpers::is_donation( $product ) ) {
			return $cart_item_data;
		}

		$line_price = (float) $line_item->get_subtotal();

		// If order prices include tax, add it back.
		if ( $product->is_taxable() && $order->get_prices_include_tax() ) {

			if ( 'yes' !== get_option( 'woocommerce_tax_round_at_subtotal' ) ) {
				$line_price = (float) wc_format_decimal( $line_price, wc_get_price_decimals() );
			}

			$taxes       = $line_item->get_taxes();
			$line_price += array_sum( $taxes['subtotal'] ?? [] );
		}

		$line_price /= max( 1, $line_item->get_quantity() );
		$cart_item_data['tbc_don_price'] = (float) wc_format_decimal( $line_price );

		return $cart_item_data;
	}
}
