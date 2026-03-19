<?php
/**
 * TBC License REST API — FluentCart Pro Bridge
 *
 * Translates between the dashboard's API contract and FluentCart Pro's
 * licensing system. The dashboard calls our endpoint; we query FluentCart's
 * License model and return the response in the format the dashboard expects.
 *
 * Dashboard calls:
 *   POST /wp-json/tbc-license/v1/check
 *   { "licenseKey": "...", "currentVersion": "3.0.6", "product": "tbc-community-app" }
 *
 * We return:
 *   { "valid": true, "plan": "core", "expiresAt": "2027-03-16", "latest": { ... } }
 */

if (!defined('ABSPATH')) exit;

class TBC_License_API {

    /**
     * The FluentCart product ID for the TBC Community App.
     * Set this to your actual FluentCart product ID.
     *
     * To find it: WP Admin → FluentCart → Products → click product → ID is in the URL.
     */
    const PRODUCT_ID = 12;

    /**
     * Register REST routes.
     */
    public function register_routes() {
        // POST /wp-json/tbc-license/v1/check
        register_rest_route(TBC_LICENSE_REST_NAMESPACE, '/check', [
            'methods'             => 'POST',
            'callback'            => [$this, 'check_license'],
            'permission_callback' => '__return_true',
        ]);

        // POST /wp-json/tbc-license/v1/deactivate
        register_rest_route(TBC_LICENSE_REST_NAMESPACE, '/deactivate', [
            'methods'             => 'POST',
            'callback'            => [$this, 'deactivate_site_endpoint'],
            'permission_callback' => '__return_true',
        ]);
    }

    /**
     * POST /check — Validate license and return update info.
     *
     * Reads from FluentCart Pro's fct_licenses table and product license_settings.
     */
    public function check_license($request) {
        $license_key     = sanitize_text_field($request->get_param('licenseKey') ?? '');
        $current_version = sanitize_text_field($request->get_param('currentVersion') ?? '0.0.0');
        $site_url        = sanitize_text_field($request->get_param('siteUrl') ?? '');

        if (empty($license_key)) {
            return new WP_REST_Response(['valid' => false, 'error' => 'License key is required'], 400);
        }

        // Check FluentCart Pro is available
        if (!class_exists('FluentCartPro\App\Modules\Licensing\Models\License')) {
            return new WP_REST_Response(['valid' => false, 'error' => 'License system not available. Contact support.'], 500);
        }

        // Find the license in FluentCart
        $license = \FluentCartPro\App\Modules\Licensing\Models\License::where('license_key', $license_key)->first();

        if (!$license) {
            return new WP_REST_Response([
                'valid' => false,
                'error' => 'License key not found. Check your key or contact support.',
            ], 200);
        }

        // Check validity (handles expiration + grace period automatically)
        if ($license->isExpired()) {
            $expiry = $license->expiration_date ? date('Y-m-d', strtotime($license->expiration_date)) : null;
            return new WP_REST_Response([
                'valid'     => false,
                'error'     => 'Your license expired' . ($expiry ? ' on ' . $expiry : '') . '. Renew at twobirdscode.com',
                'plan'      => $this->get_plan($license),
                'expiresAt' => $expiry,
            ], 200);
        }

        // Auto-activate this site if it isn't already and slots remain
        if ($site_url && $license->hasActivationLeft()) {
            $this->activate_site($license, $site_url);
            $license->refresh();
        }

        // Per-site validation: verify THIS site is activated, not just the license globally
        if ($site_url) {
            if (!$this->is_site_activated($license, $site_url)) {
                return new WP_REST_Response([
                    'valid' => false,
                    'error' => 'This license is not activated for your site. All activation slots may be in use. Contact support.',
                    'plan'  => $this->get_plan($license),
                ], 200);
            }
        } else {
            // No siteUrl provided — fall back to global status check
            if (!$license->isActive()) {
                return new WP_REST_Response([
                    'valid' => false,
                    'error' => 'This license has been disabled or all activations are used. Contact support.',
                ], 200);
            }
        }

        // License is valid — check for updates
        $plan = $this->get_plan($license);
        $expiry = $license->expiration_date
            ? date('Y-m-d', strtotime($license->expiration_date))
            : null;

        $response = [
            'valid'     => true,
            'plan'      => $plan,
            'expiresAt' => $expiry,
            'latest'    => null,
        ];

        // Get the product's version info from FluentCart license_settings
        $latest = $this->get_latest_version($license);

        if ($latest && version_compare($latest['version'], $current_version, '>')) {
            $response['latest'] = $latest;
        }

        return new WP_REST_Response($response, 200);
    }

    /**
     * Activate a license for a site using FluentCart's models.
     * Creates records in fct_license_sites and fct_license_activations.
     */
    private function activate_site($license, $site_url) {
        $LicenseSite = '\FluentCartPro\App\Modules\Licensing\Models\LicenseSite';
        $LicenseActivation = '\FluentCartPro\App\Modules\Licensing\Models\LicenseActivation';

        if (!class_exists($LicenseSite) || !class_exists($LicenseActivation)) {
            // Cannot activate without FluentCart models — skip silently
            return;
        }

        // Sanitize URL (strip protocol, trailing slash)
        $clean_url = preg_replace('#^https?://#', '', rtrim($site_url, '/'));

        // Find or create the site record
        $site = $LicenseSite::where('site_url', $clean_url)->first();
        if (!$site) {
            $site = $LicenseSite::create([
                'site_url'         => $clean_url,
                'server_version'   => '',
                'platform_version' => '',
            ]);
        }

        // Check if activation already exists for this license+site
        $existing = $LicenseActivation::where('license_id', $license->id)
            ->where('site_id', $site->id)
            ->first();

        if (!$existing) {
            $LicenseActivation::create([
                'site_id'             => $site->id,
                'license_id'          => $license->id,
                'status'              => 'active',
                'is_local'            => 0,
                'product_id'          => $license->product_id,
                'variation_id'        => $license->variation_id ?: 0,
                'activation_method'   => 'key_based',
                'activation_hash'     => md5($license->license_key . $site->id . time() . wp_generate_uuid4()),
                'last_update_version' => '',
            ]);

            // Let FluentCart recount — this sets status to active and saves
            $license->recountActivations();
        }
    }

