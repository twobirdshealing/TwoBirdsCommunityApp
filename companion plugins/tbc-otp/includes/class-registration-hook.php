<?php
/**
 * Registration Hook Class
 * Intercepts registration to inject OTP phone verification.
 *
 * App registration: hooks tbc_ca_pre_register filter in tbc-community-app's
 * POST /auth/register endpoint. Returns an OTP-required response to interrupt
 * registration when phone verification is needed, or null to let it proceed.
 *
 * Web registration: hooks wp_ajax_nopriv_fcom_user_registration at priority 6
 * (before FC's handler at priority 10) to intercept FC's native AJAX registration
 * and inject OTP verification into the flow.
 *
 * @package TBC_OTP
 */

namespace TBCOTP;

defined('ABSPATH') || exit;

class RegistrationHook {

    private Twilio $twilio;

    public function __construct(Twilio $twilio) {
        $this->twilio = $twilio;
    }

    // =========================================================================
    // App Registration (tbc_ca_pre_register filter)
    // =========================================================================

    /**
     * Hook: tbc_ca_pre_register filter.
     *
     * Called by tbc-community-app's POST /auth/register after validation passes
     * but before user creation. Return a WP_REST_Response to interrupt registration
     * (e.g., OTP required), or null to let registration proceed.
     *
     * @param mixed            $response null on first call, WP_REST_Response if another filter intercepted.
     * @param array            $data     Validated registration data.
     * @param \WP_REST_Request $request  The REST request.
     * @return \WP_REST_Response|null
     */
    public function intercept_registration($response, $data, $request) {
        // Another filter already intercepted — don't override
        if ($response !== null) {
            return $response;
        }

        $otp_enabled = (bool) Helpers::get_option('enable_registration_verification', true);
        if (!$otp_enabled) {
            return null;
        }

        $session_key = sanitize_text_field($data['tbc_otp_session_key'] ?? $data['tbc_reg_session_key'] ?? '');

        // Session already verified — let registration proceed
        if (!empty($session_key) && Helpers::is_verified($session_key)) {
            Helpers::log('OTP session verified, proceeding to user creation');
            Helpers::delete_session($session_key);
            return null;
        }

        // Check phone field
        $phone_slug = Helpers::get_phone_slug();
        $phone_value = $data[$phone_slug] ?? '';

        if (empty($phone_value)) {
            // No phone provided — skip OTP, let registration proceed
            return null;
        }

        $formatted = Helpers::format_phone($phone_value);

        if (empty($formatted)) {
            return new \WP_REST_Response([
                'success' => false,
                'message' => 'Please enter a valid phone number.',
                'errors'  => ['phone' => 'Invalid phone number format.'],
            ], 422);
        }

        if (Helpers::is_duplicate($formatted)) {
            return new \WP_REST_Response([
                'success' => false,
                'message' => 'This phone number is already registered.',
                'errors'  => [$phone_slug => 'This phone number is already in use.'],
            ], 422);
        }

        if (Helpers::is_blocked($formatted)) {
            return new \WP_REST_Response([
                'success' => false,
                'message' => 'This phone number cannot be used for registration.',
                'errors'  => [$phone_slug => 'This phone number is not allowed.'],
            ], 422);
        }

        // Start Twilio verification
        $result = $this->twilio->start_verification($formatted);

        if (!$result['success']) {
            return new \WP_REST_Response([
                'success' => false,
                'message' => $result['message'],
            ], 422);
        }

        $clean_phone = $result['data']['phone'] ?? $formatted;
        $new_session_key = Helpers::generate_session_key('tbc_otp_session_');

        Helpers::store_session($new_session_key, [
            'verified'     => false,
            'phone_number' => $clean_phone,
            'context'      => 'registration',
        ]);

        return new \WP_REST_Response([
            'success'      => false,
            'otp_required' => true,
            'session_key'  => $new_session_key,
            'phone_masked' => Helpers::mask_phone($clean_phone),
        ], 200);
    }

    // =========================================================================
    // Web Registration (AJAX interception)
    // =========================================================================

    /**
     * Optionally disable FC's email 2FA when phone OTP is active.
     * Controlled by admin setting — when both are enabled, users complete
     * phone OTP first, then email 2FA in sequence.
     *
     * Hook: fluent_auth/verify_signup_email
     */
    public function maybe_disable_email_verification(bool $enabled): bool {
        $disable = (bool) Helpers::get_option('disable_email_verification', true);
        if ($disable && (bool) Helpers::get_option('enable_registration_verification', true)) {
            return false;
        }
        return $enabled;
    }

    // =========================================================================
    // Web Registration (AJAX gate — priority 6)
    // =========================================================================

    /**
     * Hook: wp_ajax_nopriv_fcom_user_registration at priority 6.
     *
     * Server-side safety net. The JS does OTP before the form is ever submitted,
     * so by the time this fires the session should already be verified. This hook
     * just validates that and blocks submissions that somehow bypass the JS.
     *
     * If OTP is verified or not required, returns without output so FC's handler
     * runs normally at priority 10.
     */
    public function intercept_web_registration() {
        $otp_enabled = (bool) Helpers::get_option('enable_registration_verification', true);
        if (!$otp_enabled) {
            return;
        }

        // Email 2FA continuation — let through (user already passed phone OTP)
        // phpcs:ignore WordPress.Security.NonceVerification.Missing
        if (!empty($_POST['__two_fa_signed_token'])) {
            return;
        }

        // phpcs:ignore WordPress.Security.NonceVerification.Missing
        $session_key = sanitize_text_field($_POST['tbc_otp_session_key'] ?? $_POST['tbc_reg_session_key'] ?? '');

        // Verified session — consume it and let FC proceed
        if (!empty($session_key) && Helpers::is_verified($session_key)) {
            Helpers::log('Web OTP session verified, letting FC handle registration');
            Helpers::delete_session($session_key);
            return;
        }

        // Check if phone is present without a valid session (JS bypass protection)
        $phone_slug = Helpers::get_phone_slug();
        // phpcs:ignore WordPress.Security.NonceVerification.Missing
        $phone_value = sanitize_text_field($_POST[$phone_slug] ?? '');

        if (empty($phone_value)) {
            return; // No phone — let FC proceed
        }

        // Phone present but no verified session — block
        Helpers::log('Web registration blocked: phone present without verified OTP session');
        wp_send_json([
            'success' => false,
            'message' => __('Phone verification is required. Please verify your phone number first.', 'tbc-otp'),
        ]);
    }
}
