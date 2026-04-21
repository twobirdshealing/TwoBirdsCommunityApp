<?php
/**
 * Yearly donor statement — self-contained HTML page donors print or save as PDF.
 *
 * @package TBC\WooDonations\Reports
 */

declare(strict_types=1);

namespace TBC\WooDonations\Reports;

use WP_User;

defined( 'ABSPATH' ) || exit;

final class StatementView {

	/**
	 * Render the full HTML statement page and exit.
	 *
	 * @param array<string, mixed> $data  Output of StatementData::get_yearly_statement().
	 */
	public static function render( array $data, WP_User $user ): void {
		$branding = self::get_branding();
		$year     = (int) $data['year'];

		$org_name    = $branding['org_name'];
		$org_tax_id  = $branding['tax_id'];
		$org_footer  = $branding['footer'];
		$org_logo    = $branding['logo_url'];
		$donor_name  = trim( $user->first_name . ' ' . $user->last_name ) ?: $user->display_name;
		$donor_email = $user->user_email;

		$title = sprintf(
			/* translators: 1: year, 2: organization name */
			__( '%1$d Giving Statement — %2$s', 'tbc-woo-donations' ),
			$year,
			$org_name
		);

		// Force a minimal template — no theme chrome.
		nocache_headers();
		header( 'Content-Type: text/html; charset=utf-8' );

		?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="robots" content="noindex, nofollow">
	<title><?php echo esc_html( $title ); ?></title>
	<style><?php echo self::inline_styles(); ?></style>
</head>
<body>

<div class="tbc-stmt-toolbar no-print">
	<button type="button" onclick="window.print()" class="tbc-stmt-print-btn">
		<?php esc_html_e( 'Print / Save as PDF', 'tbc-woo-donations' ); ?>
	</button>
	<a href="<?php echo esc_url( wp_get_referer() ?: home_url() ); ?>" class="tbc-stmt-back-link">
		<?php esc_html_e( 'Back', 'tbc-woo-donations' ); ?>
	</a>
</div>

<main class="tbc-stmt">

	<header class="tbc-stmt-header">
		<?php if ( $org_logo ) : ?>
			<img class="tbc-stmt-logo" src="<?php echo esc_url( $org_logo ); ?>" alt="<?php echo esc_attr( $org_name ); ?>">
		<?php endif; ?>
		<h1 class="tbc-stmt-org"><?php echo esc_html( $org_name ); ?></h1>
		<p class="tbc-stmt-title">
			<?php
			printf(
				/* translators: %d year */
				esc_html__( '%d Giving Statement', 'tbc-woo-donations' ),
				$year
			);
			?>
		</p>
	</header>

	<section class="tbc-stmt-donor">
		<div>
			<span class="tbc-stmt-label"><?php esc_html_e( 'Issued to', 'tbc-woo-donations' ); ?></span>
			<span class="tbc-stmt-value"><?php echo esc_html( $donor_name ); ?></span>
			<span class="tbc-stmt-meta"><?php echo esc_html( $donor_email ); ?></span>
		</div>
		<div>
			<span class="tbc-stmt-label"><?php esc_html_e( 'Statement period', 'tbc-woo-donations' ); ?></span>
			<span class="tbc-stmt-value">
				<?php
				printf(
					/* translators: %d year */
					esc_html__( 'January 1 – December 31, %d', 'tbc-woo-donations' ),
					$year
				);
				?>
			</span>
			<span class="tbc-stmt-meta">
				<?php
				printf(
					/* translators: %s date generated */
					esc_html__( 'Issued %s', 'tbc-woo-donations' ),
					esc_html( wp_date( get_option( 'date_format' ) ) )
				);
				?>
			</span>
		</div>
	</section>

	<section class="tbc-stmt-summary">
		<div class="tbc-stmt-summary-item">
			<span class="tbc-stmt-summary-label"><?php esc_html_e( 'Total given', 'tbc-woo-donations' ); ?></span>
			<span class="tbc-stmt-summary-amount"><?php echo wp_kses_post( wc_price( $data['total_given'] ) ); ?></span>
		</div>
		<div class="tbc-stmt-summary-item is-highlight">
			<span class="tbc-stmt-summary-label"><?php esc_html_e( 'Tax-deductible portion', 'tbc-woo-donations' ); ?></span>
			<span class="tbc-stmt-summary-amount"><?php echo wp_kses_post( wc_price( $data['deductible']['total'] ) ); ?></span>
		</div>
	</section>

	<?php self::render_section(
		__( 'Tax-Deductible Contributions', 'tbc-woo-donations' ),
		__( 'For IRS purposes — no goods or services were received in exchange for these contributions.', 'tbc-woo-donations' ),
		$data['deductible']
	); ?>

	<?php self::render_section(
		__( 'Other Payments', 'tbc-woo-donations' ),
		__( 'Goods or services were received in exchange for these payments (events, retreats, courses, etc.) and are not tax-deductible.', 'tbc-woo-donations' ),
		$data['non_deductible']
	); ?>

	<footer class="tbc-stmt-footer">
		<p class="tbc-stmt-footer-org"><?php echo esc_html( $org_name ); ?></p>
		<?php if ( $org_tax_id ) : ?>
			<p class="tbc-stmt-footer-tax">
				<?php
				printf(
					/* translators: %s tax ID / EIN */
					esc_html__( 'Tax ID: %s', 'tbc-woo-donations' ),
					esc_html( $org_tax_id )
				);
				?>
			</p>
		<?php endif; ?>
		<?php if ( $org_footer ) : ?>
			<div class="tbc-stmt-footer-note"><?php echo wp_kses_post( wpautop( $org_footer ) ); ?></div>
		<?php endif; ?>
		<p class="tbc-stmt-footer-note">
			<?php esc_html_e( 'Please retain this statement for your tax records.', 'tbc-woo-donations' ); ?>
		</p>
	</footer>

</main>

</body>
</html>
		<?php
		exit;
	}