    /**
     * Check if a specific site has an active activation for this license.
     */
    private function is_site_activated($license, $site_url) {
        $LicenseSite = '\FluentCartPro\App\Modules\Licensing\Models\LicenseSite';
        $LicenseActivation = '\FluentCartPro\App\Modules\Licensing\Models\LicenseActivation';

        if (!class_exists($LicenseSite) || !class_exists($LicenseActivation)) {
            // Cannot verify — fail open to avoid blocking legitimate users
            return true;
        }

        $clean_url = preg_replace('#^https?://#', '', rtrim($site_url, '/'));
        $site = $LicenseSite::where('site_url', $clean_url)->first();
        if (!$site) return false;

        return $LicenseActivation::where('license_id', $license->id)
            ->where('site_id', $site->id)
            ->where('status', 'active')
            ->exists();
    }

    /**
     * POST /deactivate — Remove a site's activation record for a license.
     */
    public function deactivate_site_endpoint($request) {
        $license_key = sanitize_text_field($request->get_param('licenseKey') ?? '');
        $site_url    = sanitize_text_field($request->get_param('siteUrl') ?? '');

        if (empty($license_key) || empty($site_url)) {
            return new WP_REST_Response(['success' => false, 'error' => 'licenseKey and siteUrl are required'], 400);
        }

        if (!class_exists('FluentCartPro\App\Modules\Licensing\Models\License')) {
            return new WP_REST_Response(['success' => false, 'error' => 'License system not available'], 500);
        }

        $license = \FluentCartPro\App\Modules\Licensing\Models\License::where('license_key', $license_key)->first();
        if (!$license) {
            return new WP_REST_Response(['success' => false, 'error' => 'License not found'], 200);
        }

        $LicenseSite = '\FluentCartPro\App\Modules\Licensing\Models\LicenseSite';
        $LicenseActivation = '\FluentCartPro\App\Modules\Licensing\Models\LicenseActivation';

        if (!class_exists($LicenseSite) || !class_exists($LicenseActivation)) {
            return new WP_REST_Response(['success' => false, 'error' => 'License models not available'], 500);
        }

        $clean_url = preg_replace('#^https?://#', '', rtrim($site_url, '/'));
        $site = $LicenseSite::where('site_url', $clean_url)->first();

        if ($site) {
            $LicenseActivation::where('license_id', $license->id)
                ->where('site_id', $site->id)
                ->delete();

            $license->recountActivations();
        }

        return new WP_REST_Response(['success' => true], 200);
    }

    /**
     * Get the plan name from a license's variation.
     */
    private function get_plan($license) {
        if ($license->variation_id) {
            $variation = $license->productVariant;
            if ($variation && !empty($variation->title)) {
                return strtolower($variation->title);
            }
        }
        return 'core';
    }

    /**
     * Get the latest version info from the FluentCart product's license settings.
     *
     * Reads the product's version, changelog, and generates a download URL
     * for the update file.
     */
    private function get_latest_version($license) {
        $product_id = $license->product_id ?: self::PRODUCT_ID;
        if (!$product_id) return null;

        // Read license settings from the product
        $product = \FluentCart\App\Models\Product::query()->find($product_id);
        if (!$product) return null;

        $settings = $product->getProductMeta('license_settings');
        if (!$settings || empty($settings['version'])) return null;

        $version = $settings['version'];

        // Get changelog
        $changelog = $product->getProductMeta('_fluent_sl_changelog') ?: '';

        // Get the update file once (used for download URL + file size)
        $update_file = $this->get_update_file($product, $settings);
        $download_url = $update_file ? $this->get_download_url_from_file($update_file) : '';
        $size = ($update_file && !empty($update_file->file_size)) ? (int) $update_file->file_size : 0;

        return [
            'version'     => $version,
            'date'        => $product->post_modified ? date('Y-m-d', strtotime($product->post_modified)) : current_time('Y-m-d'),
            'changelog'   => $changelog,
            'downloadUrl' => $download_url ?: '',
            'size'        => $size,
        ];
    }

    /**
     * Get the ProductDownload model for the update file.
     */
    private function get_update_file($product, $settings) {
        $file_id = $settings['global_update_file'] ?? '';
        if (is_array($file_id)) {
            $file_id = $file_id['id'] ?? '';
        }

        if ($file_id) {
            return \FluentCart\App\Models\ProductDownload::find($file_id);
        }

        // Fallback: first downloadable file for this product
        return \FluentCart\App\Models\ProductDownload::where('post_id', $product->ID)->first();
    }

    /**
     * Generate a time-limited download URL for a given update file.
     */
    private function get_download_url_from_file($update_file) {
        if (!$update_file) return '';

        // Use FluentCart's built-in signed URL generation (60 min validity)
        if (class_exists('FluentCart\App\Helpers\Helper')) {
            return \FluentCart\App\Helpers\Helper::generateDownloadFileLink($update_file, null, 60);
        }

        return '';
    }
}
