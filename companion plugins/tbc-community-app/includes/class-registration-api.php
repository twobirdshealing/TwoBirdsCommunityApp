<?php
/**
 * Registration REST API - Base registration for the mobile app
 *
 * Provides registration endpoints using Fluent Community's AuthHelper.
 * Works standalone for basic registration (name, email, username, password,
 * FC custom fields, email 2FA). Add-on plugins hook in via filters:
 *
 *   tbc_ca_pre_register  — Intercept before user creation (e.g., OTP verification)
 *   tbc_ca_post_register — Act after user creation (e.g., mark profile incomplete)
 *
 * Endpoints:
 *   GET  /tbc-ca/v1/auth/register/fields  — Registration form field definitions
 *   POST /tbc-ca/v1/auth/register         — Submit registration
 *   GET  /tbc-ca/v1/auth/register/status  — Profile completion status (authenticated)
 *   POST /tbc-ca/v1/auth/register/complete — Mark registration complete (authenticated)
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

        // Inject enabled FC custom profile fields into FC's native signup form.
        // Without this, FC's web registration only shows base fields (name, email, etc.)
        // and custom fields like phone/SMS opt-in are missing.
        add_filter('fluent_community/auth/signup_fields', [$this, 'inject_custom_signup_fields'], 20, 1);

        // Fix input types that FC's FormBuilder strips (it only allows text/email/password).
        // Injects JS to convert date→date, number→number, phone→tel on the signup form.
        add_action('wp_footer', [$this, 'fix_signup_field_types']);

        // Save custom profile fields after FC's native web registration.
        // FC's signup handler creates the user but ignores injected custom fields.
        add_action('user_register', [$this, 'save_custom_fields_on_web_register']);
    }

    /**
     * Register REST routes
     */
    public function register_routes() {
        register_rest_route(TBC_CA_REST_NAMESPACE, '/auth/register/fields', [
            'methods'             => 'GET',
            'callback'            => [$this, 'handle_get_fields'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(TBC_CA_REST_NAMESPACE, '/auth/register', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_register'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(TBC_CA_REST_NAMESPACE, '/auth/register/status', [
            'methods'             => 'GET',
            'callback'            => [$this, 'handle_status'],
            'permission_callback' => function () {
                return is_user_logged_in();
            },
        ]);

        register_rest_route(TBC_CA_REST_NAMESPACE, '/auth/register/complete', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_complete'],
            'permission_callback' => function () {
                return is_user_logged_in();
            },
        ]);
    }

    // =========================================================================
    // GET /auth/register/fields
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

        // Build fields array — all on step 1
        $fields = [];

        // Step 1: base FC fields
        foreach ($fc_fields as $key => $field) {
            if ($key === 'terms') {
                continue;
            }

            $field_def = [
                'label'       => $field['label'] ?? '',
                'placeholder' => $field['placeholder'] ?? '',
                'type'        => $field['type'] ?? 'text',
                'required'    => !empty($field['required']),
                'step'        => 1,
            ];

            if (!empty($field['options'])) {
                $field_def['options'] = $field['options'];
            }

            $fields[$key] = $field_def;
        }

        // FC native custom profile fields (all enabled fields)
        $fc_field_defs = self::get_fc_field_definitions();

        foreach ($fc_field_defs as $cf) {
            $slug = $cf['slug'] ?? '';
            if (empty($slug) || empty($cf['is_enabled'])) {
                continue;
            }

            // If already added from FC auth fields, override type from real definition
            // (FC's FormBuilder downgrades types it can't render, e.g. date → text)
            if (isset($fields[$slug])) {
                $fields[$slug]['type'] = $cf['type'] ?? $fields[$slug]['type'];
                continue;
            }

            $field_def = [
                'label'       => $cf['label'] ?? $slug,
                'placeholder' => $cf['placeholder'] ?? '',
                'type'        => $cf['type'] ?? 'text',
                'required'    => !empty($cf['is_required']),
                'step'        => 1,
            ];

            // Map FC native types to input types for the app
            $type_map = [
                'text' => 'text', 'textarea' => 'textarea', 'number' => 'number',
                'date' => 'date', 'url' => 'url', 'select' => 'select',
                'radio' => 'radio', 'multiselect' => 'multiselect',
            ];
            $field_def['input_type'] = $type_map[$cf['type'] ?? 'text'] ?? 'text';

            if (!empty($cf['options']) && is_array($cf['options'])) {
                $field_def['options'] = $cf['options'];
            }

            if (!empty($cf['help_text'])) {
                $field_def['instructions'] = $cf['help_text'];
            }

            $fields[$slug] = $field_def;
        }

        // Slug-based type overrides for types FC doesn't natively support
        $app_type_overrides = [
            '_phone' => 'phone',
        ];
        foreach ($app_type_overrides as $slug => $override_type) {
            if (isset($fields[$slug])) {
                $fields[$slug]['type'] = $override_type;
            }
        }

        // Add terms checkbox at the end of step 1
        if (isset($fc_fields['terms'])) {
            $fields['terms'] = [
                'label'        => '',
                'type'         => 'inline_checkbox',
                'inline_label' => wp_kses_post($fc_fields['terms']['inline_label'] ?? 'I agree to the terms and conditions'),
                'required'     => true,
                'step'         => 1,
            ];
        }

        // Email verification (FC native 2FA)
        $email_verification_required = (bool) $auth_helper::isTwoFactorEnabled();

        return new \WP_REST_Response([
            'registration_enabled'        => $registration_enabled,
            'email_verification_required' => $email_verification_required,
            'fields'                      => $fields,
        ], 200);
    }

    // =========================================================================
    // POST /auth/register
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

        // --- Validate custom fields (FC native) ---

        $custom_field_values = [];
        $fc_field_defs = self::get_fc_field_definitions();

        foreach ($fc_field_defs as $cf) {
            $slug = $cf['slug'] ?? '';
            if (empty($slug) || empty($cf['is_enabled'])) {
                continue;
            }

            $value = isset($data[$slug]) ? trim(wp_unslash($data[$slug])) : '';
            $custom_field_values[$slug] = $value;

            if (!empty($cf['is_required']) && $value === '') {
                $errors[$slug] = sprintf('%s is required.', $cf['label'] ?? $slug);
            }
        }

        if (!empty($errors)) {
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

        // --- Pre-register hook (add-on plugins can intercept here) ---
        // Return a WP_REST_Response to interrupt registration (e.g., OTP required).
        // Return null to let registration proceed.

        $pre_register = apply_filters('tbc_ca_pre_register', null, $data, $request);
        if ($pre_register instanceof \WP_REST_Response) {
            return $pre_register;
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
            return new \WP_REST_Response([
                'success' => false,
                'message' => wp_strip_all_tags($user_id->get_error_message()),
            ], 422);
        }

        // Sync Fluent Community XProfile so avatar upload works immediately
        $fc_user = \FluentCommunity\App\Models\User::find($user_id);
        if ($fc_user) {
            $fc_user->syncXProfile(true, true);
        }

        // Save custom profile fields to FC native JSON (after XProfile sync creates the row)
        $values_to_save = array_filter($custom_field_values, function ($v) {
            return $v !== '';
        });
        if (!empty($values_to_save)) {
            self::set_fc_custom_fields($user_id, $values_to_save);
        }

        // --- Post-register hook (add-on plugins act here) ---
        // e.g., tbc-profile-completion marks user as incomplete

        do_action('tbc_ca_post_register', $user_id, $data, $request);

        // --- Auth response ---

        $context = sanitize_text_field($data['context'] ?? '');
        $response_data = [
            'success' => true,
            'user'    => self::format_user_response($user_id),
        ];

        // Web context: set auth cookie
        if ($context === 'web') {
            wp_set_auth_cookie($user_id, true);
        } else {
            // Mobile: generate JWT tokens directly
            $auth = TBC_CA_Auth::get_instance();
            $tokens = $auth->generate_token_pair($user_id);
            if ($tokens) {
                $response_data['access_token']  = $tokens['access_token'];
                $response_data['refresh_token'] = $tokens['refresh_token'];
            }
        }

        return new \WP_REST_Response($response_data, 201);
    }

    // =========================================================================
    // GET /auth/register/status — Profile completion status
    // =========================================================================

    /**
     * Returns profile completion status. Delegates to add-on plugins via filter.
     * Without tbc-profile-completion, always returns complete.
     */
    public function handle_status(\WP_REST_Request $request) {
        $user_id = get_current_user_id();

        $status = [
            'profile_complete' => true,
            'missing'          => [],
            'existing'         => [
                'bio'          => '',
                'website'      => '',
                'social_links' => new \stdClass(),
                'avatar'       => '',
                'cover_photo'  => '',
            ],
        ];

        // Populate existing profile data from FC XProfile
        if (class_exists('FluentCommunity\App\Models\XProfile')) {
            $xprofile = \FluentCommunity\App\Models\XProfile::where('user_id', $user_id)->first();
            if ($xprofile) {
                $status['existing']['bio'] = $xprofile->short_description ?? '';
                $raw_avatar = $xprofile->avatar ?? '';
                $status['existing']['avatar'] = self::is_placeholder_avatar($raw_avatar) ? '' : $raw_avatar;

                $meta = $xprofile->meta ?? [];
                if (is_string($meta)) {
                    $meta = maybe_unserialize($meta);
                }
                if (is_array($meta)) {
                    $status['existing']['website']     = $meta['website'] ?? '';
                    $status['existing']['cover_photo'] = $meta['cover_photo'] ?? '';
                    if (!empty($meta['social_links']) && is_array($meta['social_links'])) {
                        $status['existing']['social_links'] = $meta['social_links'];
                    }
                }
            }
        }

        /**
         * Filter profile completion status.
         * tbc-profile-completion hooks here to check required fields and set profile_complete.
         *
         * @param array $status  Status array with profile_complete, missing, existing.
         * @param int   $user_id Current user ID.
         */
        $status = apply_filters('tbc_ca_profile_status', $status, $user_id);

        return new \WP_REST_Response($status, 200);
    }

    // =========================================================================
    // POST /auth/register/complete — Mark registration complete
    // =========================================================================

    /**
     * Mark registration as complete. Delegates to add-on plugins via action.
     * Without tbc-profile-completion, this is a no-op that returns success.
     */
    public function handle_complete(\WP_REST_Request $request) {
        $user_id = get_current_user_id();

        /**
         * Validate and mark profile as complete.
         * tbc-profile-completion hooks here to validate required fields
         * and set _tbc_registration_complete meta.
         *
         * @param null|\WP_REST_Response $response null to proceed, WP_REST_Response to return early.
         * @param int $user_id Current user ID.
         */
        $response = apply_filters('tbc_ca_complete_registration', null, $user_id);

        if ($response instanceof \WP_REST_Response) {
            return $response;
        }

        return new \WP_REST_Response(['success' => true], 200);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    /**
     * Format user data for registration response.
     */
    private static function format_user_response($user_id) {
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
     * Get FC native custom profile field definitions.
     */
    public static function get_fc_field_definitions(): array {
        static $cache = null;
        if ($cache !== null) {
            return $cache;
        }

        if (!class_exists('FluentCommunity\App\Models\Meta')) {
            $cache = [];
            return $cache;
        }
        $meta = \FluentCommunity\App\Models\Meta::where('object_type', 'option')
            ->where('meta_key', 'custom_profile_fields')
            ->first();
        if (!$meta) {
            $cache = [];
            return $cache;
        }
        $config = $meta->value;
        $cache = $config['fields'] ?? [];
        return $cache;
    }

    /**
     * Save custom field values to FC XProfile custom_fields JSON.
     */
    public static function set_fc_custom_fields(int $user_id, array $values): bool {
        if (!class_exists('FluentCommunity\App\Models\XProfile')) {
            return false;
        }
        $xprofile = \FluentCommunity\App\Models\XProfile::where('user_id', $user_id)->first();
        if (!$xprofile) {
            return false;
        }
        $existing = is_array($xprofile->custom_fields) ? $xprofile->custom_fields : [];
        $xprofile->custom_fields = array_merge($existing, $values);
        $xprofile->save();

        // Announce the change so the Automator trigger can pick it up
        // (same action that fires on profile edits via tbc-automator-fcom-fields).
        $changed = [];
        foreach ($values as $slug => $new_value) {
            $old_value = $existing[$slug] ?? null;
            if (is_array($new_value) || is_array($old_value)) {
                if ((array) $old_value !== (array) $new_value) {
                    $changed[$slug] = ['old_value' => $old_value, 'new_value' => $new_value];
                }
            } elseif ((string) ($old_value ?? '') !== (string) $new_value) {
                $changed[$slug] = ['old_value' => $old_value, 'new_value' => $new_value];
            }
        }
        if (!empty($changed)) {
            do_action('tbc_fcom/profile_custom_fields_updated', $user_id, $changed, $xprofile->custom_fields);
        }

        return true;
    }

    /**
     * Check if an avatar URL is a Fluent placeholder.
     */
    private static function is_placeholder_avatar(string $url): bool {
        if (empty($url)) {
            return true;
        }
        return strpos($url, 'fcom_placeholder') !== false || strpos($url, 'fluent-community/assets') !== false;
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

    /**
     * Save custom profile fields when a user registers via FC's native web signup.
     *
     * FC's registration handler creates the user but doesn't save the custom
     * fields we inject into the signup form. The user_register hook fires inside
     * wp_insert_user() — BEFORE FC's handleSignupCompleted() calls syncXProfile(),
     * so we must ensure the XProfile row exists before saving custom fields.
     *
     * @param int $user_id Newly created user ID.
     */
    public function save_custom_fields_on_web_register(int $user_id): void {
        // Only act during FC's native web registration AJAX call
        if (
            !defined('DOING_AJAX') || !DOING_AJAX ||
            empty($_POST['action']) || $_POST['action'] !== 'fcom_user_registration'
        ) {
            return;
        }

        $fc_field_defs = self::get_fc_field_definitions();
        if (empty($fc_field_defs)) {
            return;
        }

        $custom_values = [];
        foreach ($fc_field_defs as $cf) {
            $slug = $cf['slug'] ?? '';
            if (empty($slug) || empty($cf['is_enabled'])) {
                continue;
            }
            $value = isset($_POST[$slug]) ? trim(wp_unslash($_POST[$slug])) : '';
            if ($value !== '') {
                $custom_values[$slug] = $value;
            }
        }

        if (empty($custom_values)) {
            return;
        }

        // user_register fires before FC creates the XProfile row, so ensure it
        // exists first. syncXProfile is idempotent — FC calling it again later
        // in handleSignupCompleted() is harmless.
        if (!class_exists('FluentCommunity\App\Models\User')) {
            return;
        }
        $fc_user = \FluentCommunity\App\Models\User::find($user_id);
        if (!$fc_user) {
            return;
        }
        $fc_user->syncXProfile(true, true);

        self::set_fc_custom_fields($user_id, $custom_values);
    }

    /**
     * Inject enabled FC custom profile fields into the native signup form.
     *
     * FC's default signup only shows base fields (name, email, username, password, terms).
     * Custom profile fields (phone, SMS opt-in, state, etc.) are only shown on profile edit.
     * This filter adds them to the signup form so they appear on web registration
     * and their values are included in the POST data.
     *
     * @param array $fields Current signup fields.
     * @return array Modified fields with custom profile fields injected before terms.
     */
    public function inject_custom_signup_fields(array $fields): array {
        $fc_field_defs = self::get_fc_field_definitions();

        if (empty($fc_field_defs)) {
            return $fields;
        }

        // Extract terms to re-add at the end
        $terms = null;
        if (isset($fields['terms'])) {
            $terms = $fields['terms'];
            unset($fields['terms']);
        }

        foreach ($fc_field_defs as $cf) {
            $slug = $cf['slug'] ?? '';
            if (empty($slug) || empty($cf['is_enabled'])) {
                continue;
            }

            // Skip if already present (e.g. added by FC itself or another plugin)
            if (isset($fields[$slug])) {
                continue;
            }

            $fc_type = $cf['type'] ?? 'text';

            // Map FC custom field types to types FC's native signup form can render.
            // The signup form only handles: text, email, password, select, inline_checkbox.
            $type_map = [
                'text'        => 'text',
                'textarea'    => 'text',
                'number'      => 'text',
                'date'        => 'text',
                'url'         => 'text',
                'select'      => 'select',
                'radio'       => 'select',     // radio → dropdown
                'multiselect' => 'select',
            ];
            $signup_type = $type_map[$fc_type] ?? 'text';

            $field_def = [
                'label'       => $cf['label'] ?? $slug,
                'placeholder' => $cf['placeholder'] ?? '',
                'type'        => $signup_type,
                'required'    => !empty($cf['is_required']),
            ];

            if (!empty($cf['options']) && is_array($cf['options'])) {
                $field_def['options'] = $cf['options'];
            }

            if (!empty($cf['help_text'])) {
                $field_def['help_text'] = $cf['help_text'];
            }

            $fields[$slug] = $field_def;
        }

        // Re-add terms at the end
        if ($terms) {
            $fields['terms'] = $terms;
        }

        return $fields;
    }

    /**
     * Fix input types on FC's native signup form.
     *
     * FC's FormBuilder only allows text/email/password input types — everything
     * else is stripped. This injects a small script that converts fields back to
     * their correct HTML5 types (date, number, tel) so browsers show native pickers.
     */
    public function fix_signup_field_types(): void {
        // Only run on FC's signup page
        if (empty($_GET['fcom_action']) || sanitize_key($_GET['fcom_action']) !== 'auth') {
            return;
        }

        $fc_field_defs = self::get_fc_field_definitions();
        if (empty($fc_field_defs)) {
            return;
        }

        // Slug-based overrides for fields whose FC type doesn't match the ideal HTML5 type
        // (e.g. FC stores phone as 'text' but browsers benefit from type="tel")
        $slug_overrides = [
            '_phone' => 'tel',
        ];

        // Collect slugs that need type correction
        $type_fixes = []; // slug => correct HTML5 type
        foreach ($fc_field_defs as $cf) {
            $slug = $cf['slug'] ?? '';
            $type = $cf['type'] ?? 'text';
            if (empty($slug) || empty($cf['is_enabled'])) {
                continue;
            }
            if (isset($slug_overrides[$slug])) {
                $type_fixes[$slug] = $slug_overrides[$slug];
            } elseif (in_array($type, ['date', 'number'], true)) {
                $type_fixes[$slug] = $type;
            }
        }

        if (empty($type_fixes)) {
            return;
        }

        $fixes_json = wp_json_encode($type_fixes);
        ?>
        <script>
        (function(){
            var fixes = <?php echo $fixes_json; ?>;
            function apply() {
                Object.keys(fixes).forEach(function(slug) {
                    var el = document.querySelector('input[name="' + slug + '"]');
                    if (el) el.type = fixes[slug];
                });
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', apply);
            } else {
                apply();
            }
        })();
        </script>
        <?php
    }
}
