<?php
/**
 * WooCommerce Subscriptions compatibility — handles subscription-specific
 * donation behavior, including the customer-facing "Edit donation amount"
 * feature on the My Account → View Subscription page.
 *
 * @package TBC\WooDonations\Compat
 */

declare(strict_types=1);

namespace TBC\WooDonations\Compat;

use TBC\WooDonations\Frontend\DonationFeatures;
use TBC\WooDonations\Helpers;
use Exception;
use WC_Order_Item_Fee;
use WC_Order_Item_Product;
use WC_Product;
use WC_Subscription;

defined( 'ABSPATH' ) || exit;

final class Subscriptions {

	/**
	 * Editable subscription statuses. Donors can change the amount on
	 * active or on-hold subs; cancelled / expired / pending-cancel are off-limits.
	 *
	 * @var string[]
	 */
	private const EDITABLE_STATUSES = [ 'active', 'on-hold' ];

	/**
	 * Form field + nonce action key.
	 */
	private const NONCE_ACTION = 'tbc_don_edit_subscription';
	private const NONCE_FIELD  = '_tbc_don_edit_sub_nonce';

	public static function init(): void {

		// When a subscription product is saved, set its price to 0 if it's a donation.
		add_action( 'woocommerce_admin_process_product_object', [ __CLASS__, 'set_subscription_price' ], 30 );

		// Ensure subscription price is set from donation price in cart.
		add_filter( 'woocommerce_subscriptions_product_price', [ __CLASS__, 'filter_subscription_price' ], 10, 2 );

		// Customer-facing edit on the My Account → View Subscription page.
		// Priority 5 so we render BEFORE WCS's own Related Orders table (which
		// hooks the same action at default priority 10). This lands the form
		// directly under "Subscription totals".
		add_action( 'template_redirect', [ __CLASS__, 'maybe_handle_edit_submission' ] );
		add_action( 'woocommerce_subscription_details_after_subscription_table', [ __CLASS__, 'maybe_render_edit_form' ], 5 );
	}

	// =========================================================================
	// PRICING WIRING (existing behavior)
	// =========================================================================

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

	// =========================================================================
	// CUSTOMER-FACING EDIT FORM
	// =========================================================================

	/**
	 * Render an inline "Change donation amount" form on the View Subscription page.
	 * Only shown when the donor owns an editable donation subscription with a
	 * single donation line item.
	 */
	public static function maybe_render_edit_form( WC_Subscription $subscription ): void {

		$line_item = self::get_editable_donation_line_item( $subscription );
		if ( ! $line_item ) {
			return;
		}

		$product = $line_item->get_product();
		if ( ! $product instanceof WC_Product ) {
			return;
		}

		$current  = (float) $line_item->get_subtotal() / max( 1, $line_item->get_quantity() );
		$minimum  = Helpers::get_minimum_price( $product );
		$maximum  = Helpers::get_maximum_price( $product );
		$hidden   = Helpers::is_minimum_hidden( $product );
		$currency = get_woocommerce_currency_symbol();

		?>
		<section class="tbc-don-edit-sub" aria-labelledby="tbc-don-edit-sub-heading">
			<h2 id="tbc-don-edit-sub-heading"><?php esc_html_e( 'Change donation amount', 'tbc-woo-donations' ); ?></h2>
			<form method="post" class="tbc-don-edit-sub-form">
				<?php wp_nonce_field( self::NONCE_ACTION, self::NONCE_FIELD ); ?>
				<input type="hidden" name="tbc_don_subscription_id" value="<?php echo esc_attr( (string) $subscription->get_id() ); ?>">

				<table class="shop_table order_details tbc-don-edit-sub-table">
					<tbody>
						<tr>
							<td colspan="2" class="tbc-don-edit-sub-description">
								<?php esc_html_e( 'Update the recurring amount for this donation. The change applies to your next renewal — you will not be charged today.', 'tbc-woo-donations' ); ?>
							</td>
						</tr>
						<tr>
							<th scope="row">
								<label for="tbc_don_new_amount"><?php esc_html_e( 'New amount', 'tbc-woo-donations' ); ?></label>
							</th>
							<td>
								<span class="tbc-don-edit-sub-input-wrap">
									<span class="tbc-don-edit-sub-symbol" aria-hidden="true"><?php echo esc_html( $currency ); ?></span>
									<input
										type="number"
										step="0.01"
										<?php if ( $minimum > 0 && ! $hidden ) : ?>min="<?php echo esc_attr( wc_format_decimal( $minimum ) ); ?>"<?php endif; ?>
										<?php if ( $maximum > 0 ) : ?>max="<?php echo esc_attr( wc_format_decimal( $maximum ) ); ?>"<?php endif; ?>
										inputmode="decimal"
										required
										id="tbc_don_new_amount"
										name="tbc_don_new_amount"
										value="<?php echo esc_attr( wc_format_decimal( $current, wc_get_price_decimals() ) ); ?>"
									>
								</span>
								<?php if ( $minimum > 0 && ! $hidden ) : ?>
									<span class="tbc-don-edit-sub-hint">
										<?php
										printf(
											/* translators: %s minimum price */
											esc_html__( 'Minimum: %s', 'tbc-woo-donations' ),
											wp_kses_post( wc_price( $minimum ) )
										);
										?>
									</span>
								<?php endif; ?>
							</td>
						</tr>
						<tr>
							<td colspan="2" class="tbc-don-edit-sub-actions">
								<button type="submit" class="button tbc-don-edit-sub-submit">
									<?php esc_html_e( 'Update donation amount', 'tbc-woo-donations' ); ?>
								</button>
							</td>
						</tr>
					</tbody>
				</table>
			</form>
		</section>
		<?php
	}

