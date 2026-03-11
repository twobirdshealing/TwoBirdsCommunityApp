<?php
/**
 * Fluent Community Integration
 *
 * All hooks and filters for Fluent Community plugin compatibility
 *
 * @package Fluent_Starter
 * @since 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Register theme as a supported Fluent Community theme
 *
 * This enables optimized content rendering when using FluentCommunity Frame templates
 */
add_filter('fluent_community/is_supported_theme', function($supported, $themeName) {
    if ($themeName === 'fluent-starter') {
        return true;
    }
    return $supported;
}, 10, 2);

/**
 * Force Fluent Community frame template on blog pages
 *
 * Uses customizer settings to determine which template to use
 */
add_filter('fluent_community/template_slug', function($templateSlug) {
    // Blog integration
    if (fluent_starter_blog_integration_enabled()) {
        if (is_singular('post') || is_home() || is_category() || is_tag() || is_author()) {
            return fluent_starter_get_blog_template();
        }
    }

    // WooCommerce integration - shop, product, cart, checkout, and account pages
    if (fluent_starter_wc_integration_enabled() && function_exists('is_woocommerce')) {
        if (is_woocommerce() || is_cart() || is_checkout() || is_account_page()) {
            return fluent_starter_get_wc_template();
        }
    }

    return $templateSlug;
});

/**
 * Dark mode cookie synchronization
 *
 * Ensures dark mode state is shared between Fluent Community portal and theme pages
 */
add_filter('fluent_community/general_portal_vars', function($vars) {
    // Use a consistent cookie/storage name for dark mode state
    $vars['color_switch_cookie_name'] = 'fluent_starter_color_mode';
    return $vars;
});

/**
 * ==========================================================================
 * Fluent Community Avatar & Badge Integration
 * ==========================================================================
 */

/**
 * Replace Gravatar URLs with Fluent Community avatars globally
 *
 * Hooks into WordPress's get_avatar_url filter so every get_avatar() call
 * throughout the theme automatically uses the FC xprofile avatar.
 */
add_filter('get_avatar_url', 'fluent_starter_fcom_avatar_url', 10, 3);

function fluent_starter_fcom_avatar_url($url, $id_or_email, $args) {
    if (!class_exists('FluentCommunity\App\Models\User')) {
        return $url;
    }

    // Resolve user ID from the various types WordPress passes
    $user_id = 0;
    if (is_numeric($id_or_email)) {
        $user_id = (int) $id_or_email;
    } elseif ($id_or_email instanceof \WP_Comment) {
        $user_id = (int) $id_or_email->user_id;
    } elseif ($id_or_email instanceof \WP_User) {
        $user_id = $id_or_email->ID;
    } elseif (is_string($id_or_email)) {
        $user = get_user_by('email', $id_or_email);
        if ($user) {
            $user_id = $user->ID;
        }
    }

    if ($user_id <= 0) {
        return $url;
    }

    // Use FC's native xprofile avatar accessor (handles all fallback logic)
    static $cache = [];
    if (!isset($cache[$user_id])) {
        try {
            $fc_user = \FluentCommunity\App\Models\User::find($user_id);
            $cache[$user_id] = ($fc_user && $fc_user->xprofile) ? $fc_user->xprofile->avatar : null;
        } catch (\Exception $e) {
            $cache[$user_id] = null;
        }
    }

    return $cache[$user_id] ?: $url;
}

/**
 * Shared profile cache for badges + verified status
 * Stores ['badge_slugs' => [], 'is_verified' => 0] per user
 */
function fluent_starter_get_profile_data($user_id) {
    static $cache = [];
    if (!$user_id || !class_exists('FluentCommunity\App\Models\User')) {
        return ['badge_slugs' => [], 'is_verified' => 0];
    }
    if (!isset($cache[$user_id])) {
        try {
            $fc_user = \FluentCommunity\App\Models\User::find($user_id);
            $xprofile = ($fc_user && $fc_user->xprofile) ? $fc_user->xprofile : null;
            $meta = $xprofile ? ($xprofile->meta ?? []) : [];
            $cache[$user_id] = [
                'badge_slugs' => (array) (is_array($meta) ? ($meta['badge_slug'] ?? []) : []),
                'is_verified' => (int) ($xprofile->is_verified ?? 0),
            ];
        } catch (\Exception $e) {
            $cache[$user_id] = ['badge_slugs' => [], 'is_verified' => 0];
        }
    }
    return $cache[$user_id];
}

