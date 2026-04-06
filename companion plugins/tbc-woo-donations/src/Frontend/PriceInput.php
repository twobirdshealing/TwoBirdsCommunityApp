<?php
/**
 * Frontend price input display — handles rendering the price input field,
 * price HTML filters, variable product support, edit-in-cart, and scripts.
 *
 * @package TBC\WooDonations\Frontend
 */

declare(strict_types=1);

namespace TBC\WooDonations\Frontend;

use TBC\WooDonations\Helpers;
use TBC\WooDonations\Plugin;
use WC_Product;

defined( 'ABSPATH' ) || exit;

final class PriceInput {

	private static ?self $instance = null;

	public static function instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {

		// Register scripts/styles.
		add_action( 'wp_enqueue_scripts', [ $this, 'register_scripts' ], 20 );

		// Single product.
		add_action( 'woocommerce_before_single_product', [ $this, 'replace_price_template' ] );
		add_action( 'woocommerce_before_add_to_cart_button', [ $this, 'display_price_input' ], 9 );
		// tbc_don_after_price_input priority order:
		//  4 = minimum price text
		//  5 = suggested amounts (SuggestedAmounts.php)
		// 10 = one-time option (DonationFeatures.php)
		// 12 = deposit (DonationFeatures.php)
		// 14 = fee recovery (DonationFeatures.php)
		// 16 = give extra (DonationFeatures.php)
		// 50 = error holder
		add_action( 'tbc_don_after_price_input', [ $this, 'display_minimum_price' ], 4 );
		add_action( 'tbc_don_after_price_input', [ $this, 'display_error_holder' ], 50 );

		// Force redirect to product page for blocks.
		add_filter( 'woocommerce_product_has_options', [ $this, 'has_options' ], 10, 2 );

		// Edit in cart.
		add_filter( 'woocommerce_quantity_input_args', [ $this, 'edit_quantity' ], 10, 2 );
		add_filter( 'woocommerce_product_single_add_to_cart_text', [ $this, 'single_add_to_cart_text' ], 10, 2 );

		// Price HTML.
		add_filter( 'woocommerce_get_price_html', [ $this, 'donation_price_html' ], 10, 2 );
		add_filter( 'woocommerce_variable_subscription_price_html', [ $this, 'variable_subscription_price_html' ], 10, 2 );

		// Loop display.
		add_filter( 'woocommerce_product_add_to_cart_text', [ $this, 'add_to_cart_text' ], 10, 2 );
		add_filter( 'woocommerce_product_add_to_cart_url', [ $this, 'add_to_cart_url' ], 10, 2 );
		add_filter( 'woocommerce_product_supports', [ $this, 'supports_ajax_add_to_cart' ], 10, 3 );

		// Post class.
		add_filter( 'woocommerce_post_class', [ $this, 'add_product_class' ], 10, 2 );

		// Variable products.
		add_action( 'woocommerce_single_variation', [ $this, 'display_price_input' ], 12 );
		add_filter( 'woocommerce_variation_is_visible', [ $this, 'variation_is_visible' ], 10, 4 );
		add_filter( 'woocommerce_available_variation', [ $this, 'available_variation' ], 10, 3 );
		add_filter( 'woocommerce_get_variation_price', [ $this, 'get_variation_price' ], 10, 4 );
		add_filter( 'woocommerce_get_variation_regular_price', [ $this, 'get_variation_price' ], 10, 4 );

		// Cart display.
		add_filter( 'woocommerce_cart_item_price', [ $this, 'add_edit_link_in_cart' ], 10, 3 );
	}

	// -------------------------------------------------------------------------
	// Scripts & Styles
	// -------------------------------------------------------------------------

