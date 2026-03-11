<?php
/**
 * The template for displaying search results pages
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
<body <?php body_class('fluent-starter fluent-starter-search'); ?>>
<?php wp_body_open(); ?>

<div id="page" class="site">
    <main id="main" class="fluent-starter-content" role="main">
        <header class="search-header">
            <h1 class="search-title">
                <?php
                printf(
                    /* translators: %s: search query. */
                    esc_html__('Search Results for: %s', 'fluent-starter'),
                    '<span>' . get_search_query() . '</span>'
                );
                ?>
            </h1>
        </header>

        <?php if (have_posts()) : ?>
            <div class="search-results">
                <?php
                while (have_posts()) :
                    the_post();
                    get_template_part('template-parts/content', 'search');
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