/**
 * Render verified checkmark SVG for a user
 *
 * @param int $user_id WordPress user ID
 * @return string SVG HTML or empty string
 */
function fluent_starter_verified_mark($user_id) {
    $data = fluent_starter_get_profile_data($user_id);
    if (!$data['is_verified']) {
        return '';
    }
    return '<span class="fs-verified" title="' . esc_attr__('Verified', 'fluent-starter') . '">'
        . '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82 1.89 3.2L12 21.04l3.4 1.46 1.89-3.2 3.61-.82-.34-3.69L23 12zm-12.91 4.72l-3.8-3.8 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48-7.33 7.34z"/></svg>'
        . '</span>';
}

/**
 * Render Fluent Community profile badge pills for a user
 *
 * Badge structure from FC: title, slug, config.emoji, config.logo, color,
 * background_color, show_label ('yes'|'no')
 *
 * @param int $user_id WordPress user ID
 * @return string Badge HTML or empty string
 */
function fluent_starter_author_badges($user_id) {
    if (!class_exists('FluentCommunity\App\Functions\Utility')) {
        return '';
    }

    $data = fluent_starter_get_profile_data($user_id);
    $badge_slugs = $data['badge_slugs'];
    if (empty($badge_slugs)) {
        return '';
    }

    static $definitions = null;
    if ($definitions === null) {
        $definitions = \FluentCommunity\App\Functions\Utility::getOption('user_badges', []);
    }
    if (empty($definitions)) {
        return '';
    }

    $html = '';
    foreach ((array) $badge_slugs as $slug) {
        if (!isset($definitions[$slug])) continue;
        $badge = $definitions[$slug];

        $title    = esc_html($badge['title'] ?? $slug);
        $config   = $badge['config'] ?? [];
        $emoji    = $config['emoji'] ?? '';
        $logo     = $config['logo'] ?? '';
        $color    = esc_attr($badge['color'] ?? '');
        $bg_color = esc_attr($badge['background_color'] ?? '');
        $show_label = ($badge['show_label'] ?? 'yes') !== 'no';

        // Icon-only mode — no pill bg, no label, larger icon
        if (!$show_label) {
            $html .= '<span class="fs-badge fs-badge--icon-only">';
            if ($logo) {
                $html .= '<img class="fs-badge-logo" src="' . esc_url($logo) . '" alt="' . $title . '" />';
            }
            if ($emoji) {
                $html .= '<span class="fs-badge-emoji">' . esc_html($emoji) . '</span>';
            }
            $html .= '</span>';
            continue;
        }

        // Pill mode — colored bg + icon + label
        $style = '';
        if ($bg_color) {
            $style .= 'background-color:' . $bg_color . ';';
        }
        if ($color) {
            $style .= 'color:' . $color . ';';
        }

        $html .= '<span class="fs-badge"' . ($style ? ' style="' . $style . '"' : '') . '>';
        if ($logo) {
            $html .= '<img class="fs-badge-logo" src="' . esc_url($logo) . '" alt="' . $title . '" />';
        }
        if ($emoji) {
            $html .= '<span class="fs-badge-emoji">' . esc_html($emoji) . '</span>';
        }
        $html .= '<span class="fs-badge-label"' . ($color ? ' style="color:' . $color . '"' : '') . '>' . $title . '</span>';
        $html .= '</span>';
    }

    return $html;
}

/**
 * Remove TemplateLoader's default content handler and add our own
 *
 * TemplateLoader->renderWpContent() falls through to renderFallback() for unknown themes,
 * which outputs plain the_content() causing double output. We remove all handlers at
 * priority 10 and re-add only our theme's handler.
 */
add_action('wp_loaded', function() {
    // Only do this if Fluent Community is active
    if (function_exists('fluentCommunityApp')) {
        // Remove all handlers at priority 10 (including TemplateLoader's renderWpContent)
        remove_all_actions('fluent_community/theme_content', 10);

        // Re-add our theme's handler
        add_action('fluent_community/theme_content', 'fluent_starter_render_theme_content', 10, 2);
    }
}, 20);

/**
 * Render theme content when using FluentCommunity Frame template
 *
 * This is called when a page uses the "FluentCommunity Frame" template
 * Handles blog archives, single posts, and regular pages
 *
 * @param string $themeName The active theme name
 * @param string $wrapperType The wrapper type ('default' or 'full')
 */