	public function register_scripts(): void {

		// Fluent Community theme variables are enqueued by tbc-cart on WooCommerce pages.

		// Frontend CSS — registered here, enqueued in display_price_input().
		if ( ! wc_string_to_bool( get_option( 'tbc_don_disable_css', 'no' ) ) ) {
			wp_register_style(
				'tbc-woo-donations',
				TBC_DON_PLUGIN_URL . 'assets/css/frontend.css',
				[],
				Plugin::instance()->asset_version( TBC_DON_PLUGIN_DIR . 'assets/css/frontend.css' )
			);
		}

		// Frontend JS — registered, enqueued only when needed.
		wp_register_script(
			'tbc-woo-donations',
			TBC_DON_PLUGIN_URL . 'assets/js/frontend.js',
			[], // No jQuery dependency.
			Plugin::instance()->asset_version( TBC_DON_PLUGIN_DIR . 'assets/js/frontend.js' ),
			true
		);

		$params = apply_filters( 'tbc_don_script_params', [
			'currency_format_num_decimals'       => wc_get_price_decimals(),
			'currency_format_precision_decimals' => absint( wc_get_rounding_precision() ),
			'currency_format_symbol'             => get_woocommerce_currency_symbol(),
			'currency_format_decimal_sep'        => wc_get_price_decimal_separator(),
			'currency_format_thousand_sep'       => wc_get_price_thousand_separator(),
			'currency_format_position'           => get_option( 'woocommerce_currency_pos' ),
			'currency_format_trim_zeros'         => (bool) apply_filters( 'woocommerce_price_trim_zeros', false ),
			'fee_recovery_rate'                  => 0.035,
		] );

		wp_localize_script( 'tbc-woo-donations', 'tbc_don_params', $params );
	}

	private function enqueue_scripts(): void {
		wp_enqueue_script( 'tbc-woo-donations' );
		wp_enqueue_style( 'tbc-woo-donations' );
	}

	// -------------------------------------------------------------------------
	// Price Template Replacement
	// -------------------------------------------------------------------------

	public function replace_price_template(): void {
		global $product;

		if ( ! $product || ! Helpers::is_donation( $product ) ) {
			return;
		}

		if ( has_action( 'woocommerce_single_product_summary', 'woocommerce_template_single_price' ) ) {
			remove_action( 'woocommerce_single_product_summary', 'woocommerce_template_single_price', 10 );
			add_action( 'woocommerce_before_add_to_cart_form', [ $this, 'display_suggested_price' ] );
			add_action( 'woocommerce_after_single_product', [ $this, 'restore_price_template' ] );
		}
	}

	public function restore_price_template(): void {
		add_action( 'woocommerce_single_product_summary', 'woocommerce_template_single_price', 10 );
		remove_action( 'woocommerce_before_add_to_cart_form', [ $this, 'display_suggested_price' ] );
	}

	// -------------------------------------------------------------------------
	// Price Input Display
	// -------------------------------------------------------------------------

	/**
	 * Render the price input on single product pages.
	 *
	 * @param WC_Product|false $product
	 * @param array<string, mixed> $args
	 */
	public function display_price_input( mixed $product = false, array $args = [] ): void {

		if ( is_int( $product ) ) {
			$product = wc_get_product( $product );
		}

		if ( ! $product instanceof WC_Product ) {
			global $product;
		}

		if ( ! $product instanceof WC_Product ) {
			return;
		}

		// Determine context — show price input if:
		// - Simple/subscription: product has _tbc_don_enabled
		// - Variable: parent has _tbc_don_enabled OR has donation variations
		$is_variation_hook = 'woocommerce_single_variation' === current_action();

		// Only show price input when custom donations is enabled.
		if ( $is_variation_hook ) {
			$enabled = wc_string_to_bool( (string) $product->get_meta( '_tbc_don_enabled' ) )
				|| Helpers::has_donation_variations( $product );
			if ( ! $enabled ) {
				return;
			}
		} elseif ( ! Helpers::is_donation( $product ) ) {
			return;
		}

		$suffix   = $args['suffix'] ?? '';
		$counter  = Helpers::get_counter();
		$input_id = 'tbc-don-' . $counter;

		// Get initial price value.
		$price = $this->get_price_value( $product, $suffix );

		$template_args = wp_parse_args( $args, [
			'product_id'        => $product->get_id(),
			'product'       => $product, // Kept for template compat.
			'counter'           => $counter,
			'input_id'          => $input_id,
			'input_type'        => 'text',
			'input_name'        => 'tbc_don_price' . $suffix,
			'input_value'       => Helpers::format_price_value( $price ),
			'input_label'       => Helpers::get_label_text( $product ),
			'classes'           => [ 'input-text', 'amount', 'tbc-don-input', 'text' ],
			'aria-describedby'  => [ 'tbc-don-minimum-price-' . $input_id, 'tbc-don-error-' . $input_id ],
			'placeholder'       => '',
			'custom_attributes' => [ 'inputmode' => 'decimal' ],
			'suffix'            => $suffix,
			'updating_cart_key' => $this->get_updating_cart_key(),
			'_tbc_don_nonce'         => isset( $_GET['_tbc_don_nonce'] ) ? sanitize_key( $_GET['_tbc_don_nonce'] ) : '', // phpcs:ignore WordPress.Security.NonceVerification
		] );

		$template_args = (array) apply_filters( 'tbc_don_price_input_attributes', $template_args, $product, $suffix );

		// Enqueue scripts.
		$this->enqueue_scripts();

		// Load template.
		wc_get_template(
			'price-input.php',
			$template_args,
			'',
			TBC_DON_PLUGIN_DIR . 'templates/'
		);
	}

