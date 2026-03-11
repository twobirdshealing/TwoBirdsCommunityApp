<?php
/**
 * REST Fields - Embeds Fluent Community avatar + verified status into WP REST API responses
 *
 * Adds fcom_avatar, fcom_is_verified, and fcom_badge_slugs to user objects (posts via _embed)
 * and fcom_author_avatar, fcom_author_is_verified, fcom_author_slug, fcom_author_badge_slugs
 * to comment objects. Eliminates the need for separate profile API calls on the mobile app.
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_Rest_Fields {

    private static $instance = null;

    /**
     * Cache of Fluent Community xprofile data keyed by WP user ID.
     * Prevents repeated DB lookups when multiple comments share the same author.
     *
     * @var array<int, array{avatar: string|null, is_verified: int, slug: string, badge_slugs: array}>
     */
    private static $profile_cache = [];

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('rest_api_init', [$this, 'register_fields']);
    }

    /**
     * Register custom REST fields on user and comment object types.
     */
    public function register_fields() {
        // --- User fields (appears in /wp-json/wp/v2/users and _embedded.author) ---

        register_rest_field('user', 'fcom_avatar', [
            'get_callback' => [$this, 'get_user_avatar'],
            'schema'       => [
                'description' => 'Fluent Community avatar URL',
                'type'        => ['string', 'null'],
                'context'     => ['view', 'embed'],
            ],
        ]);

        register_rest_field('user', 'fcom_is_verified', [
            'get_callback' => [$this, 'get_user_verified'],
            'schema'       => [
                'description' => 'Fluent Community verified status',
                'type'        => 'integer',
                'context'     => ['view', 'embed'],
            ],
        ]);

        register_rest_field('user', 'fcom_badge_slugs', [
            'get_callback' => [$this, 'get_user_badge_slugs'],
            'schema'       => [
                'description' => 'Fluent Community profile badge slugs',
                'type'        => 'array',
                'items'       => ['type' => 'string'],
                'context'     => ['view', 'embed'],
            ],
        ]);

        // --- Comment fields ---

        register_rest_field('comment', 'fcom_author_avatar', [
            'get_callback' => [$this, 'get_comment_author_avatar'],
            'schema'       => [
                'description' => 'Fluent Community avatar URL for comment author',
                'type'        => ['string', 'null'],
                'context'     => ['view', 'embed'],
            ],
        ]);

        register_rest_field('comment', 'fcom_author_is_verified', [
            'get_callback' => [$this, 'get_comment_author_verified'],
            'schema'       => [
                'description' => 'Fluent Community verified status for comment author',
                'type'        => 'integer',
                'context'     => ['view', 'embed'],
            ],
        ]);

        register_rest_field('comment', 'fcom_author_slug', [
            'get_callback' => [$this, 'get_comment_author_slug'],
            'schema'       => [
                'description' => 'WordPress user slug for comment author (for profile navigation)',
                'type'        => ['string', 'null'],
                'context'     => ['view', 'embed'],
            ],
        ]);

        register_rest_field('comment', 'fcom_author_badge_slugs', [
            'get_callback' => [$this, 'get_comment_author_badge_slugs'],
            'schema'       => [
                'description' => 'Fluent Community badge slugs for comment author',
                'type'        => 'array',
                'items'       => ['type' => 'string'],
                'context'     => ['view', 'embed'],
            ],
        ]);
    }

    // -------------------------------------------------------------------------
    // User field callbacks
    // -------------------------------------------------------------------------

    public function get_user_avatar($user, $field_name, $request) {
        $data = $this->get_fcom_profile($user['id']);
        return $data ? $data['avatar'] : null;
    }

    public function get_user_verified($user, $field_name, $request) {
        $data = $this->get_fcom_profile($user['id']);
        return $data ? $data['is_verified'] : 0;
    }

    public function get_user_badge_slugs($user, $field_name, $request) {
        $data = $this->get_fcom_profile($user['id']);
        return $data ? $data['badge_slugs'] : [];
    }

    // -------------------------------------------------------------------------
    // Comment field callbacks
    // -------------------------------------------------------------------------

    public function get_comment_author_avatar($comment, $field_name, $request) {
        $user_id = $comment['author'] ?? 0;
        if ($user_id === 0) return null;

        $data = $this->get_fcom_profile($user_id);
        return $data ? $data['avatar'] : null;
    }

    public function get_comment_author_verified($comment, $field_name, $request) {
        $user_id = $comment['author'] ?? 0;
        if ($user_id === 0) return 0;

        $data = $this->get_fcom_profile($user_id);
        return $data ? $data['is_verified'] : 0;
    }

    public function get_comment_author_slug($comment, $field_name, $request) {
        $user_id = $comment['author'] ?? 0;
        if ($user_id === 0) return null;

        $data = $this->get_fcom_profile($user_id);
        return $data ? $data['slug'] : null;
    }

    public function get_comment_author_badge_slugs($comment, $field_name, $request) {
        $user_id = $comment['author'] ?? 0;
        if ($user_id === 0) return [];

        $data = $this->get_fcom_profile($user_id);
        return $data ? $data['badge_slugs'] : [];
    }

    // -------------------------------------------------------------------------
    // Shared: Fetch & cache Fluent Community profile data
    // -------------------------------------------------------------------------

    /**
     * @param int $user_id WordPress user ID
     * @return array{avatar: string|null, is_verified: int, slug: string, badge_slugs: array}|null
     */
    private function get_fcom_profile($user_id) {
        if ($user_id <= 0) return null;

        // Return from cache if already fetched this request
        if (isset(self::$profile_cache[$user_id])) {
            return self::$profile_cache[$user_id];
        }

        // Fluent Community must be active
        if (!class_exists('FluentCommunity\App\Models\User')) {
            return null;
        }

        try {
            $fc_user = \FluentCommunity\App\Models\User::find($user_id);
            if (!$fc_user || !$fc_user->xprofile) {
                self::$profile_cache[$user_id] = null;
                return null;
            }

            $xprofile = $fc_user->xprofile;
            $wp_user = get_userdata($user_id);

            $meta = $xprofile->meta ?? [];
            $badge_slugs = is_array($meta) ? ($meta['badge_slug'] ?? []) : [];

            $data = [
                'avatar'       => $xprofile->avatar ?? null,
                'is_verified'  => (int) ($xprofile->is_verified ?? 0),
                'slug'         => $wp_user ? $wp_user->user_nicename : '',
                'badge_slugs'  => (array) $badge_slugs,
            ];

            self::$profile_cache[$user_id] = $data;
            return $data;
        } catch (\Exception $e) {
            self::$profile_cache[$user_id] = null;
            return null;
        }
    }
}
