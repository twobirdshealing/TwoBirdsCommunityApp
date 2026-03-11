<?php
/**
 * Theme Customizer Settings
 *
 * Adds settings for Fluent Community integration, template selection,
 * and WooCommerce integration.
 *
 * @package Fluent_Starter
 * @since 1.0.5
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Register customizer settings and controls
 *
 * @param WP_Customize_Manager $wp_customize Theme Customizer object
 */
function fluent_starter_customize_register($wp_customize) {

    // ==========================================================================
    // Fluent Community Integration Panel
    // ==========================================================================

    $wp_customize->add_panel('fluent_starter_panel', array(
        'title'       => __('Fluent Starter Settings', 'fluent-starter'),
        'description' => __('Configure Fluent Community integration and theme options.', 'fluent-starter'),
        'priority'    => 30,
    ));

    // ==========================================================================
    // Blog Integration Section
    // ==========================================================================

    $wp_customize->add_section('fluent_starter_blog_section', array(
        'title'       => __('Blog Integration', 'fluent-starter'),
        'description' => __('Settings for blog pages within Fluent Community frame.', 'fluent-starter'),
        'panel'       => 'fluent_starter_panel',
        'priority'    => 10,
    ));

    // Enable Blog Fluent Integration
    $wp_customize->add_setting('fluent_starter_blog_integration', array(
        'default'           => true,
        'sanitize_callback' => 'fluent_starter_sanitize_checkbox',
        'transport'         => 'refresh',
    ));

    $wp_customize->add_control('fluent_starter_blog_integration', array(
        'label'       => __('Enable Blog Integration', 'fluent-starter'),
        'description' => __('Display blog posts, archives, and single posts within Fluent Community frame.', 'fluent-starter'),
        'section'     => 'fluent_starter_blog_section',
        'type'        => 'checkbox',
    ));

    // Blog Template Selection
    $wp_customize->add_setting('fluent_starter_blog_template', array(
        'default'           => 'frame',
        'sanitize_callback' => 'fluent_starter_sanitize_template_choice',
        'transport'         => 'refresh',
    ));

    $wp_customize->add_control('fluent_starter_blog_template', array(
        'label'       => __('Blog Template', 'fluent-starter'),
        'description' => __('Choose the Fluent Community frame template for blog pages.', 'fluent-starter'),
        'section'     => 'fluent_starter_blog_section',
        'type'        => 'select',
        'choices'     => array(
            'frame'      => __('Fluent Community Frame (Constrained Width)', 'fluent-starter'),
            'frame-full' => __('Fluent Community Frame Full Width', 'fluent-starter'),
        ),
    ));

    // ==========================================================================
    // WooCommerce Integration Section (only if WooCommerce is active)
    // ==========================================================================

    if (class_exists('WooCommerce')) {
        $wp_customize->add_section('fluent_starter_woocommerce_section', array(
            'title'       => __('WooCommerce Integration', 'fluent-starter'),
            'description' => __('Settings for WooCommerce pages within Fluent Community frame.', 'fluent-starter'),
            'panel'       => 'fluent_starter_panel',
            'priority'    => 20,
        ));

        // Enable WooCommerce Fluent Integration
        $wp_customize->add_setting('fluent_starter_wc_integration', array(
            'default'           => false,
            'sanitize_callback' => 'fluent_starter_sanitize_checkbox',
            'transport'         => 'refresh',
        ));

        $wp_customize->add_control('fluent_starter_wc_integration', array(
            'label'       => __('Enable WooCommerce Integration', 'fluent-starter'),
            'description' => __('Display shop and product pages within Fluent Community frame.', 'fluent-starter'),
            'section'     => 'fluent_starter_woocommerce_section',
            'type'        => 'checkbox',
        ));

        // WooCommerce Template Selection
        $wp_customize->add_setting('fluent_starter_wc_template', array(
            'default'           => 'frame-full',
            'sanitize_callback' => 'fluent_starter_sanitize_template_choice',
            'transport'         => 'refresh',
        ));

        $wp_customize->add_control('fluent_starter_wc_template', array(
            'label'       => __('WooCommerce Template', 'fluent-starter'),
            'description' => __('Choose the Fluent Community frame template for WooCommerce pages.', 'fluent-starter'),
            'section'     => 'fluent_starter_woocommerce_section',
            'type'        => 'select',
            'choices'     => array(
                'frame'      => __('Fluent Community Frame (Constrained Width)', 'fluent-starter'),
                'frame-full' => __('Fluent Community Frame Full Width', 'fluent-starter'),
            ),
        ));

        // Show Mini Cart in Header
        $wp_customize->add_setting('fluent_starter_wc_mini_cart', array(
            'default'           => true,
            'sanitize_callback' => 'fluent_starter_sanitize_checkbox',
            'transport'         => 'refresh',
        ));

        $wp_customize->add_control('fluent_starter_wc_mini_cart', array(
            'label'       => __('Show Mini Cart in Header', 'fluent-starter'),
            'description' => __('Display a mini cart dropdown in the Fluent Community header.', 'fluent-starter'),
            'section'     => 'fluent_starter_woocommerce_section',
            'type'        => 'checkbox',
        ));

        // Show GamiPress Credits (only if GamiPress is active)
        if (function_exists('gamipress_get_user_points')) {
            $wp_customize->add_setting('fluent_starter_wc_gamipress', array(
                'default'           => true,
                'sanitize_callback' => 'fluent_starter_sanitize_checkbox',
                'transport'         => 'refresh',
            ));

            $wp_customize->add_control('fluent_starter_wc_gamipress', array(
                'label'       => __('Show GamiPress Credits', 'fluent-starter'),
                'description' => __('Display GamiPress credits/points in the mini cart dropdown.', 'fluent-starter'),
                'section'     => 'fluent_starter_woocommerce_section',
                'type'        => 'checkbox',
            ));
        }
    }

    // ==========================================================================
    // Maintenance Mode Section
    // ==========================================================================

    $wp_customize->add_section('fluent_starter_maintenance_section', array(
        'title'       => __('Maintenance Mode', 'fluent-starter'),
        'description' => __('Block all visitors except administrators. Shows a maintenance page with your custom message.', 'fluent-starter'),
        'panel'       => 'fluent_starter_panel',
        'priority'    => 5,
    ));

    // Enable Maintenance Mode
    $wp_customize->add_setting('fluent_starter_maintenance_mode', array(
        'default'           => false,
        'sanitize_callback' => 'fluent_starter_sanitize_checkbox',
        'transport'         => 'refresh',
    ));

    $wp_customize->add_control('fluent_starter_maintenance_mode', array(
        'label'       => __('Enable Maintenance Mode', 'fluent-starter'),
        'description' => __('When enabled, all visitors see a maintenance page. Administrators can still access the site.', 'fluent-starter'),
        'section'     => 'fluent_starter_maintenance_section',
        'type'        => 'checkbox',
    ));

    // Maintenance Message
    $wp_customize->add_setting('fluent_starter_maintenance_message', array(
        'default'           => '',
        'sanitize_callback' => 'sanitize_textarea_field',
        'transport'         => 'refresh',
    ));

    $wp_customize->add_control('fluent_starter_maintenance_message', array(
        'label'       => __('Maintenance Message', 'fluent-starter'),
        'description' => __('Custom message shown on the maintenance page. Leave empty for the default message.', 'fluent-starter'),
        'section'     => 'fluent_starter_maintenance_section',
        'type'        => 'textarea',
    ));

    // ==========================================================================
    // Comments Section
    // ==========================================================================

    $wp_customize->add_section('fluent_starter_comments_section', array(
        'title'       => __('Comments', 'fluent-starter'),
        'description' => __('Settings for blog post comments.', 'fluent-starter'),
        'panel'       => 'fluent_starter_panel',
        'priority'    => 30,
    ));

    // Enable Comments on Blog Posts
    $wp_customize->add_setting('fluent_starter_show_comments', array(
        'default'           => true,
        'sanitize_callback' => 'fluent_starter_sanitize_checkbox',
        'transport'         => 'refresh',
    ));

    $wp_customize->add_control('fluent_starter_show_comments', array(
        'label'       => __('Show Comments on Blog Posts', 'fluent-starter'),
        'description' => __('Display the comments section on single blog posts.', 'fluent-starter'),
        'section'     => 'fluent_starter_comments_section',
        'type'        => 'checkbox',
    ));
}
add_action('customize_register', 'fluent_starter_customize_register');