	/**
	 * Catch the form submission, validate, and update the subscription's
	 * line-item subtotal. Recalculates the fee-recovery line item if present
	 * so the next renewal charges 3.5% of the new amount, not the old one.
	 */
	public static function maybe_handle_edit_submission(): void {

		if ( empty( $_POST[ self::NONCE_FIELD ] ) ) {
			return;
		}

		if ( ! wp_verify_nonce( sanitize_key( wp_unslash( $_POST[ self::NONCE_FIELD ] ) ), self::NONCE_ACTION ) ) {
			wc_add_notice( __( 'Security check failed. Please try again.', 'tbc-woo-donations' ), 'error' );
			return;
		}

		if ( ! is_user_logged_in() ) {
			wc_add_notice( __( 'You must be logged in to update a subscription.', 'tbc-woo-donations' ), 'error' );
			return;
		}

		$subscription_id = isset( $_POST['tbc_don_subscription_id'] ) ? absint( $_POST['tbc_don_subscription_id'] ) : 0;
		$subscription    = $subscription_id ? wcs_get_subscription( $subscription_id ) : null;

		if ( ! $subscription instanceof WC_Subscription ) {
			wc_add_notice( __( 'Subscription not found.', 'tbc-woo-donations' ), 'error' );
			return;
		}

		// Ownership check — donors can only edit their own subscriptions.
		if ( ! current_user_can( 'edit_shop_subscription_line_items', $subscription->get_id() ) ) {
			wc_add_notice( __( 'You do not have permission to update this subscription.', 'tbc-woo-donations' ), 'error' );
			return;
		}

		if ( ! in_array( $subscription->get_status(), self::EDITABLE_STATUSES, true ) ) {
			wc_add_notice( __( 'This subscription is not currently editable.', 'tbc-woo-donations' ), 'error' );
			return;
		}

		$line_item = self::get_editable_donation_line_item( $subscription );
		if ( ! $line_item ) {
			wc_add_notice( __( 'This subscription cannot be edited from your account.', 'tbc-woo-donations' ), 'error' );
			return;
		}

		$product = $line_item->get_product();
		if ( ! $product instanceof WC_Product ) {
			wc_add_notice( __( 'Donation product not found.', 'tbc-woo-donations' ), 'error' );
			return;
		}

		$raw_amount = isset( $_POST['tbc_don_new_amount'] ) ? sanitize_text_field( wp_unslash( $_POST['tbc_don_new_amount'] ) ) : '';
		$new_amount = (float) Helpers::standardize_number( $raw_amount );

		// Reuse the shared validator so min/max/positive rules stay in sync
		// with cart-time validation.
		try {
			Helpers::validate_price( $product, $new_amount );
		} catch ( Exception $e ) {
			if ( $e->getMessage() ) {
				wc_add_notice( $e->getMessage(), 'error' );
			}
			return;
		}

		$old_amount = (float) $line_item->get_subtotal() / max( 1, $line_item->get_quantity() );

		if ( wc_format_decimal( $new_amount, 2 ) === wc_format_decimal( $old_amount, 2 ) ) {
			wc_add_notice( __( 'The new amount is the same as your current donation.', 'tbc-woo-donations' ), 'notice' );
			wp_safe_redirect( $subscription->get_view_order_url() );
			exit;
		}

		// Update donation line item.
		$qty = max( 1, $line_item->get_quantity() );
		$line_item->set_subtotal( $new_amount * $qty );
		$line_item->set_total( $new_amount * $qty );
		$line_item->save();

		// Recalculate fee-recovery line item if the donor opted to cover the fee.
		self::recalculate_fee_recovery( $subscription, $new_amount );

		// Recalculate totals (covers tax, fee adjustments) and persist.
		$subscription->calculate_totals();
		$subscription->save();

		$subscription->add_order_note(
			sprintf(
				/* translators: 1: previous amount, 2: new amount */
				__( 'Donation amount changed from %1$s to %2$s by donor.', 'tbc-woo-donations' ),
				wp_strip_all_tags( wc_price( $old_amount ) ),
				wp_strip_all_tags( wc_price( $new_amount ) )
			)
		);

		wc_add_notice(
			sprintf(
				/* translators: %s new recurring amount */
				__( 'Your donation amount has been updated. Your next renewal will be %s.', 'tbc-woo-donations' ),
				wp_strip_all_tags( wc_price( $subscription->get_total() ) )
			),
			'success'
		);

		wp_safe_redirect( $subscription->get_view_order_url() );
		exit;
	}

