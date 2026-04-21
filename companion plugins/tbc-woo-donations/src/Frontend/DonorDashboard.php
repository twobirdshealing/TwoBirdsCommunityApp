<?php
/**
 * Donor dashboard — [tbc_donor_dashboard] shortcode + yearly statement print view.
 *
 * @package TBC\WooDonations\Frontend
 */

declare(strict_types=1);

namespace TBC\WooDonations\Frontend;

use TBC\WooDonations\Plugin;
use TBC\WooDonations\Reports\StatementData;
use TBC\WooDonations\Reports\StatementView;

defined( 'ABSPATH' ) || exit;

final class DonorDashboard {

	private const STATEMENT_QUERY_VAR = 'tbc_don_statement';
	private const YEAR_QUERY_VAR      = 'tbc_stmt_year';

	private static ?self $instance = null;

	public static function instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_shortcode( 'tbc_donor_dashboard', [ $this, 'render_shortcode' ] );
		add_shortcode( 'donor_dashboard', [ $this, 'render_shortcode' ] );
		add_action( 'template_redirect', [ $this, 'maybe_render_statement' ] );
	}

	/**
	 * Render the donor dashboard summary + statement download form.
	 *
	 * @param array<string, string>|string $atts
	 */
	public function render_shortcode( array|string $atts = [] ): string {
		if ( ! is_user_logged_in() ) {
			return '<p class="tbc-don-dashboard-error">'
				. esc_html__( 'Please log in to view your Donor Dashboard.', 'tbc-woo-donations' )
				. '</p>';
		}

		$user_id = get_current_user_id();
		$user    = wp_get_current_user();

		$years       = StatementData::get_donor_years( $user_id );
		$current     = (int) gmdate( 'Y' );
		$total_spent = (float) wc_get_customer_total_spent( $user_id );
		$order_count = (int) wc_get_customer_order_count( $user_id );
		$average     = $order_count > 0 ? $total_spent / $order_count : 0.0;
		$last_order  = wc_get_customer_last_order( $user_id );
		$last_date   = $last_order ? wc_format_datetime( $last_order->get_date_created() ) : '';

		$statement_url = add_query_arg(
			[ self::STATEMENT_QUERY_VAR => 1 ],
			home_url( '/' )
		);

		ob_start();
		?>
		<div class="tbc-don-dashboard">
			<h2 class="tbc-don-dashboard-welcome">
				<?php
				printf(
					/* translators: %s donor display name */
					esc_html__( 'Welcome to your Donor Dashboard, %s!', 'tbc-woo-donations' ),
					esc_html( $user->display_name )
				);
				?>
			</h2>

			<ul class="tbc-don-dashboard-summary">
				<li>
					<strong><?php esc_html_e( 'Lifetime donations:', 'tbc-woo-donations' ); ?></strong>
					<span><?php echo wp_kses_post( wc_price( $total_spent ) ); ?></span>
				</li>
				<?php if ( $average > 0 ) : ?>
					<li>
						<strong><?php esc_html_e( 'Average donation:', 'tbc-woo-donations' ); ?></strong>
						<span><?php echo wp_kses_post( wc_price( $average ) ); ?></span>
					</li>
				<?php endif; ?>
				<?php if ( $last_date ) : ?>
					<li>
						<strong><?php esc_html_e( 'Last donation:', 'tbc-woo-donations' ); ?></strong>
						<span><?php echo esc_html( $last_date ); ?></span>
					</li>
				<?php endif; ?>
				<li class="tbc-don-dashboard-report">
					<strong><?php esc_html_e( 'Yearly statement:', 'tbc-woo-donations' ); ?></strong>
					<form method="get" action="<?php echo esc_url( $statement_url ); ?>" target="_blank" rel="noopener" class="tbc-don-dashboard-form">
						<input type="hidden" name="<?php echo esc_attr( self::STATEMENT_QUERY_VAR ); ?>" value="1">
						<select name="<?php echo esc_attr( self::YEAR_QUERY_VAR ); ?>" class="tbc-don-dashboard-year">
							<?php foreach ( $years as $year ) : ?>
								<option value="<?php echo esc_attr( (string) $year ); ?>" <?php selected( $year, $current ); ?>>
									<?php echo esc_html( (string) $year ); ?>
								</option>
							<?php endforeach; ?>
						</select>
						<button type="submit" class="tbc-don-dashboard-btn">
							<?php esc_html_e( 'View', 'tbc-woo-donations' ); ?>
						</button>
					</form>
				</li>
			</ul>
		</div>
		<?php

		$this->enqueue_styles();

		return (string) ob_get_clean();
	}

	/**
	 * Intercept ?tbc_don_statement=1&year=YYYY and render the statement page.
	 */
	public function maybe_render_statement(): void {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( empty( $_GET[ self::STATEMENT_QUERY_VAR ] ) ) {
			return;
		}

		if ( ! is_user_logged_in() ) {
			auth_redirect();
			exit;
		}

		$user    = wp_get_current_user();
		$user_id = (int) $user->ID;

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$year = isset( $_GET[ self::YEAR_QUERY_VAR ] ) ? (int) $_GET[ self::YEAR_QUERY_VAR ] : (int) gmdate( 'Y' );

		// Clamp to a sensible range (prevent absurd values).
		$this_year = (int) gmdate( 'Y' );
		if ( $year < 1990 || $year > $this_year + 1 ) {
			$year = $this_year;
		}

		$data = StatementData::get_yearly_statement( $user_id, $year );

		StatementView::render( $data, $user );
	}

	/**
	 * Register + enqueue the shared frontend stylesheet when the shortcode renders.
	 */
	private function enqueue_styles(): void {
		if ( ! wp_style_is( 'tbc-woo-donations', 'registered' ) ) {
			wp_register_style(
				'tbc-woo-donations',
				TBC_DON_PLUGIN_URL . 'assets/css/frontend.css',
				[],
				Plugin::instance()->asset_version( TBC_DON_PLUGIN_DIR . 'assets/css/frontend.css' )
			);
		}
		wp_enqueue_style( 'tbc-woo-donations' );
	}
}
