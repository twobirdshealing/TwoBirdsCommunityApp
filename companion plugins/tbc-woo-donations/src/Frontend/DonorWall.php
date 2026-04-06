<?php
/**
 * Donor Wall product tab — displays donors grouped by month with privacy-respecting names.
 *
 * Modernized from tbc-donation-addons/includes/donor-wall.php:
 * - Uses wc_get_orders() (HPOS-safe) instead of WC_Order_Query + in-memory filter.
 * - Uses $order->get_meta() / $product->get_meta() instead of get_post_meta().
 * - Typed PHP 8.0+ code.
 *
 * @package TBC\WooDonations\Frontend
 */

declare(strict_types=1);

namespace TBC\WooDonations\Frontend;

use TBC\WooDonations\Helpers;
use TBC\WooDonations\Plugin;
use WC_Product;
use WC_Order;
use DateTime;

defined( 'ABSPATH' ) || exit;

final class DonorWall {

	private static ?self $instance = null;

	public static function instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_filter( 'woocommerce_product_tabs', [ $this, 'add_tab' ] );
	}

	/**
	 * Add "Donor Wall" product tab if enabled.
	 *
	 * @param array<string, mixed> $tabs
	 * @return array<string, mixed>
	 */
	public function add_tab( array $tabs ): array {
		global $product;

		if ( ! $product instanceof WC_Product || ! Helpers::is_donor_wall_enabled( $product ) ) {
			return $tabs;
		}

		$tabs['tbc_don_donor_wall'] = [
			'title'    => __( 'Donor Wall', 'tbc-woo-donations' ),
			'priority' => 50,
			'callback' => [ $this, 'render' ],
		];

		return $tabs;
	}

	/**
	 * Render the donor wall tab content.
	 */
	public function render(): void {
		global $product;

		if ( ! $product instanceof WC_Product || ! Helpers::is_donor_wall_enabled( $product ) ) {
			return;
		}

		// Enqueue donor wall assets.
		wp_enqueue_style(
			'tbc-woo-donations-donor-wall',
			TBC_DON_PLUGIN_URL . 'assets/css/donor-wall.css',
			[],
			Plugin::instance()->asset_version( TBC_DON_PLUGIN_DIR . 'assets/css/donor-wall.css' )
		);
		wp_enqueue_script(
			'tbc-woo-donations-donor-wall',
			TBC_DON_PLUGIN_URL . 'assets/js/donor-wall.js',
			[],
			Plugin::instance()->asset_version( TBC_DON_PLUGIN_DIR . 'assets/js/donor-wall.js' ),
			true
		);

		$orders = $this->get_orders_for_product( $product->get_id() );

		if ( empty( $orders ) ) {
			echo '<p>' . esc_html__( 'No donors found.', 'tbc-woo-donations' ) . '</p>';
			return;
		}

		$donors = $this->group_donors_by_month( $orders, $product->get_id() );
		krsort( $donors );

		// Render tab buttons.
		echo '<div class="tbc-don-donor-tabs">';
		$index = 0;
		foreach ( array_keys( $donors ) as $key ) {
			$date  = DateTime::createFromFormat( 'Y-m', $key );
			$label = $date ? $date->format( 'F Y' ) : $key;
			printf(
				'<button class="tbc-don-donor-tab %s" data-tab="%d" data-key="%s">%s</button>',
				0 === $index ? 'active' : '',
				$index,
				esc_attr( $key ),
				esc_html( $label )
			);
			$index++;
		}
		echo '</div>';

		echo '<div class="tbc-don-donor-content"><div class="tbc-don-donor-grid"></div></div>';
		echo '<script>window.tbcDonDonorsData = ' . wp_json_encode( $donors, JSON_HEX_TAG | JSON_HEX_AMP ) . ';</script>';
	}

	// -------------------------------------------------------------------------
	// Order Querying (HPOS-safe)
	// -------------------------------------------------------------------------

	/**
	 * Get orders containing a specific product — uses wc_get_orders() for HPOS compat.
	 *
	 * @return WC_Order[]
	 */
	private function get_orders_for_product( int $product_id ): array {

		$orders = wc_get_orders( [
			'limit'        => -1,
			'status'       => [ 'wc-completed', 'wc-processing' ],
			'type'         => 'shop_order',
			'date_created' => '>' . gmdate( 'Y-01-01' ),
		] );

		return array_filter( $orders, static function ( WC_Order $order ) use ( $product_id ): bool {
			foreach ( $order->get_items() as $item ) {
				if ( $item->get_product_id() === $product_id ) {
					return true;
				}
			}
			return false;
		} );
	}

	/**
	 * Group donors by month from orders.
	 *
	 * @param WC_Order[] $orders
	 * @return array<string, array<int, array<string, mixed>>>
	 */
	private function group_donors_by_month( array $orders, int $product_id ): array {
		$donors = [];

		foreach ( $orders as $order ) {
			if ( ! $order instanceof WC_Order || $order->get_total() <= 0 ) {
				continue;
			}

			$user_id  = $order->get_customer_id();
			$date_key = $order->get_date_created()?->format( 'Y-m' ) ?? '';

			if ( ! $date_key ) {
				continue;
			}

			$donors[ $date_key ][] = [
				'name'            => $this->get_donor_display_name( $user_id, $order ),
				'donation_date'   => $order->get_date_created()->format( 'F jS, Y' ),
				'avatar'          => get_avatar( $user_id, 64 ),
				'profile_link'    => $this->get_buddyboss_profile_link( $user_id ),
				'is_subscription' => function_exists( 'wcs_order_contains_subscription' ) && wcs_order_contains_subscription( $order ),
				'is_renewal'      => function_exists( 'wcs_order_contains_renewal' ) && wcs_order_contains_renewal( $order ),
			];
		}

		return $donors;
	}

	// -------------------------------------------------------------------------
	// Privacy-Respecting Name Display
	// -------------------------------------------------------------------------

	/**
	 * Get donor display name respecting BuddyBoss privacy settings.
	 */
	private function get_donor_display_name( int $user_id, WC_Order $order ): string {

		// Guest checkout.
		if ( ! $user_id ) {
			$first = $order->get_billing_first_name();
			$last  = $order->get_billing_last_name();
			return trim( "$first $last" ) ?: __( 'Anonymous Donor', 'tbc-woo-donations' );
		}

		// No BuddyBoss — use WP display name.
		if ( ! function_exists( 'bp_is_active' ) || ! bp_is_active( 'xprofile' ) ) {
			$user = get_userdata( $user_id );
			if ( $user && $user->display_name ) {
				return $user->display_name;
			}
			$first = $order->get_billing_first_name();
			$last  = $order->get_billing_last_name();
			return trim( "$first $last" ) ?: __( 'Anonymous Donor', 'tbc-woo-donations' );
		}

		// BuddyBoss xProfile fields.
		$first_name = (string) xprofile_get_field_data( 1, $user_id );
		$last_name  = (string) xprofile_get_field_data( 2, $user_id );

		if ( ! $first_name && ! $last_name ) {
			$user = get_userdata( $user_id );
			return $user ? $user->display_name : __( 'Anonymous Donor', 'tbc-woo-donations' );
		}

		if ( ! $last_name ) {
			return $first_name;
		}

		// Check last name visibility.
		$visibility     = (string) xprofile_get_field_visibility_level( 2, $user_id );
		$viewer_id      = get_current_user_id();
		$show_last_name = match ( $visibility ) {
			'public'     => true,
			'loggedin'   => is_user_logged_in(),
			'friends'    => function_exists( 'friends_check_friendship' ) && $viewer_id && friends_check_friendship( $viewer_id, $user_id ),
			'adminsonly'  => $viewer_id === $user_id || user_can( $viewer_id, 'manage_options' ),
			default      => false,
		};

		return $show_last_name ? trim( "$first_name $last_name" ) : $first_name;
	}

	/**
	 * Get BuddyBoss profile URL.
	 */
	private function get_buddyboss_profile_link( int $user_id ): string {
		if ( ! $user_id || ! function_exists( 'bp_core_get_user_domain' ) ) {
			return '';
		}
		return (string) bp_core_get_user_domain( $user_id );
	}
}
