<?php
/**
 * WooCommerce Blocks compatibility — ensures donation products work
 * with the block-based cart/checkout and product blocks.
 *
 * @package TBC\WooDonations\Compat
 */

declare(strict_types=1);

namespace TBC\WooDonations\Compat;

use TBC\WooDonations\Helpers;
use WC_Product;

defined( 'ABSPATH' ) || exit;

final class Blocks {

	public static function init(): void {
		// Extend Store API cart item data with donation info.
		add_filter( 'rest_request_after_callbacks', [ __CLASS__, 'extend_cart_response' ], 10, 3 );
	}

	/**
	 * Extend Store API cart responses with donation data.
	 *
	 * @param \WP_REST_Response|\WP_Error $response
	 * @param array<mixed> $handler
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function extend_cart_response( $response, array $handler, \WP_REST_Request $request ) {
		if ( ! $response instanceof \WP_REST_Response ) {
			return $response;
		}

		$route = $request->get_route();

		// Only modify cart/checkout Store API endpoints.
		if ( ! str_contains( $route, 'wc/store' ) || ! str_contains( $route, 'cart' ) ) {
			return $response;
		}

		$data = $response->get_data();

		if ( isset( $data['items'] ) && is_array( $data['items'] ) ) {
			foreach ( $data['items'] as &$item ) {
				$cart_data = $item['extensions'] ?? [];

				// Add donation data to extensions.
				if ( isset( $item['key'] ) && isset( WC()->cart->cart_contents[ $item['key'] ]['tbc_don_price'] ) ) {
					$cart_data['tbc_woo_donations'] = [
						'price' => WC()->cart->cart_contents[ $item['key'] ]['tbc_don_price'],
					];
				}

				$item['extensions'] = $cart_data;
			}
			unset( $item );
			$response->set_data( $data );
		}

		return $response;
	}
}
