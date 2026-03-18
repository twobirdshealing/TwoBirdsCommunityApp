<?php
/**
 * Frontend Class
 * Enqueues the OTP registration interceptor on FC's auth pages.
 *
 * Uses FluentCommunity's portal hooks when available, plus wp_footer
 * for the auth registration page (portal hooks don't fire on auth pages).
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
     * Inject CSS on the auth registration page via wp_head.
     */
    public function maybe_inject_auth_css(): void {
        if (!$this->is_registration_page() || !$this->is_otp_enabled()) {
            return;
        }
        ?>
        <link rel="stylesheet"
              href="<?php echo esc_url(TBC_OTP_URL . 'assets/css/otp-modal.css'); ?>?v=<?php echo esc_attr(TBC_OTP_VERSION); ?>"
              media="screen"/>
        <?php
    }

    /**
     * Inject JS on the auth registration page via wp_footer.
     */
    public function maybe_inject_auth_js(): void {
        if (!$this->is_registration_page() || !$this->is_otp_enabled()) {
            return;
        }
        ?>
        <script>
            var tbcOtpReg = <?php echo wp_json_encode([
                'rest_url'      => rest_url(TBC_OTP_REST_NAMESPACE . '/otp/'),
                'rest_nonce'    => wp_create_nonce('wp_rest'),
                'voice_enabled' => (bool) Helpers::get_option('enable_voice_fallback', false),
                'phone_slug'    => Helpers::get_phone_slug(),
            ]); ?>;
        </script>
        <script src="<?php echo esc_url(TBC_OTP_URL . 'assets/js/registration-otp.js'); ?>?v=<?php echo esc_attr(TBC_OTP_VERSION); ?>" defer="defer"></script>
        <?php
    }

    /**
     * Inject CSS into the FC portal <head> (for in-portal registration if applicable).
     */
    public function inject_portal_css(): void {
        if (!$this->is_otp_enabled()) {
            return;
        }
        ?>
        <link rel="stylesheet"
              href="<?php echo esc_url(TBC_OTP_URL . 'assets/css/otp-modal.css'); ?>?v=<?php echo esc_attr(TBC_OTP_VERSION); ?>"
              media="screen"/>
        <?php
    }

    /**
     * Inject JS config + script into the FC portal footer.
     */
    public function inject_portal_js(): void {
        if (!$this->is_otp_enabled()) {
            return;
        }
        ?>
        <script>
            var tbcOtpReg = <?php echo wp_json_encode([
                'rest_url'      => rest_url(TBC_OTP_REST_NAMESPACE . '/otp/'),
                'rest_nonce'    => wp_create_nonce('wp_rest'),
                'voice_enabled' => (bool) Helpers::get_option('enable_voice_fallback', false),
                'phone_slug'    => Helpers::get_phone_slug(),
            ]); ?>;
        </script>
        <script src="<?php echo esc_url(TBC_OTP_URL . 'assets/js/registration-otp.js'); ?>?v=<?php echo esc_attr(TBC_OTP_VERSION); ?>" defer="defer"></script>
        <?php
    }
}
