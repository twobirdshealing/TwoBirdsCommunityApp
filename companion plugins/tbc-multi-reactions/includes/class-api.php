<?php
/**
 * API Class
 * Handles REST API endpoints and FC API response injection
 *
 * @package TBC_Multi_Reactions
 */

namespace TBCMultiReactions;

defined('ABSPATH') || exit;

class Api {

    public function __construct() {}

    /**
     * Inject reaction data into feeds collection API response
     * Hook: fluent_community/feeds_api_response
     */
    public function inject_reaction_data_into_feeds($data, $request_data) {
        $settings = get_option('tbc_mr_settings', []);
        if (empty($settings['enabled'])) {
            return $data;
        }

        if (!isset($data['feeds']['data']) || empty($data['feeds']['data'])) {
            return $data;
        }

        $user_id = is_user_logged_in() ? get_current_user_id() : 0;
        $feed_ids = [];
        $comment_ids = [];

        foreach ($data['feeds']['data'] as $feed) {
            if (isset($feed['id'])) {
                $feed_ids[] = $feed['id'];
            }
            if (isset($feed['comments']) && is_array($feed['comments'])) {
                foreach ($feed['comments'] as $comment) {
                    if (isset($comment['id'])) {
                        $comment_ids[] = $comment['id'];
                    }
                }
            }
        }

        if (isset($data['sticky']['id'])) {
            $feed_ids[] = $data['sticky']['id'];
        }

        // Batch fetch breakdowns
        $breakdowns = Database::get_reaction_breakdowns_batch($feed_ids, 'feed');
        $comment_breakdowns = !empty($comment_ids) ? Database::get_reaction_breakdowns_batch($comment_ids, 'comment') : [];

        // Batch fetch user reaction types
        $user_reaction_map = [];
        $comment_reaction_map = [];

        if ($user_id) {
            $user_reaction_map = Database::get_user_reaction_types_batch($user_id, $feed_ids, 'feed');
            if (!empty($comment_ids)) {
                $comment_reaction_map = Database::get_user_reaction_types_batch($user_id, $comment_ids, 'comment');
            }
        }

        $enabled = Core::get_enabled_reactions();
        $config_map = [];
        foreach ($enabled as $r) {
            $config_map[$r['id']] = $r;
        }

        // Annotate each feed
        foreach ($data['feeds']['data'] as &$feed) {
            $fid = $feed['id'] ?? null;
            if (!$fid) continue;

            // Breakdown
            if (isset($breakdowns[$fid])) {
                $feed['reaction_breakdown'] = $breakdowns[$fid]['breakdown'];
                $feed['reaction_total'] = $breakdowns[$fid]['total'];
            } else {
                $feed['reaction_breakdown'] = [];
                $feed['reaction_total'] = 0;
            }

            // User reaction
            if (isset($user_reaction_map[$fid])) {
                $type = $user_reaction_map[$fid];
                $cfg = $config_map[$type] ?? null;
                $feed['user_reaction_type'] = $type;
                $feed['user_reaction_icon_url'] = $cfg['icon_url'] ?? null;
                $feed['user_reaction_name'] = $cfg['name'] ?? $type;
            } else {
                $feed['user_reaction_type'] = null;
            }

            // Annotate comments
            if (isset($feed['comments']) && is_array($feed['comments'])) {
                foreach ($feed['comments'] as &$comment) {
                    $cid = $comment['id'] ?? null;
                    if (!$cid) continue;

                    // Comment reaction breakdown
                    if (isset($comment_breakdowns[$cid])) {
                        $comment['reaction_breakdown'] = $comment_breakdowns[$cid]['breakdown'];
                        $comment['reaction_total'] = $comment_breakdowns[$cid]['total'];
                    } else {
                        $comment['reaction_breakdown'] = [];
                        $comment['reaction_total'] = 0;
                    }

                    if (isset($comment_reaction_map[$cid])) {
                        $type = $comment_reaction_map[$cid];
                        $cfg = $config_map[$type] ?? null;
                        $comment['user_reaction_type'] = $type;
                        $comment['user_reaction_icon_url'] = $cfg['icon_url'] ?? null;
                        $comment['user_reaction_name'] = $cfg['name'] ?? $type;
                    } else {
                        $comment['user_reaction_type'] = null;
                    }
                }
            }
        }

        // Annotate sticky
        if (isset($data['sticky']['id'])) {
            $sid = $data['sticky']['id'];
            if (isset($breakdowns[$sid])) {
                $data['sticky']['reaction_breakdown'] = $breakdowns[$sid]['breakdown'];
                $data['sticky']['reaction_total'] = $breakdowns[$sid]['total'];
            }
            if (isset($user_reaction_map[$sid])) {
                $type = $user_reaction_map[$sid];
                $cfg = $config_map[$type] ?? null;
                $data['sticky']['user_reaction_type'] = $type;
                $data['sticky']['user_reaction_icon_url'] = $cfg['icon_url'] ?? null;
                $data['sticky']['user_reaction_name'] = $cfg['name'] ?? $type;
            } else {
                $data['sticky']['user_reaction_type'] = null;
            }
        }

        return $data;
    }

