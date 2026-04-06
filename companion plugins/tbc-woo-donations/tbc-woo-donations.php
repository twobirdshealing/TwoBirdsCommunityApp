<?php
/**
 * Plugin Name: TBC WooCommerce Donations
 * Plugin URI:  https://twobirdscode.com/
 * Description: Complete donation product system for WooCommerce — name-your-price, suggested amounts, deposits, fee recovery, donor wall, and more.
 * Version:     1.5.5
 * Author:      Two Birds Code
 * Author URI:  https://twobirdscode.com/
 *
 * Requires at least: 6.4.0
 * Tested up to: 6.8.0
 *
 * WC requires at least: 9.0.0
 * WC tested up to: 10.6.0
 *
 * Requires PHP: 8.0
 * Requires Plugins: woocommerce
 *
 * Text Domain: tbc-woo-donations
 * Domain Path: /languages/
 *
 * License: GNU General Public License v3.0
 * License URI: http://www.gnu.org/licenses/gpl-3.0.html
 *
 * @package TBC\WooDonations
 */

declare(strict_types=1);

defined( 'ABSPATH' ) || exit;

// Plugin constants.
define( 'TBC_DON_VERSION', '1.5.5' );
define( 'TBC_DON_PLUGIN_FILE', __FILE__ );
define( 'TBC_DON_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'TBC_DON_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

/**
 * PSR-4 Autoloader: TBC\WooDonations\ => src/
 */
spl_autoload_register( static function ( string $class ): void {

	$prefix = 'TBC\\WooDonations\\';

	if ( ! str_starts_with( $class, $prefix ) ) {
		return;
	}

	$relative = substr( $class, strlen( $prefix ) );
	$file     = TBC_DON_PLUGIN_DIR . 'src/' . str_replace( '\\', '/', $relative ) . '.php';

	if ( file_exists( $file ) ) {
		require_once $file;
	}
} );

/**
 * Declare HPOS and Cart/Checkout Blocks compatibility.
 */
add_action( 'before_woocommerce_init', static function (): void {
	if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
		\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
		\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'cart_checkout_blocks', __FILE__, true );
	}
} );

/**
 * Initialize the plugin after WooCommerce is ready.
 */
add_action( 'woocommerce_init', static function (): void {

	// Minimum WC version check.
	if ( version_compare( WC_VERSION, '9.0.0', '<' ) ) {
		add_action( 'admin_notices', static function (): void {
			echo '<div class="notice notice-error"><p>';
			echo wp_kses_post(
				sprintf(
					/* translators: %s minimum WooCommerce version */
					__( '<strong>TBC WooCommerce Donations</strong> requires WooCommerce %s or later.', 'tbc-woo-donations' ),
					'9.0.0'
				)
			);
			echo '</p></div>';
		} );
		return;
	}

	// Conflict detection — warn if old plugins are still active.
	$conflicts = [];
	if ( class_exists( 'WC_Name_Your_Price' ) ) {
		$conflicts[] = 'WooCommerce Name Your Price';
	}
	if ( class_exists( 'WC_NYP_Suggested_Amounts' ) ) {
		$conflicts[] = 'NYP Suggested Amounts';
	}
	if ( defined( 'CUSTOM_DONATION_ADDONS_VERSION' ) ) {
		$conflicts[] = 'TBC Custom Donation Addons';
	}

	if ( ! empty( $conflicts ) ) {
		add_action( 'admin_notices', static function () use ( $conflicts ): void {
			echo '<div class="notice notice-error"><p>';
			echo wp_kses_post(
				sprintf(
					/* translators: %s comma-separated list of conflicting plugin names */
					__( '<strong>TBC WooCommerce Donations:</strong> Please deactivate the following plugins — their functionality is now included: %s', 'tbc-woo-donations' ),
					implode( ', ', $conflicts )
				)
			);
			echo '</p></div>';
		} );
		return;
	}

	// Boot the plugin.
	\TBC\WooDonations\Plugin::instance();

}, 5 );

// One-time cleanup tool — load if it exists, delete after use.
if ( is_admin() && file_exists( TBC_DON_PLUGIN_DIR . 'tbc-don-cleanup.php' ) ) {
	require_once TBC_DON_PLUGIN_DIR . 'tbc-don-cleanup.php';
}
