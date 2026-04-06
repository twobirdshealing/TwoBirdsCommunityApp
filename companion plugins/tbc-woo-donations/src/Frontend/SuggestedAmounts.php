<?php
/**
 * Suggested Amounts — Frontend rendering of suggested amount radio buttons.
 *
 * Displays a grid of styled amount buttons that populate the donation price input.
 * Supports custom "enter amount" button, gradient colors, per-button font sizing.
 *
 * @package TBC\WooDonations\Frontend
 */

declare(strict_types=1);

namespace TBC\WooDonations\Frontend;

use TBC\WooDonations\Helpers;
use TBC\WooDonations\Plugin;
use WC_Product;

defined( 'ABSPATH' ) || exit;

final class SuggestedAmounts {

	private static ?self $instance = null;

	public static function instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'tbc_don_after_price_input', [ $this, 'display' ], 5, 2 );
		add_filter( 'tbc_don_get_posted_price', [ $this, 'posted_price' ], 10, 3 );
	}

	/**
	 * Render suggested amount buttons on the product page.
	 */
	public function display( WC_Product $product, string $suffix = '' ): void {

		if ( ! Helpers::has_suggested_amounts( $product ) ) {
			return;
		}

		$amounts = Helpers::get_suggested_amounts( $product );

		if ( empty( $amounts ) ) {
			return;
		}

		// Find default.
		$default = null;
		foreach ( $amounts as $amount ) {
			if ( ( $amount['default'] ?? '' ) === 'yes' ) {
				$default = $amount['amount'];
				break;
			}
		}
		$default ??= $amounts[0]['amount'] ?? null;
		$default = apply_filters( 'tbc_don_suggested_amounts_default', $default, $product );

		echo '<fieldset class="tbc-don-suggested-amounts">';

		foreach ( $amounts as $i => $amount ) {
			if ( isset( $amount['type'] ) && 'custom_button' === $amount['type'] ) {
				if ( ! empty( $amount['enabled'] ) ) {
					$this->render_custom_button( $amount, $suffix, $default );
				}
			} else {
				$this->render_amount_button( $amount, $i, $suffix, $default );
			}
		}

		echo '</fieldset>';
	}

	/**
	 * Render a single suggested amount button.
	 *
	 * @param array<string, mixed> $data
	 */
	private function render_amount_button( array $data, int $index, string $suffix, mixed $default ): void {
		$amount = $data['amount'];
		$label  = $data['label'] ?? '';
		$id     = 'tbc-don-suggested' . esc_attr( $suffix ) . '-' . $index;

		if ( $label ) {
			$content = '<span class="amount-text">' . esc_html( $label ) . '</span>';
		} else {
			$content = '<span class="amount-text">' . wp_kses_post( wc_price( $amount ) ) . '</span>';
		}

		printf(
			'<div class="tbc-don-suggested-amount">
				<input aria-hidden="true" type="radio" id="%s" name="tbc_don_suggested%s" value="%s" %s />
				<label class="tbc-don-btn" for="%s">%s</label>
			</div>',
			esc_attr( $id ),
			esc_attr( $suffix ),
			esc_attr( (string) $amount ),
			checked( $default, $amount, false ),
			esc_attr( $id ),
			$content
		);
	}

	/**
	 * Render the "Custom Amount" button.
	 *
	 * @param array<string, mixed> $data
	 */
	private function render_custom_button( array $data, string $suffix, mixed $default ): void {
		$label = ( $data['label'] ?? '' ) ?: __( 'Custom Amount', 'tbc-woo-donations' );
		$id    = 'tbc-don-suggested' . esc_attr( $suffix ) . '-custom';

		printf(
			'<div class="tbc-don-suggested-amount">
				<input aria-hidden="true" type="radio" id="%s" name="tbc_don_suggested%s" value="custom" %s />
				<label class="tbc-don-btn" for="%s"><span class="amount-text">%s</span></label>
			</div>',
			esc_attr( $id ),
			esc_attr( $suffix ),
			checked( $default, 'custom', false ),
			esc_attr( $id ),
			esc_html( $label )
		);
	}

	/**
	 * Use suggested amount as the posted price if one was selected.
	 */
	public function posted_price( string $posted_price, int $product_id, string $suffix ): string {
		// phpcs:disable WordPress.Security.NonceVerification
		$field = 'tbc_don_suggested' . $suffix;
		if ( isset( $_REQUEST[ $field ] ) && 'custom' !== $_REQUEST[ $field ] ) {
			$posted_price = Helpers::standardize_number( sanitize_text_field( wp_unslash( $_REQUEST[ $field ] ) ) );
		}
		// phpcs:enable
		return $posted_price;
	}
}
