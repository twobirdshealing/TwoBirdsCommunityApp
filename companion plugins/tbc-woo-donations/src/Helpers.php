<?php
/**
 * Static helper methods for donation product data access.
 *
 * All product meta access uses WC CRUD ($product->get_meta()) — never get_post_meta().
 *
 * @package TBC\WooDonations
 */

declare(strict_types=1);

namespace TBC\WooDonations;

use WC_Product;

defined( 'ABSPATH' ) || exit;

final class Helpers {

	/**
	 * Product types that can be individual donation products.
	 *
	 * @var string[]
	 */
	private const SIMPLE_TYPES = [
		'simple',
		'subscription',
		'variation',
		'subscription_variation',
	];

	/**
	 * Product types that can have donation variations.
	 *
	 * @var string[]
	 */
	private const VARIABLE_TYPES = [
		'variable',
		'variable-subscription',
	];

	// -------------------------------------------------------------------------
	// Instance counter for unique IDs in forms.
	// -------------------------------------------------------------------------

	private static int $counter = 0;

	public static function get_counter(): int {
		return ++self::$counter;
	}

	// -------------------------------------------------------------------------
	// Type checks.
	// -------------------------------------------------------------------------

	/**
	 * @return string[]
	 */
	public static function get_simple_types(): array {
		return apply_filters( 'tbc_don_simple_supported_types', self::SIMPLE_TYPES );
	}

	/**
	 * @return string[]
	 */
	public static function get_variable_types(): array {
		return apply_filters( 'tbc_don_variable_supported_types', self::VARIABLE_TYPES );
	}

	/** @var array<int, bool> */
	private static array $donation_cache = [];

	/** @var array<int, bool> */
	private static array $has_variations_cache = [];

	/**
	 * Check if a product/variation is a donation product. Results cached per request.
	 */
	public static function is_donation( WC_Product|int $product ): bool {
		$product = self::ensure_product( $product );

		if ( ! $product ) {
			return false;
		}

		$id = $product->get_id();
		if ( isset( self::$donation_cache[ $id ] ) ) {
			return self::$donation_cache[ $id ];
		}

		$is_donation = $product->is_type( self::get_simple_types() )
			&& wc_string_to_bool( (string) $product->get_meta( '_tbc_don_enabled' ) );

		$result = (bool) apply_filters( 'tbc_don_is_donation', $is_donation, $id );
		self::$donation_cache[ $id ] = $result;
		return $result;
	}

	/**
	 * Check if a variable product has donation variations. Results cached per request.
	 */
	public static function has_donation_variations( WC_Product|int $product ): bool {
		$product = self::ensure_product( $product );

		if ( ! $product ) {
			return false;
		}

		$id = $product->get_id();
		if ( isset( self::$has_variations_cache[ $id ] ) ) {
			return self::$has_variations_cache[ $id ];
		}

		$result = $product->is_type( self::get_variable_types() )
			&& wc_string_to_bool( (string) $product->get_meta( '_tbc_don_has_variations' ) );

		self::$has_variations_cache[ $id ] = $result;
		return $result;
	}

	// -------------------------------------------------------------------------
	// Price accessors.
	// -------------------------------------------------------------------------

	public static function get_suggested_price( WC_Product $product ): float {
		$raw = (float) apply_filters(
			'tbc_don_raw_suggested_price',
			$product->get_meta( '_tbc_don_suggested_price', true, 'edit' ),
			$product->get_id()
		);
		return max( 0.0, $raw );
	}

	public static function get_minimum_price( WC_Product $product ): float {
		$raw = (float) apply_filters(
			'tbc_don_raw_minimum_price',
			$product->get_meta( '_tbc_don_min_price', true, 'edit' ),
			$product->get_id()
		);
		return max( 0.0, $raw );
	}

	public static function get_maximum_price( WC_Product $product ): float {
		$raw = (float) apply_filters(
			'tbc_don_raw_maximum_price',
			$product->get_meta( '_tbc_don_max_price', true, 'edit' ),
			$product->get_id()
		);
		return max( 0.0, $raw );
	}

	public static function is_minimum_hidden( WC_Product $product ): bool {
		return wc_string_to_bool( (string) $product->get_meta( '_tbc_don_hide_minimum' ) );
	}