	// =========================================================================
	// INTERNAL HELPERS
	// =========================================================================

	/**
	 * Resolve the single editable donation line item on a subscription.
	 *
	 * Returns null if:
	 *  - Current user is not the subscription owner.
	 *  - Subscription is not in an editable status.
	 *  - Subscription has zero or multiple line items.
	 *  - The line item is not a donation product.
	 */
	private static function get_editable_donation_line_item( WC_Subscription $subscription ): ?WC_Order_Item_Product {

		if ( ! current_user_can( 'edit_shop_subscription_line_items', $subscription->get_id() ) ) {
			return null;
		}

		if ( ! in_array( $subscription->get_status(), self::EDITABLE_STATUSES, true ) ) {
			return null;
		}

		$items = $subscription->get_items( 'line_item' );
		if ( count( $items ) !== 1 ) {
			return null;
		}

		/** @var WC_Order_Item_Product $line_item */
		$line_item = reset( $items );
		$product   = $line_item->get_product();

		if ( ! $product instanceof WC_Product || ! Helpers::is_donation( $product ) ) {
			return null;
		}

		return $line_item;
	}

	/**
	 * If the donor opted to cover processing fees at cart time, update the
	 * subscription's fee-recovery line item to match the new donation total.
	 * Without this, the next renewal would charge the new donation but the
	 * fee from the original amount.
	 *
	 * Matches by the stable `_tbc_don_fee_type = fee_recovery` meta tag set
	 * via DonationFeatures::tag_donation_fee_item(). Falls back to the
	 * legacy English fee name for subscriptions created before that tag
	 * existed — those won't have the meta yet.
	 */
	private static function recalculate_fee_recovery( WC_Subscription $subscription, float $new_amount ): void {

		foreach ( $subscription->get_items( 'fee' ) as $fee_item ) {
			if ( ! $fee_item instanceof WC_Order_Item_Fee ) {
				continue;
			}

			$is_match = 'fee_recovery' === $fee_item->get_meta( DonationFeatures::FEE_TYPE_META_KEY )
				|| 'Donation Fee (3.5%)' === $fee_item->get_name();

			if ( ! $is_match ) {
				continue;
			}

			$fee_item->set_total( wc_format_decimal( $new_amount * Helpers::FEE_RECOVERY_RATE, wc_get_price_decimals() ) );
			$fee_item->set_total_tax( 0 );
			$fee_item->save();
			break;
		}
	}
}