	/**
	 * Get the price to pre-fill in the input.
	 */
	private function get_price_value( WC_Product $product, string $suffix = '' ): float {

		// Check if editing in cart.
		$cart_key = $this->get_updating_cart_key();
		if ( $cart_key && isset( WC()->cart->cart_contents[ $cart_key ]['tbc_don_price'] ) ) {
			return (float) WC()->cart->cart_contents[ $cart_key ]['tbc_don_price'];
		}

		// Check for posted price.
		$posted = Helpers::get_posted_price( $product, $suffix );
		if ( $posted ) {
			return (float) Helpers::standardize_number( $posted );
		}

		// Fall back to initial/suggested price.
		$initial = Helpers::get_suggested_price( $product );

		return (float) apply_filters( 'tbc_don_get_initial_price', $initial, $product, $suffix );
	}

	/**
	 * Get the cart key being updated (edit-in-cart).
	 */
	private function get_updating_cart_key(): string {
		// phpcs:disable WordPress.Security.NonceVerification
		if ( isset( $_GET['update-price'], $_GET['_tbc_don_nonce'] ) && wp_verify_nonce( sanitize_key( $_GET['_tbc_don_nonce'] ), 'tbc-don-nonce' ) ) {
			$key = sanitize_key( $_GET['update-price'] );
			if ( WC()->cart && WC()->cart->find_product_in_cart( $key ) ) {
				return $key;
			}
		}
		// phpcs:enable
		return '';
	}

	// -------------------------------------------------------------------------
	// Suggested & Minimum Price Display
	// -------------------------------------------------------------------------

	public function display_suggested_price( mixed $product = false ): void {
		if ( ! $product instanceof WC_Product ) {
			global $product;
		}

		if ( ! $product instanceof WC_Product ) {
			return;
		}

		$html = Helpers::get_suggested_price_html( $product );

		if ( $html || Helpers::has_donation_variations( $product ) ) {
			echo '<p class="price suggested-price">' . wp_kses_post( $html ) . '</p>';
		}
	}

	public function display_minimum_price( mixed $product = false ): void {
		if ( ! $product instanceof WC_Product ) {
			global $product;
		}

		if ( ! $product instanceof WC_Product ) {
			return;
		}

		$html = Helpers::get_minimum_price_html( $product );

		if ( ! $html && ! Helpers::has_donation_variations( $product ) ) {
			return;
		}

		wc_get_template(
			'minimum-price.php',
			[
				'product_id'  => $product->get_id(),
				'product' => $product,
				'counter'     => Helpers::get_counter(),
			],
			'',
			TBC_DON_PLUGIN_DIR . 'templates/'
		);
	}

	public function display_error_holder(): void {
		printf(
			'<div id="tbc-don-error-%s" class="tbc-don-message" aria-live="assertive" style="display: none"></div>',
			esc_attr( (string) Helpers::get_counter() )
		);
	}

	// -------------------------------------------------------------------------
	// Price HTML Filters
	// -------------------------------------------------------------------------

	public function donation_price_html( string $html, WC_Product $product ): string {
		if ( Helpers::is_donation( $product ) ) {
			return (string) apply_filters( 'tbc_don_price_html', Helpers::get_suggested_price_html( $product ), $product );
		}

		if ( Helpers::has_donation_variations( $product ) && ! $product->is_type( 'variable-subscription' ) ) {
			$min_string = $this->get_min_variation_price_string( $product );
			$html       = $min_string ? wc_get_price_html_from_text() . $min_string : '';
		}

		return $html;
	}

