<?php
/**
 * Enqueue Scripts and Styles
 *
 * Smart asset loading that skips Fluent Community portal pages
 *
 * @package Fluent_Starter
 * @since 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Enqueue frontend scripts and styles
 */
function fluent_starter_scripts() {
    $compat_path     = FLUENT_STARTER_DIR . '/assets/css/fluent-compat.css';
    $base_path       = FLUENT_STARTER_DIR . '/assets/css/base.css';
    $components_path = FLUENT_STARTER_DIR . '/assets/css/components.css';
    $blog_path       = FLUENT_STARTER_DIR . '/assets/css/blog.css';
    $theme_js_path   = FLUENT_STARTER_DIR . '/assets/js/theme.js';

    // Fluent Community compatibility styles load everywhere (including auth pages)
    if (fluent_starter_has_fluent_community()) {
        wp_enqueue_style(
            'fluent-starter-fluent-compat',
            FLUENT_STARTER_URI . '/assets/css/fluent-compat.css',
            array(),
            file_exists($compat_path) ? (string) filemtime($compat_path) : wp_get_theme()->get('Version')
        );
    }

    // Skip loading other theme assets on Fluent Community portal pages
    // and pages using Fluent's frame template — Fluent handles styling there
    if (fluent_starter_is_portal_page() || fluent_starter_is_fluent_frame()) {
        return;
    }

    wp_enqueue_style(
        'fluent-starter-base',
        FLUENT_STARTER_URI . '/assets/css/base.css',
        array(),
        file_exists($base_path) ? (string) filemtime($base_path) : wp_get_theme()->get('Version')
    );

    wp_enqueue_style(
        'fluent-starter-components',
        FLUENT_STARTER_URI . '/assets/css/components.css',
        array('fluent-starter-base'),
        file_exists($components_path) ? (string) filemtime($components_path) : wp_get_theme()->get('Version')
    );

    if (is_home() || is_archive() || is_single() || is_search()) {
        wp_enqueue_style(
            'fluent-starter-blog',
            FLUENT_STARTER_URI . '/assets/css/blog.css',
            array('fluent-starter-base', 'fluent-starter-components'),
            file_exists($blog_path) ? (string) filemtime($blog_path) : wp_get_theme()->get('Version')
        );
    }

    wp_enqueue_script(
        'fluent-starter-theme',
        FLUENT_STARTER_URI . '/assets/js/theme.js',
        array(),
        file_exists($theme_js_path) ? (string) filemtime($theme_js_path) : wp_get_theme()->get('Version'),
        array(
            'strategy' => 'defer',
            'in_footer' => true,
        )
    );

    // Comment reply script
    if (is_singular() && comments_open() && get_option('thread_comments')) {
        wp_enqueue_script('comment-reply');
    }
}
add_action('wp_enqueue_scripts', 'fluent_starter_scripts', 5);

/**
 * Enqueue editor styles
 */
function fluent_starter_editor_styles() {
    add_editor_style(array(
        'assets/css/base.css',
        'assets/css/components.css',
    ));
}
add_action('after_setup_theme', 'fluent_starter_editor_styles');

/**
 * Enqueue the block editor sidebar script
 *
 * Adds the "Hide page title" toggle to the Page panel in Gutenberg.
 * Only loads for the `page` post type editor screen.
 */
function fluent_starter_block_editor_assets() {
    $screen = function_exists('get_current_screen') ? get_current_screen() : null;
    if (!$screen || $screen->post_type !== 'page') {
        return;
    }

    $sidebar_path = FLUENT_STARTER_DIR . '/assets/js/editor-sidebar.js';

    wp_enqueue_script(
        'fluent-starter-editor-sidebar',
        FLUENT_STARTER_URI . '/assets/js/editor-sidebar.js',
        array('wp-plugins', 'wp-editor', 'wp-edit-post', 'wp-components', 'wp-data', 'wp-element', 'wp-i18n'),
        file_exists($sidebar_path) ? (string) filemtime($sidebar_path) : wp_get_theme()->get('Version'),
        true
    );
}
add_action('enqueue_block_editor_assets', 'fluent_starter_block_editor_assets');

/**
 * Add inline dark mode detection script to head
 *
 * This runs immediately to prevent flash of wrong theme
 */
function fluent_starter_dark_mode_inline_script() {
    // Skip on portal and frame pages — Fluent handles dark mode there
    if (fluent_starter_is_portal_page() || fluent_starter_is_fluent_frame()) {
        return;
    }
    ?>
    <script>
    (function() {
        try {
            // Check Fluent Community storage first
            var fcomStorage = localStorage.getItem('fcom_global_storage');
            if (fcomStorage) {
                var data = JSON.parse(fcomStorage);
                if (data && data.fcom_color_mode === 'dark') {
                    document.documentElement.classList.add('dark');
                    document.documentElement.setAttribute('data-color-mode', 'dark');
                    return;
                }
            }
            // Fallback to system preference
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                // Only apply system preference if no explicit Fluent setting
                if (!fcomStorage) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.setAttribute('data-color-mode', 'dark');
                }
            }
        } catch(e) {}
    })();
    </script>
    <?php
}
add_action('wp_head', 'fluent_starter_dark_mode_inline_script', 1);
