<?php
/**
 * The header for our theme
 *
 * Minimal header - blank canvas approach
 * Most sites will use Fluent Community's header via the Frame template
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
<body <?php body_class('fluent-starter'); ?>>
<?php wp_body_open(); ?>

<div id="page" class="site">
    <main id="main" class="fluent-starter-main" role="main">