function fluent_starter_render_theme_content($themeName, $wrapperType = 'default') {
    // Blog archive (home, category, tag, author)
    if (is_home() || is_category() || is_tag() || is_author()) {
        echo do_shortcode('[fluent_blog posts_per_page="12"]');
        return;
    }

    // Single blog post
    if (is_singular('post')) {
        fluent_starter_render_single_post();
        return;
    }

    // Regular page content
    if (have_posts()) {
        while (have_posts()) {
            the_post();
            ?>
            <div class="wp_content_wrapper fluent-starter-frame-content">
                <?php if ($wrapperType === 'default') : ?>
                    <div class="fcom_wp_content_title">
                        <?php the_title('<h1 class="entry-title">', '</h1>'); ?>
                    </div>
                <?php endif; ?>
                <div class="fcom_wp_content_body">
                    <?php the_content(); ?>
                </div>
            </div>
            <?php
        }
    }
}

/**
 * Render single blog post with hero image and modern layout
 */
function fluent_starter_render_single_post() {
    if (!have_posts()) {
        return;
    }

    while (have_posts()) {
        the_post();
        $categories = get_the_category();
        ?>
        <article <?php post_class('fs-single-post'); ?>>
            <?php if (has_post_thumbnail()) : ?>
                <!-- Hero with overlay content -->
                <div class="fs-single-hero">
                    <div class="fs-single-hero-image">
                        <?php the_post_thumbnail('full', ['class' => 'fs-single-hero-img']); ?>
                        <div class="fs-single-hero-overlay"></div>
                    </div>
                    <div class="fs-single-hero-content">
                        <?php if (!empty($categories)) : ?>
                            <div class="fs-single-meta-top">
                                <a href="<?php echo esc_url(get_category_link($categories[0]->term_id)); ?>" class="fs-single-category">
                                    <?php echo esc_html($categories[0]->name); ?>
                                </a>
                            </div>
                        <?php endif; ?>
                        <?php the_title('<h1 class="fs-single-title">', '</h1>'); ?>
                        <div class="fs-single-meta">
                            <div class="fs-single-author">
                                <?php echo get_avatar(get_the_author_meta('ID'), 40, '', '', ['class' => 'fs-single-avatar']); ?>
                                <div class="fs-single-author-info">
                                    <span class="fs-single-author-name"><?php the_author(); ?><?php echo fluent_starter_verified_mark(get_the_author_meta('ID')); ?><?php echo fluent_starter_author_badges(get_the_author_meta('ID')); ?></span>
                                    <span class="fs-single-date-read">
                                        <?php echo esc_html(get_the_date()); ?>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            <?php else : ?>
                <!-- Simple header without featured image -->
                <header class="fs-single-header-simple">
                    <div class="fs-single-meta-simple">
                        <div class="fs-single-author">
                            <?php echo get_avatar(get_the_author_meta('ID'), 40, '', '', ['class' => 'fs-single-avatar']); ?>
                            <div class="fs-single-author-info">
                                <span class="fs-single-author-name"><?php the_author(); ?><?php echo fluent_starter_verified_mark(get_the_author_meta('ID')); ?><?php echo fluent_starter_author_badges(get_the_author_meta('ID')); ?></span>
                                <span class="fs-single-date-read">
                                    <?php echo esc_html(get_the_date()); ?>
                                    <span class="fs-separator">·</span>
                                    <?php echo fluent_starter_reading_time(); ?>
                                </span>
                            </div>
                        </div>
                    </div>
                    <?php if (!empty($categories)) : ?>
                        <a href="<?php echo esc_url(get_category_link($categories[0]->term_id)); ?>" class="fs-single-category-simple">
                            <?php echo esc_html($categories[0]->name); ?>
                        </a>
                    <?php endif; ?>
                    <?php the_title('<h1 class="fs-single-title-simple">', '</h1>'); ?>
                </header>
            <?php endif; ?>

            <!-- Post Content -->
            <div class="fs-single-content">
                <div class="fs-single-body">
                    <?php the_content(); ?>
                </div>

                <!-- Post Footer -->
                <footer class="fs-single-footer">
                    <?php
                    $tags = get_the_tags();
                    if (!empty($tags)) :
                    ?>
                        <div class="fs-single-tags">
                            <?php foreach ($tags as $tag) : ?>
                                <a href="<?php echo esc_url(get_tag_link($tag->term_id)); ?>" class="fs-single-tag">
                                    #<?php echo esc_html($tag->name); ?>
                                </a>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                </footer>

                <!-- Comments Section -->
                <?php if (fluent_starter_show_comments() && (comments_open() || get_comments_number())) : ?>
                    <div class="fs-comments-section feed_comments">
                        <?php comments_template(); ?>
                    </div>
                <?php endif; ?>
            </div>
        </article>
        <?php
    }
}

