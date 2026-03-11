<?php
/**
 * Template part for displaying posts
 *
 * @package Fluent_Starter
 * @since 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}
?>

<article id="post-<?php the_ID(); ?>" <?php post_class('fluent-starter-article'); ?>>
    <?php if (!is_singular()) : ?>
        <header class="entry-header">
            <?php the_title(sprintf('<h2 class="entry-title"><a href="%s" rel="bookmark">', esc_url(get_permalink())), '</a></h2>'); ?>

            <?php if (get_post_type() === 'post') : ?>
                <div class="entry-meta">
                    <?php
                    printf(
                        '<time datetime="%1$s">%2$s</time>',
                        esc_attr(get_the_date('c')),
                        esc_html(get_the_date())
                    );
                    ?>
                </div>
            <?php endif; ?>
        </header>

        <div class="entry-summary">
            <?php the_excerpt(); ?>
        </div>
    <?php else : ?>
        <div class="entry-content">
            <?php
            the_content();

            wp_link_pages(array(
                'before' => '<div class="page-links">' . esc_html__('Pages:', 'fluent-starter'),
                'after'  => '</div>',
            ));
            ?>
        </div>
    <?php endif; ?>
</article>
