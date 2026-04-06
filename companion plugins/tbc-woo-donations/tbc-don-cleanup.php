<?php
/**
 * TBC WooCommerce Donations — Old Plugin Cleanup Tool
 *
 * Removes all leftover meta keys and options from the 3 old plugins:
 *   - WooCommerce Name Your Price
 *   - TBC NYP Suggested Amounts
 *   - TBC Custom Donation Addons
 *
 * USAGE:
 *   1. Upload this file to wp-content/plugins/tbc-woo-donations/
 *   2. Visit: yoursite.com/wp-admin/admin.php?page=tbc-don-cleanup
 *   3. Review what will be deleted, click "Run Cleanup"
 *   4. Delete this file when done
 *
 * This is a one-time tool — delete it after use.
 */

defined( 'ABSPATH' ) || exit;

// Register the admin page.
add_action( 'admin_menu', static function (): void {
	add_management_page(
		'TBC Donations — Old Plugin Cleanup',
		'Donation Cleanup',
		'manage_woocommerce',
		'tbc-don-cleanup',
		'tbc_don_cleanup_page'
	);
} );

function tbc_don_cleanup_page(): void {
	global $wpdb;

	// Old product meta keys to delete.
	$old_product_meta = [
		// NYP core.
		'_nyp',
		'_has_nyp',
		'_suggested_price',
		'_min_price',
		'_maximum_price',
		'_hide_nyp_minimum',
		'_nyp_hide_variable_price',
		'_variable_billing',
		'_suggested_billing_period',
		'_minimum_billing_period',
		// NYP suggested amounts.
		'_wc_nyp_use_suggested_amounts',
		'_wc_nyp_suggested_amounts',
		'_wc_nyp_custom_button_label',
		'_wc_nyp_custom_amount_font_size',
		'_wc_nyp_custom_amount_font_unit',
		'_wc_nyp_use_custom_button',
		// Donation addons.
		'_enable_non_refundable_deposit',
		'_non_refundable_deposit',
		'_cancellation_policy',
		'_recover_donor_fees',
		'_give_extra_option',
		'_donor_wall',
		'_subscription_once_checkbox',
		// Old single price RSVP (standalone snippet).
		'_single_price_rsvp',
		// Variable billing (removed feature, may still exist from migration).
		'_tbc_don_variable_billing',
		'_tbc_don_suggested_billing_period',
		'_tbc_don_min_billing_period',
		'_tbc_don_hide_variable_price',
	];

	// Old WP options to delete.
	$old_options = [
		'woocommerce_nyp_label_text',
		'woocommerce_nyp_minimum_text',
		'woocommerce_nyp_suggested_text',
		'woocommerce_nyp_button_text_single',
		'woocommerce_nyp_button_text',
		'woocommerce_nyp_edit_in_cart',
		'woocommerce_nyp_disable_css',
		'woocommerce_nyp_hide_quantity',
		'woocommerce_nyp_strict_sold_individually',
		'tbc_don_migrated_version',
	];

	// Old transients.
	$old_transients = [
		'_transient_wc_nyp_%',
	];

	$ran_cleanup = false;

	// Handle form submission.
	if ( isset( $_POST['tbc_don_run_cleanup'] ) && check_admin_referer( 'tbc_don_cleanup_action' ) ) {

		$deleted_meta    = 0;
		$deleted_options = 0;

		// Delete old product meta.
		foreach ( $old_product_meta as $key ) {
			$count = $wpdb->query(
				$wpdb->prepare( "DELETE FROM {$wpdb->postmeta} WHERE meta_key = %s", $key )
			);
			$deleted_meta += (int) $count;
		}

		// Delete old options.
		foreach ( $old_options as $key ) {
			if ( delete_option( $key ) ) {
				$deleted_options++;
			}
		}

		// Delete old transients.
		foreach ( $old_transients as $pattern ) {
			$wpdb->query(
				$wpdb->prepare( "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s", $pattern )
			);
		}

		// Flush caches.
		if ( function_exists( 'wc_delete_product_transients' ) ) {
			wc_delete_product_transients();
		}
		wp_cache_flush();

		$ran_cleanup = true;
	}

	// Count existing old data.
	$meta_counts = [];
	foreach ( $old_product_meta as $key ) {
		$count = (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->postmeta} WHERE meta_key = %s", $key )
		);
		if ( $count > 0 ) {
			$meta_counts[ $key ] = $count;
		}
	}

	$option_exists = [];
	foreach ( $old_options as $key ) {
		if ( false !== get_option( $key, false ) ) {
			$option_exists[] = $key;
		}
	}

	$total_meta    = array_sum( $meta_counts );
	$total_options = count( $option_exists );

	?>
	<div class="wrap">
		<h1>TBC Donations — Old Plugin Cleanup</h1>

		<?php if ( $ran_cleanup ) : ?>
			<div class="notice notice-success">
				<p><strong>Cleanup complete!</strong> Deleted <?php echo esc_html( (string) $deleted_meta ); ?> meta rows and <?php echo esc_html( (string) $deleted_options ); ?> options. You can delete this file now.</p>
			</div>
		<?php endif; ?>

		<?php if ( $total_meta === 0 && $total_options === 0 ) : ?>
			<div class="notice notice-info">
				<p>No old plugin data found. Everything is clean. You can delete this file (<code>tbc-don-cleanup.php</code>).</p>
			</div>
		<?php else : ?>

			<p>The following leftover data from the old plugins was found:</p>

			<?php if ( ! empty( $meta_counts ) ) : ?>
				<h2>Product Meta Keys (<?php echo esc_html( (string) $total_meta ); ?> rows)</h2>
				<table class="widefat striped">
					<thead><tr><th>Meta Key</th><th>Count</th></tr></thead>
					<tbody>
					<?php foreach ( $meta_counts as $key => $count ) : ?>
						<tr><td><code><?php echo esc_html( $key ); ?></code></td><td><?php echo esc_html( (string) $count ); ?></td></tr>
					<?php endforeach; ?>
					</tbody>
				</table>
			<?php endif; ?>

			<?php if ( ! empty( $option_exists ) ) : ?>
				<h2>WP Options (<?php echo esc_html( (string) $total_options ); ?>)</h2>
				<ul>
				<?php foreach ( $option_exists as $key ) : ?>
					<li><code><?php echo esc_html( $key ); ?></code></li>
				<?php endforeach; ?>
				</ul>
			<?php endif; ?>

			<form method="post">
				<?php wp_nonce_field( 'tbc_don_cleanup_action' ); ?>
				<p>
					<input type="submit" name="tbc_don_run_cleanup" class="button button-primary" value="Run Cleanup — Delete All Old Data" onclick="return confirm('This will permanently delete all old plugin data listed above. Continue?');" />
				</p>
			</form>

		<?php endif; ?>
	</div>
	<?php
}
