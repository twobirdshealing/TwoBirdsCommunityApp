<?php
/**
 * Profile Gate Class
 * Core logic for checking profile completion, marking users incomplete,
 * re-evaluating on profile save, and REST filter hooks.
 *
 * @package TBC_ProfileCompletion
 */

declare(strict_types=1);

namespace TBCPcom;

defined('ABSPATH') || exit;

class ProfileGate {

    /** @var array User IDs already re-evaluated this request (prevents double work). */
    private $reevaluated_users = [];

    /** @var array Cached completion results keyed by user_id. */
    private $completion_cache = [];

    // =========================================================================
    // Options
    // =========================================================================

    public static function get_option(string $key, $default = false) {
        return get_option(TBC_PCOM_OPTION_PREFIX . $key, $default);
    }

    public static function update_option(string $key, $value): bool {
        return update_option(TBC_PCOM_OPTION_PREFIX . $key, $value);
    }

    // =========================================================================
    // Registration Hook
    // =========================================================================

    /**
     * Hook: tbc_ca_post_register action.
     * Mark new users as incomplete so they must fill in bio + avatar.
     *
     * @param int              $user_id Newly created user ID.
     * @param array            $data    Registration data.
     * @param \WP_REST_Request $request REST request.
     */
    public function on_registration($user_id, $data, $request) {
        if (!self::get_option('enabled', true)) {
            return;
        }

        update_user_meta($user_id, TBC_PCOM_META_REGISTRATION_COMPLETE, '0');
    }

    // =========================================================================
    // Completion Check
    // =========================================================================

    /**
     * Check whether a user's profile is complete.
     *
     * Logic:
     *   - Gate disabled in settings → always complete.
     *   - Meta flag is '1' → complete (cached).
     *   - Meta flag is '0' or missing → check XProfile for required fields.
     *     If all present → auto-mark '1' and return complete.
     *     Otherwise → incomplete.
     *
     * @param int|null $user_id Defaults to current user.
     * @return bool True if profile is complete (or gate is disabled).
     */
    public function is_complete(?int $user_id = null): bool {
        if (!$user_id) {
            $user_id = get_current_user_id();
        }

        if (!$user_id) {
            return true; // not logged in — gate doesn't apply
        }

        if (isset($this->completion_cache[$user_id])) {
            return $this->completion_cache[$user_id];
        }

        if (!self::get_option('enabled', true)) {
            return $this->completion_cache[$user_id] = true;
        }

        $flag = get_user_meta($user_id, TBC_PCOM_META_REGISTRATION_COMPLETE, true);

        if ($flag === '1') {
            return $this->completion_cache[$user_id] = true;
        }

        if (class_exists('\FluentCommunity\App\Models\XProfile')) {
            $xprofile = \FluentCommunity\App\Models\XProfile::where('user_id', $user_id)->first();

            if ($xprofile) {
                $missing = self::get_missing_fields($xprofile);

                if (empty($missing)) {
                    update_user_meta($user_id, TBC_PCOM_META_REGISTRATION_COMPLETE, '1');
                    return $this->completion_cache[$user_id] = true;
                }

                if ($flag !== '0') {
                    update_user_meta($user_id, TBC_PCOM_META_REGISTRATION_COMPLETE, '0');
                }
            }
        }

        return $this->completion_cache[$user_id] = false;
    }

    /**
     * Get the list of missing required profile fields.
     *
     * @param \FluentCommunity\App\Models\XProfile $xprofile
     * @param array $overrides Optional override values (e.g. from pre-save $data).
     * @return string[] Array of missing field keys (e.g. ['bio', 'avatar']).
     */
    public static function get_missing_fields($xprofile, array $overrides = []): array {
        $missing = [];

        $bio = $overrides['short_description'] ?? ($xprofile->short_description ?? '');

        if (self::get_option('require_bio', true) && empty($bio)) {
            $missing[] = 'bio';
        }

        if (self::get_option('require_avatar', true) && !self::has_real_avatar($xprofile, $overrides)) {
            $missing[] = 'avatar';
        }

        return $missing;
    }

    /**
     * Whether the user has actually uploaded an avatar (vs. FC's auto-generated
     * Gravatar / ui-avatars / placeholder fallback). Delegates to FC's native
     * XProfile::hasCustomAvatar(), which reads the raw `avatar` column directly.
     *
     * @param mixed $xprofile  FluentCommunity XProfile model instance.
     * @param array $overrides Optional pre-save overrides; if 'avatar' is present
     *                         it takes precedence over the model's stored value.
     */
    public static function has_real_avatar($xprofile, array $overrides = []): bool {
        if (array_key_exists('avatar', $overrides)) {
            return !empty($overrides['avatar']);
        }

        if (!$xprofile) {
            return false;
        }

        if (method_exists($xprofile, 'hasCustomAvatar')) {
            return (bool) $xprofile->hasCustomAvatar();
        }

        // Fallback for FC versions older than 2.1.x that pre-date hasCustomAvatar().
        // Read the raw column directly so we don't trip on getAvatarAttribute()'s
        // Gravatar/ui-avatars fallback URL.
        return !empty($xprofile->getRawOriginal('avatar'));
    }

    public static function uploaded_avatar_url($xprofile): string {
        if (!$xprofile) {
            return '';
        }
        $raw = $xprofile->getRawOriginal('avatar');
        return (is_string($raw) && $raw !== '') ? $raw : '';
    }

    // =========================================================================
    // Re-evaluate on Profile Save
    // =========================================================================

