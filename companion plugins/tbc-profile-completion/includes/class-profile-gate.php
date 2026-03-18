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

        $bio    = $overrides['short_description'] ?? ($xprofile->short_description ?? '');
        $avatar = $overrides['avatar'] ?? ($xprofile->avatar ?? '');

        if (self::get_option('require_bio', true) && empty($bio)) {
            $missing[] = 'bio';
        }

        if (self::get_option('require_avatar', true) && self::is_placeholder_avatar($avatar)) {
            $missing[] = 'avatar';
        }

        return $missing;
    }

    /**
     * Check if an avatar URL is empty or Fluent Community's default placeholder.
     */
    public static function is_placeholder_avatar(string $avatar): bool {
        if (empty($avatar)) {
            return true;
        }

        if (str_contains($avatar, 'fluent-community/assets/images/placeholder')) {
            return true;
        }

        return false;
    }

    // =========================================================================
    // Re-evaluate on Profile Save
    // =========================================================================

    /**
     * Filter: fluent_community/update_profile_data (priority 99).
     * Catches POST /profile (bio, social links, website).
     */
    public function reevaluate_on_profile_update($data, $xprofile, $user) {
        if (!$user || !self::get_option('enabled', true)) {
            return $data;
        }

        $user_id = $user->ID;

        if (isset($this->reevaluated_users[$user_id])) {
            return $data;
        }
        $this->reevaluated_users[$user_id] = true;

        $overrides = [];
        if (is_array($data)) {
            if (array_key_exists('short_description', $data)) {
                $overrides['short_description'] = $data['short_description'];
            }
            if (array_key_exists('avatar', $data)) {
                $overrides['avatar'] = $data['avatar'];
            }
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

        return $data;
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
    // REST Filter Hooks (tbc-community-app delegates to us)
    // =========================================================================

    /**
     * Filter: tbc_ca_profile_status.
     * Adds profile completion data to the status response.
     */
    public function filter_profile_status($response, $user_id) {
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
                $raw_avatar = $xprofile->avatar ?? '';
                $existing['avatar'] = self::is_placeholder_avatar($raw_avatar) ? '' : $raw_avatar;

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

        return [
            'profile_complete' => $is_complete,
            'missing'          => $missing,
            'existing'         => $existing,
        ];
    }

    /**
     * Filter: tbc_ca_complete_registration.
     * Validates required fields before marking registration complete.
     */
    public function filter_complete_registration($response, $user_id) {
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