	/**
	 * Render a section (Tax-Deductible or Other Payments).
	 *
	 * @param array{rows: array<int, array<string, mixed>>, total: float, count: int} $section
	 */
	private static function render_section( string $heading, string $note, array $section ): void {
		?>
		<section class="tbc-stmt-section">
			<h2 class="tbc-stmt-section-heading"><?php echo esc_html( $heading ); ?></h2>
			<p class="tbc-stmt-section-note"><?php echo esc_html( $note ); ?></p>

			<?php if ( empty( $section['rows'] ) ) : ?>
				<p class="tbc-stmt-empty"><?php esc_html_e( 'None during this period.', 'tbc-woo-donations' ); ?></p>
			<?php else : ?>
				<table class="tbc-stmt-table">
					<thead>
						<tr>
							<th><?php esc_html_e( 'Date', 'tbc-woo-donations' ); ?></th>
							<th><?php esc_html_e( 'Order', 'tbc-woo-donations' ); ?></th>
							<th><?php esc_html_e( 'Description', 'tbc-woo-donations' ); ?></th>
							<th class="tbc-stmt-amount-col"><?php esc_html_e( 'Amount', 'tbc-woo-donations' ); ?></th>
						</tr>
					</thead>
					<tbody>
						<?php foreach ( $section['rows'] as $row ) : ?>
							<tr>
								<td><?php echo esc_html( (string) $row['date'] ); ?></td>
								<td>#<?php echo esc_html( (string) $row['order_id'] ); ?></td>
								<td><?php echo esc_html( (string) $row['description'] ); ?></td>
								<td class="tbc-stmt-amount-col"><?php echo wp_kses_post( wc_price( (float) $row['amount'] ) ); ?></td>
							</tr>
						<?php endforeach; ?>
					</tbody>
					<tfoot>
						<tr>
							<td colspan="3"><?php esc_html_e( 'Section total', 'tbc-woo-donations' ); ?></td>
							<td class="tbc-stmt-amount-col"><?php echo wp_kses_post( wc_price( $section['total'] ) ); ?></td>
						</tr>
					</tfoot>
				</table>
			<?php endif; ?>
		</section>
		<?php
	}

	/**
	 * Resolve branding settings with sensible fallbacks.
	 *
	 * @return array{org_name: string, tax_id: string, footer: string, logo_url: string}
	 */
	private static function get_branding(): array {
		return [
			'org_name' => (string) ( get_option( 'tbc_don_statement_org_name' ) ?: get_bloginfo( 'name' ) ),
			'tax_id'   => (string) get_option( 'tbc_don_statement_tax_id', '' ),
			'footer'   => (string) get_option( 'tbc_don_statement_footer', '' ),
			'logo_url' => self::resolve_logo_url(),
		];
	}

	private static function resolve_logo_url(): string {
		$attachment_id = (int) get_option( 'tbc_don_statement_logo_id', 0 );
		if ( $attachment_id > 0 ) {
			$src = wp_get_attachment_image_url( $attachment_id, 'medium' );
			if ( $src ) {
				return $src;
			}
		}

		$custom_logo_id = (int) get_theme_mod( 'custom_logo' );
		if ( $custom_logo_id > 0 ) {
			$src = wp_get_attachment_image_url( $custom_logo_id, 'medium' );
			if ( $src ) {
				return $src;
			}
		}

		return (string) get_site_icon_url( 180 );
	}

