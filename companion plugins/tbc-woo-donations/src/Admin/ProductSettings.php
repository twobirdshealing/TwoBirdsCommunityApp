<?php
/**
 * Unified "Donations" product data tab — custom donation pricing,
 * suggested amounts, deposit, fee recovery, and extras in one panel.
 *
 * Uses woocommerce_admin_process_product_object hook (receives $product object)
 * instead of woocommerce_process_product_meta (raw $_POST + post_id).
 *
 * @package TBC\WooDonations\Admin
 */

declare(strict_types=1);

namespace TBC\WooDonations\Admin;

use TBC\WooDonations\Helpers;
use TBC\WooDonations\Plugin;
use WC_Product;

defined( 'ABSPATH' ) || exit;

final class ProductSettings {

	public static function init(): void {
		add_filter( 'woocommerce_product_data_tabs', [ __CLASS__, 'add_tab' ] );
		add_action( 'woocommerce_product_data_panels', [ __CLASS__, 'render_panel' ] );
		add_action( 'woocommerce_admin_process_product_object', [ __CLASS__, 'save' ], 20 );
		add_action( 'admin_enqueue_scripts', [ __CLASS__, 'enqueue_scripts' ], 20 );
	}

	// -------------------------------------------------------------------------
	// Donations Tab
	// -------------------------------------------------------------------------

	/**
	 * @param array<string, array<string, mixed>> $tabs
	 * @return array<string, array<string, mixed>>
	 */
	public static function add_tab( array $tabs ): array {
		$tabs['tbc_donations'] = [
			'label'    => __( 'Donations', 'tbc-woo-donations' ),
			'target'   => 'tbc_donations_product_data',
			'class'    => [ 'show_if_simple', 'show_if_variable', 'show_if_subscription', 'show_if_variable-subscription' ],
			'priority' => 75,
		];
		return $tabs;
	}

	// -------------------------------------------------------------------------
	// Render Panel
	// -------------------------------------------------------------------------

