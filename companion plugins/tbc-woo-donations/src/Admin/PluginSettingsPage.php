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

		// Compute live fallbacks so the form shows what the donor will actually see
		// when a field is left blank.
		$site_name_fallback = (string) get_bloginfo( 'name' );

		$logo_placeholder = '';
		$custom_logo_id   = (int) get_theme_mod( 'custom_logo' );
		$site_icon_id     = (int) get_option( 'site_icon' );

		if ( $custom_logo_id > 0 ) {
			$logo_placeholder   = (string) $custom_logo_id;
			$logo_fallback_note = sprintf(
				/* translators: %d attachment ID of the theme's custom logo */
				__( 'Leave blank to use the theme\'s custom logo (attachment #%d).', 'tbc-woo-donations' ),
				$custom_logo_id
			);
		} elseif ( $site_icon_id > 0 ) {
			$logo_placeholder   = (string) $site_icon_id;
			$logo_fallback_note = sprintf(
				/* translators: %d attachment ID of the site icon */
				__( 'Leave blank to use your Site Icon (attachment #%d from Settings > General).', 'tbc-woo-donations' ),
				$site_icon_id
			);
		} else {
			$logo_fallback_note = __( 'Enter a Media Library attachment ID to show a logo on the statement. Leave blank to hide (no theme custom logo or site icon is currently set).', 'tbc-woo-donations' );
		}

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
			[
				'title' => __( 'Donor Statement', 'tbc-woo-donations' ),
				'type'  => 'title',
				'desc'  => __( 'Branding and rules for the year-end giving statement shown to donors via the [tbc_donor_dashboard] shortcode.', 'tbc-woo-donations' ),
				'id'    => 'tbc_don_statement_options',
			],
			[
				'title'       => __( 'Organization Name', 'tbc-woo-donations' ),
				'desc'        => __( 'Shown at the top of the statement. Leave blank to use your WordPress site title.', 'tbc-woo-donations' ),
				'id'          => 'tbc_don_statement_org_name',
				'type'        => 'text',
				'default'     => '',
				'placeholder' => $site_name_fallback,
				'css'         => 'min-width: 300px;',
				'desc_tip'    => true,
			],
			[
				'title'       => __( 'Tax ID / EIN', 'tbc-woo-donations' ),
				'desc'        => __( 'Printed in the statement footer. Leave blank to hide this line entirely.', 'tbc-woo-donations' ),
				'id'          => 'tbc_don_statement_tax_id',
				'type'        => 'text',
				'default'     => '',
				'placeholder' => __( 'e.g. 12-3456789 (leave blank to hide)', 'tbc-woo-donations' ),
				'css'         => 'min-width: 300px;',
				'desc_tip'    => true,
			],
			[
				'title'       => __( 'Statement Footer Text', 'tbc-woo-donations' ),
				'desc'        => __( 'Optional thank-you or disclaimer text. Basic HTML allowed. Leave blank to hide.', 'tbc-woo-donations' ),
				'id'          => 'tbc_don_statement_footer',
				'type'        => 'textarea',
				'default'     => '',
				'placeholder' => __( 'Thank you for your generous support this year… (leave blank to hide)', 'tbc-woo-donations' ),
				'css'         => 'min-width: 400px; min-height: 80px;',
				'desc_tip'    => true,
			],
			[
				'title'       => __( 'Statement Logo (Attachment ID)', 'tbc-woo-donations' ),
				'desc'        => $logo_fallback_note,
				'id'          => 'tbc_don_statement_logo_id',
				'type'        => 'number',
				'default'     => '',
				'placeholder' => $logo_placeholder,
				'css'         => 'width: 120px;',
				'desc_tip'    => true,
			],
			[
				'title'    => __( 'Tax-Deductible Category Slug', 'tbc-woo-donations' ),
				'desc'     => __( 'Product category slug whose products count as tax-deductible on the statement. Individual products can override this in the Donations tab.', 'tbc-woo-donations' ),
				'id'       => 'tbc_don_deductible_category',
				'type'     => 'text',
				'default'  => 'donation',
				'css'      => 'min-width: 200px;',
				'desc_tip' => true,
			],
			[
				'type' => 'sectionend',
				'id'   => 'tbc_don_statement_options',
			],
		] );
	}
}
