<?php

namespace TBC_Automator_Fluent_Notification;

/**
 * Register the Fluent Notification integration with Uncanny Automator.
 */
class Add_Fluent_Notification_Integration {

	const INTEGRATION = 'TBCAUTOMATIONS';

	public function __construct() {
		$this->add_integration();

		if ( $this->plugin_active() ) {
			\Uncanny_Automator\Set_Up_Automator::set_active_integration_code( self::INTEGRATION );
			new Fluent_Notification_Send();
		}
	}

	/**
	 * Register the shared TBC Automations integration in Automator's registry.
	 * Skips if already registered by another TBC Automator plugin.
	 */
	private function add_integration() {
		if ( \automator_integration_exists( self::INTEGRATION ) ) {
			return;
		}
		\Automator()->register->integration(
			self::INTEGRATION,
			array(
				'name'      => 'TBC Automations',
				'icon_svg'  => TBC_AFN_URL . 'img/fluent-notification-icon.svg',
				'connected' => true,
			)
		);
	}

	/**
	 * Check if FluentCommunity is active.
	 */
	public function plugin_active(): bool {
		return class_exists( '\FluentCommunity\App\Models\Notification' )
			&& class_exists( '\FluentCommunity\App\Models\NotificationSubscriber' );
	}
}
