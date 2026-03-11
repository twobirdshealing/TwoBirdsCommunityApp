<?php
/**
 * Icons Class
 * Handles custom icon uploads via FC FileSystem + Media model
 *
 * @package TBC_Multi_Reactions
 */

namespace TBCMultiReactions;

defined('ABSPATH') || exit;

use FluentCommunity\App\Models\Media;

class Icons {

    /**
     * Allowed MIME types for icon uploads
     */
    const ALLOWED_TYPES = [
        'image/png',
        'image/svg+xml',
        'image/gif',
        'image/webp',
        'image/jpeg',
    ];

    /**
     * Max file size in bytes (2MB)
     */
    const MAX_FILE_SIZE = 2097152;

    /**
     * Max icon dimensions
     */
    const MAX_WIDTH = 128;
    const MAX_HEIGHT = 128;

    /**
     * Upload an icon file to FC's upload directory and create a Media record
     *
     * @param array $file $_FILES entry
     * @return array|WP_Error ['media_id' => int, 'url' => string] on success
     */
    public static function upload_icon($file) {
        // Validate file
        $validation = self::validate_upload($file);
        if (is_wp_error($validation)) {
            return $validation;
        }

        if (!function_exists('wp_handle_upload')) {
            require_once(ABSPATH . 'wp-admin/includes/file.php');
        }

        // Set up FC's upload directory
        $upload_dir = wp_upload_dir();
        $folder_name = defined('FLUENT_COMMUNITY_UPLOAD_DIR')
            ? FLUENT_COMMUNITY_UPLOAD_DIR
            : 'fluent-community';
        $folder_name = apply_filters('fluent_community/upload_folder_name', $folder_name); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Calling Fluent Community's existing filter.

        $fc_dir = $upload_dir['basedir'] . '/' . $folder_name;
        $fc_url = $upload_dir['baseurl'] . '/' . $folder_name;

        // Ensure directory exists
        if (!is_dir($fc_dir)) {
            wp_mkdir_p($fc_dir);
        }

        // Rename file with FC naming convention
        $original_name = $file['name'];
        $prefix = 'fluentcom-' . md5(wp_generate_uuid4()) . '-fluentcom-';
        $new_name = $prefix . sanitize_file_name($original_name);

        // Override upload directory for this upload
        $custom_dir = function($param) use ($fc_dir, $fc_url) {
            $param['path'] = $fc_dir;
            $param['url'] = $fc_url;
            $param['subdir'] = '';
            return $param;
        };

        add_filter('upload_dir', $custom_dir);

        // Rename the file before upload
        $file['name'] = $new_name;

        $uploaded = wp_handle_upload($file, ['test_form' => false]);

        remove_filter('upload_dir', $custom_dir);

        if (isset($uploaded['error'])) {
            return new \WP_Error('upload_error', $uploaded['error']);
        }

        $file_path = $uploaded['file'];
        $file_url = $uploaded['url'];
        $file_type = $uploaded['type'];

        // Auto-resize if larger than MAX_WIDTH x MAX_HEIGHT (skip SVG)
        if ($file_type !== 'image/svg+xml') {
            $size = getimagesize($file_path);
            if ($size && ($size[0] > self::MAX_WIDTH || $size[1] > self::MAX_HEIGHT)) {
                $editor = wp_get_image_editor($file_path);
                if (!is_wp_error($editor)) {
                    $editor->resize(self::MAX_WIDTH, self::MAX_HEIGHT, false);
                    $editor->save($file_path);
                }
            }
        }

        // Convert static PNG/JPG to WebP (skip GIF, SVG, animated WebP)
        if (in_array($file_type, ['image/png', 'image/jpeg'])) {
            $webp_result = self::convert_to_webp($file_path);
            if ($webp_result) {
                // Delete original file
                wp_delete_file($file_path);
                $file_path = $webp_result['path'];
                $file_url = $fc_url . '/' . basename($webp_result['path']);
                $file_type = 'image/webp';
            }
        } elseif ($file_type === 'image/webp' && self::is_animated_webp($file_path)) {
            // Keep animated WebP as-is
        }

        // Create FC Media record
        $media = Media::create([
            'object_source' => 'tbc_mr_icon',
            'user_id'       => get_current_user_id(),
            'is_active'     => 1,
            'media_type'    => $file_type,
            'driver'        => 'local',
            'media_path'    => $file_path,
            'media_url'     => $file_url,
            'settings'      => [
                'original_name' => $original_name,
                'file_size'     => filesize($file_path),
            ],
        ]);

        if (!$media || !$media->id) {
            wp_delete_file($file_path);
            return new \WP_Error('db_error', __('Failed to create media record.', 'tbc-multi-reactions'));
        }

        return [
            'media_id' => $media->id,
            'url'      => $file_url,
        ];
    }

