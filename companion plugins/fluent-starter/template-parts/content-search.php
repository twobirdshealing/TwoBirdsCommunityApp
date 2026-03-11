<?php
/**
 * Template part for displaying results in search pages
 *
 * @package Fluent_Starter
 * @since 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}
?>

<article id="post-<?php the_ID(); ?>" <?php post_class('search-result'); ?>>
    <header class="entry-header">
        <?php the_title(sprintf('<h2 class="entry-title"><a href="%s" rel="bookmark">', esc_url(get_permalink())), '</a></h2>'); ?>

        <div class="entry-meta">
            <span class="post-type"><?php echo esc_html(get_post_type_object(get_post_type())->labels->singular_name); ?></span>
            &middot;
            <?php
            printf(
                '<time datetime="%1$s">%2$s</time>',
                esc_attr(get_the_date('c')),
                esc_html(get_the_date())
            );
            ?>
        </div>
    </header>

    <div class="entry-summary">
        <?php the_excerpt(); ?>
    </div>
</article>