	public function variable_subscription_price_html( string $html, WC_Product $product ): string {
		if ( Helpers::has_donation_variations( $product ) ) {
			$hide = wc_string_to_bool( (string) $product->get_meta( '_tbc_don_hide_variable_price' ) );
			if ( $hide && class_exists( 'WC_Subscriptions_Product' ) ) {
				$signup = (int) \WC_Subscriptions_Product::get_sign_up_fee( $product );
				$trial  = (int) \WC_Subscriptions_Product::get_trial_length( $product );
				if ( 0 === $signup && 0 === $trial ) {
					$html = '';
				}
			}
		}
		return $html;
	}

	private function get_min_variation_price_string( WC_Product $product ): string {
		$hide = wc_string_to_bool( (string) $product->get_meta( '_tbc_don_hide_variable_price' ) );
		if ( $hide ) {
			return '';
		}

		$prices = $product->get_variation_prices();
		if ( empty( $prices['price'] ) ) {
			return '';
		}

		reset( $prices['price'] );
		$min_id    = key( $prices['price'] );
		$min_price = Helpers::is_donation( $min_id ) ? Helpers::get_minimum_price( wc_get_product( $min_id ) ) : current( $prices['price'] );

		return $min_price > 0 ? wc_price( $min_price ) : '';
	}

	// -------------------------------------------------------------------------
	// Has Options (Blocks support)
	// -------------------------------------------------------------------------

	public function has_options( bool $has_options, WC_Product $product ): bool {
		if ( ! $has_options && defined( 'REST_REQUEST' ) && Helpers::is_donation( $product ) ) {
			return true;
		}
		return $has_options;
	}

	// -------------------------------------------------------------------------
	// Edit in Cart
	// -------------------------------------------------------------------------

	public function edit_quantity( array $args, WC_Product $product ): array {
		if ( ! Helpers::is_donation( $product ) && ! Helpers::has_donation_variations( $product ) ) {
			return $args;
		}

		// Carry cart quantity back to product page.
		$cart_key = $this->get_updating_cart_key();
		if ( $cart_key && isset( WC()->cart->cart_contents[ $cart_key ] ) ) {
			$args['input_value'] = WC()->cart->cart_contents[ $cart_key ]['quantity'];
		}

		// Hide quantity if option set.
		if ( wc_string_to_bool( get_option( 'tbc_don_hide_quantity', 'no' ) ) ) {
			$args['max_value'] = $args['min_value'];
		}

		return $args;
	}

	public function single_add_to_cart_text( string $text, WC_Product $product ): string {
		if ( ! Helpers::is_donation( $product ) ) {
			return $text;
		}

		$custom_text = trim( (string) get_option( 'tbc_don_button_text', '' ) );
		if ( $custom_text ) {
			$text = $custom_text;
		}

		// Show "Update Cart" when editing.
		$cart_key = $this->get_updating_cart_key();
		if ( $cart_key ) {
			$text = __( 'Update Cart', 'tbc-woo-donations' );
		}

		return $text;
	}

	// -------------------------------------------------------------------------
	// Loop Display
	// -------------------------------------------------------------------------

	public function add_to_cart_text( string $text, WC_Product $product ): string {
		if ( Helpers::is_donation( $product ) ) {
			return __( 'Choose price', 'tbc-woo-donations' );
		}
		return $text;
	}

	public function add_to_cart_url( string $url, ?WC_Product $product = null ): string {
		if ( $product && Helpers::is_donation( $product ) ) {
			return (string) get_permalink( $product->get_id() );
		}
		return $url;
	}

	public function supports_ajax_add_to_cart( bool $supports, string $feature, WC_Product $product ): bool {
		if ( 'ajax_add_to_cart' === $feature && Helpers::is_donation( $product ) ) {
			return false;
		}
		return $supports;
	}

	// -------------------------------------------------------------------------
	// Product Class
	// -------------------------------------------------------------------------