	public static function render_panel(): void {
		global $product_object;

		$product = $product_object instanceof WC_Product ? $product_object : null;

		if ( ! $product ) {
			global $post;
			$product = $post ? wc_get_product( $post->ID ) : null;
		}

		if ( ! $product ) {
			return;
		}

		echo '<div id="tbc_donations_product_data" class="panel woocommerce_options_panel">';

		// ---- PRICING SECTION ----
		echo '<div class="options_group">';
		echo '<h4 style="padding-left:12px;">' . esc_html__( 'Custom Donations', 'tbc-woo-donations' ) . '</h4>';

		woocommerce_wp_checkbox( [
			'id'          => '_tbc_don_enabled',
			'label'       => __( 'Enable', 'tbc-woo-donations' ),
			'value'       => $product->get_meta( '_tbc_don_enabled', true, 'edit' ),
			'description' => __( 'Let customers choose their own donation amount.', 'tbc-woo-donations' ),
		] );

		woocommerce_wp_text_input( [
			'id'          => '_tbc_don_suggested_price',
			'label'       => __( 'Suggested Price', 'tbc-woo-donations' ) . ' (' . get_woocommerce_currency_symbol() . ')',
			'type'        => 'text',
			'class'       => 'wc_input_price short',
			'value'       => $product->get_meta( '_tbc_don_suggested_price', true, 'edit' ),
			'desc_tip'    => true,
			'description' => __( 'The suggested donation amount shown to customers.', 'tbc-woo-donations' ),
		] );

		woocommerce_wp_text_input( [
			'id'          => '_tbc_don_min_price',
			'label'       => __( 'Minimum Price', 'tbc-woo-donations' ) . ' (' . get_woocommerce_currency_symbol() . ')',
			'type'        => 'text',
			'class'       => 'wc_input_price short',
			'value'       => $product->get_meta( '_tbc_don_min_price', true, 'edit' ),
			'desc_tip'    => true,
			'description' => __( 'Leave empty for no minimum.', 'tbc-woo-donations' ),
		] );

		woocommerce_wp_checkbox( [
			'id'          => '_tbc_don_hide_minimum',
			'label'       => __( 'Hide minimum', 'tbc-woo-donations' ),
			'value'       => $product->get_meta( '_tbc_don_hide_minimum', true, 'edit' ),
			'description' => __( 'Hide the minimum price from customers. Error will say "enter a higher amount".', 'tbc-woo-donations' ),
		] );

		woocommerce_wp_text_input( [
			'id'          => '_tbc_don_max_price',
			'label'       => __( 'Maximum Price', 'tbc-woo-donations' ) . ' (' . get_woocommerce_currency_symbol() . ')',
			'type'        => 'text',
			'class'       => 'wc_input_price short',
			'value'       => $product->get_meta( '_tbc_don_max_price', true, 'edit' ),
			'desc_tip'    => true,
			'description' => __( 'Leave empty for no maximum.', 'tbc-woo-donations' ),
		] );

		// Hook for suggested amounts UI.
		do_action( 'tbc_don_options_pricing', $product, $product->is_type( [ 'subscription', 'variable-subscription' ] ) );

		echo '</div>'; // .options_group pricing

		// ---- SUGGESTED AMOUNTS SECTION ----
		echo '<div class="options_group">';
		echo '<h4 style="padding-left:12px;">' . esc_html__( 'Suggested Amounts', 'tbc-woo-donations' ) . '</h4>';

		$use_suggested = wc_string_to_bool( (string) $product->get_meta( '_tbc_don_use_suggested_amounts', true ) );

		woocommerce_wp_checkbox( [
			'id'            => 'tbc_don_use_suggested_amounts',
			'wrapper_class' => 'toggle',
			'class'         => 'tbc_don_use_suggested_amounts',
			'label'         => __( 'Enable suggested amounts', 'tbc-woo-donations' ),
			'value'         => wc_bool_to_string( $use_suggested ),
			'description'   => '<label for="tbc_don_use_suggested_amounts" class="tbc-don-toggle"></label>',
		] );

		// Amounts data field + sortable container.
		$amounts = Helpers::get_suggested_amounts( $product );

		// Ensure custom button exists.
		$has_custom = false;
		foreach ( $amounts as $a ) {
			if ( ( $a['type'] ?? '' ) === 'custom_button' ) {
				$has_custom = true;
				break;
			}
		}
		if ( ! $has_custom ) {
			$amounts[] = [
				'type'    => 'custom_button',
				'amount'  => 'custom',
				'label'   => __( 'Custom Amount', 'tbc-woo-donations' ),
				'enabled' => false,
				'default' => 'no',
			];
		}

		// Ensure one default.
		$has_default = false;
		foreach ( $amounts as $a ) {
			if ( ( $a['default'] ?? '' ) === 'yes' ) {
				$has_default = true;
				break;
			}
		}
		if ( ! $has_default && ! empty( $amounts ) ) {
			$amounts[0]['default'] = 'yes';
		}

		$hidden_class = $use_suggested ? '' : 'hidden';

		// Separate preset amounts from custom button for display.
		$preset_amounts = array_filter( $amounts, fn( $a ) => ( $a['type'] ?? '' ) !== 'custom_button' );
		$custom_button  = null;
		foreach ( $amounts as $a ) {
			if ( ( $a['type'] ?? '' ) === 'custom_button' ) {
				$custom_button = $a;
				break;
			}
		}

		?>
		<div class="tbc-don-amounts-ui <?php echo esc_attr( $hidden_class ); ?>">
			<p class="form-field">
				<label><?php printf( esc_html__( 'Amounts (%s)', 'tbc-woo-donations' ), get_woocommerce_currency_symbol() ); ?></label>
				<input type="text" class="wc_input_price" id="tbc_don_add_amount_input" placeholder="<?php esc_attr_e( 'Enter amount and press Enter', 'tbc-woo-donations' ); ?>" style="width:200px;" />
				<button type="button" class="button tbc-don-add-amount"><?php esc_html_e( 'Add', 'tbc-woo-donations' ); ?></button>
			</p>

			<ul id="tbc_don_amounts_list" class="tbc-don-amounts-list">
				<?php foreach ( $preset_amounts as $i => $a ) :
					$is_default = ( $a['default'] ?? '' ) === 'yes';
				?>
					<li data-amount="<?php echo esc_attr( (string) $a['amount'] ); ?>" data-label="<?php echo esc_attr( $a['label'] ?? '' ); ?>">
						<span class="dashicons dashicons-menu tbc-don-drag"></span>
						<strong><?php echo wp_kses_post( wc_price( $a['amount'] ) ); ?></strong>
						<input type="text" class="tbc-don-amount-label" value="<?php echo esc_attr( $a['label'] ?? '' ); ?>" placeholder="<?php esc_attr_e( 'Label (optional)', 'tbc-woo-donations' ); ?>" />
						<label class="tbc-don-default-label">
							<input type="radio" name="tbc_don_default_amount" value="<?php echo esc_attr( (string) $a['amount'] ); ?>" <?php checked( $is_default ); ?> />
							<?php esc_html_e( 'Default', 'tbc-woo-donations' ); ?>
						</label>
						<button type="button" class="tbc-don-remove-amount" title="<?php esc_attr_e( 'Remove', 'tbc-woo-donations' ); ?>">&times;</button>
					</li>
				<?php endforeach; ?>
			</ul>

			<p class="form-field">
				<label>
					<input type="checkbox" id="tbc_don_custom_enabled" <?php checked( $custom_button['enabled'] ?? false ); ?> />
					<?php esc_html_e( 'Show "Custom Amount" button', 'tbc-woo-donations' ); ?>
				</label>
			</p>

			<textarea style="display:none;" id="tbc_don_suggested_amounts_data" name="tbc_don_suggested_amounts"><?php echo wp_json_encode( $amounts ); ?></textarea>
		</div>
		<?php

		echo '</div>'; // .options_group suggested

		// ---- DEPOSIT SECTION ----
		echo '<div class="options_group">';
		echo '<h4 style="padding-left:12px;">' . esc_html__( 'Non-Refundable Deposit', 'tbc-woo-donations' ) . '</h4>';

		woocommerce_wp_checkbox( [
			'id'    => '_tbc_don_deposit_enabled',
			'label' => __( 'Enable deposit', 'tbc-woo-donations' ),
			'value' => $product->get_meta( '_tbc_don_deposit_enabled', true, 'edit' ),
		] );

		woocommerce_wp_text_input( [
			'id'          => '_tbc_don_deposit_amount',
			'label'       => __( 'Deposit Amount', 'tbc-woo-donations' ) . ' (' . get_woocommerce_currency_symbol() . ')',
			'type'        => 'text',
			'class'       => 'wc_input_price short',
			'value'       => $product->get_meta( '_tbc_don_deposit_amount', true, 'edit' ),
		] );

		woocommerce_wp_textarea_input( [
			'id'          => '_tbc_don_cancellation_policy',
			'label'       => __( 'Cancellation Policy', 'tbc-woo-donations' ),
			'value'       => $product->get_meta( '_tbc_don_cancellation_policy', true, 'edit' ),
			'desc_tip'    => true,
			'description' => __( 'Policy text shown in a popup when the link is clicked.', 'tbc-woo-donations' ),
		] );

		echo '</div>';

		// ---- ADDITIONAL OPTIONS SECTION ----
		echo '<div class="options_group">';
		echo '<h4 style="padding-left:12px;">' . esc_html__( 'Additional Options', 'tbc-woo-donations' ) . '</h4>';

		woocommerce_wp_checkbox( [
			'id'          => '_tbc_don_fee_recovery',
			'label'       => __( 'Fee recovery (3.5%)', 'tbc-woo-donations' ),
			'value'       => $product->get_meta( '_tbc_don_fee_recovery', true, 'edit' ),
			'description' => __( 'Let donors cover transaction fees.', 'tbc-woo-donations' ),
		] );

		woocommerce_wp_checkbox( [
			'id'          => '_tbc_don_give_extra',
			'label'       => __( 'Enable "Donate Extra"', 'tbc-woo-donations' ),
			'value'       => $product->get_meta( '_tbc_don_give_extra', true, 'edit' ),
			'description' => __( 'Show checkbox for additional donation amount.', 'tbc-woo-donations' ),
		] );

		woocommerce_wp_checkbox( [
			'id'          => '_tbc_don_donor_wall',
			'label'       => __( 'Enable Donor Wall', 'tbc-woo-donations' ),
			'value'       => $product->get_meta( '_tbc_don_donor_wall', true, 'edit' ),
			'description' => __( 'Show a "Donor Wall" tab on the product page.', 'tbc-woo-donations' ),
		] );

		// One-time option (subscriptions only).
		if ( $product->is_type( [ 'subscription', 'variable-subscription' ] ) ) {
			woocommerce_wp_checkbox( [
				'id'          => '_tbc_don_one_time_enabled',
				'label'       => __( 'Allow one-time purchase', 'tbc-woo-donations' ),
				'value'       => $product->get_meta( '_tbc_don_one_time_enabled', true, 'edit' ),
				'description' => __( 'Let donors choose one-time instead of recurring.', 'tbc-woo-donations' ),
			] );
		}

		woocommerce_wp_checkbox( [
			'id'          => '_tbc_don_single_price_rsvp',
			'label'       => __( 'Single Price RSVP', 'tbc-woo-donations' ),
			'value'       => $product->get_meta( '_tbc_don_single_price_rsvp', true, 'edit' ),
			'description' => __( 'Charge once regardless of quantity (e.g., 2 guests at $20 = $20 total). Shows "# of Guests" label.', 'tbc-woo-donations' ),
		] );

		echo '</div>';

		wp_nonce_field( 'tbc_don_save_product', 'tbc_don_product_nonce' );

		echo '</div>'; // #tbc_donations_product_data
	}