    /**
     * Validate an uploaded file before processing
     *
     * @param array $file $_FILES entry
     * @return true|WP_Error
     */
    public static function validate_upload($file) {
        if (empty($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            return new \WP_Error('no_file', __('No valid file uploaded.', 'tbc-multi-reactions'));
        }

        // Check MIME type
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!in_array($mime, self::ALLOWED_TYPES)) {
            return new \WP_Error('invalid_type', __('Invalid file type. Allowed: PNG, JPG, SVG, GIF, WEBP.', 'tbc-multi-reactions'));
        }

        // Check file size
        if ($file['size'] > self::MAX_FILE_SIZE) {
            return new \WP_Error('too_large', sprintf(
                /* translators: %s: Maximum allowed file size (e.g., "2 MB"). */
                __('File too large. Maximum size: %s.', 'tbc-multi-reactions'),
                size_format(self::MAX_FILE_SIZE)
            ));
        }

        return true;
    }

    /**
     * Validate a Media record ID as a valid reaction icon
     *
     * @param int $media_id FC Media record ID
     * @return bool|string True if valid, error message string if not
     */
    public static function validate_icon($media_id) {
        if (!$media_id) {
            return true; // No icon is fine (will use emoji fallback)
        }

        $media = Media::find($media_id);
        if (!$media) {
            return __('Icon not found.', 'tbc-multi-reactions');
        }

        if ($media->object_source !== 'tbc_mr_icon') {
            return __('Invalid media record.', 'tbc-multi-reactions');
        }

        return true;
    }

    /**
     * Get icon URL from FC Media record ID
     *
     * @param int $media_id
     * @return string|null
     */
    public static function get_icon_url($media_id) {
        if (!$media_id) {
            return null;
        }

        $media = Media::find($media_id);
        if (!$media) {
            return null;
        }

        return $media->public_url;
    }

    /**
     * Delete an icon's Media record (auto-deletes physical file via Media::boot)
     *
     * @param int $media_id
     * @return bool
     */
    public static function delete_icon($media_id) {
        if (!$media_id) {
            return false;
        }

        $media = Media::where('id', $media_id)
            ->where('object_source', 'tbc_mr_icon')
            ->first();

        if (!$media) {
            return false;
        }

        $media->delete();
        return true;
    }

    /**
     * Convert a static image to WebP format
     *
     * @param string $file_path
     * @return array|false ['path' => string] on success
     */
    private static function convert_to_webp($file_path) {
        $editor = wp_get_image_editor($file_path);
        if (is_wp_error($editor)) {
            return false;
        }

        $webp_path = preg_replace('/\.(png|jpe?g)$/i', '.webp', $file_path);
        if ($webp_path === $file_path) {
            $webp_path = $file_path . '.webp';
        }

        $result = $editor->save($webp_path, 'image/webp');
        if (is_wp_error($result)) {
            return false;
        }

        return ['path' => $result['path']];
    }

    /**
     * Check if a WebP file is animated
     *
     * @param string $file_path
     * @return bool
     */
    public static function is_animated_webp($file_path) {
        global $wp_filesystem;

        if (!function_exists('WP_Filesystem')) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
        }

        if (!WP_Filesystem()) {
            return false;
        }

        $data = $wp_filesystem->get_contents($file_path);
        if (!$data) {
            return false;
        }

        // Only check first 40 bytes for ANIM chunk
        $header = substr($data, 0, 40);

        // Check for ANIM chunk which indicates animated WebP
        return strpos($header, 'ANIM') !== false;
    }

    /**
     * Get icon HTML for rendering
     *
     * @param array $reaction Reaction config array with icon_url, emoji, name
     * @param int $size Size in pixels
     * @return string HTML
     */
    public static function render_icon($reaction, $size = 24) {
        $icon_url = $reaction['icon_url'] ?? null;
        $name = esc_attr($reaction['name'] ?? '');

        if ($icon_url) {
            return sprintf(
                '<img src="%s" alt="%s" class="tbc-mr-icon" width="%d" height="%d" draggable="false" />',
                esc_url($icon_url),
                $name,
                $size,
                $size
            );
        }

        // Fallback to emoji
        $emoji = $reaction['emoji'] ?? '';
        if ($emoji) {
            return sprintf('<span class="tbc-mr-emoji" aria-label="%s">%s</span>', $name, $emoji);
        }

        return '';
    }
}
