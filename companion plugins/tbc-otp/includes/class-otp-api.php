<?php
/**
 * OTP REST API - Verify, resend, and voice call for registration OTP sessions.
 *
 * Endpoints:
 *   POST /tbc-otp/v1/otp/verify  - Verify OTP code
 *   POST /tbc-otp/v1/otp/resend  - Resend OTP SMS
 *   POST /tbc-otp/v1/otp/voice   - Request voice call fallback
 *
 * @package TBC_OTP
 */

namespace TBCOTP;

defined('ABSPATH') || exit;

class OtpApi {

    private Twilio $twilio;

    public function __construct(Twilio $twilio) {
        $this->twilio = $twilio;
    }

    /**
     * Register REST routes
     */
    public function register_routes() {
        register_rest_route(TBC_OTP_REST_NAMESPACE, '/otp/send', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_send'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(TBC_OTP_REST_NAMESPACE, '/otp/verify', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_verify'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(TBC_OTP_REST_NAMESPACE, '/otp/resend', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_resend'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(TBC_OTP_REST_NAMESPACE, '/otp/voice', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_voice'],
            'permission_callback' => '__return_true',
        ]);
    }

    // =========================================================================
    // POST /otp/send
    // =========================================================================

    /**
     * Start OTP verification for a phone number.
     * Validates format, checks duplicates/blocked, starts Twilio, returns session.
     * Used by web registration JS to initiate OTP before form submission.
     */
    public function handle_send(\WP_REST_Request $request) {
        $data = $request->get_json_params();
        if (empty($data)) {
            $data = $request->get_params();
        }

        $phone = sanitize_text_field($data['phone'] ?? '');

        if (empty($phone)) {
            return new \WP_REST_Response([
                'success' => false,
                'message' => 'Phone number is required.',
            ], 422);
        }

        $formatted = Helpers::format_phone($phone);

        if (empty($formatted)) {
            return new \WP_REST_Response([
                'success' => false,
                'message' => 'Please enter a valid phone number.',
            ], 422);
        }

        if (Helpers::is_duplicate($formatted)) {
            return new \WP_REST_Response([
                'success' => false,
                'message' => 'This phone number is already registered.',
            ], 422);
        }

        if (Helpers::is_blocked($formatted)) {
            return new \WP_REST_Response([
                'success' => false,
                'message' => 'This phone number cannot be used for registration.',
            ], 422);
        }

        $result = $this->twilio->start_verification($formatted);

        if (!$result['success']) {
            return new \WP_REST_Response([
                'success' => false,
                'message' => $result['message'],
            ], 422);
        }

        $clean_phone = $result['data']['phone'] ?? $formatted;
        $session_key = Helpers::generate_session_key('tbc_otp_session_');

        Helpers::store_session($session_key, [
            'verified'     => false,
            'phone_number' => $clean_phone,
            'context'      => 'registration',
        ]);

        return new \WP_REST_Response([
            'success'      => true,
            'session_key'  => $session_key,
            'phone_masked' => Helpers::mask_phone($clean_phone),
        ], 200);
    }

    // =========================================================================
    // POST /otp/verify
    // =========================================================================

    /**
     * Verify an OTP code. Marks session as verified with a 5-min resubmit window.
     */
    public function handle_verify(\WP_REST_Request $request) {
        $data = $request->get_json_params();
        if (empty($data)) {
            $data = $request->get_params();
        }

        $session_key = sanitize_text_field($data['session_key'] ?? '');
        $code        = sanitize_text_field($data['code'] ?? '');

        if (empty($session_key) || empty($code)) {
            return new \WP_REST_Response([
                'success' => false,
                'message' => 'Session key and verification code are required.',
            ], 422);
        }

        $session = Helpers::get_session($session_key);
        if (!$session) {
            return new \WP_REST_Response([
                'success' => false,
                'message' => 'Session expired. Please try again.',
            ], 422);
        }

        $check = $this->twilio->check_verification($session['phone_number'], $code);

        if (!$check['success'] || !($check['data']['valid'] ?? false)) {
            $message = $check['message'] ?? 'Invalid code. Please try again.';
            return new \WP_REST_Response([
                'success' => false,
                'message' => $message,
            ], 422);
        }

        // Mark verified with 5-min resubmit window
        Helpers::mark_verified($session_key, 300);

        return new \WP_REST_Response([
            'success'  => true,
            'verified' => true,
            'message'  => 'Phone verified successfully.',
        ], 200);
    }

    // =========================================================================
    // POST /otp/resend
    // =========================================================================

    public function handle_resend(\WP_REST_Request $request) {
        $data = $request->get_json_params();
        if (empty($data)) {
            $data = $request->get_params();
        }

        $session_key = sanitize_text_field($data['session_key'] ?? '');

        if (empty($session_key)) {
            return new \WP_REST_Response([
                'success' => false,
                'message' => 'Session key is required.',
            ], 422);
        }

        $session = Helpers::get_session($session_key);
        if (!$session) {
            return new \WP_REST_Response([
                'success' => false,
                'message' => 'Session expired. Please try again.',
            ], 422);
        }

        $result = $this->twilio->start_verification($session['phone_number']);

        if ($result['success']) {
            return new \WP_REST_Response([
                'success' => true,
                'message' => 'New code sent!',
            ], 200);
        }

        return new \WP_REST_Response([
            'success' => false,
            'message' => $result['message'],
        ], 422);
    }

    // =========================================================================
    // POST /otp/voice
    // =========================================================================

    public function handle_voice(\WP_REST_Request $request) {
        if (!Helpers::get_option('enable_voice_fallback', false)) {
            return new \WP_REST_Response([
                'success' => false,
                'message' => 'Voice call verification is not enabled.',
            ], 422);
        }

        $data = $request->get_json_params();
        if (empty($data)) {
            $data = $request->get_params();
        }

        $session_key = sanitize_text_field($data['session_key'] ?? '');

        if (empty($session_key)) {
            return new \WP_REST_Response([
                'success' => false,
                'message' => 'Session key is required.',
            ], 422);
        }

        $session = Helpers::get_session($session_key);
        if (!$session) {
            return new \WP_REST_Response([
                'success' => false,
                'message' => 'Session expired. Please try again.',
            ], 422);
        }

        $result = $this->twilio->start_voice_verification($session['phone_number']);

        if ($result['success']) {
            return new \WP_REST_Response([
                'success' => true,
                'message' => 'Voice call initiated. You will receive a call shortly.',
            ], 200);
        }

        return new \WP_REST_Response([
            'success' => false,
            'message' => $result['message'],
        ], 422);
    }
}
