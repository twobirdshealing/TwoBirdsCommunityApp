<?php
/**
 * WooCommerce Settings > Donations tab registration.
 *
 * @package TBC\WooDonations\Admin
 */

declare(strict_types=1);

namespace TBC\WooDonations\Admin;

defined( 'ABSPATH' ) || exit;

final class PluginSettings {

	public static function init(): void {
		add_filter( 'woocommerce_get_settings_pages', [ __CLASS__, 'add_settings_page' ] );
	}

	/**
	 * @param array<int, \WC_Settings_Page> $settings
	 * @return array<int, \WC_Settings_Page>
	 */
	public static function add_settings_page( array $settings ): array {
		// Load the actual settings page class here — WC_Settings_Page is guaranteed available at this point.
		require_once __DIR__ . '/PluginSettingsPage.php';
		$settings[] = new PluginSettingsPage();
		return $settings;
	}
}
