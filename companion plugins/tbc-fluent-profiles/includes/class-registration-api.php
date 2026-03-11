<?php
/**
 * Registration REST API
 *
 * Provides REST API endpoints for user registration from both the mobile app
 * and the web shortcode page. Uses hook-based JWT integration so tbc-community-app
 * can attach tokens for mobile clients.
 *
 * Endpoints:
 *   GET  /tbc-fp/v1/register/fields  - Get registration form field definitions
 *   POST /tbc-fp/v1/register         - Submit registration (handles OTP + email verify flow)
 *
 * @package TBC_Fluent_Profiles
 */

namespace TBCFluentProfiles;

defined('ABSPATH') || exit;

class RegistrationApi {

    private Fields $fields;
    private Twilio $twilio;

    public function __construct(Fields $fields, Twilio $twilio) {
        $this->fields = $fields;
        $this->twilio = $twilio;
    }

    /**
     * Register REST routes
     */
    public function register_routes() {
        register_rest_route(TBC_FP_REST_NAMESPACE, '/register/fields', [
            'methods'             => 'GET',
            'callback'            => [$this, 'handle_get_fields'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(TBC_FP_REST_NAMESPACE, '/register', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_register'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(TBC_FP_REST_NAMESPACE, '/register/complete', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_complete'],
            'permission_callback' => function () {
                return is_user_logged_in();
            },
        ]);

        register_rest_route(TBC_FP_REST_NAMESPACE, '/register/status', [
            'methods'             => 'GET',
            'callback'            => [$this, 'handle_status'],
            'permission_callback' => function () {
                return is_user_logged_in();
            },
        ]);
    }

    /**
     * Mark registration as complete (steps 5-6 finished or skipped).
     */
    public function handle_complete(\WP_REST_Request $request) {
        update_user_meta(get_current_user_id(), TBC_FP_META_REGISTRATION_COMPLETE, '1');
        return new \WP_REST_Response(['success' => true], 200);
    }

    /**
     * Check profile completion status for the authenticated user.
     * Used by the mobile app on login to decide whether to show the profile completion gate.
     */
    public function handle_status(\WP_REST_Request $request) {
        $user_id = get_current_user_id();
        $missing = [];
        $existing = [
            'bio'          => '',
            'website'      => '',
            'social_links' => new \stdClass(),
            'avatar'       => '',
            'cover_photo'  => '',
        ];

        if (class_exists('\FluentCommunity\App\Models\XProfile')) {
            $xprofile = \FluentCommunity\App\Models\XProfile::where('user_id', $user_id)->first();
            if ($xprofile) {
                $missing = RegistrationPage::get_missing_fields($xprofile);

                $existing['bio']    = $xprofile->short_description ?? '';
                $existing['avatar'] = $xprofile->avatar ?? '';

                // cover_photo, social_links, website are in the serialized `meta` column
                $meta = $xprofile->meta ?? [];
                if (is_string($meta)) {
                    $meta = maybe_unserialize($meta);
                }
                if (is_array($meta)) {
                    $existing['website']     = $meta['website'] ?? '';
                    $existing['cover_photo'] = $meta['cover_photo'] ?? '';

                    if (!empty($meta['social_links']) && is_array($meta['social_links'])) {
                        $existing['social_links'] = $meta['social_links'];
                    }
                }
            }
        }

        // Derive completion from what we already know (no redundant XProfile query)
        $gate_enabled = Helpers::get_option('profile_completion_enabled', true);
        $is_complete = !$gate_enabled || empty($missing);

        return new \WP_REST_Response([
            'profile_complete' => $is_complete,
            'missing'          => $missing,
            'existing'         => $existing,
        ], 200);
    }

    // =========================================================================
    // GET /register/fields
    // =========================================================================

    public function handle_get_fields(\WP_REST_Request $request) {
        if (!class_exists('FluentCommunity\Modules\Auth\AuthHelper')) {
            return new \WP_REST_Response([
                'registration_enabled' => false,
                'message'              => 'Fluent Community plugin is not active.',
            ], 503);
        }

        $auth_helper = 'FluentCommunity\Modules\Auth\AuthHelper';

        $registration_enabled = $auth_helper::isRegistrationEnabled();

        // Get base Fluent Community form fields
        $fc_fields = $auth_helper::getFormFields();

        // Build fields array with step assignments
        $fields = [];
        $base_keys = ['full_name', 'email', 'username', 'password', 'conf_password'];

        // Step 1: base FC fields
        foreach ($fc_fields as $key => $field) {
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

            $fields[$key] = $field_def;
        }

        // Step 2: custom profile fields marked "show on signup"
        $signup_fields = $this->fields->get_fields_for('signup');

        foreach ($signup_fields as $key => $cf) {
            // Skip if already added from FC fields above
            if (isset($fields[$key])) {
                continue;
            }

            $type_config = Fields::get_type_config($cf['type']);

            $field_def = [
                'label'       => $cf['label'] ?? $key,
                'placeholder' => $cf['placeholder'] ?? '',
                'type'        => $cf['type'],
                'input_type'  => $type_config['input_type'] ?? 'text',
                'required'    => !empty($cf['required']),
                'step'        => 2,
            ];

            $options = Fields::get_field_options($cf);
            if (!empty($options)) {
                $field_def['options'] = $options;
            }

            if (!empty($cf['instructions'])) {
                $field_def['instructions'] = $cf['instructions'];
            }

            $fields[$key] = $field_def;
        }

        // Add terms checkbox at the end of step 2
        if (isset($fc_fields['terms'])) {
            $fields['terms'] = [
                'label'        => '',
                'type'         => 'inline_checkbox',
                'inline_label' => wp_kses_post($fc_fields['terms']['inline_label'] ?? 'I agree to the terms and conditions'),
                'required'     => true,
                'step'         => 2,
            ];
        }

        // OTP settings
        $otp_required   = (bool) Helpers::get_option('enable_registration_verification', true);
        $voice_fallback = (bool) Helpers::get_option('enable_voice_fallback', false);

        // Email verification
        $email_verification_required = (bool) $auth_helper::isTwoFactorEnabled();

        return new \WP_REST_Response([
            'registration_enabled'        => $registration_enabled,
            'otp_required'                => $otp_required,
            'voice_fallback'              => $voice_fallback,
            'email_verification_required' => $email_verification_required,
            'fields'                      => $fields,
        ], 200);
    }

    // =========================================================================
    // POST /register
    // =========================================================================

    public function handle_register(\WP_REST_Request $request) {
        if (!class_exists('FluentCommunity\Modules\Auth\AuthHelper')) {
            return new \WP_REST_Response([
                'success' => false,
                'message' => 'Fluent Community plugin is not active.',
            ], 503);
        }

        $auth_helper = 'FluentCommunity\Modules\Auth\AuthHelper';

        if (!$auth_helper::isRegistrationEnabled()) {
            return new \WP_REST_Response([
                'success' => false,
                'message' => 'Registration is currently disabled.',
            ], 422);
        }

        // Rate limit
        $rate_check = $auth_helper::isAuthRateLimit();
        if (is_wp_error($rate_check)) {
            return new \WP_REST_Response([
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

        $full_name = sanitize_text_field(trim($data['full_name'] ?? ''));
        if (empty($full_name)) {
            $errors['full_name'] = 'Full name is required.';
        } elseif (strlen($full_name) > 100) {
            $errors['full_name'] = 'Full name must be 100 characters or less.';
        }

        $email = sanitize_email($data['email'] ?? '');
        if (empty($email) || !is_email($email)) {
            $errors['email'] = 'A valid email address is required.';
        } elseif (email_exists($email)) {
            $errors['email'] = 'This email is already registered.';
        }

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

        $password = $data['password'] ?? '';
        $conf_password = $data['conf_password'] ?? '';
        if (empty($password)) {
            $errors['password'] = 'Password is required.';
        } elseif (strlen($password) > 50) {
            $errors['password'] = 'Password must be 50 characters or less.';
        }

        if ($auth_helper::isPasswordConfRequired()) {
            if (empty($conf_password)) {
                $errors['conf_password'] = 'Password confirmation is required.';
            } elseif ($password !== $conf_password) {
                $errors['conf_password'] = 'Passwords do not match.';
            }
        }

        if (empty($data['terms'])) {
            $errors['terms'] = 'You must agree to the terms and conditions.';
        }

        // --- Validate custom fields ---

        $custom_field_values = [];
        $signup_fields = $this->fields->get_fields_for('signup');

        foreach ($signup_fields as $key => $field) {
            $value = isset($data[$key]) ? trim(wp_unslash($data[$key])) : '';
            $custom_field_values[$key] = $value;

            if (!empty($field['required']) && $value === '') {
                $errors[$key] = sprintf('%s is required.', $field['label']);
            }
        }

        if (!empty($errors)) {
            Helpers::log('Registration validation failed: ' . wp_json_encode($errors), 'warn');
            return new \WP_REST_Response([
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
                $signed_token = $this->send_email_verification_code($full_name, $email);

                if (is_wp_error($signed_token)) {
                    return new \WP_REST_Response([
                        'success' => false,
                        'message' => $signed_token->get_error_message(),
                    ], 500);
                }

                return new \WP_REST_Response([
                    'success'                     => false,
                    'email_verification_required' => true,
                    'verification_token'          => $signed_token,
                    'message'                     => 'Please check your email for a verification code.',
                ], 200);
            }

            $validation = $auth_helper::validateVerificationCode($two_fa_code, $two_fa_token, ['email' => $email]);

            if (is_wp_error($validation)) {
                return new \WP_REST_Response([
                    'success' => false,
                    'message' => $validation->get_error_message(),
                ], 422);
            }
        }

        // --- OTP flow ---

        $session_key = sanitize_text_field($data['tbc_otp_session_key'] ?? '');
        $otp_enabled = (bool) Helpers::get_option('enable_registration_verification', true);

        if ($otp_enabled) {
            Helpers::log('OTP flow: enabled=' . ($otp_enabled ? 'yes' : 'no') . ' session_key=' . ($session_key ?: '(none)') . ' is_verified=' . (!empty($session_key) && Helpers::is_verified($session_key) ? 'yes' : 'no'));
            if (!empty($session_key) && Helpers::is_verified($session_key)) {
                Helpers::log('OTP session verified, proceeding to user creation');
                Helpers::delete_session($session_key);
                // Fall through to user creation
            } else {
                $phone_meta_key = Helpers::get_phone_meta_key();
                $phone_field_key = $phone_meta_key;
                if (strpos($phone_meta_key, '_tbc_fp_') === 0) {
                    $phone_field_key = substr($phone_meta_key, 8);
                }

                $phone_value = $data[$phone_field_key] ?? ($data[$phone_meta_key] ?? '');

                if (!empty($phone_value)) {
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
                            'errors'  => [$phone_field_key => 'This phone number is already in use.'],
                        ], 422);
                    }

                    if (Helpers::is_blocked($formatted)) {
                        return new \WP_REST_Response([
                            'success' => false,
                            'message' => 'This phone number cannot be used for registration.',
                            'errors'  => [$phone_field_key => 'This phone number is not allowed.'],
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
                // No phone provided — skip OTP, let registration proceed
            }
        }

        // --- Create user ---

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
            Helpers::log('User creation failed: ' . $user_id->get_error_message(), 'error');
            return new \WP_REST_Response([
                'success' => false,
                'message' => wp_strip_all_tags($user_id->get_error_message()),
            ], 422);
        }

        Helpers::log('User created: ID=' . $user_id . ' username=' . $username);

        // Mark registration as incomplete — user must finish steps 5-6 (social links + avatar)
        update_user_meta($user_id, TBC_FP_META_REGISTRATION_COMPLETE, '0');

        // Save custom profile fields
        if (!empty($custom_field_values)) {
            foreach ($custom_field_values as $key => $value) {
                if (isset($signup_fields[$key]) && $value !== '') {
                    $this->fields->save_user_value($user_id, $key, $value, $signup_fields[$key]);
                }
            }
        }

        // Sync Fluent Community XProfile so avatar upload works immediately
        $fc_user = \FluentCommunity\App\Models\User::find($user_id);
        if ($fc_user) {
            $fc_user->syncXProfile(true, true);
        }

        // --- Auth response ---

        $context = sanitize_text_field($data['context'] ?? '');
        $response_data = [
            'success' => true,
            'user'    => $this->format_user_response($user_id),
        ];

        // Web context: set auth cookie. JS reloads the page after this response
        // so the cookie is in the browser for subsequent authenticated requests.
        if ($context === 'web') {
            wp_set_auth_cookie($user_id, true);
            Helpers::log('Web auth: cookie set for user_id=' . $user_id);
        }

        /**
         * Hook for other plugins to attach auth tokens to the registration response.
         * tbc-community-app hooks here to generate and attach JWT tokens for mobile.
         *
         * @param array            $response_data Response data (passed by reference via filter).
         * @param int              $user_id       Newly created user ID.
         * @param WP_REST_Request  $request       The original request.
         */
        $response_data = apply_filters('tbc_fp_registration_response', $response_data, $user_id, $request);

        return new \WP_REST_Response($response_data, 201);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

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

    /**
     * Generate a 6-digit code, create a signed token, and send verification email.
     * Replicates the token format used by Fluent Community's AuthHelper.
     *
     * @return string|\WP_Error Signed token string on success, WP_Error on failure.
     */
    private function send_email_verification_code($full_name, $email) {
        $code = str_pad((string) random_int(100123, 900987), 6, '0', STR_PAD_LEFT);
        $code_hash = wp_hash_password($code);

        $token_data = wp_json_encode([
            'email'     => $email,
            'code_hash' => $code_hash,
            'expires'   => time() + 600,
        ]);

        $token_base = base64_encode($token_data);
        $signature = hash_hmac('sha256', $token_base, SECURE_AUTH_KEY);
        $signed_token = $token_base . '.' . $signature;

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

        $html_content_type = function () { return 'text/html'; };
        add_filter('wp_mail_content_type', $html_content_type);

        $sent = wp_mail($email, $subject, $body);

        remove_filter('wp_mail_content_type', $html_content_type);

        if (!$sent) {
            return new \WP_Error('email_failed', 'Failed to send verification email. Please try again.');
        }

        return $signed_token;
    }
}