	// -------------------------------------------------------------------------
	// Save
	// -------------------------------------------------------------------------

	public static function save( WC_Product $product ): void {

		// Verify nonce from the Donations tab.
		if ( ! isset( $_POST['tbc_don_product_nonce'] ) || ! wp_verify_nonce( sanitize_key( $_POST['tbc_don_product_nonce'] ), 'tbc_don_save_product' ) ) {
			return;
		}

		// --- Pricing ---
		$price_fields = [
			'_tbc_don_suggested_price',
			'_tbc_don_min_price',
			'_tbc_don_max_price',
			'_tbc_don_deposit_amount',
		];

		foreach ( $price_fields as $field ) {
			if ( isset( $_POST[ $field ] ) ) {
				$value = wc_format_decimal( wc_clean( wp_unslash( $_POST[ $field ] ) ) );
				$product->update_meta_data( $field, $value );
			}
		}

		// --- Checkboxes ---
		$checkbox_fields = [
			'_tbc_don_enabled',
			'_tbc_don_hide_minimum',
			'_tbc_don_deposit_enabled',
			'_tbc_don_fee_recovery',
			'_tbc_don_give_extra',
			'_tbc_don_donor_wall',
			'_tbc_don_one_time_enabled',
			'_tbc_don_single_price_rsvp',
		];

		foreach ( $checkbox_fields as $field ) {
			$product->update_meta_data( $field, isset( $_POST[ $field ] ) ? 'yes' : 'no' );
		}

		// --- Cancellation Policy ---
		if ( isset( $_POST['_tbc_don_cancellation_policy'] ) ) {
			$product->update_meta_data( '_tbc_don_cancellation_policy', wp_kses_post( wp_unslash( $_POST['_tbc_don_cancellation_policy'] ) ) );
		}

		// --- Suggested Amounts ---
		self::save_checkbox( $product, 'tbc_don_use_suggested_amounts', '_tbc_don_use_suggested_amounts' );

		if ( isset( $_POST['tbc_don_suggested_amounts'] ) ) {
			self::save_suggested_amounts( $product );
		}

		// _tbc_don_has_variations is handled by Compat\VariableProducts::update_parent_meta().
	}

