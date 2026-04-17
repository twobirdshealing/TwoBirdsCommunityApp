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
        add_action('fluent_community/portal_head', [$this->frontend, 'enqueue_styles']);
        add_action('fluent_community/portal_footer', [$this->frontend, 'inject_reactions_script'], 99);
        add_action('fluent_community/headless/footer', [$this->frontend, 'inject_reactions_script'], 99);

        add_action('admin_menu', [$this->admin, 'add_admin_menu']);
        add_action('admin_init', [$this->admin, 'register_settings']);
        add_action('admin_enqueue_scripts', [$this->admin, 'admin_assets']);

        add_action('rest_api_init', [$this, 'register_rest_routes']);
        add_action('wp_ajax_tbc_mr_upload_icon', [$this, 'handle_icon_upload']);

        add_action('fluent_community/feed/react_added', [$this, 'track_feed_reaction'], 10, 2);
        // Runs AFTER FC's NotificationEventHandler::handleNewFeedReact() at priority 10.
        add_action('fluent_community/feed/react_added', [$this, 'patch_reaction_notification'], 20, 2);
        // FC 2.2.01+ passes 1 arg ($feed), not 2 ($reaction, $feed).
        add_action('fluent_community/feed/react_removed', [$this, 'clear_reaction_cache_on_removal'], 10, 1);

        add_filter('rest_request_before_callbacks', [$this, 'store_pending_reaction_type'], 10, 3);
        // No FC hook exists for comment reactions, so we intercept the REST response.
        add_filter('rest_request_after_callbacks', [$this, 'track_comment_reaction'], 10, 3);

        add_filter('fluent_community/feeds_api_response', [$this->api, 'inject_reaction_data_into_feeds'], 10, 2);
        add_filter('fluent_community/feed_api_response', [$this->api, 'inject_reaction_data_into_feed'], 10, 2);
        add_filter('fluent_community/comments_query_response', [$this->api, 'inject_reaction_data_into_comments'], 10, 2);
        add_filter('fluent_community/reactions_api_response', [$this->api, 'format_reactions_response'], 10, 3);

        add_filter('fluent_community/notifications_api_response', [$this->api, 'inject_reaction_type_into_notifications'], 10, 2);
        add_filter('fluent_community/unread_notifications_api_response', [$this->api, 'inject_reaction_type_into_unread_notifications'], 10, 2);

        add_filter('rest_request_after_callbacks', [$this->api, 'intercept_activities_api_response'], 10, 3);

        add_filter('fluent_messaging/allowed_reaction_emojis', [$this, 'filter_chat_reaction_emojis']);
    }

    public function register_rest_routes() {
        $namespace = 'tbc-multi-reactions/v1';

        register_rest_route($namespace, '/config', [
            'methods'             => 'GET',
            'callback'            => [$this->api, 'rest_get_config'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($namespace, '/swap', [
            'methods'             => 'POST',
            'callback'            => [$this->api, 'rest_swap_reaction'],
            'permission_callback' => function() { return is_user_logged_in(); },
        ]);

        register_rest_route($namespace, '/breakdown/(?P<object_type>[a-z]+)/(?P<object_id>\d+)', [
            'methods'             => 'GET',
            'callback'            => [$this->api, 'rest_get_breakdown'],
            'permission_callback' => '__return_true',
            'args' => [
                'object_type' => ['required' => true, 'sanitize_callback' => 'sanitize_text_field'],
                'object_id'   => ['required' => true, 'sanitize_callback' => 'absint'],
            ],
        ]);

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

    public function store_pending_reaction_type($response, $handler, $request) {
        $route = $request->get_route();

        if (!$route || (strpos($route, '/fluent-community/v2/feeds/') === false && strpos($route, '/fluent-community/v2/comments/') === false)) {
            return $response;
        }

        if ($request->get_method() !== 'POST' || (strpos($route, '/react') === false && strpos($route, '/reactions') === false)) {
            return $response;
        }

        $react_type = $request->get_header('X-TBC-Reaction-Type');

        if (empty($react_type)) {
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

        $enabled_reactions = self::get_enabled_reactions();
        $valid_types = array_column($enabled_reactions, 'id');
        if (!in_array($react_type, $valid_types)) {
            return $response;
        }

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

        $this->last_tracked_reaction_type = $pending['reaction_type'];

        delete_option('tbc_mr_pending_reaction');
    }

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
     * Replaces FC's hardcoded "loved" verb with "reacted with {Name} to" so the
     * notification reflects the actual reaction type chosen by the user.
     */
    public function patch_reaction_notification($reaction, $feed) {
        $reaction_type = $this->last_tracked_reaction_type;
        $this->last_tracked_reaction_type = null;

        if (!$reaction_type) {
            return;
        }

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

    public function clear_reaction_cache_on_removal($feed) {
        Database::clear_reaction_breakdown_cache($feed->id, 'feed');
    }

    public function filter_chat_reaction_emojis($emojis) {
        $enabled = self::get_enabled_reactions();
        if (empty($enabled)) {
            return $emojis;
        }

        $our_emojis = array_filter(array_column($enabled, 'emoji'));
        return !empty($our_emojis) ? array_values($our_emojis) : $emojis;
    }

    /**
     * Build the slim reaction config shape used by all injected JS (posts, comments, chat).
     *
     * @return array
     */
    public static function build_js_reaction_config() {
        $config = [];
        foreach (self::get_enabled_reactions() as $r) {
            $config[] = [
                'id'       => $r['id'],
                'name'     => $r['name'],
                'emoji'    => $r['emoji'] ?? null,
                'icon_url' => $r['icon_url'] ?? null,
                'color'    => $r['color'] ?? null,
            ];
        }
        return $config;
    }

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
            if (isset($reaction['emoji'])) {
                $reaction['emoji'] = html_entity_decode($reaction['emoji'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
            }
            $result[] = $reaction;
        }

        return $result;
    }
}
