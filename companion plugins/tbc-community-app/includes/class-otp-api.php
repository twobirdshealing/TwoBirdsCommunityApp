<?php
/**
 * Universal OTP REST API - Verify, resend, and voice call for any OTP session
 *
 * Provides a single set of REST endpoints that work across all OTP contexts
 * (registration, password recovery, profile phone change). Replaces the
 * context-specific verify/resend/voice handlers with one universal set.
 *
 * Endpoints:
 *   POST /tbc-ca/v1/otp/verify  - Verify OTP code for any session
 *   POST /tbc-ca/v1/otp/resend  - Resend OTP SMS for any session
 *   POST /tbc-ca/v1/otp/voice   - Request voice call for any session
 *
 * @package TBC_Community_App
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_OTP_API {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('rest_api_init', [$this, 'register_routes']);
    }

    /**
     * Register REST routes
     */
    public function register_routes() {
        // POST /otp/verify - Verify OTP code
        register_rest_route(TBC_CA_REST_NAMESPACE, '/otp/verify', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_verify'],
            'permission_callback' => '__return_true',
        ]);

        // POST /otp/resend - Resend OTP SMS
        register_rest_route(TBC_CA_REST_NAMESPACE, '/otp/resend', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_resend'],
            'permission_callback' => '__return_true',
        ]);

        // POST /otp/voice - Request voice call
        register_rest_route(TBC_CA_REST_NAMESPACE, '/otp/voice', [
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
     * For recovery: generates WP reset key, deletes session, returns reset_token + login.
     */
    public function handle_verify(WP_REST_Request $request) {
        if (!class_exists('TBCOtpVerification\Helpers') || !class_exists('TBCOtpVerification\Twilio')) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'OTP verification is not available.',
            ], 503);
        }

        $data = $request->get_json_params();
        if (empty($data)) {
            $data = $request->get_params();
        }

        $session_key = sanitize_text_field($data['session_key'] ?? '');
        $code        = sanitize_text_field($data['code'] ?? '');

        if (empty($session_key) || empty($code)) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Session key and verification code are required.',
            ], 422);
        }

        $session = \TBCOtpVerification\Helpers::get_session($session_key);
        if (!$session) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Session expired. Please try again.',
            ], 422);
        }

        $twilio = new \TBCOtpVerification\Twilio();
        $check  = $twilio->check_verification($session['phone_number'], $code);

        if (!$check['success'] || !($check['data']['valid'] ?? false)) {
            $message = $check['message'] ?? 'Invalid code. Please try again.';
            return new WP_REST_Response([
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
                return new WP_REST_Response([
                    'success' => false,
                    'message' => 'User not found.',
                ], 404);
            }

            $reset_key = get_password_reset_key($user);
            if (is_wp_error($reset_key)) {
                return new WP_REST_Response([
                    'success' => false,
                    'message' => 'Unable to generate reset token. Please try again.',
                ], 500);
            }

            \TBCOtpVerification\Helpers::delete_session($session_key);

            return new WP_REST_Response([
                'success'     => true,
                'verified'    => true,
                'reset_token' => $reset_key,
                'login'       => $user->user_login,
                'message'     => 'Phone verified successfully.',
            ], 200);
        }

        // Registration / profile_update: mark verified with 5-min resubmit window
        \TBCOtpVerification\Helpers::mark_verified($session_key, 300);

        return new WP_REST_Response([
            'success'  => true,
            'verified' => true,
            'message'  => 'Phone verified successfully.',
        ], 200);
    }

    // =========================================================================
    // POST /otp/resend
    // =========================================================================

    /**
     * Resend OTP SMS for any session.
     */
    public function handle_resend(WP_REST_Request $request) {
        if (!class_exists('TBCOtpVerification\Helpers') || !class_exists('TBCOtpVerification\Twilio')) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'OTP verification is not available.',
            ], 503);
        }

        $data = $request->get_json_params();
        if (empty($data)) {
            $data = $request->get_params();
        }

        $session_key = sanitize_text_field($data['session_key'] ?? '');

        if (empty($session_key)) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Session key is required.',
            ], 422);
        }

        $session = \TBCOtpVerification\Helpers::get_session($session_key);
        if (!$session) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Session expired. Please try again.',
            ], 422);
        }

        $twilio = new \TBCOtpVerification\Twilio();
        $result = $twilio->start_verification($session['phone_number']);

        if ($result['success']) {
            return new WP_REST_Response([
                'success' => true,
                'message' => 'New code sent!',
            ], 200);
        }

        return new WP_REST_Response([
            'success' => false,
            'message' => $result['message'],
        ], 422);
    }

    // =========================================================================
    // POST /otp/voice
    // =========================================================================

    /**
     * Request voice call OTP for any session.
     */
    public function handle_voice(WP_REST_Request $request) {
        if (!class_exists('TBCOtpVerification\Helpers') || !class_exists('TBCOtpVerification\Twilio')) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'OTP verification is not available.',
            ], 503);
        }

        if (!\TBCOtpVerification\Helpers::get_option('enable_voice_fallback', false)) {
            return new WP_REST_Response([
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
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Session key is required.',
            ], 422);
        }

        $session = \TBCOtpVerification\Helpers::get_session($session_key);
        if (!$session) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Session expired. Please try again.',
            ], 422);
        }

        $twilio = new \TBCOtpVerification\Twilio();
        $result = $twilio->start_voice_verification($session['phone_number']);

        if ($result['success']) {
            return new WP_REST_Response([
                'success' => true,
                'message' => 'Voice call initiated. You will receive a call shortly.',
            ], 200);
        }

        return new WP_REST_Response([
            'success' => false,
            'message' => $result['message'],
        ], 422);
    }
}