	// -------------------------------------------------------------------------
	// Subscription helpers.
	// -------------------------------------------------------------------------

	public static function is_subscription( WC_Product $product ): bool {
		return $product->is_type( [ 'subscription', 'subscription_variation', 'variable-subscription' ] );
	}

	// -------------------------------------------------------------------------
	// Formatting helpers.
	// -------------------------------------------------------------------------

	/**
	 * Standardize a number from locale format to machine format.
	 *
	 * Strips thousand separators and normalizes decimal separator to '.'.
	 */
	public static function standardize_number( string|float|int $value ): string {
		$value = (string) $value;

		$decimal   = wc_get_price_decimal_separator();
		$thousand  = wc_get_price_thousand_separator();

		// Remove thousand separators.
		if ( $thousand ) {
			$value = str_replace( $thousand, '', $value );
		}

		// Normalize decimal separator.
		if ( $decimal && $decimal !== '.' ) {
			$value = str_replace( $decimal, '.', $value );
		}

		// Remove everything except digits, dots, and minus.
		return preg_replace( '/[^0-9.\-]/', '', $value ) ?: '0';
	}

	/**
	 * Format a price as a plain number string for input fields (no HTML, no currency symbol).
	 * e.g., 10.00 — respects WC decimal settings.
	 */
	public static function format_price_value( float $price ): string {
		if ( $price <= 0 ) {
			return '';
		}
		return number_format( $price, wc_get_price_decimals(), wc_get_price_decimal_separator(), wc_get_price_thousand_separator() );
	}

	// -------------------------------------------------------------------------
	// Price display strings.
	// -------------------------------------------------------------------------

	/**
	 * Get the price input label text.
	 */
	public static function get_label_text( WC_Product $product ): string {
		$label = get_option( 'tbc_don_label_text', '' );

		if ( ! $label ) {
			$label = __( 'My Donation', 'tbc-woo-donations' );
		}

		return (string) apply_filters( 'tbc_don_price_input_label_text', $label, $product );
	}

	/**
	 * Get minimum price display HTML.
	 */
	public static function get_minimum_price_html( WC_Product $product ): string {

		$minimum = self::get_minimum_price( $product );

		if ( $minimum <= 0 || self::is_minimum_hidden( $product ) ) {
			return '';
		}

		$text = get_option( 'tbc_don_minimum_text', '' );
		if ( ! $text ) {
			/* translators: %PRICE% = formatted minimum price */
			$text = __( 'Minimum price: %PRICE%', 'tbc-woo-donations' );
		}

		$html = '<span class="tbc-don-minimum-price">'
			. str_replace( '%PRICE%', wc_price( $minimum ), $text )
			. '</span>';

		return (string) apply_filters( 'tbc_don_minimum_price_html', $html, $product );
	}

	/**
	 * Get suggested price display HTML.
	 */
	public static function get_suggested_price_html( WC_Product $product ): string {

		$suggested = self::get_suggested_price( $product );

		if ( $suggested <= 0 ) {
			return '';
		}

		$text = get_option( 'tbc_don_suggested_text', '' );
		if ( ! $text ) {
			/* translators: %PRICE% = formatted suggested price */
			$text = __( 'Suggested price: %PRICE%', 'tbc-woo-donations' );
		}

		$html = '<span class="tbc-don-suggested-price">'
			. str_replace( '%PRICE%', wc_price( $suggested ), $text )
			. '</span>';

		return (string) apply_filters( 'tbc_don_suggested_price_html', $html, $product );
	}

	// -------------------------------------------------------------------------
	// Data attributes for the price input.
	// -------------------------------------------------------------------------

	/**
	 * Build data-* attributes for the price input element.
	 *
	 * @return array<string, string>
	 */
	public static function get_data_attributes( WC_Product $product, string $suffix = '' ): array {

		$minimum = self::get_minimum_price( $product );
		$maximum = self::get_maximum_price( $product );

		$attributes = [
			'data-min'  => wc_format_decimal( $minimum ),
			'data-max'  => wc_format_decimal( $maximum ),
		];

		if ( $minimum > 0 && ! self::is_minimum_hidden( $product ) ) {
			$attributes['data-hide-minimum'] = 'no';
		}

		return (array) apply_filters( 'tbc_don_data_attributes', $attributes, $product, $suffix );
	}