/**
 * Add theme-specific body attributes for Fluent Community templates
 */
add_action('fluent_community/theme_body_atts', function($themeName) {
    if ($themeName === 'fluent-starter') {
        echo 'data-fluent-starter-theme="true"';
    }
});

/**
 * Inject dark mode script early to prevent flash of wrong theme
 *
 * This runs before the page renders to set dark mode class
 */
add_action('fluent_community/portal_head', function() {
    ?>
    <script>
    (function() {
        try {
            var storage = localStorage.getItem('fcom_global_storage');
            if (storage) {
                var data = JSON.parse(storage);
                if (data && data.fcom_color_mode === 'dark') {
                    document.documentElement.classList.add('dark');
                    document.documentElement.setAttribute('data-color-mode', 'dark');
                }
            }
        } catch(e) {}
    })();
    </script>
    <?php
});

/**
 * Add theme-specific styles to portal pages if needed
 *
 * Generally we want to avoid adding styles to the portal,
 * but this hook is available if absolutely necessary
 */
add_action('fluent_community/portal_footer', function() {
    // Portal gets its own styling from Fluent Community
    // Only add styles here if absolutely necessary for compatibility
});

/**
 * Filter for controlling headless mode
 *
 * Return false for classic mode (wp_head/wp_footer called)
 * Return true for headless mode (Fluent handles everything)
 *
 * We prefer classic mode for better theme integration
 */
add_filter('fluent_community/portal_page_headless', function($isHeadless) {
    // Keep classic mode for theme integration
    return $isHeadless;
});

/**
 * Hook into Fluent Community's global asset enqueuing
 *
 * This is called on non-portal pages that use Fluent Community components
 * (e.g., pages using FluentCommunity Frame template)
 */
add_action('fluent_community/enqueue_global_assets', function($useDefaultTheme) {
    // Load base theme styles
    wp_enqueue_style(
        'fluent-starter-base',
        FLUENT_STARTER_URI . '/assets/css/base.css',
        array(),
        FLUENT_STARTER_VERSION
    );

    // Load components
    wp_enqueue_style(
        'fluent-starter-components',
        FLUENT_STARTER_URI . '/assets/css/components.css',
        array('fluent-starter-base'),
        FLUENT_STARTER_VERSION
    );

    // Load blog styles for blog archive and single posts
    wp_enqueue_style(
        'fluent-starter-blog',
        FLUENT_STARTER_URI . '/assets/css/blog.css',
        array('fluent-starter-base', 'fluent-starter-components'),
        FLUENT_STARTER_VERSION
    );

    // Fluent compatibility CSS variable bridge
    wp_enqueue_style(
        'fluent-starter-fluent-compat',
        FLUENT_STARTER_URI . '/assets/css/fluent-compat.css',
        array('fluent-starter-base'),
        FLUENT_STARTER_VERSION
    );

    // Load WooCommerce styles if WooCommerce integration is enabled
    if (fluent_starter_wc_integration_enabled() && function_exists('is_woocommerce')) {
        if (is_woocommerce() || is_cart() || is_checkout() || is_account_page()) {
            wp_enqueue_style(
                'fluent-starter-woocommerce',
                FLUENT_STARTER_URI . '/assets/css/woocommerce.css',
                array('fluent-starter-base'),
                FLUENT_STARTER_VERSION
            );
        }
    }
}, 10, 1);

/**
 * Add custom links to header right menu (optional)
 */
// add_action('fluent_community/before_header_right_menu_items', function($auth) {
//     // Add custom menu items if needed
// });

/**
 * Add custom links before header menu items (optional)
 */
// add_action('fluent_community/before_header_menu_items', function($auth, $context) {
//     // Add custom menu items if needed
// }, 10, 2);
