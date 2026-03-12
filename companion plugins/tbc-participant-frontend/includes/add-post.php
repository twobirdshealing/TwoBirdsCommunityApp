<?php
/**
 * Event Space Posts Management
 *
 * Handles scheduled and immediate posts for event chat spaces.
 * Uses dynamic templates from database.
 * Migrated from BuddyBoss Groups in v4.0.0.
 *
 * @package TBC_Participant_Frontend
 * @since 4.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

use FluentCommunity\App\Models\Media as FCMedia;
use FluentCommunity\App\Services\FeedsHelper;
use FluentCommunity\App\Services\Helper as FCHelper;

// ============================================================================
// SPACE POST CREATION
// ============================================================================

/**
 * Create a Fluent Community space post with optional media
 *
 * @param int $space_id Fluent Community space ID
 * @param int $user_id Author user ID
 * @param string $title Post title
 * @param string $content Post content
 * @param array $media_images Array of image data [{id, url}]
 * @param array $media_videos Array of video data [{id, url}]
 * @return int|false Feed ID on success, false on failure
 */
function tbc_pf_create_group_post($space_id, $user_id, $title, $content, $media_images = [], $media_videos = []) {
    if (!tbc_pf_is_fluent_active() || !class_exists(FeedsHelper::class)) {
        return false;
    }

    // Ensure user is a member of the space (FeedsHelper validates this)
    if (!FCHelper::isUserInSpace($user_id, $space_id)) {
        FCHelper::addToSpace($space_id, $user_id, 'member', 'by_admin');
    }

    // Content is already markdown from EasyMDE editor, just strip slashes
    $content = wp_unslash($content);

    $feedData = [
        'message'  => $content,
        'user_id'  => intval($user_id),
        'space_id' => intval($space_id),
    ];

    if (!empty($title)) {
        $feedData['title'] = $title;
    }

    // Register WP attachments in Fluent's media archive and build native media_images
    if (!empty($media_images) && is_array($media_images) && class_exists(FCMedia::class)) {
        $fluent_images = [];
        foreach ($media_images as $image) {
            if (empty($image['id'])) {
                continue;
            }
            $attachment_id = intval($image['id']);
            $url = !empty($image['url']) ? $image['url'] : wp_get_attachment_url($attachment_id);
            if (!$url) {
                continue;
            }

            $meta = wp_get_attachment_metadata($attachment_id);
            $media = FCMedia::where('media_url', $url)->first();
            if (!$media) {
                $media = FCMedia::create([
                    'object_source' => 'feed',
                    'user_id'       => intval($user_id),
                    'media_type'    => get_post_mime_type($attachment_id) ?: 'image/jpeg',
                    'driver'        => 'local',
                    'media_path'    => get_attached_file($attachment_id) ?: '',
                    'media_url'     => $url,
                    'is_active'     => 0,
                    'settings'      => [
                        'width'    => $meta['width'] ?? 0,
                        'height'   => $meta['height'] ?? 0,
                        'provider' => 'uploader',
                    ],
                ]);
            }

            $fluent_images[] = [
                'url'      => add_query_arg('media_key', $media->media_key, $url),
                'type'     => 'image',
                'width'    => $meta['width'] ?? 0,
                'height'   => $meta['height'] ?? 0,
                'provider' => 'uploader',
            ];
        }
        if ($fluent_images) {
            $feedData['media_images'] = $fluent_images;
        }
    }

    // Handle video embeds (YouTube, Vimeo, etc.)
    if (!empty($media_videos) && is_array($media_videos)) {
        foreach ($media_videos as $video) {
            $url = !empty($video['url']) ? $video['url'] : '';
            if (!empty($video['id']) && !$url) {
                $url = wp_get_attachment_url(intval($video['id']));
            }
            if ($url) {
                $feedData['media'] = [
                    'type' => 'oembed',
                    'url'  => $url,
                ];
                break; // Only one video per post
            }
        }
    }

    $feed = FeedsHelper::createFeed($feedData);

    if (is_wp_error($feed)) {
        error_log('[TBC PF] createFeed failed — code: ' . $feed->get_error_code() . ', message: ' . $feed->get_error_message() . ', data: ' . wp_json_encode($feed->get_error_data()));
        return false;
    }

    return $feed->id;
}

// ============================================================================
// POST SCHEDULING
// ============================================================================

/**
 * Schedule all event posts for a space using database templates
 *
 * @param int $group_id Fluent Community space ID (kept as group_id for AS compatibility)
 * @param int $product_id Product ID
 * @param string $event_date Event START date (Y-m-d)
 * @param string $event_end_date Event END date (Y-m-d) - optional
 */
function tbc_pf_schedule_event_posts_dynamic($group_id, $product_id, $event_date, $event_end_date = '') {
    if (!function_exists('as_enqueue_async_action') || !function_exists('as_schedule_single_action')) {
        return;
    }

    // AS group name includes group_id for uniqueness
    $as_group = 'tbc_pf_event_' . $product_id . '_' . $event_date . '_group_' . $group_id;

    // Get all active post types from database
    $post_types = tbc_pf_ps_get_all_post_types();

    if (empty($post_types)) {
        return;
    }

    foreach ($post_types as $post_type) {
        $timestamp = tbc_pf_pm_calculate_schedule_time($post_type['schedule_timing'], $event_date, $event_end_date);

        if ($timestamp === null) {
            // Immediate - use async
            as_enqueue_async_action(
                'tbc_pf_send_dynamic_post',
                ['post_type_id' => $post_type['id'], 'group_id' => $group_id],
                $as_group
            );
        } elseif ($timestamp !== false) {
            // Scheduled (only if timestamp is valid, not false)
            as_schedule_single_action(
                $timestamp,
                'tbc_pf_send_dynamic_post',
                ['post_type_id' => $post_type['id'], 'group_id' => $group_id],
                $as_group
            );
        }
        // If $timestamp is false, timing has passed - don't schedule
    }
}

// ============================================================================
// ACTION SCHEDULER HOOK
// ============================================================================

/**
 * Action Scheduler hook: Send dynamic post using template
 */
add_action('tbc_pf_send_dynamic_post', function($post_type_id, $group_id) {
    $template = tbc_pf_ps_get_post_type($post_type_id);

    if (!$template) {
        return;
    }

    tbc_pf_create_group_post(
        $group_id,
        $template['author_user_id'],
        $template['post_title'],
        $template['content'],
        $template['media_images'],
        $template['media_videos']
    );
}, 10, 2);
