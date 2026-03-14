<?php
/**
 * The template for displaying archive pages
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
<body <?php body_class('fluent-starter fluent-starter-archive'); ?>>
<?php wp_body_open(); ?>

<div id="page" class="site">
    <main id="main" class="fluent-starter-content" role="main">
        <?php if (have_posts()) : ?>
            <header class="archive-header">
                <?php
                the_archive_title('<h1 class="archive-title">', '</h1>');
                the_archive_description('<div class="archive-description">', '</div>');
                ?>
            </header>

            <div class="archive-posts">
                <?php
                while (have_posts()) :
                    the_post();
                    get_template_part('template-parts/content', 'archive');
                endwhile;
                ?>
            </div>

            <?php
            the_posts_pagination(array(
                'mid_size' => 2,
                'prev_text' => '&larr;',
                'next_text' => '&rarr;',
            ));
        else :
            get_template_part('template-parts/content', 'none');
        endif;
        ?>
    </main>
</div>

<?php wp_footer(); ?>
</body>
</html>
