<?php
/**
 * YouTube API - Fetches videos and playlists via YouTube Data API v3
 *
 * Provides cached REST endpoints for the mobile app:
 *   GET /youtube/latest               — Latest uploads from channel
 *   GET /youtube/playlists            — All channel playlists
 *   GET /youtube/playlists/{id}/videos — Videos in a specific playlist
 *
 * Requires a YouTube Data API v3 key configured via:
 *   TBC Community App Settings → General → YouTube API Key
 *
 * Caches results via WordPress transients (6 hours).
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_YouTube_API {

    private static $instance = null;

    /** Default channel ID — Two Birds Church */
    const DEFAULT_CHANNEL_ID = 'UCO7lWHNeso1Gdyw8Rcb3UmA';

    /** YouTube Data API v3 base URL */
    const API_BASE = 'https://www.googleapis.com/youtube/v3';

    /** Cache duration in seconds (6 hours) */
    const CACHE_DURATION = 6 * HOUR_IN_SECONDS;

    /** Transient keys */
    const CACHE_KEY_LATEST    = 'tbc_ca_youtube_latest';
    const CACHE_KEY_PLAYLISTS = 'tbc_ca_youtube_playlists';

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
        // GET /youtube/latest
        register_rest_route(TBC_CA_REST_NAMESPACE, '/youtube/latest', [
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
        ]);

        // GET /youtube/playlists
        register_rest_route(TBC_CA_REST_NAMESPACE, '/youtube/playlists', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_playlists'],
            'permission_callback' => '__return_true',
        ]);

        // GET /youtube/playlists/{id}/videos
        register_rest_route(TBC_CA_REST_NAMESPACE, '/youtube/playlists/(?P<id>[a-zA-Z0-9_-]+)/videos', [
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
        ]);
    }

    // =========================================================================
    // GET /youtube/latest — Latest uploads from channel
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

        // Uploads playlist = channel ID with "UC" replaced by "UU"
        $channel_id  = get_option('tbc_ca_youtube_channel_id', self::DEFAULT_CHANNEL_ID);
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
    // GET /youtube/playlists — All channel playlists
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

        $channel_id = get_option('tbc_ca_youtube_channel_id', self::DEFAULT_CHANNEL_ID);

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
    // GET /youtube/playlists/{id}/videos — Videos in a playlist
    // =========================================================================

    public function get_playlist_videos(WP_REST_Request $request) {
        $playlist_id = $request->get_param('id');
        $limit       = $request->get_param('limit') ?: 10;
        $page_token  = $request->get_param('pageToken');

        // Cache per playlist + page token
        $cache_key = 'tbc_ca_yt_pl_' . md5($playlist_id . '_' . $page_token . '_' . $limit);
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
    // Private helpers
    // =========================================================================

    /**
     * Get YouTube Data API v3 key from plugin settings
     */
    private function get_api_key() {
        return get_option('tbc_ca_youtube_api_key', '');
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
}
