<?php
/**
 * WooCommerce Store API (Blocks) — extends cart/product data for donation products.
 *
 * @package TBC\WooDonations\API
 */

declare(strict_types=1);

namespace TBC\WooDonations\API;

use TBC\WooDonations\Helpers;
use TBC\WooDonations\Frontend\CartHandler;
use WC_Product;

defined( 'ABSPATH' ) || exit;

final class StoreAPI {

	public static function init(): void {
		add_action( 'woocommerce_store_api_validate_add_to_cart', [ __CLASS__, 'validate_add_to_cart' ], 10, 2 );
		add_action( 'woocommerce_store_api_validate_cart_item', [ __CLASS__, 'validate_cart_item' ], 10, 1 );
		add_filter( 'woocommerce_store_api_add_to_cart_data', [ __CLASS__, 'add_to_cart_data' ], 10, 2 );
	}

	public static function validate_add_to_cart( WC_Product $product, \WP_REST_Request $request ): void {
		if ( ! Helpers::is_donation( $product ) ) {
			return;
		}

		$extensions = $request->get_param( 'extensions' ) ?? [];
		$price      = $extensions['tbc_woo_donations']['price'] ?? '';

		if ( ! $price ) {
			throw new \Automattic\WooCommerce\StoreApi\Exceptions\RouteException(
				'tbc_don_missing_price',
				__( 'Please enter a donation amount.', 'tbc-woo-donations' ),
				400
			);
		}

		CartHandler::instance()->validate_price( $product, $price );
	}

	/**
	 * @param array<string, mixed> $cart_item
	 */
	public static function validate_cart_item( array $cart_item ): void {
		if ( ! isset( $cart_item['tbc_don_price'] ) ) {
			return;
		}

		CartHandler::instance()->validate_price( $cart_item['data'], $cart_item['tbc_don_price'] );
	}

	/**
	 * @param array<string, mixed> $add_to_cart_data
	 * @return array<string, mixed>
	 */
	public static function add_to_cart_data( array $add_to_cart_data, \WP_REST_Request $request ): array {
		$extensions = $request->get_param( 'extensions' ) ?? [];

		if ( isset( $extensions['tbc_woo_donations']['price'] ) ) {
			$add_to_cart_data['tbc_don_price'] = (float) Helpers::standardize_number(
				sanitize_text_field( $extensions['tbc_woo_donations']['price'] )
			);
		}

		return $add_to_cart_data;
	}
}
