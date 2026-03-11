<?php
/**
 * Registration REST API - Mobile app registration endpoints
 *
 * Provides REST API endpoints for user registration from the mobile app.
 * Reuses validation logic from Fluent Community, tbc-fluent-profiles, and tbc-otp-verification.
 *
 * Endpoints:
 *   GET  /tbc-ca/v1/register/fields  - Get registration form field definitions
 *   POST /tbc-ca/v1/register         - Submit registration (handles OTP flow)
 *
 * OTP verify/resend/voice handled by universal endpoints in class-otp-api.php
 *
 * @package TBC_Community_App
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_Registration_API {

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
        // GET /register/fields - Get registration form field definitions
        register_rest_route(TBC_CA_REST_NAMESPACE, '/register/fields', [
            'methods'             => 'GET',
            'callback'            => [$this, 'handle_get_fields'],
            'permission_callback' => '__return_true',
        ]);

        // POST /register - Submit registration
        register_rest_route(TBC_CA_REST_NAMESPACE, '/register', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_register'],
            'permission_callback' => '__return_true',
        ]);

    }

    // =========================================================================
    // GET /register/fields
    // =========================================================================

    /**
     * Return registration form field definitions for the mobile app.
     */
    public function handle_get_fields(WP_REST_Request $request) {
        // Check if Fluent Community is active
        if (!class_exists('FluentCommunity\Modules\Auth\AuthHelper')) {
            return new WP_REST_Response([
                'registration_enabled' => false,
                'message'              => 'Fluent Community plugin is not active.',
            ], 503);
        }

        $auth_helper = 'FluentCommunity\Modules\Auth\AuthHelper';

        // Check if registration is enabled
        $registration_enabled = $auth_helper::isRegistrationEnabled();

        // Get base Fluent Community form fields
        $fc_fields = $auth_helper::getFormFields();

        // Build fields array with step assignments
        $fields = [];
        $base_keys = ['full_name', 'email', 'username', 'password', 'conf_password'];

        foreach ($fc_fields as $key => $field) {
            // Skip terms for now - we'll add it at the end of step 2
            if ($key === 'terms') {
                continue;
            }

            $is_base = in_array($key, $base_keys, true);
            $field_def = [
                'label'       => $field['label'] ?? '',
                'placeholder' => $field['placeholder'] ?? '',
                'type'        => $field['type'] ?? 'text',
                'required'    => !empty($field['required']),
                'step'        => $is_base ? 1 : 2,
            ];

            if (!empty($field['options'])) {
                $field_def['options'] = $field['options'];
            }

            // For custom fields from tbc-fluent-profiles, provide real type info
            if (!$is_base && $key !== 'terms' && class_exists('TBCFluentProfiles\Fields')) {
                $fp_fields_obj = new \TBCFluentProfiles\Fields();
                $signup_fields = $fp_fields_obj->get_fields_for('signup');

                if (isset($signup_fields[$key])) {
                    $cf = $signup_fields[$key];
                    $type_config = \TBCFluentProfiles\Fields::get_type_config($cf['type']);

                    // Use the real field type instead of the mapped signup_type
                    $field_def['type'] = $cf['type'];
                    $field_def['input_type'] = $type_config['input_type'] ?? 'text';

                    // Get proper options for select-type fields
                    $options = \TBCFluentProfiles\Fields::get_field_options($cf);
                    if (!empty($options)) {
                        $field_def['options'] = $options;
                    }

                    // Pass through field instructions (help text shown below label)
                    if (!empty($cf['instructions'])) {
                        $field_def['instructions'] = $cf['instructions'];
                    }
                }
            }

            $fields[$key] = $field_def;
        }

        // Add terms checkbox at the end of step 2
        if (isset($fc_fields['terms'])) {
            $fields['terms'] = [
                'label'        => '',
                'type'         => 'inline_checkbox',
                'inline_label' => wp_strip_all_tags($fc_fields['terms']['inline_label'] ?? 'I agree to the terms and conditions'),
                'required'     => true,
                'step'         => 2,
            ];
        }

        // Determine OTP settings
        $otp_required = false;
        $voice_fallback = false;
        if (class_exists('TBCOtpVerification\Helpers')) {
            $otp_required = (bool) \TBCOtpVerification\Helpers::get_option('enable_registration_verification', true);
            $voice_fallback = (bool) \TBCOtpVerification\Helpers::get_option('enable_voice_fallback', false);
        }

        // Check if email verification is enabled (respects tbc-otp-verification filter)
        $email_verification_required = (bool) $auth_helper::isTwoFactorEnabled();

        return new WP_REST_Response([
            'registration_enabled'         => $registration_enabled,
            'otp_required'                 => $otp_required,
            'voice_fallback'               => $voice_fallback,
            'email_verification_required'  => $email_verification_required,
            'fields'                       => $fields,
        ], 200);
    }

    // =========================================================================
    // POST /register
    // =========================================================================

    /**
     * Handle registration submission.
     *
     * Flow:
     * 1. Validate all fields
     * 2. If OTP required and no verified session → send OTP, return session_key
     * 3. If OTP verified → create user, save custom fields, return JWT token
     */
    public function handle_register(WP_REST_Request $request) {
        if (!class_exists('FluentCommunity\Modules\Auth\AuthHelper')) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Fluent Community plugin is not active.',
            ], 503);
        }

        $auth_helper = 'FluentCommunity\Modules\Auth\AuthHelper';

        // Check registration enabled
        if (!$auth_helper::isRegistrationEnabled()) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Registration is currently disabled.',
            ], 422);
        }

        // Rate limit
        $rate_check = $auth_helper::isAuthRateLimit();
        if (is_wp_error($rate_check)) {
            return new WP_REST_Response([
                'success' => false,
                'message' => $rate_check->get_error_message(),
            ], 429);
        }

        $data = $request->get_json_params();
        if (empty($data)) {
            $data = $request->get_params();
        }

        // --- Validate base fields ---

        $errors = [];

        // Full name
        $full_name = sanitize_text_field(trim($data['full_name'] ?? ''));
        if (empty($full_name)) {
            $errors['full_name'] = 'Full name is required.';
        } elseif (strlen($full_name) > 100) {
            $errors['full_name'] = 'Full name must be 100 characters or less.';
        }

        // Email
        $email = sanitize_email($data['email'] ?? '');
        if (empty($email) || !is_email($email)) {
            $errors['email'] = 'A valid email address is required.';
        } elseif (email_exists($email)) {
            $errors['email'] = 'This email is already registered.';
        }

        // Username
        $username = sanitize_user(strtolower(preg_replace('/[^A-Za-z0-9_]/', '', $data['username'] ?? '')));
        if (empty($username)) {
            $errors['username'] = 'A valid username is required.';
        } elseif (strlen($username) < 4) {
            $errors['username'] = 'Username must be at least 4 characters.';
        } elseif (strlen($username) > 30) {
            $errors['username'] = 'Username must be 30 characters or less.';
        } elseif (username_exists($username)) {
            $errors['username'] = 'This username is already taken.';
        } elseif (class_exists('FluentCommunity\App\Services\ProfileHelper') &&
                  !\FluentCommunity\App\Services\ProfileHelper::isUsernameAvailable($username)) {
            $errors['username'] = 'This username is already taken.';
        }

        // Password
        $password = $data['password'] ?? '';
        $conf_password = $data['conf_password'] ?? '';
        if (empty($password)) {
            $errors['password'] = 'Password is required.';
        } elseif (strlen($password) > 50) {
            $errors['password'] = 'Password must be 50 characters or less.';
        }

        // Confirm password (if required by FC)
        if ($auth_helper::isPasswordConfRequired()) {
            if (empty($conf_password)) {
                $errors['conf_password'] = 'Password confirmation is required.';
            } elseif ($password !== $conf_password) {
                $errors['conf_password'] = 'Passwords do not match.';
            }
        }

        // Terms
        if (empty($data['terms'])) {
            $errors['terms'] = 'You must agree to the terms and conditions.';
        }

        // --- Validate custom fields from tbc-fluent-profiles ---

        $custom_field_values = [];
        if (class_exists('TBCFluentProfiles\Fields')) {
            $fp_fields = new \TBCFluentProfiles\Fields();
            $signup_fields = $fp_fields->get_fields_for('signup');

            foreach ($signup_fields as $key => $field) {
                $value = isset($data[$key]) ? trim(wp_unslash($data[$key])) : '';
                $custom_field_values[$key] = $value;

                if (!empty($field['required']) && $value === '') {
                    $errors[$key] = sprintf('%s is required.', $field['label']);
                }
            }
        }

        if (!empty($errors)) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Please fix the errors below.',
                'errors'  => $errors,
            ], 422);
        }

        // --- Email verification (Fluent Community 2FA) ---

        if ($auth_helper::isTwoFactorEnabled()) {
            $two_fa_code = sanitize_text_field($data['__two_fa_code'] ?? '');
            $two_fa_token = sanitize_text_field($data['__two_fa_signed_token'] ?? '');

            if (empty($two_fa_token)) {
                // No token yet — send verification email, return token
                $signed_token = $this->send_email_verification_code($full_name, $email);

                if (is_wp_error($signed_token)) {
                    return new WP_REST_Response([
                        'success' => false,
                        'message' => $signed_token->get_error_message(),
                    ], 500);
                }

                return new WP_REST_Response([
                    'success'                     => false,
                    'email_verification_required' => true,
                    'verification_token'          => $signed_token,
                    'message'                     => 'Please check your email for a verification code.',
                ], 200);
            }

            // Token provided — validate the email code
            $validation = $auth_helper::validateVerificationCode($two_fa_code, $two_fa_token, ['email' => $email]);

            if (is_wp_error($validation)) {
                return new WP_REST_Response([
                    'success' => false,
                    'message' => $validation->get_error_message(),
                ], 422);
            }

            // Email verified — fall through to OTP check / user creation
        }

        // --- OTP flow ---

        $session_key = sanitize_text_field($data['tbc_otp_session_key'] ?? '');

        if (class_exists('TBCOtpVerification\Helpers') && class_exists('TBCOtpVerification\Twilio')) {
            $otp_enabled = (bool) \TBCOtpVerification\Helpers::get_option('enable_registration_verification', true);

            if ($otp_enabled) {
                // If a verified session key is provided, let registration proceed
                if (!empty($session_key) && \TBCOtpVerification\Helpers::is_verified($session_key)) {
                    \TBCOtpVerification\Helpers::delete_session($session_key);
                    // Fall through to user creation
                } else {
                    // Extract phone and send OTP
                    $phone_meta_key = \TBCOtpVerification\Helpers::get_phone_meta_key();
                    $phone_field_key = $phone_meta_key;
                    if (strpos($phone_meta_key, '_tbc_fp_') === 0) {
                        $phone_field_key = substr($phone_meta_key, 8);
                    }

                    $phone_value = $data[$phone_field_key] ?? ($data[$phone_meta_key] ?? '');

                    if (!empty($phone_value)) {
                        $formatted = \TBCOtpVerification\Helpers::format_phone($phone_value);

                        if (empty($formatted)) {
                            return new WP_REST_Response([
                                'success' => false,
                                'message' => 'Please enter a valid phone number.',
                                'errors'  => ['phone' => 'Invalid phone number format.'],
                            ], 422);
                        }

                        // Check duplicates
                        if (\TBCOtpVerification\Helpers::is_duplicate($formatted)) {
                            return new WP_REST_Response([
                                'success' => false,
                                'message' => 'This phone number is already registered.',
                                'errors'  => [$phone_field_key => 'This phone number is already in use.'],
                            ], 422);
                        }

                        // Check blocked
                        if (\TBCOtpVerification\Helpers::is_blocked($formatted)) {
                            return new WP_REST_Response([
                                'success' => false,
                                'message' => 'This phone number cannot be used for registration.',
                                'errors'  => [$phone_field_key => 'This phone number is not allowed.'],
                            ], 422);
                        }

                        // Send OTP
                        $twilio = new \TBCOtpVerification\Twilio();
                        $result = $twilio->start_verification($formatted);

                        if (!$result['success']) {
                            return new WP_REST_Response([
                                'success' => false,
                                'message' => $result['message'],
                            ], 422);
                        }

                        // Store session
                        $clean_phone = $result['data']['phone'] ?? $formatted;
                        $new_session_key = \TBCOtpVerification\Helpers::generate_session_key('tbc_otp_session_');

                        \TBCOtpVerification\Helpers::store_session($new_session_key, [
                            'verified'     => false,
                            'phone_number' => $clean_phone,
                            'context'      => 'registration',
                        ]);

                        return new WP_REST_Response([
                            'success'      => false,
                            'otp_required' => true,
                            'session_key'  => $new_session_key,
                            'phone_masked' => \TBCOtpVerification\Helpers::mask_phone($clean_phone),
                        ], 200);
                    }
                    // No phone provided — skip OTP, let registration proceed
                }
            }
        }

        // --- Create user ---

        // Extract name parts
        $name_parts = explode(' ', $full_name);
        $first_name = $name_parts[0];
        $last_name = count($name_parts) > 1 ? implode(' ', array_slice($name_parts, 1)) : '';

        $user_id = $auth_helper::registerNewUser($username, $email, $password, [
            'first_name' => $first_name,
            'last_name'  => $last_name,
            'full_name'  => $full_name,
            'role'       => get_option('default_role', 'subscriber'),
        ]);

        if (is_wp_error($user_id)) {
            return new WP_REST_Response([
                'success' => false,
                'message' => wp_strip_all_tags($user_id->get_error_message()),
            ], 422);
        }

        // Save custom profile fields
        if (class_exists('TBCFluentProfiles\Fields') && !empty($custom_field_values)) {
            $fp_fields = new \TBCFluentProfiles\Fields();
            $signup_fields = $fp_fields->get_fields_for('signup');

            foreach ($custom_field_values as $key => $value) {
                if (isset($signup_fields[$key]) && $value !== '') {
                    $fp_fields->save_user_value($user_id, $key, $value, $signup_fields[$key]);
                }
            }
        }

        // Sync Fluent Community XProfile so avatar upload works immediately
        $fc_user = \FluentCommunity\App\Models\User::find($user_id);
        if ($fc_user) {
            $fc_user->syncXProfile(true, true);
        }

        // Generate JWT token pair for auto-login
        $tokens = $this->generate_jwt_token($user_id);

        if (is_wp_error($tokens)) {
            // User created but token failed - still return success but without token
            return new WP_REST_Response([
                'success' => true,
                'message' => 'Account created. Please log in.',
                'user'    => $this->format_user_response($user_id),
            ], 201);
        }

        return new WP_REST_Response([
            'success'       => true,
            'access_token'  => $tokens['access_token'],
            'refresh_token' => $tokens['refresh_token'],
            'user'          => $this->format_user_response($user_id),
        ], 201);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    /**
     * Generate JWT token pair for the given user.
     * Delegates to TBC_CA_Auth for self-contained JWT generation.
     *
     * @param int $user_id
     * @return array|WP_Error { access_token, refresh_token } or WP_Error on failure.
     */
    private function generate_jwt_token($user_id) {
        try {
            $auth = TBC_CA_Auth::get_instance();
            return $auth->generate_token_pair($user_id);
        } catch (\Exception $e) {
            return new WP_Error('jwt_generation_failed', 'Failed to generate authentication tokens.');
        }
    }

    /**
     * Format user data for the API response.
     *
     * @param int $user_id
     * @return array
     */
    private function format_user_response($user_id) {
        $user = get_user_by('ID', $user_id);

        $display_name = $user->display_name;
        if (empty($display_name) || $display_name === $user->user_login) {
            $display_name = trim($user->first_name . ' ' . $user->last_name);
            if (empty($display_name)) {
                $display_name = $user->user_login;
            }
        }

        return [
            'id'           => $user_id,
            'username'     => $user->user_login,
            'display_name' => $display_name,
            'email'        => $user->user_email,
        ];
    }

    // =========================================================================
    // Email verification helper
    // =========================================================================

    /**
     * Generate a 6-digit code, create a signed token, and send verification email.
     * Replicates the token format used by Fluent Community's AuthHelper
     * so that AuthHelper::validateVerificationCode() can validate it.
     *
     * @param string $full_name User's full name (for email greeting).
     * @param string $email     User's email address.
     * @return string|WP_Error  Signed token string on success, WP_Error on failure.
     */
    private function send_email_verification_code($full_name, $email) {
        // Generate 6-digit code (same range as Fluent's AuthHelper)
        $code = str_pad((string) random_int(100123, 900987), 6, '0', STR_PAD_LEFT);

        // Hash the code (validated by AuthHelper::validateVerificationCode via wp_check_password)
        $code_hash = wp_hash_password($code);

        // Create signed token in the exact format AuthHelper expects
        $token_data = wp_json_encode([
            'email'     => $email,
            'code_hash' => $code_hash,
            'expires'   => time() + 600, // 10 minutes
        ]);

        $token_base = base64_encode($token_data);
        $signature = hash_hmac('sha256', $token_base, SECURE_AUTH_KEY);
        $signed_token = $token_base . '.' . $signature;

        // Build email
        $name_parts = explode(' ', $full_name);
        $first_name = $name_parts[0];
        $site_name = get_bloginfo('name');

        $subject = sprintf('[%s] Your verification code: %s', $site_name, $code);

        $body = sprintf(
            "<p>Hello %s,</p>" .
            "<p>Your email verification code is:</p>" .
            "<p style=\"font-size: 28px; font-weight: bold; letter-spacing: 4px; text-align: center; " .
            "padding: 16px; background: #f3f4f6; border-radius: 8px;\">%s</p>" .
            "<p>This code expires in 10 minutes.</p>" .
            "<p>If you didn't request this, you can safely ignore this email.</p>",
            esc_html($first_name),
            esc_html($code)
        );

        // Set HTML content type
        add_filter('wp_mail_content_type', function () {
            return 'text/html';
        });

        $sent = wp_mail($email, $subject, $body);

        // Reset content type to avoid affecting other emails
        remove_all_filters('wp_mail_content_type');

        if (!$sent) {
            return new WP_Error('email_failed', 'Failed to send verification email. Please try again.');
        }

        return $signed_token;
    }

}
