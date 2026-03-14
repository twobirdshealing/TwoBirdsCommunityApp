<?php
/**
 * Blog Grid Shortcode
 *
 * Renders modern blog archive with hero + card grid
 * Use [fluent_blog] shortcode on any page
 *
 * @package Fluent_Starter
 * @since 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Register the blog grid shortcode
 */
function fluent_starter_blog_shortcode($atts) {
    $atts = shortcode_atts(array(
        'posts_per_page' => 10,
        'category' => '',
        'show_hero' => 'yes',
    ), $atts, 'fluent_blog');

    // Query args
    $args = array(
        'post_type' => 'post',
        'post_status' => 'publish',
        'posts_per_page' => intval($atts['posts_per_page']),
        'paged' => get_query_var('paged') ? get_query_var('paged') : 1,
    );

    if (!empty($atts['category'])) {
        $args['category_name'] = sanitize_text_field($atts['category']);
    }

    $query = new WP_Query($args);

    ob_start();
    ?>
    <div class="fs-blog-archive">
        <?php if ($query->have_posts()) : ?>

            <?php if ($atts['show_hero'] === 'yes') : ?>
                <?php
                // Get the first post for the hero section
                $query->the_post();
                ?>

                <!-- Hero Featured Post -->
                <a href="<?php the_permalink(); ?>" class="fs-hero-post">
                    <div class="fs-hero-image">
                        <?php if (has_post_thumbnail()) : ?>
                            <?php the_post_thumbnail('full', ['class' => 'fs-hero-img']); ?>
                        <?php else : ?>
                            <div class="fs-hero-no-image"></div>
                        <?php endif; ?>
                        <div class="fs-hero-overlay"></div>
                    </div>

                    <div class="fs-hero-content">
                        <?php the_title('<h2 class="fs-hero-title">', '</h2>'); ?>

                        <div class="fs-hero-bottom">
                            <div class="fs-hero-author">
                                <?php echo get_avatar(get_the_author_meta('ID'), 32, '', '', ['class' => 'fs-hero-avatar']); ?>
                                <div class="fs-hero-author-info">
                                    <span class="fs-hero-author-name"><?php the_author(); ?><?php echo fluent_starter_verified_mark(get_the_author_meta('ID')); ?><?php echo fluent_starter_author_badges(get_the_author_meta('ID')); ?></span>
                                    <span class="fs-hero-date"><?php echo esc_html(get_the_date()); ?></span>
                                </div>
                            </div>

                            <div class="fs-hero-meta-right">
                                <?php
                                $categories = get_the_category();
                                if (!empty($categories)) :
                                ?>
                                    <span class="fs-hero-category"><?php echo esc_html($categories[0]->name); ?></span>
                                <?php endif; ?>
                                <?php if (get_comments_number() > 0) : ?>
                                    <span class="fs-hero-comments">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                        <?php echo get_comments_number(); ?>
                                    </span>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>
                </a>
            <?php endif; ?>

            <!-- Post Grid -->
            <?php if ($query->have_posts()) : ?>
                <div class="fs-posts-grid">
                    <?php
                    while ($query->have_posts()) :
                        $query->the_post();
                        ?>
                        <a href="<?php the_permalink(); ?>" <?php post_class('fs-post-card'); ?>>
                            <div class="fs-card-image">
                                <?php if (has_post_thumbnail()) : ?>
                                    <?php the_post_thumbnail('large', ['class' => 'fs-card-img']); ?>
                                <?php else : ?>
                                    <div class="fs-card-image-placeholder">
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                            <circle cx="8.5" cy="8.5" r="1.5"/>
                                            <polyline points="21 15 16 10 5 21"/>
                                        </svg>
                                    </div>
                                <?php endif; ?>
                                <div class="fs-card-overlay"></div>
                            </div>

                            <div class="fs-card-overlay-content">
                                <?php the_title('<h3 class="fs-card-title">', '</h3>'); ?>

                                <div class="fs-card-bottom">
                                    <div class="fs-card-author">
                                        <?php echo get_avatar(get_the_author_meta('ID'), 28, '', '', ['class' => 'fs-card-avatar']); ?>
                                        <span class="fs-card-author-name"><?php the_author(); ?><?php echo fluent_starter_verified_mark(get_the_author_meta('ID')); ?><?php echo fluent_starter_author_badges(get_the_author_meta('ID')); ?></span>
                                    </div>
                                    <?php if (get_comments_number() > 0) : ?>
                                        <span class="fs-card-comments">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                            <?php echo get_comments_number(); ?>
                                        </span>
                                    <?php endif; ?>
                                </div>
                            </div>
                        </a>
                    <?php endwhile; ?>
                </div>

                <!-- Pagination -->
                <?php if ($query->max_num_pages > 1) : ?>
                    <nav class="fs-pagination">
                        <?php
                        echo paginate_links(array(
                            'total' => $query->max_num_pages,
                            'current' => max(1, get_query_var('paged')),
                            'mid_size' => 2,
                            'prev_text' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>',
                            'next_text' => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>',
                        ));
                        ?>
                    </nav>
                <?php endif; ?>
            <?php endif; ?>

        <?php else : ?>
            <div class="fs-no-posts">
                <h2><?php esc_html_e('No posts yet', 'fluent-starter'); ?></h2>
                <p><?php esc_html_e('Check back soon for new content.', 'fluent-starter'); ?></p>
            </div>
        <?php endif; ?>

        <?php wp_reset_postdata(); ?>
    </div>
    <?php

    return ob_get_clean();
}
add_shortcode('fluent_blog', 'fluent_starter_blog_shortcode');

/**
 * Register Gutenberg block for the blog grid
 */
function fluent_starter_register_blog_block() {
    if (!function_exists('register_block_type')) {
        return;
    }

    register_block_type('fluent-starter/blog-grid', array(
        'render_callback' => 'fluent_starter_blog_shortcode',
        'attributes' => array(
            'posts_per_page' => array(
                'type' => 'number',
                'default' => 10,
            ),
            'category' => array(
                'type' => 'string',
                'default' => '',
            ),
            'show_hero' => array(
                'type' => 'string',
                'default' => 'yes',
            ),
        ),
    ));
}
add_action('init', 'fluent_starter_register_blog_block');
