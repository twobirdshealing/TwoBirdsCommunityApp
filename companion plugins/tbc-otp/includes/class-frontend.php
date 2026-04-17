<?php
/**
 * Frontend Class
 * Injects the OTP registration interceptor on FC's auth registration page.
 *
 * @package TBC_OTP
 */

namespace TBCOTP;

defined('ABSPATH') || exit;

class Frontend {

    /**
     * Check if OTP registration interception is enabled.
     */
    private function is_otp_enabled(): bool {
        return (bool) Helpers::get_option('enable_registration_verification', true);
    }

    /**
     * Check if we're on FC's auth registration page.
     */
    private function is_registration_page(): bool {
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        return isset($_GET['fcom_action']) && $_GET['fcom_action'] === 'auth'
            // phpcs:ignore WordPress.Security.NonceVerification.Recommended
            && isset($_GET['form']) && $_GET['form'] === 'register';
    }

    /**
     * Enqueue the OTP modal CSS + registration JS on FC's auth registration page.
     */
    public function maybe_enqueue_auth_assets(): void {
        if (!$this->is_registration_page() || !$this->is_otp_enabled()) {
            return;
        }

        $css_path = TBC_OTP_DIR . 'assets/css/otp-modal.css';
        $js_path  = TBC_OTP_DIR . 'assets/js/registration-otp.js';

        wp_enqueue_style(
            'tbc-otp-modal',
            TBC_OTP_URL . 'assets/css/otp-modal.css',
            [],
            file_exists($css_path) ? (string) filemtime($css_path) : TBC_OTP_VERSION
        );

        wp_enqueue_script(
            'tbc-otp-registration',
            TBC_OTP_URL . 'assets/js/registration-otp.js',
            [],
            file_exists($js_path) ? (string) filemtime($js_path) : TBC_OTP_VERSION,
            [
                'strategy'  => 'defer',
                'in_footer' => true,
            ]
        );

        wp_localize_script('tbc-otp-registration', 'tbcOtpReg', [
            'rest_url'      => rest_url(TBC_OTP_REST_NAMESPACE . '/otp/'),
            'rest_nonce'    => wp_create_nonce('wp_rest'),
            'voice_enabled' => (bool) Helpers::get_option('enable_voice_fallback', false),
            'phone_slug'    => Helpers::get_phone_slug(),
        ]);
    }

}