    /**
     * Inject reaction data into single feed API response
     * Hook: fluent_community/feed_api_response
     */
    public function inject_reaction_data_into_feed($data, $request_data) {
        $settings = get_option('tbc_mr_settings', []);
        if (empty($settings['enabled'])) {
            return $data;
        }

        if (!isset($data['feed']['id'])) {
            return $data;
        }

        $feed_id = $data['feed']['id'];
        $breakdowns = Database::get_reaction_breakdowns_batch([$feed_id], 'feed');

        if (isset($breakdowns[$feed_id])) {
            $data['feed']['reaction_breakdown'] = $breakdowns[$feed_id]['breakdown'];
            $data['feed']['reaction_total'] = $breakdowns[$feed_id]['total'];
        } else {
            $data['feed']['reaction_breakdown'] = [];
            $data['feed']['reaction_total'] = 0;
        }

        if (is_user_logged_in()) {
            $type = Database::get_user_reaction_type(get_current_user_id(), $feed_id, 'feed');
            $data['feed']['user_reaction_type'] = $type;

            if ($type) {
                $config = $this->find_reaction_config($type);
                $data['feed']['user_reaction_icon_url'] = $config['icon_url'] ?? null;
                $data['feed']['user_reaction_name'] = $config['name'] ?? $type;
            }
        }

        return $data;
    }

    /**
     * Inject reaction data into comments API response
     * Hook: fluent_community/comments_query_response
     */
    public function inject_reaction_data_into_comments($comments, $feed) {
        $settings = get_option('tbc_mr_settings', []);
        if (empty($settings['enabled'])) {
            return $comments;
        }

        // FC passes an Eloquent Collection from ->get(), not a plain array.
        // is_array() returns false for Collections, so handle both.
        $is_collection = is_object($comments) && method_exists($comments, 'toArray');
        $items = $is_collection ? $comments->all() : $comments;

        if (empty($items)) {
            return $comments;
        }

        $user_id = is_user_logged_in() ? get_current_user_id() : 0;
        $comment_ids = [];
        foreach ($items as $c) {
            $id = is_object($c) ? ($c->id ?? null) : ($c['id'] ?? null);
            if ($id) {
                $comment_ids[] = $id;
            }
        }

        if (empty($comment_ids)) {
            return $comments;
        }

        // Batch fetch comment breakdowns (for all users, not just logged in)
        $comment_breakdowns = Database::get_reaction_breakdowns_batch($comment_ids, 'comment');

        $reaction_map = [];
        if ($user_id) {
            $reaction_map = Database::get_user_reaction_types_batch($user_id, $comment_ids, 'comment');
        }

        $config_map = [];
        foreach (Core::get_enabled_reactions() as $r) {
            $config_map[$r['id']] = $r;
        }

        // Use index-based iteration so modifications apply to the original
        foreach ($items as $key => $comment) {
            $cid = is_object($comment) ? ($comment->id ?? null) : ($comment['id'] ?? null);
            if (!$cid) continue;

            $data = [];

            // Comment reaction breakdown
            if (isset($comment_breakdowns[$cid])) {
                $data['reaction_breakdown'] = $comment_breakdowns[$cid]['breakdown'];
                $data['reaction_total'] = $comment_breakdowns[$cid]['total'];
            } else {
                $data['reaction_breakdown'] = [];
                $data['reaction_total'] = 0;
            }

            if (isset($reaction_map[$cid])) {
                $type = $reaction_map[$cid];
                $cfg = $config_map[$type] ?? null;
                $data['user_reaction_type'] = $type;
                $data['user_reaction_icon_url'] = $cfg['icon_url'] ?? null;
                $data['user_reaction_name'] = $cfg['name'] ?? $type;
            } else {
                $data['user_reaction_type'] = null;
            }

            // Eloquent models use property assignment, arrays use key assignment
            if ($is_collection) {
                foreach ($data as $k => $v) {
                    $comments[$key]->$k = $v;
                }
            } else {
                foreach ($data as $k => $v) {
                    $comments[$key][$k] = $v;
                }
            }
        }

        return $comments;
    }

