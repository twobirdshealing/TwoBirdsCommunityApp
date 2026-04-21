<?php
/**
 * Yearly donor statement — data extraction.
 *
 * Deductibility rules (in order):
 *   1. Product `_tbc_don_deductible` meta = 'yes' / 'no'  → explicit override.
 *   2. Otherwise, product is in the configured deductible category (default: "donation").
 *   3. Give Extra fees (tagged `_tbc_don_fee_type = give_extra`) are always deductible.
 *      Historical orders without the meta tag fall back to the "Extra Donation" fee name.
 *
 * @package TBC\WooDonations\Reports
 */

declare(strict_types=1);

namespace TBC\WooDonations\Reports;

use TBC\WooDonations\Frontend\DonationFeatures;
use WC_Order;
use WC_Order_Item_Fee;
use WC_Order_Item_Product;

defined( 'ABSPATH' ) || exit;

final class StatementData {

	/** @var array<int, bool> Per-request memo for is_product_deductible(). */
	private static array $deductible_cache = [];

	/**
	 * Get every year the donor has completed orders in, newest first.
	 *
	 * @return int[]
	 */
	public static function get_donor_years( int $user_id ): array {
		$orders = wc_get_orders( [
			'customer_id' => $user_id,
			'status'      => [ 'wc-completed' ],
			'limit'       => -1,
		] );

		$years = [];
		foreach ( $orders as $order ) {
			if ( $order instanceof WC_Order ) {
				$years[ (int) $order->get_date_created()->format( 'Y' ) ] = true;
			}
		}

		if ( empty( $years ) ) {
			$years[ (int) gmdate( 'Y' ) ] = true;
		}

		$list = array_keys( $years );
		rsort( $list );
		return $list;
	}

	/**
	 * Build the full yearly statement payload for a donor.
	 *
	 * @return array{
	 *   year: int,
	 *   total_given: float,
	 *   deductible: array{rows: array<int, array<string, mixed>>, total: float, count: int},
	 *   non_deductible: array{rows: array<int, array<string, mixed>>, total: float, count: int},
	 * }
	 */
	public static function get_yearly_statement( int $user_id, int $year ): array {
		$orders = wc_get_orders( [
			'customer_id'  => $user_id,
			'status'       => [ 'wc-completed' ],
			'date_created' => "{$year}-01-01...{$year}-12-31",
			'orderby'      => 'date_created',
			'order'        => 'ASC',
			'limit'        => -1,
		] );

		$deductible     = [];
		$non_deductible = [];

		foreach ( $orders as $order ) {
			if ( ! $order instanceof WC_Order || $order->get_total( 'edit' ) <= 0 ) {
				continue;
			}

			self::collect_line_items( $order, $deductible, $non_deductible );
			self::collect_fees( $order, $deductible, $non_deductible );
		}

		$d_total = array_sum( array_column( $deductible, 'amount' ) );
		$n_total = array_sum( array_column( $non_deductible, 'amount' ) );

		return [
			'year'           => $year,
			'total_given'    => $d_total + $n_total,
			'deductible'     => [
				'rows'  => $deductible,
				'total' => $d_total,
				'count' => count( $deductible ),
			],
			'non_deductible' => [
				'rows'  => $non_deductible,
				'total' => $n_total,
				'count' => count( $non_deductible ),
			],
		];
	}

	/**
	 * @param array<int, array<string, mixed>> $deductible
	 * @param array<int, array<string, mixed>> $non_deductible
	 */
	private static function collect_line_items( WC_Order $order, array &$deductible, array &$non_deductible ): void {
		foreach ( $order->get_items( 'line_item' ) as $item ) {
			if ( ! $item instanceof WC_Order_Item_Product ) {
				continue;
			}

			$amount = (float) $item->get_total();
			if ( $amount <= 0 ) {
				continue;
			}

			$row = [
				'date'        => $order->get_date_created()->date( 'Y-m-d' ),
				'order_id'    => $order->get_order_number(),
				'description' => $item->get_name(),
				'amount'      => $amount,
			];

			if ( self::is_product_deductible( $item->get_product_id() ) ) {
				$deductible[] = $row;
			} else {
				$non_deductible[] = $row;
			}
		}
	}

	/**
	 * @param array<int, array<string, mixed>> $deductible
	 * @param array<int, array<string, mixed>> $non_deductible
	 */
	private static function collect_fees( WC_Order $order, array &$deductible, array &$non_deductible ): void {
		foreach ( $order->get_fees() as $fee ) {
			if ( ! $fee instanceof WC_Order_Item_Fee ) {
				continue;
			}

			$amount = (float) $fee->get_total();
			if ( $amount <= 0 ) {
				continue;
			}

			$row = [
				'date'        => $order->get_date_created()->date( 'Y-m-d' ),
				'order_id'    => $order->get_order_number(),
				'description' => $fee->get_name(),
				'amount'      => $amount,
			];

			if ( self::is_fee_deductible( $fee ) ) {
				$deductible[] = $row;
			} else {
				$non_deductible[] = $row;
			}
		}
	}

	/**
	 * Product deductibility check. Filterable. Memoized per request.
	 */
	public static function is_product_deductible( int $product_id ): bool {
		if ( $product_id <= 0 ) {
			return false;
		}

		if ( isset( self::$deductible_cache[ $product_id ] ) ) {
			return self::$deductible_cache[ $product_id ];
		}

		$product = wc_get_product( $product_id );
		if ( ! $product ) {
			return self::$deductible_cache[ $product_id ] = false;
		}

		$override = (string) $product->get_meta( '_tbc_don_deductible' );
		if ( 'yes' === $override || 'no' === $override ) {
			$result = 'yes' === $override;
			return self::$deductible_cache[ $product_id ] = (bool) apply_filters( 'tbc_don_is_product_deductible', $result, $product_id, 'override' );
		}

		$category = (string) get_option( 'tbc_don_deductible_category', 'donation' );
		$slugs    = wp_get_post_terms( $product_id, 'product_cat', [ 'fields' => 'slugs' ] );
		$by_cat   = ! is_wp_error( $slugs ) && in_array( $category, (array) $slugs, true );

		return self::$deductible_cache[ $product_id ] = (bool) apply_filters( 'tbc_don_is_product_deductible', $by_cat, $product_id, 'category' );
	}

	/**
	 * Fee deductibility check. "Give Extra" fees are always deductible.
	 * Modern orders carry `_tbc_don_fee_type = give_extra` meta; historical orders
	 * are matched by the "Extra Donation" fee name for backwards compatibility.
	 */
	private static function is_fee_deductible( WC_Order_Item_Fee $fee ): bool {
		if ( 'give_extra' === (string) $fee->get_meta( DonationFeatures::FEE_TYPE_META_KEY ) ) {
			return true;
		}

		// Historical fallback — match the label used by DonationFeatures::apply_extra_donation()
		// for orders created before the fee-tagging meta existed.
		if ( 'Extra Donation' === $fee->get_name() ) {
			return true;
		}

		return (bool) apply_filters( 'tbc_don_is_fee_deductible', false, $fee );
	}
}
