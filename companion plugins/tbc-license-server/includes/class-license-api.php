<?php
/**
 * TBC License REST API — FluentCart Pro Bridge
 *
 * Thin proxy between the dashboard and FluentCart Pro's native license API.
 * All activation logic, limit enforcement, and site tracking is handled by
 * FluentCart — this plugin only translates the request/response format.
 *
 * Dashboard calls:
 *   POST /wp-json/tbc-license/v1/check
 *   { "licenseKey": "...", "currentVersion": "3.0.6", "siteUrl": "example.com" }
 *
 * We return:
 *   { "valid": true, "plan": "core", "expiresAt": "2027-03-16", "latest": { ... } }
 */

if (!defined('ABSPATH')) exit;

class TBC_License_API {

    /**
     * The FluentCart product ID for the TBC Community App.
     * To find it: WP Admin → FluentCart → Products → click product → ID is in the URL.
     */
    const PRODUCT_ID = 12;

    /**
     * Register REST routes.
     */
    public function register_routes() {
        register_rest_route(TBC_LICENSE_REST_NAMESPACE, '/check', [
            'methods'             => 'POST',
            'callback'            => [$this, 'check_license'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(TBC_LICENSE_REST_NAMESPACE, '/deactivate', [
            'methods'             => 'POST',
            'callback'            => [$this, 'deactivate_site_endpoint'],
            'permission_callback' => '__return_true',
        ]);
    }

    /**
     * POST /check — Activate/validate license via FluentCart's native API and return update info.
     */
    public function check_license($request) {
        $license_key     = sanitize_text_field($request->get_param('licenseKey') ?? '');
        $current_version = sanitize_text_field($request->get_param('currentVersion') ?? '0.0.0');
        $site_url        = sanitize_text_field($request->get_param('siteUrl') ?? '');

        if (empty($license_key)) {
            return new WP_REST_Response(['valid' => false, 'error' => 'License key is required.'], 400);
        }

        if (empty($site_url)) {
            return new WP_REST_Response([
                'valid' => false,
                'error' => 'Site URL is required for license validation. Configure your Production URL in the dashboard Config tab.',
            ], 200);
        }

        // Call FluentCart's native activate_license endpoint
        // This handles: key validation, expiration, activation limits, local site detection, duplicate detection
        $fc_result = $this->call_fluentcart('activate_license', [
            'license_key' => $license_key,
            'site_url'    => $site_url,
            'item_id'     => self::PRODUCT_ID,
        ]);

        if (!$fc_result) {
            return new WP_REST_Response([
                'valid' => false,
                'error' => 'Could not reach license system. Is FluentCart Pro active?',
            ], 200);
        }

        // FluentCart returned an error
        if (empty($fc_result['success']) || ($fc_result['status'] ?? '') !== 'valid') {
            return new WP_REST_Response([
                'valid' => false,
                'error' => $this->translate_error($fc_result),
                'plan'  => $this->extract_plan($fc_result),
            ], 200);
        }

        // License is valid — build our response
        $expiry = null;
        if (!empty($fc_result['expiration_date']) && $fc_result['expiration_date'] !== 'lifetime') {
            $expiry = date('Y-m-d', strtotime($fc_result['expiration_date']));
        }

        $response = [
            'valid'     => true,
            'plan'      => $this->extract_plan($fc_result),
            'expiresAt' => $expiry,
            'latest'    => null,
        ];

        // Check for available updates via FluentCart's native version endpoint
        $version_result = $this->call_fluentcart('get_license_version', [
            'item_id'     => self::PRODUCT_ID,
            'license_key' => $license_key,
            'site_url'    => $site_url,
        ]);

        if ($version_result && !empty($version_result['new_version'])) {
            $new_version = $version_result['new_version'];

            if (version_compare($new_version, $current_version, '>')) {
                $response['latest'] = [
                    'version'     => $new_version,
                    'date'        => !empty($version_result['last_updated'])
                        ? date('Y-m-d', strtotime($version_result['last_updated']))
                        : current_time('Y-m-d'),
                    'changelog'   => $version_result['sections']['changelog'] ?? '',
                    'downloadUrl' => $version_result['download_link'] ?? '',
                ];
            }
        }

        return new WP_REST_Response($response, 200);
    }

    /**
     * POST /deactivate — Deactivate a site via FluentCart's native API.
     */
    public function deactivate_site_endpoint($request) {
        $license_key = sanitize_text_field($request->get_param('licenseKey') ?? '');
        $site_url    = sanitize_text_field($request->get_param('siteUrl') ?? '');

        if (empty($license_key) || empty($site_url)) {
            return new WP_REST_Response(['success' => false, 'error' => 'licenseKey and siteUrl are required'], 400);
        }

        $fc_result = $this->call_fluentcart('deactivate_license', [
            'license_key' => $license_key,
            'site_url'    => $site_url,
            'item_id'     => self::PRODUCT_ID,
        ]);

        if (!$fc_result) {
            return new WP_REST_Response(['success' => false, 'error' => 'Could not reach license system.'], 200);
        }

        $success = !empty($fc_result['success']) && ($fc_result['status'] ?? '') === 'deactivated';

        return new WP_REST_Response([
            'success' => $success,
            'error'   => $success ? null : ($fc_result['message'] ?? 'Deactivation failed'),
        ], 200);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Call a FluentCart native license action via internal HTTP request.
     *
     * FluentCart exposes actions via ?fluent-cart=<action_name> URLs.
     * These are proper public API endpoints used by WordPress plugins,
     * themes, and other software to validate licenses.
     */
    private function call_fluentcart($action, $params) {
        $url = home_url('/?fluent-cart=' . $action);

        $response = wp_remote_post($url, [
            'body'      => $params,
            'timeout'   => 15,
            'sslverify' => false, // same server, no need for SSL verification
            'cookies'   => [],    // don't forward auth cookies
        ]);

        if (is_wp_error($response)) {
            return null;
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);

        if (empty($body)) {
            return null;
        }

        $data = json_decode($body, true);

        return $data;
    }

    /**
     * Translate FluentCart's error response into a user-friendly message.
     */
    private function translate_error($fc_result) {
        $error_type = $fc_result['error_type'] ?? '';
        $message    = $fc_result['message'] ?? '';

        $translations = [
            'validation_error'          => 'License key and site URL are required.',
            'license_not_found'         => 'License key not found. Check your key or contact support.',
            'license_expired'           => 'Your license has expired. Renew at twobirdscode.com',
            'activation_limit_exceeded' => 'All activation slots are in use. Deactivate another site first, or upgrade your license.',
            'key_mismatch'              => 'This license key is not valid for this product.',
            'license_not_active'        => 'This license has been disabled. Contact support.',
        ];

        return $translations[$error_type] ?? $message ?: 'License validation failed. Contact support.';
    }

    /**
     * Extract plan name from FluentCart's response.
     */
    private function extract_plan($fc_result) {
        if (!empty($fc_result['variation_title'])) {
            return strtolower($fc_result['variation_title']);
        }
        return 'core';
    }
}