    /**
     * Filter: fluent_community/update_profile_data (priority 99).
     * FC signature: apply_filters('fluent_community/update_profile_data', $updateData, $data, $xProfile)
     *   - $updateData : array of fields about to be persisted (first_name, last_name,
     *                   short_description, website)
     *   - $data       : full POST body (may include other fields)
     *   - $xProfile   : the XProfile model being updated
     */
    public function reevaluate_on_profile_update($updateData, $data, $xprofile) {
        if (!self::get_option('enabled', true) || !$xprofile) {
            return $updateData;
        }

        $user_id = $xprofile->user_id ?? null;
        if (!$user_id) {
            return $updateData;
        }

        if (isset($this->reevaluated_users[$user_id])) {
            return $updateData;
        }
        $this->reevaluated_users[$user_id] = true;

        // Build overrides from the data being saved so we re-evaluate against the
        // post-save state, not the stale pre-save model. Avatar isn't in $updateData
        // (FC only persists name + bio + website here), so the reevaluate_from_model_event
        // hook handles avatar changes separately.
        $overrides = [];
        if (is_array($updateData) && array_key_exists('short_description', $updateData)) {
            $overrides['short_description'] = $updateData['short_description'];
        }

        $flag = get_user_meta($user_id, TBC_PCOM_META_REGISTRATION_COMPLETE, true);
        $missing = self::get_missing_fields($xprofile, $overrides);

        if (empty($missing)) {
            if ($flag !== '1') {
                update_user_meta($user_id, TBC_PCOM_META_REGISTRATION_COMPLETE, '1');
            }
        } else {
            if ($flag !== '0') {
                update_user_meta($user_id, TBC_PCOM_META_REGISTRATION_COMPLETE, '0');
            }
        }

        return $updateData;
    }

    /**
     * Eloquent model event: fires AFTER XProfile is saved to DB.
     * Catches ALL save paths including PUT /profile (avatar, cover).
     */
    public function reevaluate_from_model_event($xprofile) {
        if (!self::get_option('enabled', true)) {
            return;
        }

        $user_id = $xprofile->user_id ?? null;
        if (!$user_id) {
            return;
        }

        if (isset($this->reevaluated_users[$user_id])) {
            return;
        }
        $this->reevaluated_users[$user_id] = true;

        $flag = get_user_meta($user_id, TBC_PCOM_META_REGISTRATION_COMPLETE, true);
        $missing = self::get_missing_fields($xprofile);

        if (empty($missing) && $flag !== '1') {
            update_user_meta($user_id, TBC_PCOM_META_REGISTRATION_COMPLETE, '1');
        } elseif (!empty($missing) && $flag !== '0') {
            update_user_meta($user_id, TBC_PCOM_META_REGISTRATION_COMPLETE, '0');
        }
    }

    // =========================================================================
    // REST API
    // =========================================================================

    /**
     * Register REST routes for the profile-completion gate.
     * Hooked on rest_api_init from the plugin bootstrap.
     *
     * Routes:
     *   GET  /tbc-pcom/v1/status   — Profile completion status (authenticated)
     *   POST /tbc-pcom/v1/complete — Mark profile complete (authenticated)
     */
    public function register_routes(): void {
        register_rest_route(TBC_PCOM_REST_NAMESPACE, '/status', [
            'methods'             => 'GET',
            'callback'            => [$this, 'handle_status'],
            'permission_callback' => 'is_user_logged_in',
        ]);

        register_rest_route(TBC_PCOM_REST_NAMESPACE, '/complete', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_complete'],
            'permission_callback' => 'is_user_logged_in',
        ]);
    }

    /**
     * GET /tbc-pcom/v1/status
     * Returns whether the current user's profile is complete, the list of
     * missing required fields, and the user's current profile values so the
     * mobile app can pre-fill its profile-completion form.
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
                $missing = self::get_missing_fields($xprofile);

                $existing['bio']    = $xprofile->short_description ?? '';
                $existing['avatar'] = self::uploaded_avatar_url($xprofile);

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

        $is_complete = !self::get_option('enabled', true) || empty($missing);

        // Seed the per-request cache so the rest_post_dispatch hook
        // (add_incomplete_header) doesn't re-query XProfile on this response.
        $this->completion_cache[$user_id] = $is_complete;

        return new \WP_REST_Response([
            'profile_complete' => $is_complete,
            'missing'          => $missing,
            'existing'         => $existing,
        ], 200);
    }

    /**
     * POST /tbc-pcom/v1/complete
     * Validates required fields and marks the user's profile complete.
     * Returns 422 with a missing-fields list if the gate's requirements
     * aren't met yet.
     */
    public function handle_complete(\WP_REST_Request $request) {
        $user_id = get_current_user_id();

        if (class_exists('\FluentCommunity\App\Models\XProfile')) {
            $xprofile = \FluentCommunity\App\Models\XProfile::where('user_id', $user_id)->first();
            if ($xprofile) {
                $missing = self::get_missing_fields($xprofile);
                if (!empty($missing)) {
                    return new \WP_REST_Response([
                        'success' => false,
                        'message' => 'Profile incomplete.',
                        'missing' => $missing,
                    ], 422);
                }
            }
        }

        update_user_meta($user_id, TBC_PCOM_META_REGISTRATION_COMPLETE, '1');
        return new \WP_REST_Response(['success' => true], 200);
    }

    // =========================================================================
    // Response Header
    // =========================================================================

    /**
     * Add X-TBC-Profile-Incomplete header on REST responses for incomplete users.
     * The mobile app reads this header to redirect to the profile completion screen.
     */
    public function add_incomplete_header($response, $server, $request) {
        $user_id = get_current_user_id();
        if (!$user_id) {
            return $response;
        }

        if (!$this->is_complete($user_id)) {
            $response->header('X-TBC-Profile-Incomplete', '1');
        }

        return $response;
    }
}
