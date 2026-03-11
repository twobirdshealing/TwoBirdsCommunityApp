<?php
/**
 * Core Class
 * Singleton orchestrator for TBC Multi Reactions
 *
 * @package TBC_Multi_Reactions
 */

namespace TBCMultiReactions;

defined('ABSPATH') || exit;

class Core {

    private static $instance = null;
    private $api;
    private $admin;
    private $frontend;
    private $posts;
    private $comments;
    private $chat;
    private $last_tracked_reaction_type = null;

    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->load_dependencies();
        $this->init_components();
        $this->init_hooks();
    }

    private function load_dependencies() {
        require_once TBC_MR_DIR . 'includes/class-database.php';
        require_once TBC_MR_DIR . 'includes/class-api.php';
        require_once TBC_MR_DIR . 'includes/class-admin.php';
        require_once TBC_MR_DIR . 'includes/class-icons.php';
        require_once TBC_MR_DIR . 'includes/class-frontend.php';
        require_once TBC_MR_DIR . 'includes/class-posts.php';
        require_once TBC_MR_DIR . 'includes/class-comments.php';
        require_once TBC_MR_DIR . 'includes/class-chat.php';
    }

    private function init_components() {
        $this->api = new Api();
        $this->admin = new Admin();
        $this->posts = new Posts();
        $this->comments = new Comments();
        $this->chat = new Chat();
        $this->frontend = new Frontend($this->posts, $this->comments, $this->chat);
    }

    private function init_hooks() {
        // FC portal integration
        add_action('fluent_community/portal_head', [$this->frontend, 'enqueue_styles']);
        add_action('fluent_community/portal_footer', [$this->frontend, 'inject_reactions_script'], 99);
        add_action('fluent_community/headless/footer', [$this->frontend, 'inject_reactions_script'], 99);
        add_filter('fluent_community/portal_vars', [$this->frontend, 'add_reactions_config']);

        // Admin hooks
        add_action('admin_menu', [$this->admin, 'add_admin_menu']);
        add_action('admin_init', [$this->admin, 'register_settings']);
        add_action('admin_enqueue_scripts', [$this->admin, 'admin_assets']);

        // REST API endpoints (unified for web + mobile app)
        add_action('rest_api_init', [$this, 'register_rest_routes']);

        // Keep icon upload as AJAX (admin-only, uses $_FILES)
        add_action('wp_ajax_tbc_mr_upload_icon', [$this, 'handle_icon_upload']);

        // Track reaction types via FC hooks
        add_action('fluent_community/feed/react_added', [$this, 'track_feed_reaction'], 10, 2);
        // Patch notification text with correct reaction verb (runs AFTER FC's handler at priority 10)
        add_action('fluent_community/feed/react_added', [$this, 'patch_reaction_notification'], 20, 2);
        // FC 2.2.01+ passes 1 arg: $feed (not $reaction)
        add_action('fluent_community/feed/react_removed', [$this, 'clear_reaction_cache_on_removal'], 10, 1);

        // Intercept REST API to capture reaction type before FC processes it
        add_filter('rest_request_before_callbacks', [$this, 'store_pending_reaction_type'], 10, 3);

        // Track comment reactions (no FC hook exists for comments)
        add_filter('rest_request_after_callbacks', [$this, 'track_comment_reaction'], 10, 3);

        // Inject reaction data into FC API responses
        add_filter('fluent_community/feeds_api_response', [$this->api, 'inject_reaction_data_into_feeds'], 10, 2);
        add_filter('fluent_community/feed_api_response', [$this->api, 'inject_reaction_data_into_feed'], 10, 2);
        add_filter('fluent_community/comments_query_response', [$this->api, 'inject_reaction_data_into_comments'], 10, 2);
        add_filter('fluent_community/reactions_api_response', [$this->api, 'format_reactions_response'], 10, 3);

        // Inject reaction type into notifications API
        add_filter('fluent_community/notifications_api_response', [$this->api, 'inject_reaction_type_into_notifications'], 10, 2);
        add_filter('fluent_community/unread_notifications_api_response', [$this->api, 'inject_reaction_type_into_unread_notifications'], 10, 2);

        // Intercept activities API for list view
        add_filter('rest_request_after_callbacks', [$this->api, 'intercept_activities_api_response'], 10, 3);

        // Sync fluent-messaging chat reaction emojis with our configured set
        add_filter('fluent_messaging/allowed_reaction_emojis', [$this, 'filter_chat_reaction_emojis']);
    }

    /**
     * Register REST API routes
     * Namespace: tbc-multi-reactions/v1
     * Auth: Web uses cookie (automatic), App uses JWT Bearer token
     */
    public function register_rest_routes() {
        $namespace = 'tbc-multi-reactions/v1';

        // GET /config - Get enabled reaction types (public)
        register_rest_route($namespace, '/config', [
            'methods'             => 'GET',
            'callback'            => [$this->api, 'rest_get_config'],
            'permission_callback' => '__return_true',
        ]);

        // POST /swap - Swap reaction type on existing reaction (auth required)
        register_rest_route($namespace, '/swap', [
            'methods'             => 'POST',
            'callback'            => [$this->api, 'rest_swap_reaction'],
            'permission_callback' => function() { return is_user_logged_in(); },
        ]);

        // GET /breakdown/{object_type}/{object_id} - Get reaction breakdown (public)
        register_rest_route($namespace, '/breakdown/(?P<object_type>[a-z]+)/(?P<object_id>\d+)', [
            'methods'             => 'GET',
            'callback'            => [$this->api, 'rest_get_breakdown'],
            'permission_callback' => '__return_true',
            'args' => [
                'object_type' => ['required' => true, 'sanitize_callback' => 'sanitize_text_field'],
                'object_id'   => ['required' => true, 'sanitize_callback' => 'absint'],
            ],
        ]);

        // GET /breakdown/{object_type}/{object_id}/users - Get breakdown with users (public)
        register_rest_route($namespace, '/breakdown/(?P<object_type>[a-z]+)/(?P<object_id>\d+)/users', [
            'methods'             => 'GET',
            'callback'            => [$this->api, 'rest_get_breakdown_users'],
            'permission_callback' => '__return_true',
            'args' => [
                'object_type' => ['required' => true, 'sanitize_callback' => 'sanitize_text_field'],
                'object_id'   => ['required' => true, 'sanitize_callback' => 'absint'],
            ],
        ]);
    }

    /**
     * Handle icon upload via AJAX
     */
    public function handle_icon_upload() {
        check_ajax_referer('tbc_mr_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Permission denied.', 'tbc-multi-reactions')], 403);
        }

        if (empty($_FILES['icon_file'])) {
            wp_send_json_error(['message' => __('No file uploaded.', 'tbc-multi-reactions')], 400);
        }

        $result = Icons::upload_icon($_FILES['icon_file']); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- File array validated in Icons::validate_upload().

        if (is_wp_error($result)) {
            wp_send_json_error(['message' => $result->get_error_message()], 400);
        }

        wp_send_json_success($result);
    }

    /**
     * Store pending reaction type from REST request header before FC processes it
     */
    public function store_pending_reaction_type($response, $handler, $request) {
        $route = $request->get_route();

        if (!$route || (strpos($route, '/fluent-community/v2/feeds/') === false && strpos($route, '/fluent-community/v2/comments/') === false)) {
            return $response;
        }

        if ($request->get_method() !== 'POST' || (strpos($route, '/react') === false && strpos($route, '/reactions') === false)) {
            return $response;
        }

        // Read reaction type from our custom header
        $react_type = $request->get_header('X-TBC-Reaction-Type');

        if (empty($react_type)) {
            // Fallback: check body for react_type
            $raw_body = $request->get_body();
            if (empty($raw_body)) {
                return $response;
            }
            $body_data = json_decode($raw_body, true);
            if (json_last_error() !== JSON_ERROR_NONE || empty($body_data['react_type'])) {
                return $response;
            }
            $react_type = sanitize_text_field($body_data['react_type']);
        } else {
            $react_type = sanitize_text_field($react_type);
        }

        // Validate reaction type
        $enabled_reactions = self::get_enabled_reactions();
        $valid_types = array_column($enabled_reactions, 'id');
        if (!in_array($react_type, $valid_types)) {
            return $response;
        }

        // Determine object ID and type from route
        $object_id = null;
        $object_type = null;

        if (preg_match('#/feeds/(\d+)/react#', $route, $matches)) {
            $object_id = intval($matches[1]);
            $object_type = 'feed';
        } elseif (preg_match('#/comments/(\d+)/reactions#', $route, $matches)) {
            $object_id = intval($matches[1]);
            $object_type = 'comment';
        }

        if ($object_id) {
            $raw_body = $raw_body ?? $request->get_body();
            $body_data = $body_data ?? json_decode($raw_body, true);
            $is_remove = ($body_data && isset($body_data['remove']) && $body_data['remove']);

            update_option('tbc_mr_pending_reaction', [
                'user_id'       => get_current_user_id(),
                'object_id'     => $object_id,
                'object_type'   => $object_type,
                'reaction_type' => $react_type,
                'is_remove'     => $is_remove,
                'timestamp'     => time(),
            ], false);
        }

        return $response;
    }

    /**
     * Track feed reaction type after FC creates the reaction
     */
    public function track_feed_reaction($reaction, $feed) {
        $pending = get_option('tbc_mr_pending_reaction');

        if (!$pending || (time() - $pending['timestamp']) > 10) {
            delete_option('tbc_mr_pending_reaction');
            return;
        }

        if ($pending['user_id'] != $reaction->user_id ||
            $pending['object_id'] != $reaction->object_id ||
            $pending['object_type'] != $reaction->object_type) {
            return;
        }

        Database::update_reaction_type(
            $reaction->user_id,
            $reaction->object_id,
            $reaction->object_type,
            $pending['reaction_type']
        );

        // Store for notification patcher (runs at priority 20)
        $this->last_tracked_reaction_type = $pending['reaction_type'];

        delete_option('tbc_mr_pending_reaction');
    }

    /**
     * Track comment reaction type after FC processes the comment reaction
     */
    public function track_comment_reaction($response, $handler, $request) {
        $route = $request->get_route();

        if (!$route || strpos($route, '/fluent-community/v2/') === false) {
            return $response;
        }

        if (!preg_match('#/feeds/\d+/comments/(\d+)/reactions#', $route, $matches)) {
            return $response;
        }

        if ($request->get_method() !== 'POST') {
            return $response;
        }

        if (!($response instanceof \WP_REST_Response)) {
            return $response;
        }

        $status = $response->get_status();
        if ($status < 200 || $status >= 300) {
            return $response;
        }

        $pending = get_option('tbc_mr_pending_reaction');

        if (!$pending || (time() - $pending['timestamp']) > 10) {
            delete_option('tbc_mr_pending_reaction');
            return $response;
        }

        if ($pending['object_type'] !== 'comment' || $pending['object_id'] !== intval($matches[1])) {
            return $response;
        }

        $response_data = $response->get_data();
        if (isset($response_data['action']) && $response_data['action'] === 'removed') {
            delete_option('tbc_mr_pending_reaction');
            return $response;
        }

        Database::update_reaction_type(
            $pending['user_id'],
            $pending['object_id'],
            'comment',
            $pending['reaction_type']
        );

        delete_option('tbc_mr_pending_reaction');
        return $response;
    }

    /**
     * Patch notification text after FC creates it with hardcoded "loved"
     * Runs AFTER FC's NotificationEventHandler::handleNewFeedReact() (priority 20 vs FC's 10)
     * Replaces "loved" with "reacted with {Name} to" using the reaction's display name
     */
    public function patch_reaction_notification($reaction, $feed) {
        $reaction_type = $this->last_tracked_reaction_type;
        $this->last_tracked_reaction_type = null;

        if (!$reaction_type) {
            return;
        }

        // Look up the reaction display name from config
        $name = $reaction_type;
        foreach (self::get_enabled_reactions() as $r) {
            if ($r['id'] === $reaction_type) {
                $name = $r['name'];
                break;
            }
        }

        $notification = \FluentCommunity\App\Models\Notification::where('feed_id', $feed->id)
            ->where('action', 'feed/react_added')
            ->first();

        if (!$notification) {
            return;
        }

        $notification->content = str_replace(' loved ', " reacted with {$name} to ", $notification->content);
        $notification->save();
    }

    /**
     * Clear cache when a reaction is removed
     * FC 2.2.01+ fires with 1 arg: $feed (Feed model)
     */
    public function clear_reaction_cache_on_removal($feed) {
        Database::clear_reaction_breakdown_cache($feed->id, 'feed');
    }

    /**
     * Filter fluent-messaging chat reaction emojis to match our configured set.
     * Replaces Fluent's default 6 emojis with whatever emojis are configured in our admin.
     *
     * @param array $emojis Default emoji array from Fluent Messaging
     * @return array Filtered emoji array
     */
    public function filter_chat_reaction_emojis($emojis) {
        $enabled = self::get_enabled_reactions();
        if (empty($enabled)) {
            return $emojis;
        }

        $our_emojis = array_filter(array_column($enabled, 'emoji'));
        return !empty($our_emojis) ? array_values($our_emojis) : $emojis;
    }

    /**
     * Get enabled reaction types with config
     *
     * @return array
     */
    public static function get_enabled_reactions() {
        $settings = get_option('tbc_mr_settings', []);
        $reaction_types = isset($settings['reaction_types']) ? $settings['reaction_types'] : [];

        $enabled = array_filter($reaction_types, function($r) {
            return !empty($r['enabled']);
        });

        uasort($enabled, function($a, $b) {
            return ($a['order'] ?? 999) - ($b['order'] ?? 999);
        });

        $result = [];
        foreach ($enabled as $id => $reaction) {
            $reaction['id'] = $id;
            // Decode HTML entities back to emoji characters
            if (isset($reaction['emoji'])) {
                $reaction['emoji'] = html_entity_decode($reaction['emoji'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
            }
            $result[] = $reaction;
        }

        return $result;
    }
}
