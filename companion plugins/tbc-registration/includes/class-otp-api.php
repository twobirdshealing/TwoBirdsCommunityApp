<?php
/**
 * Universal OTP REST API - Verify, resend, and voice call for any OTP session.
 *
 * Single set of REST endpoints that work across all OTP contexts
 * (registration, password recovery, profile phone change).
 *
 * Endpoints:
 *   POST /tbc-reg/v1/otp/verify  - Verify OTP code for any session
 *   POST /tbc-reg/v1/otp/resend  - Resend OTP SMS for any session
 *   POST /tbc-reg/v1/otp/voice   - Request voice call for any session
 *
 * @package TBC_Registration
 */

namespace TBCRegistration;

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
        register_rest_route(TBC_REG_REST_NAMESPACE, '/otp/verify', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_verify'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(TBC_REG_REST_NAMESPACE, '/otp/resend', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_resend'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(TBC_REG_REST_NAMESPACE, '/otp/voice', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_voice'],
            'permission_callback' => '__return_true',
        ]);
    }

    // =========================================================================
    // POST /otp/verify
    // =========================================================================

    /**
     * Verify an OTP code for any session context.
     *
     * For registration/profile_update: marks session verified (5-min resubmit window).
     * For recovery: generates WP reset key, deletes session, returns reset_token + login + redirect_url.
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

        // Context-specific post-verification
        $context = $session['context'] ?? '';

        if ($context === 'recovery') {
            // Password recovery: generate reset key and return it
            $user = get_user_by('ID', $session['user_id'] ?? 0);
            if (!$user) {
                return new \WP_REST_Response([
                    'success' => false,
                    'message' => 'User not found.',
                ], 404);
            }

            $reset_key = get_password_reset_key($user);
            if (is_wp_error($reset_key)) {
                return new \WP_REST_Response([
                    'success' => false,
                    'message' => 'Unable to generate reset token. Please try again.',
                ], 500);
            }

            Helpers::delete_session($session_key);

            $reset_url = wp_login_url() . '?action=rp&key=' . $reset_key . '&login=' . rawurlencode($user->user_login);

            return new \WP_REST_Response([
                'success'      => true,
                'verified'     => true,
                'reset_token'  => $reset_key,
                'login'        => $user->user_login,
                'redirect_url' => $reset_url,
                'message'      => 'Phone verified successfully.',
            ], 200);
        }

        // Registration / profile_update: mark verified with 5-min resubmit window
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