    /**
     * Format reactions popup response
     * Hook: fluent_community/reactions_api_response
     */
    public function format_reactions_response($response, $reactions, $request_data) {
        $settings = get_option('tbc_mr_settings', []);
        if (empty($settings['enabled'])) {
            return $response;
        }

        $object_id = intval($request_data['feed_id'] ?? ($request_data['comment_id'] ?? 0));
        $object_type = isset($request_data['feed_id']) ? 'feed' : 'comment';

        if (!$object_id) {
            return $response;
        }

        if (is_user_logged_in()) {
            $type = Database::get_user_reaction_type(get_current_user_id(), $object_id, $object_type);
            $response['user_reaction_type'] = $type;

            if ($type) {
                $config = $this->find_reaction_config($type);
                $response['user_reaction_icon_url'] = $config['icon_url'] ?? null;
                $response['user_reaction_name'] = $config['name'] ?? $type;
            }
        }

        return $response;
    }

    /**
     * Intercept activities API to add reaction data
     * Hook: rest_request_after_callbacks
     */
    public function intercept_activities_api_response($response, $handler, $request) {
        $route = $request->get_route();
        if (!$route || strpos($route, '/fluent-community/v2/activities') === false) {
            return $response;
        }

        if ($request->get_method() !== 'GET' || !($response instanceof \WP_REST_Response)) {
            return $response;
        }

        $settings = get_option('tbc_mr_settings', []);
        if (empty($settings['enabled'])) {
            return $response;
        }

        $data = $response->get_data();

        if (!isset($data['activities']['data']) || empty($data['activities']['data'])) {
            return $response;
        }

        $user_id = get_current_user_id();
        $feed_ids = [];
        $feed_slugs_to_lookup = [];

        // First pass: collect feed IDs and slugs
        foreach ($data['activities']['data'] as $i => $activity) {
            if (isset($activity['feed_id'])) {
                $feed_ids[] = intval($activity['feed_id']);
            } elseif (isset($activity['route']['params']['feed_slug'])) {
                $slug = $activity['route']['params']['feed_slug'];
                if ($slug) {
                    $feed_slugs_to_lookup[$slug][] = $i;
                }
            }
        }

        // Batch lookup slugs
        if (!empty($feed_slugs_to_lookup)) {
            $slugs = array_keys($feed_slugs_to_lookup);
            $feeds = \FluentCommunity\App\Models\Feed::whereIn('slug', $slugs)->select('id', 'slug')->get();
            $slug_map = [];
            foreach ($feeds as $f) {
                $slug_map[$f->slug] = $f->id;
            }
            foreach ($feed_slugs_to_lookup as $slug => $indices) {
                if (isset($slug_map[$slug])) {
                    $fid = $slug_map[$slug];
                    foreach ($indices as $i) {
                        $data['activities']['data'][$i]['feed_id'] = $fid;
                        $feed_ids[] = $fid;
                    }
                }
            }
        }

        $feed_ids = array_unique(array_filter(array_map('intval', $feed_ids)));

        if (empty($feed_ids)) {
            return $response;
        }

        $breakdowns = Database::get_reaction_breakdowns_batch($feed_ids, 'feed');
        $user_map = $user_id ? Database::get_user_reaction_types_batch($user_id, $feed_ids, 'feed') : [];

        $config_map = [];
        foreach (Core::get_enabled_reactions() as $r) {
            $config_map[$r['id']] = $r;
        }

        foreach ($data['activities']['data'] as &$activity) {
            $fid = $activity['feed_id'] ?? null;
            if (!$fid) continue;

            if (isset($breakdowns[$fid])) {
                $activity['reaction_breakdown'] = $breakdowns[$fid]['breakdown'];
                $activity['reaction_total'] = $breakdowns[$fid]['total'];
            }

            if (isset($user_map[$fid])) {
                $type = $user_map[$fid];
                $cfg = $config_map[$type] ?? null;
                $activity['user_reaction_type'] = $type;
                $activity['user_reaction_icon_url'] = $cfg['icon_url'] ?? null;
                $activity['user_reaction_name'] = $cfg['name'] ?? $type;
            } else {
                $activity['user_reaction_type'] = null;
            }
        }

        $response->set_data($data);
        return $response;
    }