	/**
	 * @param string[] $classes
	 */
	public function add_product_class( array $classes, WC_Product $product ): array {
		if ( Helpers::is_donation( $product ) || Helpers::has_donation_variations( $product ) ) {
			$classes[] = 'tbc-don-product';

			if ( Helpers::has_donation_variations( $product ) ) {
				$classes[] = 'tbc-don-variable-product';
			}
			if ( wc_string_to_bool( get_option( 'tbc_don_hide_quantity', 'no' ) ) ) {
				$classes[] = 'tbc-don-hide-quantity';
			}
		}
		return $classes;
	}

	// -------------------------------------------------------------------------
	// Variable Products
	// -------------------------------------------------------------------------

	/**
	 * @param mixed $visible
	 * @param int $variation_id
	 * @param int $product_id
	 * @param \WC_Product_Variation $variation
	 */
	public function variation_is_visible( $visible, $variation_id, $product_id, $variation ): bool {
		if ( Helpers::is_donation( $variation ) ) {
			return true;
		}
		return (bool) $visible;
	}

	/**
	 * @param array<string, mixed> $data
	 */
	public function available_variation( array $data, WC_Product $product, \WC_Product_Variation $variation ): array {
		if ( Helpers::is_donation( $variation ) ) {
			$data['is_donation']           = true;
			$data['minimum_price']         = Helpers::get_minimum_price( $variation );
			$data['maximum_price']         = Helpers::get_maximum_price( $variation );
			$data['initial_price']         = Helpers::get_suggested_price( $variation );
			$data['price_label']           = Helpers::get_label_text( $variation );
			$data['posted_price']          = Helpers::format_price_value( (float) Helpers::get_posted_price( $variation ) );
			$data['display_price']         = Helpers::format_price_value( $this->get_price_value( $variation ) );
			$data['display_regular_price'] = $data['display_price'];
			$data['price_html']            = '<span class="price">' . Helpers::get_suggested_price_html( $variation ) . '</span>';
			$data['minimum_price_html']    = Helpers::get_minimum_price_html( $variation );
			$data['hide_minimum']          = Helpers::is_minimum_hidden( $variation );
			$data['add_to_cart_text']      = esc_html( $variation->single_add_to_cart_text() );
		} else {
			$data['is_donation'] = false;
		}
		return $data;
	}

	/**
	 * Get the minimum variation price for donation variations.
	 */
	public function get_variation_price( mixed $price, WC_Product $product, string $min_or_max, bool $display ): mixed {
		if ( Helpers::has_donation_variations( $product ) && 'min' === $min_or_max ) {
			$prices = $product->get_variation_prices();
			if ( ! empty( $prices['price'] ) ) {
				reset( $prices['price'] );
				$min_id = key( $prices['price'] );
				if ( Helpers::is_donation( $min_id ) ) {
					$min_product = wc_get_product( $min_id );
					if ( $min_product ) {
						$price = Helpers::get_minimum_price( $min_product );
					}
				}
			}
		}
		return $price;
	}

	// -------------------------------------------------------------------------
	// Cart Display
	// -------------------------------------------------------------------------

	public function add_edit_link_in_cart( string $content, array $cart_item, string $cart_item_key ): string {

		$show = wc_string_to_bool( get_option( 'tbc_don_edit_in_cart', 'yes' ) );

		if ( ! isset( $cart_item['tbc_don_price'] ) || ! $show ) {
			return $content;
		}

		if ( ! function_exists( 'is_cart' ) || ! is_cart() || $this->is_cart_widget() ) {
			return $content;
		}

		$product = $cart_item['data'];
		if ( ! $product instanceof WC_Product ) {
			return $content;
		}

		$edit_url = add_query_arg( [
			'update-price' => $cart_item_key,
			'quantity'     => $cart_item['quantity'],
			'_tbc_don_nonce'    => wp_create_nonce( 'tbc-don-nonce' ),
		], get_permalink( $product->get_id() ) );

		$edit_text = _x( 'Edit price', 'edit in cart link text', 'tbc-woo-donations' );

		return sprintf(
			'%s<br/><a class="tbc-don-edit-price" href="%s"><small>%s</small></a>',
			$content,
			esc_url( $edit_url ),
			esc_html( $edit_text )
		);
	}

	private function is_cart_widget(): bool {
		return did_action( 'woocommerce_before_mini_cart' ) > did_action( 'woocommerce_after_mini_cart' );
	}
}
