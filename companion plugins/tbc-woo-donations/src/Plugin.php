<?php
/**
 * Main plugin class — singleton entry point.
 *
 * @package TBC\WooDonations
 */

declare(strict_types=1);

namespace TBC\WooDonations;

defined( 'ABSPATH' ) || exit;

final class Plugin {

	private static ?self $instance = null;

	public static function instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		$this->init_hooks();
		do_action( 'tbc_don_loaded' );
	}

	public function __clone() {
		_doing_it_wrong( __FUNCTION__, 'Cloning is forbidden.', '1.0.0' );
	}

	public function __wakeup(): void {
		_doing_it_wrong( __FUNCTION__, 'Unserializing is forbidden.', '1.0.0' );
	}

	/**
	 * Register all hooks.
	 */
	private function init_hooks(): void {

		// Text domain.
		add_action( 'init', [ $this, 'load_textdomain' ] );

		// Product query support: wc_get_products( [ 'tbc-donation' => true ] ).
		add_filter( 'woocommerce_get_wp_query_args', [ $this, 'query_args' ], 10, 2 );

		// Frontend.
		Frontend\PriceInput::instance();
		Frontend\CartHandler::instance();
		Frontend\SuggestedAmounts::instance();
		Frontend\DonationFeatures::instance();
		Frontend\DonorWall::instance();

		// Compatibility modules (loaded conditionally).
		$this->load_compat_modules();

		// API.
		API\RestAPI::init();
		API\StoreAPI::init();

		// Admin (conditional).
		if ( is_admin() ) {
			Admin\ProductSettings::init();
			Admin\PluginSettings::init();
		}
	}

	/**
	 * Load compatibility modules based on active plugins.
	 */
	private function load_compat_modules(): void {

		// Variable products — always loaded.
		Compat\VariableProducts::init();

		// WC Subscriptions.
		if ( class_exists( 'WC_Subscriptions' ) ) {
			Compat\Subscriptions::init();
		}

		// Braintree for WooCommerce.
		if ( class_exists( 'WC_PayPal_Braintree_Loader' ) || class_exists( '\WC_Braintree' ) ) {
			Compat\Braintree::init();
		}

		// WC Blocks.
		if ( class_exists( '\Automattic\WooCommerce\Blocks\Package' ) ) {
			Compat\Blocks::init();
		}

		/**
		 * Filter the compatibility modules to load.
		 *
		 * @param array $modules Associative array of module class names => loaded boolean.
		 */
		do_action( 'tbc_don_compatibility_modules' );
	}

	/**
	 * Load plugin text domain.
	 */
	public function load_textdomain(): void {
		load_plugin_textdomain( 'tbc-woo-donations', false, dirname( plugin_basename( TBC_DON_PLUGIN_FILE ) ) . '/languages' );
	}

	/**
	 * Support querying donation products via wc_get_products().
	 *
	 * Usage: wc_get_products( [ 'tbc-donation' => true ] )
	 *
	 * @param array<string, mixed> $query      WP_Query args.
	 * @param array<string, mixed> $query_vars WC_Product_Query vars.
	 * @return array<string, mixed>
	 */
	public function query_args( array $query, array $query_vars ): array {

		if ( ! empty( $query_vars['tbc-donation'] ) ) {
			$query['meta_query'][] = [
				'relation' => 'OR',
				[
					'key'     => '_tbc_don_enabled',
					'value'   => 'yes',
					'compare' => '=',
				],
				[
					'key'     => '_tbc_don_has_variations',
					'value'   => 'yes',
					'compare' => '=',
				],
			];
		}

		return $query;
	}

	// -------------------------------------------------------------------------
	// Path helpers.
	// -------------------------------------------------------------------------

	public function plugin_url(): string {
		return untrailingslashit( TBC_DON_PLUGIN_URL );
	}

	public function plugin_path(): string {
		return untrailingslashit( TBC_DON_PLUGIN_DIR );
	}

	/**
	 * Cache-busting version for assets.
	 */
	public function asset_version( string $file = '' ): string {
		if ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG && $file && file_exists( $file ) ) {
			return (string) filemtime( $file );
		}
		return TBC_DON_VERSION;
	}
}