	// -------------------------------------------------------------------------
	// Donation addon meta helpers.
	// Donation features are always stored on the PARENT product,
	// so for variations we resolve to the parent before reading meta.
	// -------------------------------------------------------------------------

	/**
	 * Get the parent product for feature meta lookups.
	 * For variations, returns the parent. For everything else, returns the product itself.
	 */
	/** @var array<int, WC_Product> */
	private static array $feature_product_cache = [];

	private static function get_feature_product( WC_Product $product ): WC_Product {
		$id = $product->get_id();
		if ( isset( self::$feature_product_cache[ $id ] ) ) {
			return self::$feature_product_cache[ $id ];
		}

		if ( $product->is_type( [ 'variation', 'subscription_variation' ] ) ) {
			$parent   = wc_get_product( $product->get_parent_id() );
			$resolved = $parent instanceof WC_Product ? $parent : $product;
		} else {
			$resolved = $product;
		}

		self::$feature_product_cache[ $id ] = $resolved;
		return $resolved;
	}

	public static function is_deposit_enabled( WC_Product $product ): bool {
		return wc_string_to_bool( (string) self::get_feature_product( $product )->get_meta( '_tbc_don_deposit_enabled' ) );
	}

	public static function get_deposit_amount( WC_Product $product ): float {
		return (float) self::get_feature_product( $product )->get_meta( '_tbc_don_deposit_amount' );
	}

	public static function get_cancellation_policy( WC_Product $product ): string {
		return (string) self::get_feature_product( $product )->get_meta( '_tbc_don_cancellation_policy' );
	}

	public static function is_fee_recovery_enabled( WC_Product $product ): bool {
		return wc_string_to_bool( (string) self::get_feature_product( $product )->get_meta( '_tbc_don_fee_recovery' ) );
	}

	public static function is_give_extra_enabled( WC_Product $product ): bool {
		return wc_string_to_bool( (string) self::get_feature_product( $product )->get_meta( '_tbc_don_give_extra' ) );
	}

	public static function is_donor_wall_enabled( WC_Product $product ): bool {
		return wc_string_to_bool( (string) self::get_feature_product( $product )->get_meta( '_tbc_don_donor_wall' ) );
	}

	public static function is_one_time_enabled( WC_Product $product ): bool {
		return wc_string_to_bool( (string) self::get_feature_product( $product )->get_meta( '_tbc_don_one_time_enabled' ) );
	}

	public static function is_single_price_rsvp( WC_Product $product ): bool {
		return wc_string_to_bool( (string) self::get_feature_product( $product )->get_meta( '_tbc_don_single_price_rsvp' ) );
	}

	// -------------------------------------------------------------------------
	// Suggested amounts.
	// -------------------------------------------------------------------------

	public static function has_suggested_amounts( WC_Product $product ): bool {
		return wc_string_to_bool( (string) $product->get_meta( '_tbc_don_use_suggested_amounts' ) );
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public static function get_suggested_amounts( WC_Product $product ): array {
		$amounts = $product->get_meta( '_tbc_don_suggested_amounts' );
		return is_array( $amounts ) ? $amounts : [];
	}

	// -------------------------------------------------------------------------
	// Product resolution helper.
	// -------------------------------------------------------------------------

	private static function ensure_product( WC_Product|int $product ): ?WC_Product {
		if ( is_int( $product ) ) {
			$product = wc_get_product( $product );
		}
		return $product instanceof WC_Product ? $product : null;
	}

	/**
	 * Get the posted price from form data.
	 */
	public static function get_posted_price( WC_Product $product, string $suffix = '' ): string {

		$field_name = 'tbc_don_price' . $suffix;
		$posted     = '';

		// phpcs:disable WordPress.Security.NonceVerification
		if ( isset( $_REQUEST[ $field_name ] ) ) {
			$posted = sanitize_text_field( wp_unslash( $_REQUEST[ $field_name ] ) );
		}
		// phpcs:enable

		return (string) apply_filters( 'tbc_don_get_posted_price', $posted, $product->get_id(), $suffix );
	}

}