/**
 * Sanitize checkbox values
 *
 * @param bool $checked Whether the checkbox is checked
 * @return bool
 */
function fluent_starter_sanitize_checkbox($checked) {
    return ((isset($checked) && true == $checked) ? true : false);
}

/**
 * Sanitize template choice
 *
 * @param string $choice The template choice
 * @return string
 */
function fluent_starter_sanitize_template_choice($choice) {
    $valid = array('frame', 'frame-full');
    return in_array($choice, $valid, true) ? $choice : 'frame';
}

// ==========================================================================
// Helper Functions to Get Settings
// ==========================================================================

/**
 * Check if blog Fluent integration is enabled
 *
 * @return bool
 */
function fluent_starter_blog_integration_enabled() {
    return (bool) get_theme_mod('fluent_starter_blog_integration', true);
}

/**
 * Get the blog template file
 *
 * @return string Template filename
 */
function fluent_starter_get_blog_template() {
    $template = get_theme_mod('fluent_starter_blog_template', 'frame');
    return $template === 'frame-full'
        ? 'fluent-community-frame-full.php'
        : 'fluent-community-frame.php';
}

/**
 * Check if WooCommerce Fluent integration is enabled
 *
 * @return bool
 */
function fluent_starter_wc_integration_enabled() {
    if (!class_exists('WooCommerce')) {
        return false;
    }
    return (bool) get_theme_mod('fluent_starter_wc_integration', false);
}

/**
 * Get the WooCommerce template file
 *
 * @return string Template filename
 */
function fluent_starter_get_wc_template() {
    $template = get_theme_mod('fluent_starter_wc_template', 'frame-full');
    return $template === 'frame-full'
        ? 'fluent-community-frame-full.php'
        : 'fluent-community-frame.php';
}

/**
 * Check if mini cart should be shown
 *
 * @return bool
 */
function fluent_starter_show_mini_cart() {
    if (!fluent_starter_wc_integration_enabled()) {
        return false;
    }
    return (bool) get_theme_mod('fluent_starter_wc_mini_cart', true);
}

/**
 * Check if GamiPress credits should be shown
 *
 * @return bool
 */
function fluent_starter_show_gamipress() {
    if (!function_exists('gamipress_get_user_points')) {
        return false;
    }
    return (bool) get_theme_mod('fluent_starter_wc_gamipress', true);
}

/**
 * Check if comments should be shown on blog posts
 *
 * @return bool
 */
function fluent_starter_show_comments() {
    return (bool) get_theme_mod('fluent_starter_show_comments', true);
}
