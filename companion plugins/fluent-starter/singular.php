<?php
/**
 * The template for displaying single posts and pages
 *
 * Blank canvas approach - no header/footer, just content
 *
 * @package Fluent_Starter
 * @since 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1">
    <?php wp_head(); ?>
</head>
<body <?php body_class('fluent-starter fluent-starter-singular'); ?>>
<?php wp_body_open(); ?>

<div id="page" class="site">
    <main id="main" class="fluent-starter-content" role="main">
        <?php
        while (have_posts()) :
            the_post();
            ?>
            <article id="post-<?php the_ID(); ?>" <?php post_class('fluent-starter-article'); ?>>
                <?php if (is_single() && !is_page()) : ?>
                    <header class="entry-header">
                        <?php the_title('<h1 class="entry-title">', '</h1>'); ?>
                        <div class="entry-meta">
                            <?php
                            printf(
                                '<time datetime="%1$s">%2$s</time>',
                                esc_attr(get_the_date('c')),
                                esc_html(get_the_date())
                            );
                            ?>
                        </div>
                    </header>
                <?php endif; ?>

                <div class="entry-content">
                    <?php
                    the_content();

                    wp_link_pages(array(
                        'before' => '<div class="page-links">' . esc_html__('Pages:', 'fluent-starter'),
                        'after'  => '</div>',
                    ));
                    ?>
                </div>

                <?php if (is_single()) : ?>
                    <footer class="entry-footer">
                        <?php
                        // Post navigation
                        the_post_navigation(array(
                            'prev_text' => '&larr; %title',
                            'next_text' => '%title &rarr;',
                        ));

                        // Comments
                        if (comments_open() || get_comments_number()) :
                            comments_template();
                        endif;
                        ?>
                    </footer>
                <?php endif; ?>
            </article>
            <?php
        endwhile;
        ?>
    </main>
</div>

<?php wp_footer(); ?>
</body>
</html>
