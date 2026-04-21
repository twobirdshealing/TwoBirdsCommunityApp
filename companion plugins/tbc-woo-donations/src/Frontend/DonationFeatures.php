<?php
/**
 * Donation-specific features: deposits, fee recovery, give extra, one-time option, price suffix.
 *
 * Merged from tbc-donation-addons: non-refundable-deposit.php, woocommerce-recover-donor-fees.php,
 * give-extra-fee.php, one-time-donation.php, append-deposit-to-price.php.
 *
 * @package TBC\WooDonations\Frontend
 */

declare(strict_types=1);

namespace TBC\WooDonations\Frontend;

use TBC\WooDonations\Helpers;
use TBC\WooDonations\Plugin;
use WC_Product;

defined( 'ABSPATH' ) || exit;

final class DonationFeatures {

	private static ?self $instance = null;

	public static function instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		// When custom donations (price input) is active, show after the price input.
		add_action( 'tbc_don_after_price_input', [ $this, 'display_one_time_option' ], 10, 2 );
		add_action( 'tbc_don_after_price_input', [ $this, 'display_deposit' ], 12, 2 );
		add_action( 'tbc_don_after_price_input', [ $this, 'display_fee_recovery' ], 14, 2 );
		add_action( 'tbc_don_after_price_input', [ $this, 'display_give_extra' ], 16, 2 );

		// When custom donations is OFF, show before the add-to-cart button directly.
		add_action( 'woocommerce_before_add_to_cart_button', [ $this, 'display_standalone_features' ], 15 );

		// Register styles for standalone mode (PriceInput registers them too, but may not run).
		add_action( 'wp_enqueue_scripts', [ $this, 'register_styles' ], 20 );

		// Cart item data.
		add_filter( 'woocommerce_add_cart_item_data', [ $this, 'add_cart_item_data' ], 10, 2 );

		// Cart fees.
		add_action( 'woocommerce_cart_calculate_fees', [ $this, 'apply_deposit_fee' ], 10 );
		add_action( 'woocommerce_cart_calculate_fees', [ $this, 'apply_fee_recovery' ], 20 );
		add_action( 'woocommerce_cart_calculate_fees', [ $this, 'apply_extra_donation' ], 20 );

		// Tag the Give Extra fee on the order so the donor statement can identify it
		// reliably (not by translated fee name).
		add_action( 'woocommerce_checkout_create_order_fee_item', [ $this, 'tag_give_extra_fee_item' ], 10, 3 );

		// One-time purchase: convert subscription to simple.
		add_filter( 'woocommerce_get_cart_item_from_session', [ $this, 'adjust_one_time_price' ], 10, 1 );
		add_filter( 'woocommerce_is_subscription', [ $this, 'filter_is_subscription' ], 10, 2 );

		// Guest quantity label.
		add_action( 'woocommerce_before_add_to_cart_quantity', [ $this, 'display_guest_label' ] );

		// Single Price RSVP: charge once regardless of quantity.
		add_action( 'woocommerce_before_calculate_totals', [ $this, 'apply_single_price_rsvp' ], 20 );

