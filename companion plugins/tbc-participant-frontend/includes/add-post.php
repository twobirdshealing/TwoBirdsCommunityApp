<?php
/**
 * Event Group Posts Management
 * 
 * Handles scheduled and immediate posts for event chat groups.
 * Uses dynamic templates from database.
 * 
 * @package TBC_Participant_Frontend
 * @since 3.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

// ============================================================================
// GROUP POST CREATION
// ============================================================================

/**
 * Create a BuddyBoss group post with optional media
 * 
 * @param int $group_id BuddyBoss group ID
 * @param int $user_id Author user ID
 * @param string $title Post title
 * @param string $content Post content
 * @param array $media_images Array of image data [{id, url}]
 * @param array $media_videos Array of video data [{id, url}]
 * @return int|false Activity ID on success, false on failure
 */
function tbc_pf_create_group_post($group_id, $user_id, $title, $content, $media_images = [], $media_videos = []) {
    if (!function_exists('groups_post_update')) {
        return false;
    }
    
    $activity_id = groups_post_update([
        'post_title' => $title,
        'content'    => $content,
        'group_id'   => $group_id,
        'user_id'    => $user_id
    ]);
    
    if (!$activity_id) {
        return false;
    }
    
    // Attach images
    if (!empty($media_images) && is_array($media_images)) {
        foreach ($media_images as $index => $image) {
            if (empty($image['id'])) {
                continue;
            }
            
            $attachment_id = intval($image['id']);
            if (!wp_attachment_is_image($attachment_id)) {
                continue;
            }
            
            $media_id = bp_media_add([
                'attachment_id' => $attachment_id,
                'title'         => 'Image',
                'group_id'      => $group_id,
                'privacy'       => 'grouponly',
                'user_id'       => $user_id,
                'menu_order'    => $index + 1
            ]);
            
            if (!$media_id) {
                continue;
            }
            
            $media = new BP_Media($media_id);
            $media->activity_id = $activity_id;
            $media->save();
            
            bp_activity_update_meta($activity_id, 'bp_media_activity', '1');
            bp_activity_update_meta($activity_id, 'bp_media_id', $media_id);
            update_post_meta($attachment_id, 'bp_media_activity_id', $activity_id);
        }
    }
    
    // Attach videos
    if (!empty($media_videos) && is_array($media_videos)) {
        foreach ($media_videos as $index => $video) {
            if (empty($video['id'])) {
                continue;
            }
            
            $attachment_id = intval($video['id']);
            if (!wp_attachment_is('video', $attachment_id)) {
                continue;
            }
            
            $video_id_bp = bp_video_add([
                'attachment_id' => $attachment_id,
                'title'         => 'Video',
                'group_id'      => $group_id,
                'privacy'       => 'grouponly',
                'user_id'       => $user_id,
                'menu_order'    => count($media_images) + $index + 1
            ]);
            
            if (!$video_id_bp) {
                continue;
            }
            
            $video_obj = new BP_Video($video_id_bp);
            $video_obj->activity_id = $activity_id;
            $video_obj->save();
            
            bp_activity_update_meta($activity_id, 'bp_video_activity', '1');
            bp_activity_update_meta($activity_id, 'bp_video_id', $video_id_bp);
            update_post_meta($attachment_id, 'bp_video_activity_id', $activity_id);
        }
    }
    
    return $activity_id;
}

// ============================================================================
// POST SCHEDULING
// ============================================================================

/**
 * Schedule all event posts for a group using database templates
 * 
 * @param int $group_id BuddyBoss group ID
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