    // =========================================================================
    // REST API Handlers (unified for web + mobile app)
    // =========================================================================

    /**
     * GET /tbc-multi-reactions/v1/config
     * Returns enabled reaction types configuration
     */
    public function rest_get_config(\WP_REST_Request $request) {
        $enabled = Core::get_enabled_reactions();
        $reactions = [];
        foreach ($enabled as $r) {
            $reactions[] = [
                'id'       => $r['id'],
                'name'     => $r['name'],
                'emoji'    => $r['emoji'] ?? null,
                'icon_url' => $r['icon_url'] ?? null,
                'color'    => $r['color'],
                'order'    => $r['order'] ?? 0,
            ];
        }

        return new \WP_REST_Response([
            'reactions' => $reactions,
            'display'   => [
                'count'   => 5,
                'overlap' => 8,
                'stroke'  => 0,
            ],
        ], 200);
    }

    /**
     * POST /tbc-multi-reactions/v1/swap
     * Swap reaction type on an existing reaction
     * Body: { object_id, object_type, reaction_type }
     */
    public function rest_swap_reaction(\WP_REST_Request $request) {
        $params = $request->get_json_params();

        $object_id     = absint($params['object_id'] ?? 0);
        $object_type   = sanitize_text_field($params['object_type'] ?? 'feed');
        $reaction_type = sanitize_text_field($params['reaction_type'] ?? 'like');

        if (!$object_id) {
            return new \WP_REST_Response(['message' => 'Invalid object ID.'], 400);
        }

        // Validate reaction type
        $enabled = Core::get_enabled_reactions();
        $valid_ids = array_column($enabled, 'id');
        if (!in_array($reaction_type, $valid_ids)) {
            return new \WP_REST_Response(['message' => 'Invalid reaction type.'], 400);
        }

        $user_id = get_current_user_id();

        // Verify user has an existing reaction
        global $wpdb;
        $table = $wpdb->prefix . 'fcom_post_reactions';
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Real-time reaction check for swap operation.
        $existing = $wpdb->get_row($wpdb->prepare(
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $table is from $wpdb->prefix.
            "SELECT * FROM {$table} WHERE user_id = %d AND object_id = %d AND object_type = %s",
            $user_id, $object_id, $object_type
        ));

        if (!$existing) {
            return new \WP_REST_Response(['message' => 'No existing reaction to update.'], 404);
        }

        $result = Database::update_reaction_type($user_id, $object_id, $object_type, $reaction_type);

        if ($result) {
            $config = $this->find_reaction_config($reaction_type);
            return new \WP_REST_Response([
                'reaction_type' => $reaction_type,
                'icon_url'      => $config['icon_url'] ?? null,
                'emoji'         => $config['emoji'] ?? null,
                'name'          => $config['name'] ?? $reaction_type,
            ], 200);
        }

        return new \WP_REST_Response(['message' => 'Failed to update.'], 500);
    }

    /**
     * GET /tbc-multi-reactions/v1/breakdown/{object_type}/{object_id}
     * Get reaction breakdown for a single item
     */
    public function rest_get_breakdown(\WP_REST_Request $request) {
        $object_id   = absint($request->get_param('object_id'));
        $object_type = sanitize_text_field($request->get_param('object_type'));

        if (!$object_id) {
            return new \WP_REST_Response(['message' => 'Invalid object ID.'], 400);
        }

        $results   = Database::get_reaction_breakdown($object_id, $object_type);
        $breakdown = $this->enrich_breakdown($results);

        $response = [
            'breakdown' => $breakdown,
            'total'     => array_sum(array_column($breakdown, 'count')),
        ];

        if (is_user_logged_in()) {
            $type = Database::get_user_reaction_type(get_current_user_id(), $object_id, $object_type);
            $response['user_reaction_type'] = $type;
        }

        return new \WP_REST_Response($response, 200);
    }

