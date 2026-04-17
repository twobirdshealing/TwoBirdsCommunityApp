<?php
/**
 * Fluent Starter Theme Functions
 *
 * @package Fluent_Starter
 * @since 1.0.0
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

/**
 * Theme Constants
 *
 * No version constant — style.css is the single source of truth. Enqueue cache
 * busters come from filemtime() on shipped assets; the defensive fallback reads
 * the header via wp_get_theme()->get('Version').
 */
define('FLUENT_STARTER_DIR', get_template_directory());
define('FLUENT_STARTER_URI', get_template_directory_uri());

/**
 * Check if we're on a Fluent Community portal page
 *
 * @return bool
 */
function fluent_starter_is_portal_page() {
    // Check query var set by Fluent Community
    if (get_query_var('fcom_route')) {
        return true;
    }

    // Check if Fluent Community helper exists and verify path
    if (function_exists('fluentCommunityApp') && class_exists('\FluentCommunity\App\Services\Helper')) {
        $slug = \FluentCommunity\App\Services\Helper::getPortalSlug();
        if ($slug) {
            $currentPath = trim(parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/');
            if (strpos($currentPath, $slug) === 0) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Check if Fluent Community plugin is active
 *
 * @return bool
 */
function fluent_starter_has_fluent_community() {
    return defined('FLUENT_COMMUNITY_PLUGIN_VERSION') || function_exists('fluentCommunityApp');
}

/**
 * Calculate reading time for a post
 *
 * @param int|null $post_id Post ID (optional, uses current post if not provided)
 * @return string Formatted reading time
 */
function fluent_starter_reading_time($post_id = null) {
    $content = get_post_field('post_content', $post_id);
    $word_count = str_word_count(strip_tags($content));
    $reading_time = ceil($word_count / 200); // Average reading speed

    if ($reading_time < 1) {
        $reading_time = 1;
    }

    return sprintf(
        /* translators: %d: number of minutes */
        _n('%d min read', '%d min read', $reading_time, 'fluent-starter'),
        $reading_time
    );
}

/**
 * Check if current page uses Fluent Community frame template
 *
 * @return bool
 */
function fluent_starter_is_fluent_frame() {
    if (is_page()) {
        $template = get_page_template_slug();
        return in_array($template, ['fluent-community-frame.php', 'fluent-community-frame-full.php']);
    }
    return false;
}

/**
 * Load theme includes
 */
require_once FLUENT_STARTER_DIR . '/inc/theme-setup.php';
require_once FLUENT_STARTER_DIR . '/inc/enqueue.php';
require_once FLUENT_STARTER_DIR . '/inc/customizer.php';
require_once FLUENT_STARTER_DIR . '/inc/maintenance-mode.php';
require_once FLUENT_STARTER_DIR . '/inc/fluent-integration.php';
require_once FLUENT_STARTER_DIR . '/inc/blog-shortcode.php';
require_once FLUENT_STARTER_DIR . '/inc/docs-viewer.php';