	/**
	 * Inline print-friendly styles. Kept in PHP so the statement page is self-contained.
	 */
	private static function inline_styles(): string {
		return '
			* { box-sizing: border-box; }
			body {
				font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
				color: #1a1a1a;
				background: #f5f5f5;
				margin: 0;
				padding: 24px 16px;
				-webkit-print-color-adjust: exact;
				print-color-adjust: exact;
			}
			.tbc-stmt-toolbar {
				max-width: 780px;
				margin: 0 auto 16px;
				display: flex;
				justify-content: space-between;
				align-items: center;
			}
			.tbc-stmt-print-btn {
				background: #2271b1;
				color: #fff;
				border: 0;
				padding: 10px 18px;
				font-size: 15px;
				border-radius: 6px;
				cursor: pointer;
				font-weight: 600;
			}
			.tbc-stmt-print-btn:hover { filter: brightness(1.08); }
			.tbc-stmt-back-link { color: #2271b1; text-decoration: none; font-size: 14px; }
			.tbc-stmt-back-link:hover { text-decoration: underline; }
			.tbc-stmt {
				max-width: 780px;
				margin: 0 auto;
				background: #fff;
				padding: 48px 56px;
				box-shadow: 0 1px 3px rgba(0,0,0,0.08);
				border-radius: 4px;
			}
			.tbc-stmt-header { text-align: center; border-bottom: 2px solid #1a1a1a; padding-bottom: 18px; margin-bottom: 24px; }
			.tbc-stmt-logo { max-height: 72px; width: auto; margin-bottom: 12px; }
			.tbc-stmt-org { font-size: 22px; margin: 0 0 4px; font-weight: 700; }
			.tbc-stmt-title { font-size: 15px; margin: 0; color: #555; letter-spacing: 0.5px; text-transform: uppercase; }
			.tbc-stmt-donor {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 24px;
				margin-bottom: 24px;
			}
			.tbc-stmt-donor > div { display: flex; flex-direction: column; }
			.tbc-stmt-donor > div:last-child { text-align: right; }
			.tbc-stmt-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #777; }
			.tbc-stmt-value { font-size: 16px; font-weight: 600; margin-top: 2px; }
			.tbc-stmt-meta { font-size: 13px; color: #555; margin-top: 2px; }
			.tbc-stmt-summary {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 12px;
				margin-bottom: 28px;
			}
			.tbc-stmt-summary-item {
				border: 1px solid #e3e3e3;
				border-radius: 6px;
				padding: 14px 16px;
				display: flex;
				flex-direction: column;
				gap: 4px;
			}
			.tbc-stmt-summary-item.is-highlight { background: #fef9e7; border-color: #f0dc87; }
			.tbc-stmt-summary-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; }
			.tbc-stmt-summary-amount { font-size: 20px; font-weight: 700; }
			.tbc-stmt-section { margin-bottom: 28px; page-break-inside: avoid; }
			.tbc-stmt-section-heading { font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #1a1a1a; padding-bottom: 6px; margin: 0 0 6px; }
			.tbc-stmt-section-note { font-size: 12px; color: #666; margin: 0 0 10px; font-style: italic; }
			.tbc-stmt-empty { font-size: 13px; color: #888; padding: 8px 0; }
			.tbc-stmt-table { width: 100%; border-collapse: collapse; font-size: 13px; }
			.tbc-stmt-table thead th { text-align: left; font-weight: 600; border-bottom: 1px solid #ccc; padding: 6px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; color: #555; }
			.tbc-stmt-table tbody td { padding: 6px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
			.tbc-stmt-table tfoot td { padding: 8px; border-top: 2px solid #1a1a1a; font-weight: 700; }
			.tbc-stmt-amount-col { text-align: right; white-space: nowrap; }
			.tbc-stmt-footer { border-top: 1px solid #e3e3e3; padding-top: 18px; margin-top: 24px; text-align: center; font-size: 12px; color: #555; }
			.tbc-stmt-footer-org { font-weight: 700; color: #1a1a1a; margin: 0 0 4px; }
			.tbc-stmt-footer-tax { margin: 0 0 8px; }
			.tbc-stmt-footer-note { margin: 4px 0; }
			@media print {
				body { background: #fff; padding: 0; }
				.no-print { display: none !important; }
				.tbc-stmt { box-shadow: none; padding: 24px; max-width: none; }
			}
			@media (max-width: 600px) {
				.tbc-stmt { padding: 24px 16px; }
				.tbc-stmt-donor, .tbc-stmt-summary { grid-template-columns: 1fr; }
				.tbc-stmt-donor > div:last-child { text-align: left; }
			}
		';
	}
}