    /**
     * GET /tbc-multi-reactions/v1/breakdown/{object_type}/{object_id}/users
     * Get breakdown with user details
     */
    public function rest_get_breakdown_users(\WP_REST_Request $request) {
        $object_id   = absint($request->get_param('object_id'));
        $object_type = sanitize_text_field($request->get_param('object_type'));

        if (!$object_id) {
            return new \WP_REST_Response(['message' => 'Invalid object ID.'], 400);
        }

        global $wpdb;
        $table   = $wpdb->prefix . 'fcom_post_reactions';

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Real-time breakdown with user details.
        $reactions = $wpdb->get_results($wpdb->prepare(
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $table is from $wpdb->prefix.
            "SELECT tbc_mr_reaction_type, user_id
            FROM {$table}
            WHERE object_id = %d AND object_type = %s AND tbc_mr_reaction_type IS NOT NULL
            ORDER BY tbc_mr_reaction_type, created_at DESC",
            $object_id, $object_type
        ), ARRAY_A);

        // Bulk fetch users via FC XProfile for native avatars & URLs
        $user_ids   = array_unique(array_column($reactions, 'user_id'));
        $xprofiles  = [];
        $users_data = [];
        if (!empty($user_ids)) {
            if (class_exists('\FluentCommunity\App\Models\XProfile')) {
                $xp_rows = \FluentCommunity\App\Models\XProfile::whereIn('user_id', $user_ids)->get();
                foreach ($xp_rows as $xp) {
                    $xprofiles[$xp->user_id] = $xp;
                }
            }
            // WP fallback for any users not in XProfile
            $users = get_users(['include' => $user_ids, 'fields' => ['ID', 'display_name', 'user_nicename']]);
            foreach ($users as $user) {
                $users_data[$user->ID] = $user;
            }
        }

        // Group by type
        $grouped = [];
        foreach ($reactions as $row) {
            $type = $row['tbc_mr_reaction_type'];
            $uid  = (int) $row['user_id'];
            $xp   = $xprofiles[$uid] ?? null;
            $user = $users_data[$uid] ?? null;
            if (!$xp && !$user) continue;

            $meta = ($xp && is_array($xp->meta)) ? $xp->meta : [];
            $grouped[$type][] = [
                'user_id'      => $uid,
                'display_name' => $xp ? $xp->display_name : ($user->display_name ?: $user->user_nicename ?: 'Unknown'),
                'avatar'       => $xp ? $xp->avatar : get_avatar_url($uid, ['size' => 128]),
                'user_url'     => $xp ? $xp->getPermalink() : home_url('/'),
                'is_verified'  => $xp ? (int) ($xp->is_verified ?? 0) : 0,
                'badge_slugs'  => (array) ($meta['badge_slug'] ?? []),
            ];
        }

        $breakdown = [];
        foreach ($grouped as $type => $users) {
            $config = $this->find_reaction_config($type);
            if (!$config) continue;

            $max   = 10;
            $total = count($users);

            $breakdown[] = [
                'type'     => $type,
                'icon_url' => $config['icon_url'] ?? null,
                'emoji'    => $config['emoji'] ?? null,
                'name'     => $config['name'],
                'count'    => $total,
                'color'    => $config['color'],
                'users'    => array_slice($users, 0, $max),
                'has_more' => $total > $max,
            ];
        }

        usort($breakdown, function($a, $b) { return $b['count'] - $a['count']; });

        return new \WP_REST_Response([
            'breakdown' => $breakdown,
            'total'     => array_sum(array_column($breakdown, 'count')),
        ], 200);
    }

    // =========================================================================
    // Notification API Injection
    // =========================================================================

    /**
     * Inject reaction type data into paginated notifications API response
     * Hook: fluent_community/notifications_api_response
     */
    public function inject_reaction_type_into_notifications($data, $request_data) {
        $settings = get_option('tbc_mr_settings', []);
        if (empty($settings['enabled'])) {
            return $data;
        }

        if (!isset($data['notifications']) || empty($data['notifications'])) {
            return $data;
        }

        // Paginated response: notifications is a LengthAwarePaginator
        $items = $data['notifications'];
        $is_paginator = is_object($items) && method_exists($items, 'items');
        $notifications = $is_paginator ? $items->items() : (is_array($items) ? $items : []);

        $this->enrich_notifications_with_reaction_type($notifications);

        return $data;
    }

