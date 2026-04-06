<?php
/**
 * WooCommerce REST API extensions — adds donation fields to product endpoints.
 *
 * @package TBC\WooDonations\API
 */

declare(strict_types=1);

namespace TBC\WooDonations\API;

use TBC\WooDonations\Helpers;
use WC_Product;

defined( 'ABSPATH' ) || exit;

final class RestAPI {

	public static function init(): void {
		add_filter( 'woocommerce_rest_product_schema', [ __CLASS__, 'schema' ] );
		add_filter( 'woocommerce_rest_prepare_product_object', [ __CLASS__, 'prepare' ], 10, 2 );
		add_filter( 'woocommerce_rest_pre_insert_product_object', [ __CLASS__, 'insert' ], 10, 2 );
	}

	/**
	 * Extend the product REST schema with donation fields.
	 *
	 * @param array<string, mixed> $schema
	 * @return array<string, mixed>
	 */
	public static function schema( array $schema ): array {

		$donation_fields = [
			'tbc_don_enabled' => [
				'description' => __( 'Whether this is a donation product.', 'tbc-woo-donations' ),
				'type'        => 'boolean',
				'context'     => [ 'view', 'edit' ],
			],
			'tbc_don_suggested_price' => [
				'description' => __( 'Suggested donation price.', 'tbc-woo-donations' ),
				'type'        => 'string',
				'context'     => [ 'view', 'edit' ],
			],
			'tbc_don_min_price' => [
				'description' => __( 'Minimum donation price.', 'tbc-woo-donations' ),
				'type'        => 'string',
				'context'     => [ 'view', 'edit' ],
			],
			'tbc_don_max_price' => [
				'description' => __( 'Maximum donation price.', 'tbc-woo-donations' ),
				'type'        => 'string',
				'context'     => [ 'view', 'edit' ],
			],
			'tbc_don_hide_minimum' => [
				'description' => __( 'Whether the minimum price is hidden.', 'tbc-woo-donations' ),
				'type'        => 'boolean',
				'context'     => [ 'view', 'edit' ],
			],
		];

		foreach ( $donation_fields as $key => $field ) {
			$schema['properties'][ $key ] = $field;
		}

		return $schema;
	}

	/**
	 * Add donation data to REST response.
	 *
	 * @param \WP_REST_Response $response
	 * @param WC_Product $product
	 * @return \WP_REST_Response
	 */
	public static function prepare( \WP_REST_Response $response, WC_Product $product ): \WP_REST_Response {

		$data = $response->get_data();

		$data['tbc_don_enabled']         = Helpers::is_donation( $product );
		$data['tbc_don_suggested_price'] = (string) Helpers::get_suggested_price( $product );
		$data['tbc_don_min_price']       = (string) Helpers::get_minimum_price( $product );
		$data['tbc_don_max_price']       = (string) Helpers::get_maximum_price( $product );
		$data['tbc_don_hide_minimum']    = Helpers::is_minimum_hidden( $product );

		$response->set_data( $data );

		return $response;
	}

	/**
	 * Handle donation fields in REST create/update.
	 *
	 * @param WC_Product $product
	 * @param \WP_REST_Request $request
	 * @return WC_Product
	 */
	public static function insert( WC_Product $product, \WP_REST_Request $request ): WC_Product {

		$map = [
			'tbc_don_enabled'         => [ '_tbc_don_enabled', 'bool' ],
			'tbc_don_suggested_price' => [ '_tbc_don_suggested_price', 'price' ],
			'tbc_don_min_price'       => [ '_tbc_don_min_price', 'price' ],
			'tbc_don_max_price'       => [ '_tbc_don_max_price', 'price' ],
			'tbc_don_hide_minimum'    => [ '_tbc_don_hide_minimum', 'bool' ],
		];

		foreach ( $map as $param => [ $meta_key, $type ] ) {
			if ( $request->has_param( $param ) ) {
				$value = $request->get_param( $param );
				$value = match ( $type ) {
					'bool'  => $value ? 'yes' : 'no',
					'price' => wc_format_decimal( $value ),
					default => wc_clean( $value ),
				};
				$product->update_meta_data( $meta_key, $value );
			}
		}

		return $product;
	}
}
