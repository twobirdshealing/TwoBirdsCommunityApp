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
    // Fluent Community compatibility styles load everywhere (including auth pages)
    if (fluent_starter_has_fluent_community()) {
        wp_enqueue_style(
            'fluent-starter-fluent-compat',
            FLUENT_STARTER_URI . '/assets/css/fluent-compat.css',
            array(),
            FLUENT_STARTER_VERSION
        );
    }

    // Skip loading other theme assets on Fluent Community portal pages
    // Fluent Community handles all styling for the portal
    if (fluent_starter_is_portal_page()) {
        return;
    }

    // Base styles (reset, typography)
    wp_enqueue_style(
        'fluent-starter-base',
        FLUENT_STARTER_URI . '/assets/css/base.css',
        array(),
        FLUENT_STARTER_VERSION
    );

    // Component styles (buttons, cards, forms)
    wp_enqueue_style(
        'fluent-starter-components',
        FLUENT_STARTER_URI . '/assets/css/components.css',
        array('fluent-starter-base'),
        FLUENT_STARTER_VERSION
    );

    // Blog styles (archive and single post)
    if (is_home() || is_archive() || is_single() || is_search()) {
        wp_enqueue_style(
            'fluent-starter-blog',
            FLUENT_STARTER_URI . '/assets/css/blog.css',
            array('fluent-starter-base', 'fluent-starter-components'),
            FLUENT_STARTER_VERSION
        );
    }

    // Dark mode sync script (very small - just syncs dark mode state)
    wp_enqueue_script(
        'fluent-starter-theme',
        FLUENT_STARTER_URI . '/assets/js/theme.js',
        array(),
        FLUENT_STARTER_VERSION,
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
 * Add inline dark mode detection script to head
 *
 * This runs immediately to prevent flash of wrong theme
 */
function fluent_starter_dark_mode_inline_script() {
    // Skip on portal pages
    if (fluent_starter_is_portal_page()) {
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

/**
 * Remove jQuery from frontend if not needed
 *
 * Fluent Community uses Vue.js, so jQuery is not needed for the theme
 * Only dequeue if no other plugins need it
 */
function fluent_starter_maybe_remove_jquery() {
    // Don't remove on admin or if not on portal
    if (is_admin()) {
        return;
    }

    // Check if we're on a portal page - let Fluent handle it
    if (fluent_starter_is_portal_page()) {
        return;
    }

    // Only dequeue jQuery if theme doesn't need it
    // Comment out if you need jQuery for some reason
    // wp_dequeue_script('jquery');
    // wp_deregister_script('jquery');
}
// add_action('wp_enqueue_scripts', 'fluent_starter_maybe_remove_jquery', 20);

/**
 * Preload critical fonts (none needed - we use system fonts)
 *
 * Keeping this function as a placeholder in case custom fonts are added later
 */
function fluent_starter_preload_fonts() {
    // We use system fonts, no preloading needed
    // If you add custom fonts later, preload them here:
    // echo '<link rel="preload" href="' . FLUENT_STARTER_URI . '/assets/fonts/your-font.woff2" as="font" type="font/woff2" crossorigin>';
}
// add_action('wp_head', 'fluent_starter_preload_fonts', 1);
