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

// ==========================================================================
// Skip all Fluent Community hooks if the plugin is not active.
// This prevents unnecessary filter registrations and potential issues
// on sites without Fluent Community installed.
// ==========================================================================
if (!fluent_starter_has_fluent_community()) {
    return;
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
 * Disable FluentCart's auto the_content product page injection
 *
 * Since we render FluentCart products ourselves inside the portal frame via
 * fluent_starter_render_theme_content(), FluentCart's internal the_content
 * filter would otherwise double-inject the product header/related products.
 */
add_filter('fluent_cart/disable_auto_single_product_page', '__return_true');

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
 *
 * Includes a recursion guard: if FC's User model internally triggers
 * get_avatar_url (e.g. through relationship loading), we bail out to
 * prevent infinite recursion and memory exhaustion.
 */
add_filter('get_avatar_url', 'fluent_starter_fcom_avatar_url', 10, 3);

function fluent_starter_fcom_avatar_url($url, $id_or_email, $args) {
    if (!class_exists('FluentCommunity\App\Models\User')) {
        return $url;
    }

    // Recursion guard — prevent infinite loop if FC model triggers get_avatar_url
    static $resolving = false;
    if ($resolving) {
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
        $resolving = true;
        try {
            $fc_user = \FluentCommunity\App\Models\User::find($user_id);
            $cache[$user_id] = ($fc_user && $fc_user->xprofile) ? $fc_user->xprofile->avatar : null;
        } catch (\Exception $e) {
            $cache[$user_id] = null;
        }
        $resolving = false;
    }

    return $cache[$user_id] ?: $url;
}

/**
 * Shared profile cache for badges + verified status
 * Stores ['badge_slugs' => [], 'is_verified' => 0] per user
 */
function fluent_starter_get_profile_data($user_id) {
    static $cache = [];
    static $resolving = false;
    $default = ['badge_slugs' => [], 'is_verified' => 0];

    if (!$user_id || !class_exists('FluentCommunity\App\Models\User') || $resolving) {
        return $default;
    }
    if (!isset($cache[$user_id])) {
        $resolving = true;
        try {
            $fc_user = \FluentCommunity\App\Models\User::find($user_id);
            $xprofile = ($fc_user && $fc_user->xprofile) ? $fc_user->xprofile : null;
            $meta = $xprofile ? ($xprofile->meta ?? []) : [];
            $cache[$user_id] = [
                'badge_slugs' => (array) (is_array($meta) ? ($meta['badge_slug'] ?? []) : []),
                'is_verified' => (int) ($xprofile->is_verified ?? 0),
            ];
        } catch (\Exception $e) {
            $cache[$user_id] = $default;
        }
        $resolving = false;
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
        . '<svg viewBox="0 0 22 22" aria-label="' . esc_attr__('Verified account', 'fluent-starter') . '" role="img"><g><path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"/></g></svg>'
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
 * Universal template routing for Fluent Community frame
 *
 * Wraps ALL frontend WordPress templates in the Fluent Community portal frame:
 * singular posts/pages, all CPTs (including FluentCart products), archives,
 * taxonomies, search, 404. The frame provides the portal sidebar/nav, and
 * fluent_starter_render_theme_content() handles the inner rendering per type.
 */
add_filter('fluent_community/template_slug', function ($templateSlug) {
    // Bail if portal frame integration is disabled in the Customizer
    if (!fluent_starter_frame_integration_enabled()) {
        return $templateSlug;
    }

    // Skip admin, feeds, embeds, REST, cron, AJAX — never wrap these
    if (is_admin() || is_feed() || is_embed() || wp_doing_ajax() || wp_doing_cron()) {
        return $templateSlug;
    }

    // Skip if a specific page has explicitly picked a non-frame template
    if (is_page() && $templateSlug && !in_array($templateSlug, ['fluent-community-frame.php', 'fluent-community-frame-full.php'], true)) {
        return $templateSlug;
    }

    // Wrap everything frontend in the portal
    return fluent_starter_get_blog_template();
});

/**
 * Render theme content when using FluentCommunity Frame template
 *
 * Handles blog and regular page content. Plugins like tbc-cart hook
 * directly into FC's theme_content action at an earlier priority to
 * handle their own page types (e.g., WooCommerce).
 *
 * @param string $themeName The active theme name
 * @param string $wrapperType The wrapper type ('default' or 'full')
 */
function fluent_starter_render_theme_content($themeName, $wrapperType = 'default') {
    if (is_singular('fluent-products')) {
        $post_id = get_the_ID();
        echo '<div class="fct-single-product-wrap fluent-starter-frame-content">';
        do_action('fluent_cart/product/render_product_header', $post_id);
        echo '<div class="fct-product-description">';
        the_content();
        echo '</div>';
        do_action('fluent_cart/product/after_product_content', $post_id);
        echo '</div>';
        return;
    }

    if (is_tax(['product-categories', 'product-brands']) || is_post_type_archive('fluent-products')) {
        echo do_shortcode('[fluent_cart_products]');
        return;
    }

    if (is_home() || is_category() || is_tag() || is_author()) {
        echo do_shortcode('[fluent_blog posts_per_page="12"]');
        return;
    }

    if (is_singular('post')) {
        fluent_starter_render_single_post();
        return;
    }

    if (is_search()) {
        ?>
        <div class="wp_content_wrapper fluent-starter-frame-content">
            <h1 class="entry-title"><?php printf(esc_html__('Search Results for: %s', 'fluent-starter'), '<span>' . get_search_query() . '</span>'); ?></h1>
            <?php if (have_posts()) : ?>
                <div class="fs-search-results">
                    <?php while (have_posts()) : the_post(); ?>
                        <?php get_template_part('template-parts/content', 'search'); ?>
                    <?php endwhile; ?>
                </div>
            <?php else : ?>
                <?php get_template_part('template-parts/content', 'none'); ?>
            <?php endif; ?>
        </div>
        <?php
        return;
    }

    if (is_404()) {
        ?>
        <div class="wp_content_wrapper fluent-starter-frame-content">
            <div class="error-404">
                <h1 class="error-title"><?php esc_html_e('404', 'fluent-starter'); ?></h1>
                <h2 class="error-subtitle"><?php esc_html_e('Page Not Found', 'fluent-starter'); ?></h2>
                <p class="error-message">
                    <?php esc_html_e('The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.', 'fluent-starter'); ?>
                </p>
                <a href="<?php echo esc_url(home_url('/')); ?>" class="button button-primary">
                    <?php esc_html_e('Go to Homepage', 'fluent-starter'); ?>
                </a>
            </div>
        </div>
        <?php
        return;
    }

    if (is_archive()) {
        ?>
        <div class="wp_content_wrapper fluent-starter-frame-content">
            <?php the_archive_title('<h1 class="entry-title">', '</h1>'); ?>
            <?php if (have_posts()) : while (have_posts()) : the_post(); ?>
                <?php get_template_part('template-parts/content', 'archive'); ?>
            <?php endwhile; else : ?>
                <?php get_template_part('template-parts/content', 'none'); ?>
            <?php endif; ?>
        </div>
        <?php
        return;
    }

    if (have_posts()) {
        while (have_posts()) {
            the_post();
            ?>
            <div class="wp_content_wrapper fluent-starter-frame-content">
                <?php if ($wrapperType === 'default' && !get_post_meta(get_the_ID(), '_tbc_hide_title', true)) : ?>
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
        $author_id = get_the_author_meta('ID');
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
                                <?php echo get_avatar($author_id, 40, '', '', ['class' => 'fs-single-avatar']); ?>
                                <div class="fs-single-author-info">
                                    <span class="fs-single-author-name"><?php the_author(); ?><?php echo fluent_starter_verified_mark($author_id); ?><?php echo fluent_starter_author_badges($author_id); ?></span>
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
                            <?php echo get_avatar($author_id, 40, '', '', ['class' => 'fs-single-avatar']); ?>
                            <div class="fs-single-author-info">
                                <span class="fs-single-author-name"><?php the_author(); ?><?php echo fluent_starter_verified_mark($author_id); ?><?php echo fluent_starter_author_badges($author_id); ?></span>
                                <span class="fs-single-date-read">
                                    <?php echo esc_html(get_the_date()); ?>
                                    <span class="fs-separator">&middot;</span>
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
 * Hook into Fluent Community's global asset enqueuing
 *
 * This is called on non-portal pages that use Fluent Community components
 * (e.g., pages using FluentCommunity Frame template)
 */
add_action('fluent_community/enqueue_global_assets', function($useDefaultTheme) {
    wp_enqueue_style(
        'fluent-starter-base',
        FLUENT_STARTER_URI . '/assets/css/base.css',
        array(),
        fluent_starter_asset_ver('assets/css/base.css')
    );

    wp_enqueue_style(
        'fluent-starter-components',
        FLUENT_STARTER_URI . '/assets/css/components.css',
        array('fluent-starter-base'),
        fluent_starter_asset_ver('assets/css/components.css')
    );

    wp_enqueue_style(
        'fluent-starter-fluent-compat',
        FLUENT_STARTER_URI . '/assets/css/fluent-compat.css',
        array('fluent-starter-base'),
        fluent_starter_asset_ver('assets/css/fluent-compat.css')
    );

    // Frame content styles — only load when portal frame integration is on
    if (fluent_starter_frame_integration_enabled() && (is_home() || is_archive() || is_singular() || is_search() || is_404())) {
        wp_enqueue_style(
            'fluent-starter-blog',
            FLUENT_STARTER_URI . '/assets/css/blog.css',
            array('fluent-starter-base', 'fluent-starter-components'),
            fluent_starter_asset_ver('assets/css/blog.css')
        );
    }

}, 10, 1);
