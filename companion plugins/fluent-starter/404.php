<?php
/**
 * The template for displaying 404 pages (not found)
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
<body <?php body_class('fluent-starter fluent-starter-404'); ?>>
<?php wp_body_open(); ?>

<div id="page" class="site">
    <main id="main" class="fluent-starter-content fluent-starter-error-page" role="main">
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
    </main>
</div>

<?php wp_footer(); ?>
</body>
</html>
