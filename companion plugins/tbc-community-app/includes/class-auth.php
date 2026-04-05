<?php
/**
 * JWT Authentication - Self-contained token generation, validation, and session management.
 *
 * Replaces the third-party "JWT Authentication for WP REST API" plugin.
 *
 * Hooks:
 *   rest_api_init           (priority 0)  — disable cookie auth when Bearer token present
 *   determine_current_user  (priority 99) — decode Bearer token → set WP user
 *   rest_authentication_errors (priority 99) — surface JWT errors to REST responses
 *
 * Token model:
 *   Access token  — 1 day,  used in Authorization header for API calls
 *   Refresh token — 6 months, used to obtain new access tokens without re-login
 *   Both share a JTI (JWT ID) stored in user_meta for revocation.
 *
 * @package TBC_Community_App
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_Auth {

    private static $instance = null;

    /** @var \WP_Error|null Stored JWT error for rest_authentication_errors filter */
    private $jwt_error = null;

    /** User meta key for JTI session tracking */
    const SESSION_META_KEY = '_tbc_jwt_sessions';

    /** Token expiry durations */
    const ACCESS_TOKEN_EXPIRY  = DAY_IN_SECONDS;          // 1 day
    const REFRESH_TOKEN_EXPIRY = MONTH_IN_SECONDS * 6;    // 6 months

    /** Max concurrent sessions per user (oldest evicted on new login) */
    const MAX_SESSIONS_PER_USER = 3;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        // Validate Bearer tokens on REST requests (after other auth plugins)
        add_filter('determine_current_user', [$this, 'determine_current_user'], 99);
        add_filter('rest_authentication_errors', [$this, 'rest_authentication_errors'], 99);

        // Remove cookie nonce check early when JWT Bearer token is present.
        // Must run at rest_api_init priority 0 — before rest_cookie_collect_status (priority 10)
        // and before rest_authentication_errors filter chain executes.
        add_action('rest_api_init', [$this, 'maybe_disable_cookie_auth'], 0);
    }

    // =========================================================================
    // WordPress Auth Filters
    // =========================================================================

    /**
     * When a Bearer token is present, remove rest_cookie_check_errors() before
     * it can run. Hooked at rest_api_init priority 0 — before
     * rest_cookie_collect_status (priority 10) and before rest_authentication_errors.
     *
     * This is the ONLY reliable place to do this. Removing it inside
     * determine_current_user is too late — the filter callbacks are already queued.
     */
    public function maybe_disable_cookie_auth() {
        $auth_header = $this->get_authorization_header();
        if ($auth_header && stripos($auth_header, 'Bearer ') === 0) {
            remove_filter('rest_authentication_errors', 'rest_cookie_check_errors', 100);
        }
    }

    /**
     * Decode Bearer token from Authorization header and return the authenticated user ID.
     *
     * When a Bearer token is present, JWT ALWAYS takes precedence over cookie auth.
     * rest_cookie_check_errors is already removed by maybe_disable_cookie_auth(),
     * so we don't need to handle cookie conflicts here.
     *
     * @param int $user_id Current user ID (0 if not yet authenticated).
     * @return int Authenticated user ID, or unchanged $user_id.
     */
    public function determine_current_user($user_id) {
        // Only run on REST API requests
        if (!defined('REST_REQUEST') || !REST_REQUEST) {
            return $user_id;
        }

        $auth_header = $this->get_authorization_header();
        if (!$auth_header || stripos($auth_header, 'Bearer ') !== 0) {
            return $user_id;
        }

        $token = trim(substr($auth_header, 7));
        if (empty($token)) {
            return $user_id;
        }

        $result = $this->validate_token($token, 'access');

        if (is_wp_error($result)) {
            $this->jwt_error = $result;
            // JWT was provided but invalid — don't fall back to cookie auth
            return 0;
        }

        // Rebuild Fluent Community space cache periodically (every 5 min per user).
        // The web portal does this on every page load via PortalHandler, but JWT
        // auth never hits that path. Without this, users added to spaces (e.g. via
        // participant-frontend or automations) won't see posts until they re-login.
        $this->maybe_rebuild_space_cache($result['user_id']);

        return $result['user_id'];
    }

    /**
     * Surface stored JWT errors so REST responses include proper error codes.
     *
     * @param \WP_Error|null|bool $error Existing error, if any.
     * @return \WP_Error|null|bool
     */
    public function rest_authentication_errors($error) {
        if (!empty($error)) {
            return $error;
        }
        return $this->jwt_error ?? $error;
    }

    // =========================================================================
    // Token Generation
    // =========================================================================

    /**
     * Generate an access + refresh token pair for a user.
     *
     * @param int $user_id WordPress user ID.
     * @return array { access_token: string, refresh_token: string }
     */
    public function generate_token_pair($user_id) {
        $jti = $this->create_jti($user_id);

        return [
            'access_token'  => $this->generate_access_token($user_id, $jti),
            'refresh_token' => $this->generate_refresh_token($user_id, $jti),
        ];
    }

    /**
     * Generate an access token (short-lived, for API calls).
     *
     * @param int    $user_id WordPress user ID.
     * @param string $jti     JWT ID (shared with refresh token).
     * @return string Encoded JWT.
     */
    public function generate_access_token($user_id, $jti) {
        $now = time();

        $payload = [
            'iss'  => get_bloginfo('url'),
            'iat'  => $now,
            'nbf'  => $now,
            'exp'  => $now + self::ACCESS_TOKEN_EXPIRY,
            'jti'  => $jti,
            'data' => [
                'user' => ['id' => $user_id],
                'type' => 'access',
            ],
        ];

        return \Firebase\JWT\JWT::encode($payload, $this->get_secret_key(), 'HS256');
    }

    /**
     * Generate a refresh token (long-lived, for obtaining new access tokens).
     *
     * @param int    $user_id WordPress user ID.
     * @param string $jti     JWT ID (shared with access token).
     * @return string Encoded JWT.
     */
    public function generate_refresh_token($user_id, $jti) {
        $now = time();

        $payload = [
            'iss'  => get_bloginfo('url'),
            'iat'  => $now,
            'nbf'  => $now,
            'exp'  => $now + self::REFRESH_TOKEN_EXPIRY,
            'jti'  => $jti,
            'data' => [
                'user' => ['id' => $user_id],
                'type' => 'refresh',
            ],
        ];

        return \Firebase\JWT\JWT::encode($payload, $this->get_secret_key(), 'HS256');
    }

    // =========================================================================
    // Token Validation
    // =========================================================================

    /**
     * Decode and validate a JWT token.
     *
     * @param string $token        The raw JWT string.
     * @param string $expected_type Expected token type: 'access' or 'refresh'.
     * @return array|WP_Error { user_id: int, token: object } on success, WP_Error on failure.
     */
    public function validate_token($token, $expected_type = 'access') {
        try {
            $decoded = \Firebase\JWT\JWT::decode(
                $token,
                new \Firebase\JWT\Key($this->get_secret_key(), 'HS256')
            );
        } catch (\Firebase\JWT\ExpiredException $e) {
            return new \WP_Error('tbc_auth_expired_token', 'Token has expired.', ['status' => 401]);
        } catch (\Firebase\JWT\SignatureInvalidException $e) {
            return new \WP_Error('tbc_auth_bad_token', 'Invalid token signature.', ['status' => 401]);
        } catch (\Exception $e) {
            return new \WP_Error('tbc_auth_bad_token', 'Invalid token.', ['status' => 401]);
        }

        // Verify issuer
        if (!isset($decoded->iss) || $decoded->iss !== get_bloginfo('url')) {
            return new \WP_Error('tbc_auth_invalid_issuer', 'Token issuer mismatch.', ['status' => 401]);
        }

        // Extract user ID
        $user_id = isset($decoded->data->user->id) ? (int) $decoded->data->user->id : 0;
        if (!$user_id || !get_userdata($user_id)) {
            return new \WP_Error('tbc_auth_invalid_user', 'User not found.', ['status' => 401]);
        }

        // Check token type
        $token_type = $decoded->data->type ?? '';
        if ($token_type !== $expected_type) {
            if ($expected_type === 'access' && $token_type === 'refresh') {
                return new \WP_Error('tbc_auth_refresh_as_access', 'Refresh token cannot be used for API access.', ['status' => 401]);
            }
            return new \WP_Error('tbc_auth_bad_token', 'Wrong token type.', ['status' => 401]);
        }

        // JTI verification — every valid token must have a tracked session
        if (!isset($decoded->jti) || !$this->verify_jti($user_id, $decoded->jti)) {
            return new \WP_Error('tbc_auth_revoked_session', 'Session has been revoked.', ['status' => 401]);
        }

        return [
            'user_id' => $user_id,
            'token'   => $decoded,
        ];
    }

    // =========================================================================
    // JTI Session Management
    // =========================================================================

    /**
     * Create a new JTI and store it in user meta.
     *
     * @param int $user_id WordPress user ID.
     * @return string The generated JTI.
     */
    private function create_jti($user_id) {
        $jti = wp_generate_password(32, false);

        $sessions = get_user_meta($user_id, self::SESSION_META_KEY, true);
        if (!is_array($sessions)) {
            $sessions = [];
        }

        // Clean up expired sessions while we're here
        $now = time();
        $sessions = array_filter($sessions, function ($session) use ($now) {
            return ($session['expires_at'] ?? 0) > $now;
        });

        // Evict oldest sessions if at capacity
        if (count($sessions) >= self::MAX_SESSIONS_PER_USER) {
            uasort($sessions, function ($a, $b) {
                return ($a['issued_at'] ?? 0) - ($b['issued_at'] ?? 0);
            });
            $sessions = array_slice($sessions, -(self::MAX_SESSIONS_PER_USER - 1), null, true);
        }

        // Add new session
        $sessions[$jti] = [
            'issued_at'  => $now,
            'expires_at' => $now + self::REFRESH_TOKEN_EXPIRY,
            'client'     => isset($_SERVER['HTTP_USER_AGENT']) ? substr($_SERVER['HTTP_USER_AGENT'], 0, 200) : '',
            'ip'         => $this->get_client_ip(),
        ];

        update_user_meta($user_id, self::SESSION_META_KEY, $sessions);

        return $jti;
    }

    /**
     * Check if a JTI exists and is valid for a user.
     *
     * @param int    $user_id WordPress user ID.
     * @param string $jti     The JWT ID to verify.
     * @return bool
     */
    public function verify_jti($user_id, $jti) {
        $sessions = get_user_meta($user_id, self::SESSION_META_KEY, true);
        if (!is_array($sessions) || !isset($sessions[$jti])) {
            return false;
        }

        // Check if session has expired
        if (($sessions[$jti]['expires_at'] ?? 0) < time()) {
            // Clean up this expired session
            unset($sessions[$jti]);
            update_user_meta($user_id, self::SESSION_META_KEY, $sessions);
            return false;
        }

        return true;
    }

    /**
     * Revoke a specific JTI (single device logout).
     *
     * @param int    $user_id WordPress user ID.
     * @param string $jti     The JWT ID to revoke.
     * @return bool True if session was found and revoked.
     */
    public function revoke_jti($user_id, $jti) {
        $sessions = get_user_meta($user_id, self::SESSION_META_KEY, true);
        if (!is_array($sessions) || !isset($sessions[$jti])) {
            return false;
        }

        unset($sessions[$jti]);
        update_user_meta($user_id, self::SESSION_META_KEY, $sessions);

        return true;
    }

    /**
     * Revoke all sessions for a user (log out everywhere).
     *
     * @param int $user_id WordPress user ID.
     */
    public function revoke_all_sessions($user_id) {
        delete_user_meta($user_id, self::SESSION_META_KEY);
    }

    // =========================================================================
    // Secret Key
    // =========================================================================

    /**
     * Get the JWT signing secret.
     * Prefers JWT_AUTH_SECRET_KEY constant (backward compat), falls back to auto-generated key.
     *
     * @return string The secret key.
     */
    private function get_secret_key() {
        if (defined('JWT_AUTH_SECRET_KEY') && !empty(JWT_AUTH_SECRET_KEY)) {
            return JWT_AUTH_SECRET_KEY;
        }

        $key = get_option('tbc_ca_jwt_secret');
        if (empty($key)) {
            $key = wp_generate_password(64, true, true);
            update_option('tbc_ca_jwt_secret', $key, false);
        }

        return $key;
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    /**
     * Extract the Authorization header from the request.
     * Handles Apache, Nginx, CGI, and redirect configurations.
     *
     * @return string|null The Authorization header value, or null.
     */
    private function get_authorization_header() {
        if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
            return $_SERVER['HTTP_AUTHORIZATION'];
        }
        if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        }
        if (function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            if (isset($headers['Authorization'])) {
                return $headers['Authorization'];
            }
            if (isset($headers['authorization'])) {
                return $headers['authorization'];
            }
        }
        // Fallback: getallheaders (available in PHP-FPM since PHP 7.3+)
        if (function_exists('getallheaders')) {
            $headers = getallheaders();
            if (isset($headers['Authorization'])) {
                return $headers['Authorization'];
            }
            if (isset($headers['authorization'])) {
                return $headers['authorization'];
            }
        }
        return null;
    }

    /**
     * Rebuild the user's Fluent Community space ID cache if stale.
     *
     * Throttled to once per 5 minutes per user via a transient to avoid
     * running the query on every API request.
     *
     * @param int $user_id WordPress user ID.
     */
    private function maybe_rebuild_space_cache($user_id) {
        $throttle_key = 'tbc_space_cache_' . $user_id;

        if (get_transient($throttle_key)) {
            return;
        }

        // Set BEFORE rebuild to prevent stampede from concurrent requests
        set_transient($throttle_key, 1, 5 * MINUTE_IN_SECONDS);

        if (class_exists('FluentCommunity\App\Models\User')) {
            try {
                $fc_user = \FluentCommunity\App\Models\User::find($user_id);
                if ($fc_user) {
                    $fc_user->cacheAccessSpaces();
                }
            } catch (\Exception $e) {
                // Non-critical — cache will rebuild on next cycle
            }
        }
    }

    /**
     * Get the client IP address.
     *
     * @return string
     */
    private function get_client_ip() {
        $headers = ['HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR'];
        foreach ($headers as $header) {
            if (!empty($_SERVER[$header])) {
                // X-Forwarded-For may contain multiple IPs — take the first
                $ip = explode(',', $_SERVER[$header])[0];
                return trim($ip);
            }
        }
        return '';
    }
}
