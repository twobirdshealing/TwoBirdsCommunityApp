<?php
/**
 * Auth REST API - Login, refresh, and logout endpoints.
 *
 * Endpoints:
 *   POST /tbc-ca/v1/auth/login   - Authenticate with username+password → access + refresh tokens
 *   POST /tbc-ca/v1/auth/refresh - Exchange refresh token for a new access token
 *   POST /tbc-ca/v1/auth/logout  - Revoke session (invalidate tokens)
 *
 * @package TBC_Community_App
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_Auth_API {

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
     * Register REST routes.
     */
    public function register_routes() {
        // POST /auth/login — public
        register_rest_route(TBC_CA_REST_NAMESPACE, '/auth/login', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_login'],
            'permission_callback' => '__return_true',
        ]);

        // POST /auth/refresh — public (token in body)
        register_rest_route(TBC_CA_REST_NAMESPACE, '/auth/refresh', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_refresh'],
            'permission_callback' => '__return_true',
        ]);

        // POST /auth/logout — authenticated
        register_rest_route(TBC_CA_REST_NAMESPACE, '/auth/logout', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_logout'],
            'permission_callback' => function () {
                return is_user_logged_in();
            },
        ]);
    }

    // =========================================================================
    // POST /auth/login
    // =========================================================================

    /**
     * Authenticate user and return access + refresh tokens.
     */
    public function handle_login(WP_REST_Request $request) {
        $data = $request->get_json_params();
        if (empty($data)) {
            $data = $request->get_params();
        }

        $username = sanitize_user($data['username'] ?? '');
        $password = $data['password'] ?? '';

        // Validate required fields
        if (empty($username) || empty($password)) {
            return new WP_REST_Response([
                'code'    => 'tbc_auth_missing_fields',
                'message' => 'Username and password are required.',
            ], 400);
        }

        // Authenticate via WordPress
        $user = wp_authenticate($username, $password);

        if (is_wp_error($user)) {
            return $this->map_auth_error($user);
        }

        // Generate token pair
        $auth = TBC_CA_Auth::get_instance();
        $tokens = $auth->generate_token_pair($user->ID);

        // Build user object with avatar from Fluent Community
        $user_data = $this->build_user_response($user);

        return new WP_REST_Response([
            'access_token'  => $tokens['access_token'],
            'refresh_token' => $tokens['refresh_token'],
            'user'          => $user_data,
        ], 200);
    }

    // =========================================================================
    // POST /auth/refresh
    // =========================================================================

    /**
     * Exchange a valid refresh token for a new access token.
     */
    public function handle_refresh(WP_REST_Request $request) {
        $data = $request->get_json_params();
        if (empty($data)) {
            $data = $request->get_params();
        }

        $refresh_token = $data['refresh_token'] ?? '';

        if (empty($refresh_token)) {
            return new WP_REST_Response([
                'code'    => 'tbc_auth_missing_fields',
                'message' => 'Refresh token is required.',
            ], 400);
        }

        // Validate the refresh token
        $auth = TBC_CA_Auth::get_instance();
        $result = $auth->validate_token($refresh_token, 'refresh');

        if (is_wp_error($result)) {
            $status = $result->get_error_data()['status'] ?? 401;
            return new WP_REST_Response([
                'code'    => $result->get_error_code(),
                'message' => $result->get_error_message(),
            ], $status);
        }

        // Generate a new access token with the SAME JTI (refresh token stays valid)
        $jti = $result['token']->jti;
        $access_token = $auth->generate_access_token($result['user_id'], $jti);

        return new WP_REST_Response([
            'access_token' => $access_token,
        ], 200);
    }

    // =========================================================================
    // POST /auth/logout
    // =========================================================================

    /**
     * Revoke the current session.
     */
    public function handle_logout(WP_REST_Request $request) {
        $user_id = get_current_user_id();
        $auth = TBC_CA_Auth::get_instance();

        // If a refresh token is provided, revoke that specific session
        $data = $request->get_json_params();
        $refresh_token = $data['refresh_token'] ?? '';

        if (!empty($refresh_token)) {
            $result = $auth->validate_token($refresh_token, 'refresh');
            if (!is_wp_error($result) && isset($result['token']->jti)) {
                $auth->revoke_jti($user_id, $result['token']->jti);
            }
        } else {
            // No refresh token — try to revoke the access token's JTI
            $auth_header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
            if (stripos($auth_header, 'Bearer ') === 0) {
                $token = trim(substr($auth_header, 7));
                $result = $auth->validate_token($token, 'access');
                if (!is_wp_error($result) && isset($result['token']->jti)) {
                    $auth->revoke_jti($user_id, $result['token']->jti);
                }
            }
        }

        return new WP_REST_Response([
            'success' => true,
            'message' => 'Logged out successfully.',
        ], 200);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    /**
     * Map wp_authenticate WP_Error codes to user-friendly REST responses.
     * Returns a generic message to prevent user enumeration.
     *
     * @param WP_Error $error The authentication error.
     * @return WP_REST_Response
     */
    private function map_auth_error(WP_Error $error) {
        $code = $error->get_error_code();

        // Empty field errors
        if (in_array($code, ['empty_username', 'empty_password'], true)) {
            return new WP_REST_Response([
                'code'    => 'tbc_auth_missing_fields',
                'message' => 'Username and password are required.',
            ], 400);
        }

        // All credential errors return the same generic message (prevents enumeration)
        return new WP_REST_Response([
            'code'    => 'tbc_auth_invalid_credentials',
            'message' => 'Invalid username or password.',
        ], 401);
    }

    /**
     * Build user response object including Fluent Community avatar.
     *
     * @param WP_User $user WordPress user object.
     * @return array User data for the API response.
     */
    private function build_user_response($user) {
        $display_name = $user->display_name;
        if (empty($display_name) || $display_name === $user->user_login) {
            $display_name = trim($user->first_name . ' ' . $user->last_name);
            if (empty($display_name)) {
                $display_name = $user->user_login;
            }
        }

        $avatar  = '';
        $fc_user = null;

        // Get Fluent Community profile (if available)
        if (class_exists('FluentCommunity\App\Models\User')) {
            try {
                $fc_user = \FluentCommunity\App\Models\User::find($user->ID);
                if ($fc_user && !empty($fc_user->photo)) {
                    $avatar = $fc_user->photo;
                }
            } catch (\Exception $e) {
                // Fallback to WordPress avatar
            }
        }

        // Fallback to WordPress avatar URL
        if (empty($avatar)) {
            $avatar = get_avatar_url($user->ID, ['size' => 200]);
        }

        return [
            'id'           => $user->ID,
            'username'     => $user->user_nicename,
            'display_name' => $display_name,
            'first_name'   => $user->first_name,
            'last_name'    => $user->last_name,
            'email'        => $user->user_email,
            'avatar'       => $avatar,
            'is_verified'  => $fc_user ? (int) $fc_user->is_verified : 0,
            'status'       => $fc_user ? $fc_user->status : 'active',
        ];
    }
}
