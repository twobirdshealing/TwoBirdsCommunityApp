<?php
/**
 * YouTube API - Fetches videos and playlists via YouTube Data API v3
 *
 * Provides cached REST endpoints for the mobile app:
 *   GET /tbc-yt/v1/latest               — Latest uploads from channel
 *   GET /tbc-yt/v1/playlists            — All channel playlists
 *   GET /tbc-yt/v1/playlists/{id}/videos — Videos in a specific playlist
 *   GET /tbc-yt/v1/config               — Module config (channel URL)
 *
 * Also registers backward-compatible routes under tbc-ca/v1/youtube/*
 * for older app versions.
 *
 * Requires a YouTube Data API v3 key configured via:
 *   TBC YouTube Settings → YouTube API Key
 *
 * Caches results via WordPress transients (6 hours).
 *
 * @package TBC_YouTube
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_YT_API {

    private static $instance = null;

    /** YouTube Data API v3 base URL */
    const API_BASE = 'https://www.googleapis.com/youtube/v3';

    /** Cache duration in seconds (6 hours) */
    const CACHE_DURATION = 6 * HOUR_IN_SECONDS;

    /** Transient keys */
    const CACHE_KEY_LATEST    = 'tbc_yt_latest';
    const CACHE_KEY_PLAYLISTS = 'tbc_yt_playlists';

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('rest_api_init', [$this, 'register_routes']);
    }

    // =========================================================================
    // Routes
    // =========================================================================

    public function register_routes() {
        $routes = $this->get_route_definitions();

        // Primary namespace: tbc-yt/v1
        foreach ($routes as $path => $args) {
            register_rest_route(TBC_YT_REST_NAMESPACE, $path, $args);
        }

        // Backward compat: tbc-ca/v1/youtube/* (for older app versions)
        $legacy_namespace = defined('TBC_CA_REST_NAMESPACE') ? TBC_CA_REST_NAMESPACE : 'tbc-ca/v1';
        foreach ($routes as $path => $args) {
            register_rest_route($legacy_namespace, '/youtube' . $path, $args);
        }
    }

    /**
     * Route definitions shared between both namespaces
     */
    private function get_route_definitions() {
        return [
            '/latest' => [
                'methods'             => 'GET',
                'callback'            => [$this, 'get_latest_videos'],
                'permission_callback' => '__return_true',
                'args'                => [
                    'limit' => [
                        'default'           => 1,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function ($value) {
                            return is_numeric($value) && $value >= 1 && $value <= 15;
                        },
                    ],
                ],
            ],
            '/playlists' => [
                'methods'             => 'GET',
                'callback'            => [$this, 'get_playlists'],
                'permission_callback' => '__return_true',
            ],
            '/playlists/(?P<id>[a-zA-Z0-9_-]+)/videos' => [
                'methods'             => 'GET',
                'callback'            => [$this, 'get_playlist_videos'],
                'permission_callback' => '__return_true',
                'args'                => [
                    'limit' => [
                        'default'           => 10,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function ($value) {
                            return is_numeric($value) && $value >= 1 && $value <= 50;
                        },
                    ],
                    'pageToken' => [
                        'default'           => '',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                ],
            ],
            '/config' => [
                'methods'             => 'GET',
                'callback'            => [$this, 'get_config'],
                'permission_callback' => '__return_true',
            ],
        ];
    }

    // =========================================================================
    // GET /latest — Latest uploads from channel
    // =========================================================================

    public function get_latest_videos(WP_REST_Request $request) {
        $limit = $request->get_param('limit') ?: 1;

        // Check cache
        $cached = get_transient(self::CACHE_KEY_LATEST);
        if ($cached !== false) {
            return new WP_REST_Response([
                'success' => true,
                'videos'  => array_slice($cached, 0, $limit),
                'cached'  => true,
            ], 200);
        }

        $api_key = $this->get_api_key();
        if (!$api_key) {
            return $this->error_response('YouTube API key not configured');
        }

        $channel_id = $this->get_channel_id();
        if (!$channel_id) {
            return $this->error_response('YouTube channel ID not configured');
        }

        // Uploads playlist = channel ID with "UC" replaced by "UU"
        $playlist_id = 'UU' . substr($channel_id, 2);

        $data = $this->fetch_api('playlistItems', [
            'part'       => 'snippet',
            'playlistId' => $playlist_id,
            'maxResults' => 15,
        ]);

        if (is_wp_error($data)) {
            return $this->error_response($data->get_error_message());
        }

        $videos = $this->map_playlist_items($data['items'] ?? []);

        if (empty($videos)) {
            return $this->error_response('No videos found');
        }

        set_transient(self::CACHE_KEY_LATEST, $videos, self::CACHE_DURATION);

        return new WP_REST_Response([
            'success' => true,
            'videos'  => array_slice($videos, 0, $limit),
            'cached'  => false,
        ], 200);
    }

    // =========================================================================
    // GET /playlists — All channel playlists
    // =========================================================================

    public function get_playlists(WP_REST_Request $request) {
        // Check cache
        $cached = get_transient(self::CACHE_KEY_PLAYLISTS);
        if ($cached !== false) {
            return new WP_REST_Response([
                'success'   => true,
                'playlists' => $cached,
                'cached'    => true,
            ], 200);
        }

        $api_key = $this->get_api_key();
        if (!$api_key) {
            return $this->error_response('YouTube API key not configured');
        }

        $channel_id = $this->get_channel_id();
        if (!$channel_id) {
            return $this->error_response('YouTube channel ID not configured');
        }

        $data = $this->fetch_api('playlists', [
            'part'       => 'snippet,contentDetails',
            'channelId'  => $channel_id,
            'maxResults' => 50,
        ]);

        if (is_wp_error($data)) {
            return $this->error_response($data->get_error_message());
        }

        $playlists = [];
        foreach (($data['items'] ?? []) as $item) {
            $snippet = $item['snippet'] ?? [];
            $thumbs  = $snippet['thumbnails'] ?? [];

            $playlists[] = [
                'id'          => $item['id'],
                'title'       => $snippet['title'] ?? '',
                'description' => $snippet['description'] ?? '',
                'thumbnail'   => $thumbs['high']['url']
                                 ?? $thumbs['medium']['url']
                                 ?? $thumbs['default']['url']
                                 ?? '',
                'videoCount'  => $item['contentDetails']['itemCount'] ?? 0,
            ];
        }

        if (empty($playlists)) {
            return $this->error_response('No playlists found');
        }

        set_transient(self::CACHE_KEY_PLAYLISTS, $playlists, self::CACHE_DURATION);

        return new WP_REST_Response([
            'success'   => true,
            'playlists' => $playlists,
            'cached'    => false,
        ], 200);
    }

    // =========================================================================
    // GET /playlists/{id}/videos — Videos in a playlist
    // =========================================================================

    public function get_playlist_videos(WP_REST_Request $request) {
        $playlist_id = $request->get_param('id');
        $limit       = $request->get_param('limit') ?: 10;
        $page_token  = $request->get_param('pageToken');

        // Cache per playlist + page token
        $cache_key = 'tbc_yt_pl_' . md5($playlist_id . '_' . $page_token . '_' . $limit);
        $cached    = get_transient($cache_key);
        if ($cached !== false) {
            return new WP_REST_Response(array_merge($cached, ['cached' => true]), 200);
        }

        $api_key = $this->get_api_key();
        if (!$api_key) {
            return $this->error_response('YouTube API key not configured');
        }

        $params = [
            'part'       => 'snippet',
            'playlistId' => $playlist_id,
            'maxResults' => $limit,
        ];
        if (!empty($page_token)) {
            $params['pageToken'] = $page_token;
        }

        $data = $this->fetch_api('playlistItems', $params);

        if (is_wp_error($data)) {
            return $this->error_response($data->get_error_message());
        }

        $videos = $this->map_playlist_items($data['items'] ?? []);

        $result = [
            'success'       => true,
            'videos'        => $videos,
            'nextPageToken' => $data['nextPageToken'] ?? null,
            'totalResults'  => $data['pageInfo']['totalResults'] ?? 0,
        ];

        set_transient($cache_key, $result, self::CACHE_DURATION);

        return new WP_REST_Response(array_merge($result, ['cached' => false]), 200);
    }

    // =========================================================================
    // GET /config — Module config for the mobile app
    // =========================================================================

    public function get_config(WP_REST_Request $request) {
        $settings = get_option('tbc_youtube_settings', []);

        return new WP_REST_Response([
            'channel_url' => !empty($settings['channel_url']) ? $settings['channel_url'] : '',
        ], 200);
    }

    // =========================================================================
    // Private helpers
    // =========================================================================

    /**
     * Get YouTube Data API v3 key from plugin settings
     */
    private function get_api_key() {
        $settings = get_option('tbc_youtube_settings', []);
        return !empty($settings['api_key']) ? $settings['api_key'] : '';
    }

    /**
     * Get YouTube channel ID from plugin settings
     */
    private function get_channel_id() {
        $settings = get_option('tbc_youtube_settings', []);
        return !empty($settings['channel_id']) ? $settings['channel_id'] : '';
    }

    /**
     * Fetch from YouTube Data API v3
     *
     * @param string $endpoint API endpoint (e.g. 'playlistItems', 'playlists')
     * @param array  $params   Query parameters
     * @return array|WP_Error  Decoded JSON or error
     */
    private function fetch_api($endpoint, $params = []) {
        $api_key = $this->get_api_key();
        if (!$api_key) {
            return new WP_Error('no_api_key', 'YouTube API key not configured');
        }

        $params['key'] = $api_key;
        $url = self::API_BASE . '/' . $endpoint . '?' . http_build_query($params);

        $response = wp_remote_get($url, [
            'timeout' => 15,
        ]);

        if (is_wp_error($response)) {
            return $response;
        }

        $status = wp_remote_retrieve_response_code($response);
        $body   = wp_remote_retrieve_body($response);

        if (empty($body)) {
            return new WP_Error('empty_response', 'Empty response from YouTube API');
        }

        $data = json_decode($body, true);

        if ($status !== 200) {
            $error_msg = $data['error']['message'] ?? 'YouTube API error (HTTP ' . $status . ')';
            return new WP_Error('api_error', $error_msg);
        }

        return $data;
    }

    /**
     * Map YouTube playlistItems response to our video format
     */
    private function map_playlist_items($items) {
        $videos = [];

        foreach ($items as $item) {
            $snippet  = $item['snippet'] ?? [];
            $resource = $snippet['resourceId'] ?? [];
            $videoId  = $resource['videoId'] ?? '';

            if (empty($videoId)) {
                continue;
            }

            $thumbs = $snippet['thumbnails'] ?? [];

            $videos[] = [
                'videoId'     => $videoId,
                'title'       => $snippet['title'] ?? '',
                'thumbnail'   => $thumbs['high']['url']
                                 ?? $thumbs['medium']['url']
                                 ?? $thumbs['default']['url']
                                 ?? "https://img.youtube.com/vi/{$videoId}/hqdefault.jpg",
                'publishedAt' => $snippet['publishedAt'] ?? '',
            ];
        }

        return $videos;
    }

    /**
     * Standard error response
     */
    private function error_response($message) {
        return new WP_REST_Response([
            'success' => false,
            'error'   => $message,
            'videos'  => [],
        ], 200);
    }

    /**
     * Clear all YouTube caches
     */
    public function clear_cache() {
        delete_transient(self::CACHE_KEY_LATEST);
        delete_transient(self::CACHE_KEY_PLAYLISTS);

        // Clear playlist video caches (transient names start with tbc_yt_pl_)
        global $wpdb;
        $wpdb->query(
            "DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_tbc_yt_pl_%' OR option_name LIKE '_transient_timeout_tbc_yt_pl_%'"
        );
    }
}