		// Price display suffix: append deposit amount.
		add_filter( 'woocommerce_get_price_html', [ $this, 'append_deposit_to_price' ], 999, 2 );
	}

	// =========================================================================
	// ASSET REGISTRATION
	// =========================================================================

	public function register_styles(): void {
		if ( ! wp_style_is( 'tbc-woo-donations', 'registered' ) ) {
			wp_register_style(
				'tbc-woo-donations',
				TBC_DON_PLUGIN_URL . 'assets/css/frontend.css',
				[],
				Plugin::instance()->asset_version( TBC_DON_PLUGIN_DIR . 'assets/css/frontend.css' )
			);
		}
		if ( ! wp_script_is( 'tbc-woo-donations', 'registered' ) ) {
			wp_register_script(
				'tbc-woo-donations',
				TBC_DON_PLUGIN_URL . 'assets/js/frontend.js',
				[],
				Plugin::instance()->asset_version( TBC_DON_PLUGIN_DIR . 'assets/js/frontend.js' ),
				true
			);
		}
	}

	// =========================================================================
	// STANDALONE — for products without custom donations enabled
	// =========================================================================

	/**
	 * Display donation features directly before add-to-cart for products
	 * that have features enabled but NOT custom donations (price input).
	 */
	public function display_standalone_features(): void {
		global $product;

		if ( ! $product instanceof WC_Product ) {
			return;
		}

		// Skip if custom donations is enabled — features will show via tbc_don_after_price_input instead.
		if ( Helpers::is_donation( $product ) || wc_string_to_bool( (string) $product->get_meta( '_tbc_don_enabled' ) ) ) {
			return;
		}

		// Check if any donation feature is enabled on this product.
		$has_features = Helpers::is_deposit_enabled( $product )
			|| Helpers::is_fee_recovery_enabled( $product )
			|| Helpers::is_give_extra_enabled( $product )
			|| Helpers::is_one_time_enabled( $product );

		if ( ! $has_features ) {
			return;
		}

		// Enqueue frontend CSS (normally done by PriceInput, but that doesn't run here).
		wp_enqueue_style( 'tbc-woo-donations' );
		wp_enqueue_script( 'tbc-woo-donations' );

		// Render features inside a .tbc-don wrapper for consistent styling.
		echo '<div class="tbc-don tbc-don-standalone">';
		$this->display_one_time_option( $product );
		$this->display_deposit( $product );
		$this->display_fee_recovery( $product );
		$this->display_give_extra( $product );
		echo '</div>';
	}

	// =========================================================================
	// NON-REFUNDABLE DEPOSIT
	// =========================================================================

	public function display_deposit( mixed $product = null, string $suffix = '' ): void {
		if ( ! $product instanceof WC_Product ) {
			global $product;
		}

		if ( ! $product instanceof WC_Product || ! Helpers::is_deposit_enabled( $product ) ) {
			return;
		}

		$amount = Helpers::get_deposit_amount( $product );
		$policy = Helpers::get_cancellation_policy( $product );

		if ( $amount <= 0 ) {
			return;
		}

		?>
		<div class="tbc-don-deposit-wrapper" data-deposit-enabled="yes" data-deposit-amount="<?php echo esc_attr( (string) $amount ); ?>">
			<h4 class="tbc-don-heading"><?php esc_html_e( 'Non-refundable Deposit', 'tbc-woo-donations' ); ?></h4>
			<div class="tbc-don-deposit-container">
				<div class="tbc-don-deposit-checkbox">
					<input type="checkbox" id="tbc_don_deposit" name="tbc_don_deposit" value="yes" required />
					<label for="tbc_don_deposit">
						<?php
						printf(
							wp_kses(
								/* translators: %1$s deposit amount, %2$s cancellation policy text for data attribute */
								__( 'I understand the %1$s deposit is non-refundable and have read the <a href="#" class="tbc-don-policy-link" data-policy="%2$s">cancellation policy</a>.', 'tbc-woo-donations' ),
								[
									'a' => [ 'href' => true, 'class' => true, 'data-policy' => true ],
								]
							),
							wp_kses_post( wc_price( $amount ) ),
							esc_attr( $policy )
						);
						?>
					</label>
				</div>
			</div>
		</div>
		<?php
	}

	public function apply_deposit_fee( \WC_Cart $cart ): void {
		if ( is_admin() && ! wp_doing_ajax() ) {
			return;
		}

		$total_deposit = 0.0;

		foreach ( $cart->get_cart_contents() as $cart_item ) {
			$product = $cart_item['data'] ?? null;
			if ( ! $product instanceof WC_Product || ! Helpers::is_deposit_enabled( $product ) ) {
				continue;
			}

			$deposit = Helpers::get_deposit_amount( $product );
			if ( $deposit > 0 ) {
				$total_deposit += $deposit * $cart_item['quantity'];
			}
		}

		if ( $total_deposit > 0 ) {
			$cart->add_fee( esc_html__( 'Non-refundable Deposit', 'tbc-woo-donations' ), $total_deposit );
		}
	}

	public function append_deposit_to_price( string $price_html, WC_Product $product ): string {

		if ( ! Helpers::is_deposit_enabled( $product ) ) {
			return $price_html;
		}

		$deposit = Helpers::get_deposit_amount( $product );
		if ( $deposit <= 0 || str_contains( $price_html, 'Deposit' ) ) {
			return $price_html;
		}

		return $price_html . ' + ' . wc_price( $deposit ) . ' ' . esc_html__( 'Deposit', 'tbc-woo-donations' );
	}

	// =========================================================================
	// ONE-TIME DONATION OPTION (for subscription products)
	// =========================================================================

	public function display_one_time_option( mixed $product = null, string $suffix = '' ): void {
		if ( ! $product instanceof WC_Product ) {
			global $product;
		}

		if ( ! $product instanceof WC_Product ) {
			return;
		}

		if ( ! $product->is_type( 'subscription' ) || ! Helpers::is_one_time_enabled( $product ) ) {
			return;
		}

		?>
		<div class="tbc-don-frequency">
			<span class="tbc-don-heading"><?php esc_html_e( 'Donation Frequency', 'tbc-woo-donations' ); ?></span>
			<div class="tbc-don-frequency-options">
				<label class="tbc-don-freq-option">
					<input type="radio" name="tbc_don_purchase_option" value="one_time" checked />
					<span><?php esc_html_e( 'One-Time', 'tbc-woo-donations' ); ?></span>
					<span class="tbc-don-freq-price tbc-don-one-time-price"></span>
				</label>
				<label class="tbc-don-freq-option">
					<input type="radio" name="tbc_don_purchase_option" value="subscription" />
					<span><?php esc_html_e( 'Monthly', 'tbc-woo-donations' ); ?></span>
					<span class="tbc-don-freq-price tbc-don-recurring-price"></span>
				</label>
			</div>
		</div>
		<?php
	}

	/**
	 * @param array<string, mixed> $cart_item
	 * @return array<string, mixed>
	 */
	public function adjust_one_time_price( array $cart_item ): array {
		if ( isset( $cart_item['data'], $cart_item['tbc_don_purchase_option'] )
			&& 'one_time' === $cart_item['tbc_don_purchase_option']
			&& $cart_item['data']->is_type( 'subscription' )
		) {
			$cart_item['data']->set_price( $cart_item['data']->get_regular_price() );
		}
		return $cart_item;
	}

	public function filter_is_subscription( bool $is_subscription, int $product_id ): bool {
		if ( ( is_cart() || is_checkout() ) && WC()->cart ) {
			foreach ( WC()->cart->get_cart() as $cart_item ) {
				if ( $product_id === $cart_item['product_id']
					&& isset( $cart_item['tbc_don_purchase_option'] )
					&& 'one_time' === $cart_item['tbc_don_purchase_option']
				) {
					return false;
				}
			}
		}
		return $is_subscription;
	}

	// =========================================================================
	// FEE RECOVERY (3.5%)
	// =========================================================================

	public function display_fee_recovery( mixed $product = null, string $suffix = '' ): void {
		if ( ! $product instanceof WC_Product ) {
			global $product;
		}

		if ( ! $product instanceof WC_Product || ! Helpers::is_fee_recovery_enabled( $product ) ) {
			return;
		}

		$pct       = 0.035;
		$type      = $product->is_type( [ 'variable', 'variable-subscription' ] ) ? 'variable' : 'simple';
		$basePrice = ( 'simple' === $type ) ? (float) $product->get_price() : 0.0;

		$deposit = Helpers::is_deposit_enabled( $product ) ? Helpers::get_deposit_amount( $product ) : 0.0;

		?>
		<h4 class="tbc-don-heading"><?php esc_html_e( 'Cover Donation Fees', 'tbc-woo-donations' ); ?></h4>
		<div class="tbc-don-fee-recovery"
			data-percent="<?php echo esc_attr( (string) $pct ); ?>"
			data-deposit="<?php echo esc_attr( (string) $deposit ); ?>"
			data-base-price="<?php echo esc_attr( (string) $basePrice ); ?>"
			data-product-type="<?php echo esc_attr( $type ); ?>">
			<div class="tbc-don-fee-recovery-wrapper">
				<input type="checkbox" id="tbc_don_cover_fee" name="tbc_don_cover_fee" value="1" />
				<label for="tbc_don_cover_fee">
					<?php
					echo wp_kses_post(
						__( 'Help cover the donation fee of <span class="tbc-don-fee-amount">$0.00</span> (3.5%)', 'tbc-woo-donations' )
					);
					?>
				</label>
			</div>
		</div>
		<?php
	}

	public function apply_fee_recovery( \WC_Cart $cart ): void {
		if ( is_admin() && ! wp_doing_ajax() ) {
			return;
		}

		$pct       = 0.035;
		$total_fee = 0.0;

		foreach ( $cart->get_cart() as $cart_item ) {
			if ( empty( $cart_item['tbc_don_cover_fee'] ) ) {
				continue;
			}

			$product = $cart_item['data'] ?? null;
			if ( ! $product instanceof WC_Product ) {
				continue;
			}

			$qty     = max( 1, (int) ( $cart_item['quantity'] ?? 1 ) );
			$price   = (float) $product->get_price();
			$deposit = Helpers::is_deposit_enabled( $product ) ? Helpers::get_deposit_amount( $product ) : 0.0;

			$total_fee += ( $price + $deposit ) * $pct * $qty;
		}

		if ( $total_fee > 0 ) {
			$cart->add_fee( __( 'Donation Fee (3.5%)', 'tbc-woo-donations' ), $total_fee, false );
		}
	}

	// =========================================================================
	// GIVE EXTRA (Donate Extra)
	// =========================================================================

	public function display_give_extra( mixed $product = null, string $suffix = '' ): void {
		if ( ! $product instanceof WC_Product ) {
			global $product;
		}

		if ( ! $product instanceof WC_Product || ! Helpers::is_give_extra_enabled( $product ) ) {
			return;
		}

		$symbol = get_woocommerce_currency_symbol();
		?>
		<div class="tbc-don-give-extra">
			<label class="tbc-don-give-extra-label" for="tbc_don_give_extra_checkbox">
				<input type="checkbox" name="tbc_don_give_extra_checkbox" id="tbc_don_give_extra_checkbox" value="1" />
				<?php esc_html_e( 'Donate Extra', 'tbc-woo-donations' ); ?>
			</label>
			<span class="tbc-don-give-extra-input" style="display:none;">
				<span class="tbc-don-give-extra-symbol"><?php echo esc_html( $symbol ); ?></span>
				<input type="number" name="tbc_don_extra_amount" id="tbc_don_extra_amount" min="0" step="0.01" inputmode="decimal" placeholder="0.00" />
			</span>
		</div>
		<?php
	}

	/**
	 * Stable, non-translated id for the Give Extra fee. Used at checkout to
	 * tag the resulting order fee item so year-end donor statements can
	 * identify it regardless of the site's language.
	 */
	public const GIVE_EXTRA_FEE_ID = 'tbc_don_give_extra';

	/** Order-item meta key that tags a fee as deductible for the donor statement. */
	public const FEE_TYPE_META_KEY = '_tbc_don_fee_type';

	public function apply_extra_donation( \WC_Cart $cart ): void {
		if ( is_admin() && ! wp_doing_ajax() ) {
			return;
		}

		foreach ( $cart->get_cart() as $cart_item ) {
			if ( ! empty( $cart_item['tbc_don_extra_amount'] ) ) {
				$amount = (float) $cart_item['tbc_don_extra_amount'];
				if ( $amount > 0 ) {
					$cart->fees_api()->add_fee( [
						'id'     => self::GIVE_EXTRA_FEE_ID,
						'name'   => __( 'Extra Donation', 'tbc-woo-donations' ),
						'amount' => $amount,
					] );
					break; // Single fee line for the first matching item.
				}
			}
		}
	}

	/**
	 * Tag the Give Extra fee on the order so StatementData can identify it
	 * via meta (`_tbc_don_fee_type = give_extra`) instead of matching the
	 * translated fee name.
	 *
	 * @param \WC_Order_Item_Fee $item
	 * @param string             $fee_key
	 * @param object             $fee
	 */
	public function tag_give_extra_fee_item( $item, string $fee_key, $fee ): void {
		if ( ! $item instanceof \WC_Order_Item_Fee ) {
			return;
		}
		if ( self::GIVE_EXTRA_FEE_ID === $fee_key || ( isset( $fee->id ) && self::GIVE_EXTRA_FEE_ID === $fee->id ) ) {
			$item->add_meta_data( self::FEE_TYPE_META_KEY, 'give_extra', true );
		}
	}

	// =========================================================================
	// CART ITEM DATA (shared across features)
	// =========================================================================

	/**
	 * @param array<string, mixed> $cart_item_data
	 */
	public function add_cart_item_data( array $cart_item_data, int $product_id ): array {
		// phpcs:disable WordPress.Security.NonceVerification

		// Fee recovery.
		if ( ! empty( $_POST['tbc_don_cover_fee'] ) && '1' === $_POST['tbc_don_cover_fee'] ) {
			$cart_item_data['tbc_don_cover_fee'] = true;
		}

		// Extra donation.
		if ( ! empty( $_POST['tbc_don_give_extra_checkbox'] ) && ! empty( $_POST['tbc_don_extra_amount'] ) ) {
			$amount = (float) wc_format_decimal( sanitize_text_field( wp_unslash( $_POST['tbc_don_extra_amount'] ) ), 2 );
			if ( $amount > 0 ) {
				$cart_item_data['tbc_don_extra_amount'] = $amount;
			}
		}

		// One-time purchase option.
		if ( ! empty( $_POST['tbc_don_purchase_option'] ) ) {
			$cart_item_data['tbc_don_purchase_option'] = wc_clean( wp_unslash( $_POST['tbc_don_purchase_option'] ) );
		}

		// phpcs:enable
		return $cart_item_data;
	}

	// =========================================================================
	// GUEST QUANTITY LABEL + SINGLE PRICE RSVP
	// =========================================================================

	/**
	 * Display "Please select # of Guests — $X.XX each" above the quantity input.
	 * Only shows when product allows quantity > 1.
	 */
	public function display_guest_label(): void {
		global $product;

		if ( ! $product instanceof WC_Product || $product->is_sold_individually() ) {
			return;
		}

		// Only show on products with donation features enabled.
		$has_features = Helpers::is_donation( $product )
			|| wc_string_to_bool( (string) $product->get_meta( '_tbc_don_enabled' ) )
			|| Helpers::is_deposit_enabled( $product )
			|| Helpers::is_fee_recovery_enabled( $product )
			|| Helpers::is_single_price_rsvp( $product );

		if ( ! $has_features ) {
			return;
		}

		$is_rsvp = Helpers::is_single_price_rsvp( $product );
		?>
		<div class="tbc-don-guest-section">
			<span class="tbc-don-heading"><?php esc_html_e( 'Guests', 'tbc-woo-donations' ); ?></span>
			<div class="tbc-don-guest-card">
				<span class="tbc-don-guest-label">
					<?php esc_html_e( 'Please select # of Guests', 'tbc-woo-donations' ); ?>
					<span class="tbc-don-guest-price"></span>
				</span>
			</div>
		</div>
		<?php if ( $is_rsvp ) : ?>
			<input type="hidden" class="tbc-don-single-price-rsvp" value="1" />
		<?php endif; ?>
		<?php
	}

	/**
	 * Single Price RSVP: divide price by quantity so WC total stays the same as single unit.
	 */
	public function apply_single_price_rsvp( \WC_Cart $cart ): void {
		if ( is_admin() && ! wp_doing_ajax() ) {
			return;
		}

		static $run = false;
		if ( $run ) {
			return;
		}
		$run = true;

		foreach ( $cart->get_cart() as $cart_item ) {
			$product = $cart_item['data'] ?? null;
			if ( ! $product instanceof WC_Product ) {
				continue;
			}

			if ( ! Helpers::is_single_price_rsvp( $product ) || $cart_item['quantity'] <= 1 ) {
				continue;
			}

			$price = (float) $product->get_price();
			$product->set_price( $price / $cart_item['quantity'] );
		}
	}
}
