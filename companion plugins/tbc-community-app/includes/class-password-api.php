<?php
/**
 * Password Reset REST API - Mobile app password recovery via OTP
 *
 * Provides REST API endpoints for password reset from the mobile app.
 * Reuses the tbc-otp-verification Twilio + Helpers classes for OTP delivery.
 * Falls back to WordPress native email reset if user has no phone on file.
 *
 * Endpoints:
 *   POST /tbc-ca/v1/password/forgot  - Initiate password reset (sends OTP or email)
 *   POST /tbc-ca/v1/password/reset   - Set new password with reset token
 *
 * OTP verify/resend/voice handled by universal endpoints in class-otp-api.php
 *
 * @package TBC_Community_App
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_Password_API {

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
        // POST /password/forgot - Initiate password reset
        register_rest_route(TBC_CA_REST_NAMESPACE, '/password/forgot', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_forgot'],
            'permission_callback' => '__return_true',
        ]);

        // POST /password/reset - Set new password
        register_rest_route(TBC_CA_REST_NAMESPACE, '/password/reset', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_reset'],
            'permission_callback' => '__return_true',
        ]);
    }

    // =========================================================================
    // POST /password/forgot
    // =========================================================================

    /**
     * Initiate password reset.
     * If user has a phone → send OTP via Twilio.
     * If no phone → send native WP email reset link.
     */
    public function handle_forgot(WP_REST_Request $request) {
        $data = $request->get_json_params();
        if (empty($data)) {
            $data = $request->get_params();
        }

        $login = sanitize_text_field(trim($data['login'] ?? ''));

        if (empty($login)) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Please enter your email or username.',
            ], 422);
        }

        // Find user
        $user = is_email($login)
            ? get_user_by('email', $login)
            : get_user_by('login', $login);

        if (!$user) {
            // Don't reveal whether the user exists — always return generic message
            return new WP_REST_Response([
                'success' => true,
                'email_sent' => true,
                'message' => 'If an account exists with that information, you will receive reset instructions.',
            ], 200);
        }

        // Check if OTP password recovery is enabled and classes exist
        $otp_available = class_exists('TBCOtpVerification\Helpers')
            && class_exists('TBCOtpVerification\Twilio')
            && \TBCOtpVerification\Helpers::get_option('enable_password_recovery', false);

        if ($otp_available) {
            // Look up phone from usermeta
            $meta_key = \TBCOtpVerification\Helpers::get_phone_meta_key();
            $raw_phone = get_user_meta($user->ID, $meta_key, true);

            if (!empty($raw_phone)) {
                $formatted = \TBCOtpVerification\Helpers::format_phone((string) $raw_phone, true);

                if (!empty($formatted) && !\TBCOtpVerification\Helpers::is_blocked($formatted)) {
                    // Send OTP via Twilio
                    $twilio = new \TBCOtpVerification\Twilio();
                    $result = $twilio->start_verification($formatted);

                    if ($result['success']) {
                        $clean_phone = $result['data']['phone'] ?? $formatted;
                        $session_key = \TBCOtpVerification\Helpers::generate_session_key('tbc_otp_recovery_');

                        \TBCOtpVerification\Helpers::store_session($session_key, [
                            'verified'     => false,
                            'phone_number' => $clean_phone,
                            'user_id'      => $user->ID,
                            'user_login'   => $user->user_login,
                            'context'      => 'recovery',
                        ]);

                        $voice_fallback = (bool) \TBCOtpVerification\Helpers::get_option('enable_voice_fallback', false);

                        return new WP_REST_Response([
                            'success'        => true,
                            'otp_sent'       => true,
                            'session_key'    => $session_key,
                            'phone_masked'   => \TBCOtpVerification\Helpers::mask_phone($clean_phone),
                            'voice_fallback' => $voice_fallback,
                        ], 200);
                    }
                    // OTP send failed — fall through to email
                }
            }
        }

        // Fallback: WordPress native email reset
        $result = retrieve_password($user->user_login);

        if (is_wp_error($result)) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Unable to send reset instructions. Please try again later.',
            ], 500);
        }

        return new WP_REST_Response([
            'success'    => true,
            'email_sent' => true,
            'message'    => 'A password reset link has been sent to your email.',
        ], 200);
    }

    // =========================================================================
    // POST /password/reset
    // =========================================================================

    /**
     * Set new password using a reset token.
     */
    public function handle_reset(WP_REST_Request $request) {
        $data = $request->get_json_params();
        if (empty($data)) {
            $data = $request->get_params();
        }

        $reset_token = sanitize_text_field($data['reset_token'] ?? '');
        $login = sanitize_text_field($data['login'] ?? '');
        $new_password = $data['new_password'] ?? '';

        if (empty($reset_token) || empty($login) || empty($new_password)) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Reset token, username, and new password are required.',
            ], 422);
        }

        if (strlen($new_password) < 6) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Password must be at least 6 characters.',
            ], 422);
        }

        // Validate reset key
        $user = check_password_reset_key($reset_token, $login);

        if (is_wp_error($user)) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Reset token is invalid or has expired. Please start over.',
            ], 422);
        }

        // Set new password
        reset_password($user, $new_password);

        return new WP_REST_Response([
            'success' => true,
            'message' => 'Password updated successfully. You can now sign in.',
        ], 200);
    }
}
