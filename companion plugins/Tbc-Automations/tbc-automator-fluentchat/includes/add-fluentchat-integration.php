<?php

namespace TBC_Automator_FluentChat;

/**
 * Register the FluentChat integration with Uncanny Automator.
 */
class Add_FluentChat_Integration {

	const INTEGRATION = 'TBCAUTOMATIONS';

	public function __construct() {
		$this->add_integration();

		if ( $this->plugin_active() ) {
			\Uncanny_Automator\Set_Up_Automator::set_active_integration_code( self::INTEGRATION );
			new FluentChat_Send_DM();
		}
	}

	/**
	 * Register the shared TBC Automations integration in Automator's registry.
	 * Skips if already registered by another TBC Automator plugin.
	 */
	private function add_integration() {
		if ( \Automator()->get->integration_from_code( self::INTEGRATION ) ) {
			return;
		}
		\Automator()->register->integration(
			self::INTEGRATION,
			array(
				'name'      => 'TBC Automations',
				'icon_svg'  => TBC_AFC_URL . 'img/fluentchat-icon.svg',
				'connected' => true,
			)
		);
	}

	/**
	 * Check if FluentChat (Fluent Community messaging) is active.
	 */
	public function plugin_active(): bool {
		return class_exists( '\FluentMessaging\App\Models\Thread' )
			&& class_exists( '\FluentMessaging\App\Services\ChatHelper' );
	}
}
