<?php
/**
 * Donation Price Input Template
 *
 * Override by copying to yourtheme/woocommerce/price-input.php
 *
 * @package TBC\WooDonations\Templates
 * @version 1.0.1
 */

declare(strict_types=1);

use TBC\WooDonations\Helpers;

defined( 'ABSPATH' ) || exit;

// Build data attributes string.
$data_attrs = Helpers::get_data_attributes( $product, $suffix );
$data_html  = '';
foreach ( $data_attrs as $key => $val ) {
	$data_html .= sprintf( ' %s="%s"', esc_attr( $key ), esc_attr( $val ) );
}

// Check if suggested amounts are enabled — if so, we hide the manual input by default.
$has_suggested = Helpers::has_suggested_amounts( $product );
$container_class = 'tbc-don' . ( $has_suggested ? ' has-suggested-amounts' : '' );
?>
<div class="<?php echo esc_attr( $container_class ); ?>"<?php echo $data_html; // phpcs:ignore WordPress.Security.EscapeOutput ?>>

	<?php do_action( 'tbc_don_before_price_input', $product, $suffix ); ?>

	<div class="tbc-don-input-wrap">
		<?php do_action( 'tbc_don_before_price_label', $product, $suffix ); ?>

		<label for="<?php echo esc_attr( $input_id ); ?>"><?php echo wp_kses_post( $input_label ); ?></label>

		<?php do_action( 'tbc_don_after_price_label', $product, $suffix ); ?>

		<input
			type="<?php echo esc_attr( $input_type ); ?>"
			id="<?php echo esc_attr( $input_id ); ?>"
			class="<?php echo esc_attr( implode( ' ', (array) $classes ) ); ?>"
			name="<?php echo esc_attr( $input_name ); ?>"
			value="<?php echo esc_attr( $input_value ); ?>"
			title="<?php echo esc_attr( wp_strip_all_tags( $input_label ) ); ?>"
			placeholder="<?php echo esc_attr( $placeholder ); ?>"
			<?php
			if ( ! empty( $custom_attributes ) && is_array( $custom_attributes ) ) {
				foreach ( $custom_attributes as $key => $value ) {
					printf( ' %s="%s"', esc_attr( $key ), esc_attr( $value ) );
				}
			}
			?>
		/>
	</div>

	<input type="hidden" name="update-price" value="<?php echo esc_attr( $updating_cart_key ); ?>" />
	<input type="hidden" name="_tbc_don_nonce" value="<?php echo esc_attr( $_tbc_don_nonce ); ?>" />

	<?php do_action( 'tbc_don_after_price_input', $product, $suffix ); ?>

</div>
