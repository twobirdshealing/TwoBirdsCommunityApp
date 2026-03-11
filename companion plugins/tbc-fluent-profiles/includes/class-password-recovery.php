<?php
/**
 * PasswordRecovery Class
 * Intercepts WordPress lost-password flow to send OTP to phone instead of email.
 * Verify/resend handled by the universal REST OTP API (class-otp-api.php).
 *
 * @package TBC_Fluent_Profiles
 */

declare(strict_types=1);

namespace TBCFluentProfiles;

defined('ABSPATH') || exit;

class PasswordRecovery {

    private Twilio $twilio;

    public function __construct(Twilio $twilio) {
        $this->twilio = $twilio;
    }

    /**
     * Intercept the lost-password POST submission.
     * Hooked on `lostpassword_post` at priority 1.
     *
     * @param \WP_Error $errors WP errors object (passed by reference by WP).
     */
    public function intercept_lost_password(\WP_Error $errors): void {
        if (!Helpers::get_option('enable_password_recovery', false)) {
            return;
        }

        // Only act on POST with a user_login value
        // phpcs:ignore WordPress.Security.NonceVerification.Missing
        $user_login = isset($_POST['user_login'])
            ? sanitize_text_field(wp_unslash($_POST['user_login']))
            : '';

        if (empty($user_login)) {
            return;
        }

        // Find the user
        $user = is_email($user_login)
            ? get_user_by('email', $user_login)
            : get_user_by('login', $user_login);

        if (!$user) {
            return; // Let WP show its own "user not found" error
        }

        // Look up phone from usermeta
        $meta_key  = Helpers::get_phone_meta_key();
        $raw_phone = get_user_meta($user->ID, $meta_key, true);

        if (empty($raw_phone)) {
            Helpers::log("No phone for user #{$user->ID}, falling through to email recovery");
            return;
        }

        $formatted = Helpers::format_phone((string) $raw_phone, true);
        if (empty($formatted)) {
            Helpers::log("Invalid phone format for user #{$user->ID}, falling through to email");
            return;
        }

        // Check blocked
        if (Helpers::is_blocked($formatted)) {
            Helpers::log("Blocked phone during recovery: {$formatted}");
            $this->redirect_with_error();
            return;
        }

        // Send OTP
        $result = $this->twilio->start_verification($formatted);
        if (!$result['success']) {
            Helpers::log("Failed to send recovery OTP: {$result['message']}", 'error');
            $this->redirect_with_error();
            return;
        }

        $clean_phone = $result['data']['phone'] ?? $formatted;
        $session_key = Helpers::generate_session_key('tbc_otp_recovery_');

        Helpers::store_session($session_key, [
            'verified'     => false,
            'phone_number' => $clean_phone,
            'user_id'      => $user->ID,
            'user_login'   => $user->user_login,
            'user_email'   => $user->user_email,
            'context'      => 'recovery',
        ]);

        Helpers::log("Recovery OTP sent to {$clean_phone} for user #{$user->ID}");

        // Show the OTP full-page template
        $this->render_recovery_page($session_key, $clean_phone);
        exit;
    }

    /**
     * Show error message on the lost-password page.
     * Hooked on `login_message`.
     */
    public function show_error_message(string $message): string {
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        if (isset($_GET['otp_error']) && $_GET['otp_error'] === '1') {
            $error = '<div id="login_error"><strong>' .
                esc_html__('Unable to send verification code. Please try again or contact support.', 'tbc-fluent-profiles') .
                '</strong></div>';
            return $error . $message;
        }
        return $message;
    }

    /**
     * Render the full-page recovery OTP template.
     */
    private function render_recovery_page(string $session_key, string $phone): void {
        $context       = 'recovery';
        $phone_masked  = Helpers::mask_phone($phone);
        $rest_url      = rest_url(TBC_FP_REST_NAMESPACE . '/otp/');
        $rest_nonce    = wp_create_nonce('wp_rest');
        $voice_enabled = (bool) Helpers::get_option('enable_voice_fallback', false);

        include TBC_FP_DIR . 'templates/otp-modal.php';
    }

    /**
     * Redirect back to lost password page with error.
     */
    private function redirect_with_error(): void {
        $url = add_query_arg('otp_error', '1', wp_lostpassword_url());
        wp_safe_redirect($url);
        exit;
    }
}
