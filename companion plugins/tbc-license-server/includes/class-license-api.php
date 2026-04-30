<?php
/**
 * TBC License REST API — FluentCart Pro Bridge
 *
 * Thin proxy between the dashboard and FluentCart Pro's native license API.
 * Handles both core app and module add-on license checks.
 *
 * License keys are self-identifying — each key is tied to a product in FluentCart's
 * database. No hardcoded product ID mapping needed. We look up the product from
 * the key using FluentCart's License model (same server).
 */

if (!defined('ABSPATH')) exit;

class TBC_License_API {

    public function register_routes() {
        register_rest_route(TBC_LICENSE_REST_NAMESPACE, '/check', [
            'methods'             => 'POST',
            'callback'            => [$this, 'check_license'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(TBC_LICENSE_REST_NAMESPACE, '/activate', [
            'methods'             => 'POST',
            'callback'            => [$this, 'activate_license_endpoint'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(TBC_LICENSE_REST_NAMESPACE, '/deactivate', [
            'methods'             => 'POST',
            'callback'            => [$this, 'deactivate_site_endpoint'],
            'permission_callback' => '__return_true',
        ]);
    }

    /**
     * Resolve the FluentCart product_id from a license key.
     * The key is already tied to a product — no mapping needed.
     */
    private function get_product_id_from_key($license_key) {
        if (!class_exists('\FluentCartPro\App\Modules\Licensing\Models\License')) return null;
        $license = \FluentCartPro\App\Modules\Licensing\Models\License::query()
            ->where('license_key', $license_key)
            ->first();
        return $license ? $license->product_id : null;
    }

    /**
     * POST /activate — Validate and activate a license key (core or module).
     * The key itself identifies the product — caller doesn't need to know the product ID.
     */
    public function activate_license_endpoint($request) {
        $license_key = sanitize_text_field($request->get_param('licenseKey') ?? '');
        $site_url    = sanitize_text_field($request->get_param('siteUrl') ?? '');

        if (empty($license_key)) {
            return new WP_REST_Response(['valid' => false, 'error' => 'License key is required.'], 400);
        }

        $product_id = $this->get_product_id_from_key($license_key);
        if (!$product_id) {
            return new WP_REST_Response(['valid' => false, 'error' => 'License key not found.'], 200);
        }

        $fc_result = $this->call_fluentcart('activate_license', [
            'license_key' => $license_key,
            'site_url'    => $site_url ?: home_url(),
            'item_id'     => $product_id,
        ]);

        if (!$fc_result) {
            return new WP_REST_Response(['valid' => false, 'error' => 'Could not reach license system.'], 200);
        }

        if (empty($fc_result['success']) || ($fc_result['status'] ?? '') !== 'valid') {
            return new WP_REST_Response([
                'valid' => false,
                'error' => $this->translate_error($fc_result),
            ], 200);
        }

        return new WP_REST_Response([
            'valid'     => true,
            'plan'      => $this->extract_plan($fc_result),
            'expiresAt' => $this->extract_expiry($fc_result),
            'name'      => $fc_result['product_title'] ?? '',
        ], 200);
    }

    /**
     * POST /check — Validate core license + check for core and module updates.
     */
    public function check_license($request) {
        $license_key     = sanitize_text_field($request->get_param('licenseKey') ?? '');
        $current_version = sanitize_text_field($request->get_param('currentVersion') ?? '0.0.0');
        $site_url        = sanitize_text_field($request->get_param('siteUrl') ?? '');
        $installed_modules = $request->get_param('installedModules') ?? [];

        if (empty($license_key)) {
            return new WP_REST_Response(['valid' => false, 'error' => 'License key is required.'], 400);
        }

        if (empty($site_url)) {
            return new WP_REST_Response([
                'valid' => false,
                'error' => 'Site URL is required. Configure your Production URL in the dashboard Config tab.',
            ], 200);
        }

        // Resolve product ID from the key itself
        $core_product_id = $this->get_product_id_from_key($license_key);
        if (!$core_product_id) {
            return new WP_REST_Response(['valid' => false, 'error' => 'License key not found.'], 200);
        }

        $fc_result = $this->call_fluentcart('activate_license', [
            'license_key' => $license_key,
            'site_url'    => $site_url,
            'item_id'     => $core_product_id,
        ]);

        if (!$fc_result) {
            return new WP_REST_Response([
                'valid' => false,
                'error' => 'Could not reach license system. Is FluentCart Pro active?',
            ], 200);
        }

        if (empty($fc_result['success']) || ($fc_result['status'] ?? '') !== 'valid') {
            return new WP_REST_Response([
                'valid' => false,
                'error' => $this->translate_error($fc_result),
                'plan'  => $this->extract_plan($fc_result),
            ], 200);
        }

        $response = [
            'valid'     => true,
            'plan'      => $this->extract_plan($fc_result),
            'expiresAt' => $this->extract_expiry($fc_result),
            'latest'    => null,
            'modules'   => [],
        ];

        // Check for core update
        $response['latest'] = $this->check_version($core_product_id, $license_key, $site_url, $current_version);

        // Validate each installed module + check for its update.
        // Always emit one entry per module — the dashboard renders both the
        // license row (plan/expiry) and the update row (up-to-date / available)
        // from this same per-module record, mirroring how core is rendered.
        if (is_array($installed_modules)) {
            foreach ($installed_modules as $mod) {
                $mod_id      = sanitize_text_field($mod['id'] ?? '');
                $mod_version = sanitize_text_field($mod['version'] ?? '0.0.0');
                $mod_key     = sanitize_text_field($mod['licenseKey'] ?? '');

                if (empty($mod_id) || empty($mod_key)) continue;

                // Resolve product ID from the module's license key
                $mod_product_id = $this->get_product_id_from_key($mod_key);
                if (!$mod_product_id) {
                    $response['modules'][] = $this->module_error_entry($mod_id, 'License key not found.');
                    continue;
                }

                // Validate module license
                $mod_fc = $this->call_fluentcart('activate_license', [
                    'license_key' => $mod_key,
                    'site_url'    => $site_url,
                    'item_id'     => $mod_product_id,
                ]);

                if (!$mod_fc) {
                    $response['modules'][] = $this->module_error_entry($mod_id, 'Could not reach license system.');
                    continue;
                }

                if (empty($mod_fc['success']) || ($mod_fc['status'] ?? '') !== 'valid') {
                    $response['modules'][] = $this->module_error_entry($mod_id, $this->translate_error($mod_fc));
                    continue;
                }

                $response['modules'][] = [
                    'id'             => $mod_id,
                    'valid'          => true,
                    'plan'           => $this->extract_plan($mod_fc),
                    'expiresAt'      => $this->extract_expiry($mod_fc),
                    'currentVersion' => $mod_version,
                    'latest'         => $this->check_version($mod_product_id, $mod_key, $site_url, $mod_version),
                ];
            }
        }

        return new WP_REST_Response($response, 200);
    }

    /**
     * POST /deactivate
     */
    public function deactivate_site_endpoint($request) {
        $license_key = sanitize_text_field($request->get_param('licenseKey') ?? '');
        $site_url    = sanitize_text_field($request->get_param('siteUrl') ?? '');

        if (empty($license_key) || empty($site_url)) {
            return new WP_REST_Response(['success' => false, 'error' => 'licenseKey and siteUrl are required'], 400);
        }

        $product_id = $this->get_product_id_from_key($license_key);
        $fc_result = $this->call_fluentcart('deactivate_license', [
            'license_key' => $license_key,
            'site_url'    => $site_url,
            'item_id'     => $product_id,
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

    private function check_version($product_id, $license_key, $site_url, $current_version) {
        $result = $this->call_fluentcart('get_license_version', [
            'item_id'     => $product_id,
            'license_key' => $license_key,
            'site_url'    => $site_url,
        ]);

        if (!$result || empty($result['new_version'])) return null;

        $new_version = $result['new_version'];
        if (!version_compare($new_version, $current_version, '>')) return null;

        return [
            'version'     => $new_version,
            'date'        => !empty($result['last_updated'])
                ? date('Y-m-d', strtotime($result['last_updated']))
                : current_time('Y-m-d'),
            'changelog'   => $result['sections']['changelog'] ?? '',
            'downloadUrl' => $result['download_link'] ?? '',
        ];
    }

    private function call_fluentcart($action, $params) {
        $url = home_url('/?fluent-cart=' . $action);

        $response = wp_remote_post($url, [
            'body'      => $params,
            'timeout'   => 15,
            'sslverify' => false,
            'cookies'   => [],
        ]);

        if (is_wp_error($response)) return null;

        $body = wp_remote_retrieve_body($response);
        if (empty($body)) return null;

        return json_decode($body, true);
    }

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

    private function extract_plan($fc_result) {
        if (!empty($fc_result['variation_title'])) {
            return strtolower($fc_result['variation_title']);
        }
        return 'core';
    }

    private function extract_expiry($fc_result) {
        if (!empty($fc_result['expiration_date']) && $fc_result['expiration_date'] !== 'lifetime') {
            return date('Y-m-d', strtotime($fc_result['expiration_date']));
        }
        return null;
    }

    private function module_error_entry($mod_id, $error) {
        return ['id' => $mod_id, 'valid' => false, 'error' => $error];
    }
}
