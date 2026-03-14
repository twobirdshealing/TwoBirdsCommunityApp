<?php
/**
 * Theme Setup
 *
 * @package Fluent_Starter
 * @since 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Sets up theme defaults and registers support for various WordPress features.
 */
function fluent_starter_setup() {
    // Make theme available for translation
    load_theme_textdomain('fluent-starter', FLUENT_STARTER_DIR . '/languages');

    // Add default posts and comments RSS feed links to head
    add_theme_support('automatic-feed-links');

    // Let WordPress manage the document title
    add_theme_support('title-tag');

    // Enable support for Post Thumbnails on posts and pages
    add_theme_support('post-thumbnails');

    // Register navigation menus (minimal - just in case needed)
    register_nav_menus(array(
        'primary' => esc_html__('Primary Menu', 'fluent-starter'),
    ));

    // Switch default core markup to HTML5
    add_theme_support('html5', array(
        'search-form',
        'comment-form',
        'comment-list',
        'gallery',
        'caption',
        'style',
        'script',
        'navigation-widgets',
    ));

    // Add support for Block Styles
    add_theme_support('wp-block-styles');

    // Add support for full and wide align blocks
    add_theme_support('align-wide');

    // Add support for responsive embedded content
    add_theme_support('responsive-embeds');

    // Add support for custom line heights
    add_theme_support('custom-line-height');

    // Add support for custom units
    add_theme_support('custom-units');

    // Add support for editor styles
    add_theme_support('editor-styles');

    // Add support for custom spacing
    add_theme_support('custom-spacing');

    // Disable custom colors in block editor to keep things consistent
    // add_theme_support('disable-custom-colors');

    // Add support for appearance tools (border, link color, typography, etc)
    add_theme_support('appearance-tools');

    // Set content width
    $GLOBALS['content_width'] = apply_filters('fluent_starter_content_width', 1200);

    // WooCommerce theme support
    // This ensures products display properly even when Fluent integration is OFF
    if (class_exists('WooCommerce')) {
        add_theme_support('woocommerce');
        add_theme_support('wc-product-gallery-zoom');
        add_theme_support('wc-product-gallery-lightbox');
        add_theme_support('wc-product-gallery-slider');
    }
}
add_action('after_setup_theme', 'fluent_starter_setup');

/**
 * Add custom body classes
 */
function fluent_starter_body_classes($classes) {
    // Add class if Fluent Community is active
    if (fluent_starter_has_fluent_community()) {
        $classes[] = 'has-fluent-community';
    }

    // Add class for singular pages
    if (is_singular()) {
        $classes[] = 'is-singular';
    }

    // Check for dark mode preference
    if (isset($_COOKIE['fluent_starter_color_mode']) && $_COOKIE['fluent_starter_color_mode'] === 'dark') {
        $classes[] = 'dark-mode-preferred';
    }

    return $classes;
}
add_filter('body_class', 'fluent_starter_body_classes');

/**
 * Remove unnecessary WordPress features for performance
 */
function fluent_starter_cleanup() {
    // Remove emoji scripts and styles
    remove_action('wp_head', 'print_emoji_detection_script', 7);
    remove_action('wp_print_styles', 'print_emoji_styles');
    remove_action('admin_print_scripts', 'print_emoji_detection_script');
    remove_action('admin_print_styles', 'print_emoji_styles');

    // Remove RSD link
    remove_action('wp_head', 'rsd_link');

    // Remove Windows Live Writer manifest link
    remove_action('wp_head', 'wlwmanifest_link');

    // Remove WordPress generator version
    remove_action('wp_head', 'wp_generator');

    // Remove shortlink
    remove_action('wp_head', 'wp_shortlink_wp_head');

    // Remove REST API link
    remove_action('wp_head', 'rest_output_link_wp_head');

    // Remove oEmbed discovery links
    remove_action('wp_head', 'wp_oembed_add_discovery_links');
}
add_action('init', 'fluent_starter_cleanup');

/**
 * Disable XML-RPC for security (optional - uncomment if desired)
 */
// add_filter('xmlrpc_enabled', '__return_false');
