<?php
/**
 * WooCommerce Settings > Donations tab — actual settings page.
 *
 * This file is loaded via require_once inside the woocommerce_get_settings_pages
 * filter callback, ensuring WC_Settings_Page is available before we extend it.
 *
 * @package TBC\WooDonations\Admin
 */

declare(strict_types=1);

namespace TBC\WooDonations\Admin;

defined( 'ABSPATH' ) || exit;

class PluginSettingsPage extends \WC_Settings_Page {

	public function __construct() {
		$this->id    = 'tbc_donations';
		$this->label = __( 'Donations', 'tbc-woo-donations' );
		parent::__construct();
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public function get_settings(): array {

		return apply_filters( 'tbc_don_settings', [
			[
				'title' => __( 'Donation Display Options', 'tbc-woo-donations' ),
				'type'  => 'title',
				'desc'  => __( 'Customize how donation products appear to your customers.', 'tbc-woo-donations' ),
				'id'    => 'tbc_don_display_options',
			],
			[
				'title'    => __( 'Price Input Label', 'tbc-woo-donations' ),
				'desc'     => __( 'Text shown above the price input field.', 'tbc-woo-donations' ),
				'id'       => 'tbc_don_label_text',
				'type'     => 'text',
				'default'  => __( 'My Donation', 'tbc-woo-donations' ),
				'css'      => 'min-width: 300px;',
				'desc_tip' => true,
			],
			[
				'title'    => __( 'Minimum Price Text', 'tbc-woo-donations' ),
				'desc'     => __( 'Use %PRICE% as a placeholder for the minimum price.', 'tbc-woo-donations' ),
				'id'       => 'tbc_don_minimum_text',
				'type'     => 'text',
				'default'  => __( 'Minimum price: %PRICE%', 'tbc-woo-donations' ),
				'css'      => 'min-width: 300px;',
				'desc_tip' => true,
			],
			[
				'title'    => __( 'Suggested Price Text', 'tbc-woo-donations' ),
				'desc'     => __( 'Use %PRICE% as a placeholder for the suggested price.', 'tbc-woo-donations' ),
				'id'       => 'tbc_don_suggested_text',
				'type'     => 'text',
				'default'  => __( 'Suggested price: %PRICE%', 'tbc-woo-donations' ),
				'css'      => 'min-width: 300px;',
				'desc_tip' => true,
			],
			[
				'title'    => __( 'Add to Cart Button Text', 'tbc-woo-donations' ),
				'desc'     => __( 'Custom text for the single product add-to-cart button. Leave blank for default.', 'tbc-woo-donations' ),
				'id'       => 'tbc_don_button_text',
				'type'     => 'text',
				'default'  => '',
				'css'      => 'min-width: 300px;',
				'desc_tip' => true,
			],
			[
				'type' => 'sectionend',
				'id'   => 'tbc_don_display_options',
			],
			[
				'title' => __( 'Cart & Checkout', 'tbc-woo-donations' ),
				'type'  => 'title',
				'id'    => 'tbc_don_cart_options',
			],
			[
				'title'   => __( 'Edit Price in Cart', 'tbc-woo-donations' ),
				'desc'    => __( 'Show an "Edit price" link in the cart.', 'tbc-woo-donations' ),
				'id'      => 'tbc_don_edit_in_cart',
				'type'    => 'checkbox',
				'default' => 'yes',
			],
			[
				'title'   => __( 'Hide Quantity Selector', 'tbc-woo-donations' ),
				'desc'    => __( 'Hide the quantity field on donation product pages.', 'tbc-woo-donations' ),
				'id'      => 'tbc_don_hide_quantity',
				'type'    => 'checkbox',
				'default' => 'no',
			],
			[
				'title'   => __( 'Disable Frontend CSS', 'tbc-woo-donations' ),
				'desc'    => __( 'Disable the plugin\'s built-in frontend stylesheet.', 'tbc-woo-donations' ),
				'id'      => 'tbc_don_disable_css',
				'type'    => 'checkbox',
				'default' => 'no',
			],
			[
				'type' => 'sectionend',
				'id'   => 'tbc_don_cart_options',
			],
		] );
	}
}
