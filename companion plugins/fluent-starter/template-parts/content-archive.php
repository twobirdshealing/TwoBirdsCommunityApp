<?php
/**
 * Template part for displaying posts in archive pages
 *
 * @package Fluent_Starter
 * @since 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}
?>

<article id="post-<?php the_ID(); ?>" <?php post_class('archive-post'); ?>>
    <header class="entry-header">
        <?php the_title(sprintf('<h2 class="entry-title"><a href="%s" rel="bookmark">', esc_url(get_permalink())), '</a></h2>'); ?>

        <div class="entry-meta">
            <?php
            printf(
                '<time datetime="%1$s">%2$s</time>',
                esc_attr(get_the_date('c')),
                esc_html(get_the_date())
            );

            if (get_post_type() === 'post') {
                $categories = get_the_category();
                if (!empty($categories)) {
                    echo ' &middot; ';
                    echo '<span class="cat-links">' . esc_html($categories[0]->name) . '</span>';
                }
            }
            ?>
        </div>
    </header>

    <?php if (has_post_thumbnail()) : ?>
        <div class="entry-thumbnail">
            <a href="<?php the_permalink(); ?>">
                <?php the_post_thumbnail('medium_large'); ?>
            </a>
        </div>
    <?php endif; ?>

    <div class="entry-summary">
        <?php the_excerpt(); ?>
    </div>

    <footer class="entry-footer">
        <a href="<?php the_permalink(); ?>" class="read-more">
            <?php esc_html_e('Read more', 'fluent-starter'); ?> &rarr;
        </a>
    </footer>
</article>