    /**
     * Inject reaction type data into unread notifications API response
     * Hook: fluent_community/unread_notifications_api_response
     */
    public function inject_reaction_type_into_unread_notifications($data, $request_data) {
        $settings = get_option('tbc_mr_settings', []);
        if (empty($settings['enabled'])) {
            return $data;
        }

        if (!isset($data['notifications']) || empty($data['notifications'])) {
            return $data;
        }

        $notifications = $data['notifications'];
        $items = is_object($notifications) && method_exists($notifications, 'all') ? $notifications->all() : (is_array($notifications) ? $notifications : []);

        $this->enrich_notifications_with_reaction_type($items);

        return $data;
    }

    /**
     * Enrich notification objects with reaction type data
     * Modifies objects in-place (Eloquent models passed by reference)
     */
    private function enrich_notifications_with_reaction_type($notifications) {
        // Collect feed_id + src_user_id pairs for react notifications
        $lookups = [];
        foreach ($notifications as $notification) {
            $action = is_object($notification) ? $notification->action : ($notification['action'] ?? '');
            if ($action !== 'feed/react_added') {
                continue;
            }
            $feed_id = is_object($notification) ? $notification->feed_id : ($notification['feed_id'] ?? 0);
            $src_user_id = is_object($notification) ? $notification->src_user_id : ($notification['src_user_id'] ?? 0);
            if ($feed_id && $src_user_id) {
                $lookups[] = ['feed_id' => (int) $feed_id, 'src_user_id' => (int) $src_user_id];
            }
        }

        if (empty($lookups)) {
            return;
        }

        // Batch lookup: get reaction type for each src_user_id + feed_id pair
        $reaction_types = [];
        foreach ($lookups as $l) {
            $key = $l['src_user_id'] . '_' . $l['feed_id'];
            if (!isset($reaction_types[$key])) {
                $reaction_types[$key] = Database::get_user_reaction_type($l['src_user_id'], $l['feed_id'], 'feed');
            }
        }

        // Build config map
        $config_map = [];
        foreach (Core::get_enabled_reactions() as $r) {
            $config_map[$r['id']] = $r;
        }

        // Enrich each react notification
        foreach ($notifications as $notification) {
            $action = is_object($notification) ? $notification->action : ($notification['action'] ?? '');
            if ($action !== 'feed/react_added') {
                continue;
            }
            $feed_id = (int) (is_object($notification) ? $notification->feed_id : ($notification['feed_id'] ?? 0));
            $src_user_id = (int) (is_object($notification) ? $notification->src_user_id : ($notification['src_user_id'] ?? 0));
            $key = $src_user_id . '_' . $feed_id;
            $type = $reaction_types[$key] ?? null;

            $enrichment = [
                'tbc_reaction_type'     => $type,
                'tbc_reaction_icon_url' => null,
                'tbc_reaction_emoji'    => null,
                'tbc_reaction_name'     => null,
            ];

            if ($type && isset($config_map[$type])) {
                $cfg = $config_map[$type];
                $enrichment['tbc_reaction_icon_url'] = $cfg['icon_url'] ?? null;
                $enrichment['tbc_reaction_emoji']    = $cfg['emoji'] ?? null;
                $enrichment['tbc_reaction_name']     = $cfg['name'] ?? $type;
            }

            // Eloquent models use property assignment
            if (is_object($notification)) {
                foreach ($enrichment as $k => $v) {
                    $notification->$k = $v;
                }
            }
        }
    }

    // --- Helpers ---

    /**
     * Find reaction config by type ID
     */
    private function find_reaction_config($type) {
        foreach (Core::get_enabled_reactions() as $r) {
            if ($r['id'] === $type) {
                return $r;
            }
        }
        return null;
    }

    /**
     * Enrich raw breakdown rows with reaction config
     */
    private function enrich_breakdown($rows) {
        $enabled = Core::get_enabled_reactions();
        $map = [];
        foreach ($enabled as $r) {
            $map[$r['id']] = $r;
        }

        $breakdown = [];
        foreach ($rows as $row) {
            $type = $row['reaction_type'];
            if (!isset($map[$type])) continue;

            $cfg = $map[$type];
            $breakdown[] = [
                'type'     => $type,
                'icon_url' => $cfg['icon_url'] ?? null,
                'emoji'    => $cfg['emoji'] ?? null,
                'name'     => $cfg['name'],
                'count'    => (int) $row['count'],
                'color'    => $cfg['color'],
            ];
        }

        return $breakdown;
    }
}