	/**
	 * Save a checkbox field.
	 */
	private static function save_checkbox( WC_Product $product, string $post_key, string $meta_key ): void {
		$product->update_meta_data( $meta_key, isset( $_POST[ $post_key ] ) ? 'yes' : 'no' ); // phpcs:ignore WordPress.Security.NonceVerification
	}

	/**
	 * Save suggested amounts from JSON textarea.
	 */
	private static function save_suggested_amounts( WC_Product $product ): void {
		$raw = wp_unslash( $_POST['tbc_don_suggested_amounts'] ?? '' ); // phpcs:ignore WordPress.Security.NonceVerification
		$data = json_decode( $raw, true );

		if ( ! is_array( $data ) ) {
			$product->delete_meta_data( '_tbc_don_suggested_amounts' );
			return;
		}

		$amounts       = [];
		$default_count = 0;

		foreach ( $data as $item ) {
			if ( empty( $item ) ) {
				continue;
			}

			// Custom button.
			if ( ( $item['type'] ?? '' ) === 'custom_button' ) {
				$amounts[] = [
					'type'    => 'custom_button',
					'amount'  => 'custom',
					'label'   => sanitize_text_field( $item['label'] ?? '' ),
					'enabled' => (bool) ( $item['enabled'] ?? false ),
					'default' => sanitize_text_field( $item['default'] ?? 'no' ),
				];
				if ( ( $item['default'] ?? '' ) === 'yes' ) {
					$default_count++;
				}
				continue;
			}

			// Regular amount.
			if ( ! isset( $item['amount'] ) ) {
				continue;
			}

			$amount = (float) wc_format_decimal( wc_clean( $item['amount'] ) );

			// Validate range.
			$max = (float) $product->get_meta( '_tbc_don_max_price', true, 'edit' );
			$min = (float) $product->get_meta( '_tbc_don_min_price', true, 'edit' );

			if ( $max > 0 && $amount > $max ) {
				continue;
			}
			if ( $min > 0 && $amount < $min ) {
				continue;
			}

			$default = sanitize_text_field( $item['default'] ?? 'no' );
			if ( 'yes' === $default ) {
				$default_count++;
				if ( $default_count > 1 ) {
					$default = 'no';
				}
			}

			$amounts[] = [
				'amount'  => $amount,
				'label'   => sanitize_text_field( $item['label'] ?? '' ),
				'default' => $default,
			];
		}

		// Ensure at least one default.
		if ( 0 === $default_count && ! empty( $amounts ) ) {
			$amounts[0]['default'] = 'yes';
		}

		if ( ! empty( $amounts ) ) {
			$product->update_meta_data( '_tbc_don_suggested_amounts', $amounts );
		} else {
			$product->delete_meta_data( '_tbc_don_suggested_amounts' );
		}
	}

