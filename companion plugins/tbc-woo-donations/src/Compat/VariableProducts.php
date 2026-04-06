<?php
/**
 * Variable products compatibility — handles donation variations within variable products.
 *
 * @package TBC\WooDonations\Compat
 */

declare(strict_types=1);

namespace TBC\WooDonations\Compat;

use TBC\WooDonations\Helpers;
use WC_Product;

defined( 'ABSPATH' ) || exit;

final class VariableProducts {

	public static function init(): void {
		// Variation options — add "Donation" checkbox in variation admin.
		add_action( 'woocommerce_variation_options', [ __CLASS__, 'variation_options' ], 10, 3 );

		// Save variation meta.
		add_action( 'woocommerce_admin_process_variation_object', [ __CLASS__, 'save_variation' ], 20, 2 );

		// After all variations saved, update parent _tbc_don_has_variations.
		add_action( 'woocommerce_update_product', [ __CLASS__, 'update_parent_meta' ] );
	}

	/**
	 * Show "Donation" checkbox in variation options.
	 */
	public static function variation_options( int $loop, array $variation_data, \WP_Post $variation ): void {
		$variation_product = wc_get_product( $variation->ID );
		if ( ! $variation_product ) {
			return;
		}

		$checked = Helpers::is_donation( $variation_product ) ? 'yes' : '';
		?>
		<label class="tips" data-tip="<?php esc_attr_e( 'Enable donation pricing for this variation.', 'tbc-woo-donations' ); ?>">
			<input type="checkbox" class="checkbox tbc_don_variation_enabled" name="tbc_don_variation_enabled[<?php echo esc_attr( (string) $loop ); ?>]" <?php checked( $checked, 'yes' ); ?> />
			<?php esc_html_e( 'Donation', 'tbc-woo-donations' ); ?>
		</label>
		<?php
	}

	/**
	 * Save variation donation meta.
	 */
	public static function save_variation( \WC_Product_Variation $variation, int $loop ): void {
		// phpcs:disable WordPress.Security.NonceVerification
		$enabled = isset( $_POST['tbc_don_variation_enabled'][ $loop ] ) ? 'yes' : 'no';
		$variation->update_meta_data( '_tbc_don_enabled', $enabled );

		// Pricing fields for variations.
		$fields = [ '_tbc_don_suggested_price', '_tbc_don_min_price', '_tbc_don_max_price' ];
		foreach ( $fields as $field ) {
			$key = $field . '_variation';
			if ( isset( $_POST[ $key ][ $loop ] ) ) {
				$variation->update_meta_data( $field, wc_format_decimal( wc_clean( wp_unslash( $_POST[ $key ][ $loop ] ) ) ) );
			}
		}
		// phpcs:enable
	}

	/**
	 * Update the parent product's _tbc_don_has_variations flag.
	 */
	public static function update_parent_meta( int $product_id ): void {
		$product = wc_get_product( $product_id );
		if ( ! $product || ! $product->is_type( Helpers::get_variable_types() ) ) {
			return;
		}

		$has_donation = false;
		foreach ( $product->get_children() as $child_id ) {
			$child = wc_get_product( $child_id );
			if ( $child && Helpers::is_donation( $child ) ) {
				$has_donation = true;
				break;
			}
		}

		$product->update_meta_data( '_tbc_don_has_variations', $has_donation ? 'yes' : 'no' );
		$product->save_meta_data();
	}
}