	// -------------------------------------------------------------------------
	// Admin Assets
	// -------------------------------------------------------------------------

	public static function enqueue_scripts(): void {
		$screen = get_current_screen();
		if ( ! $screen || 'product' !== $screen->id ) {
			return;
		}

		wp_enqueue_style(
			'tbc-woo-donations-admin',
			TBC_DON_PLUGIN_URL . 'assets/css/admin.css',
			[],
			Plugin::instance()->asset_version( TBC_DON_PLUGIN_DIR . 'assets/css/admin.css' )
		);

		wp_enqueue_script( 'accounting' );
		wp_enqueue_script(
			'tbc-woo-donations-admin',
			TBC_DON_PLUGIN_URL . 'assets/js/admin.js',
			[ 'wc-admin-product-meta-boxes', 'jquery-ui-sortable', 'wp-util' ],
			Plugin::instance()->asset_version( TBC_DON_PLUGIN_DIR . 'assets/js/admin.js' ),
			true
		);

		wp_localize_script( 'tbc-woo-donations-admin', 'TBC_DON_ADMIN', [
			'i18n_no_amounts_added'        => __( 'No amount added', 'tbc-woo-donations' ),
			'i18n_remove_amount'           => __( 'Are you sure you want to remove this amount?', 'tbc-woo-donations' ),
			'i18n_maximum_error'           => __( 'Amount cannot exceed the maximum price.', 'tbc-woo-donations' ),
			'i18n_minimum_error'           => __( 'Amount cannot be less than the minimum price.', 'tbc-woo-donations' ),
			'currency_format_num_decimals' => wc_get_price_decimals(),
			'currency_format_symbol'       => get_woocommerce_currency_symbol(),
			'currency_format_decimal_sep'  => wc_get_price_decimal_separator(),
			'currency_format_thousand_sep' => wc_get_price_thousand_separator(),
			'currency_format'              => str_replace( [ '%1$s', '%2$s' ], [ '%s', '%v' ], get_woocommerce_price_format() ),
			'trim_zeroes'                  => apply_filters( 'woocommerce_price_trim_zeros', false ) && wc_get_price_decimals() > 0,
		] );
	}
}
