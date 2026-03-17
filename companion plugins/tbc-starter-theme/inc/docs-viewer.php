<?php
/**
 * Docs Viewer — Serve static HTML docs inside Fluent Community frame
 *
 * Upload HTML files to wp-content/tbc-docs/ and they'll be served
 * at /docs/{filename} wrapped in the Fluent Community frame with
 * sidebar, header, and dark mode support.
 *
 * CSS/JS from docs-theme.css and docs-theme.js are also served
 * from the tbc-docs folder.
 *
 * @package Fluent_Starter
 * @since 1.0.51
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Get the docs directory path
 *
 * @return string Absolute path to the docs folder
 */
function fluent_starter_docs_dir() {
    return WP_CONTENT_DIR . '/tbc-docs/';
}

/**
 * Register rewrite rules for docs
 */
function fluent_starter_docs_rewrite_rules() {
    add_rewrite_rule(
        '^docs/([a-zA-Z0-9_-]+)(?:\.html?)?/?$',
        'index.php?tbc_doc=$matches[1]',
        'top'
    );
}
add_action('init', 'fluent_starter_docs_rewrite_rules');

/**
 * Register the tbc_doc query variable
 */
function fluent_starter_docs_query_vars($vars) {
    $vars[] = 'tbc_doc';
    return $vars;
}
add_filter('query_vars', 'fluent_starter_docs_query_vars');

/**
 * Prevent WordPress from showing a 404 for valid doc pages
 */
function fluent_starter_docs_prevent_404($preempt, $wp_query) {
    $doc_slug = get_query_var('tbc_doc');
    if (!$doc_slug) {
        return $preempt;
    }

    $file = fluent_starter_docs_dir() . sanitize_file_name($doc_slug) . '.html';
    if (file_exists($file)) {
        $wp_query->is_404 = false;
        status_header(200);
        return true;
    }

    return $preempt;
}
add_filter('pre_handle_404', 'fluent_starter_docs_prevent_404', 10, 2);

/**
 * Force Fluent Community frame template for doc pages
 */
add_filter('fluent_community/template_slug', function ($templateSlug) {
    if (get_query_var('tbc_doc')) {
        return 'fluent-community-frame-full.php';
    }
    return $templateSlug;
});

/**
 * Render doc content inside the Fluent Community frame
 *
 * Extracts <body> content from the HTML file and outputs it.
 * The docs-theme.css handles the styling, and --fcom-* variables
 * from Fluent Community automatically override the standalone colors.
 */
add_action('fluent_community/theme_content', function ($themeName, $wrapperType = 'default') {
    $doc_slug = get_query_var('tbc_doc');
    if (!$doc_slug) {
        return;
    }

    $file = fluent_starter_docs_dir() . sanitize_file_name($doc_slug) . '.html';
    if (!file_exists($file)) {
        echo '<div class="wp_content_wrapper"><h1>Doc not found</h1><p>The requested documentation page does not exist.</p></div>';
        return;
    }

    $html = file_get_contents($file);

    // Extract body content (everything between <body> and </body>)
    $body_content = $html;
    if (preg_match('/<body[^>]*>(.*)<\/body>/si', $html, $matches)) {
        $body_content = $matches[1];
    }

    // Extract title for page title
    $title = $doc_slug;
    if (preg_match('/<title>([^<]+)<\/title>/i', $html, $matches)) {
        $title = $matches[1];
    }

    echo '<div class="tbc-docs-viewer">';
    echo $body_content;
    echo '</div>';
}, 10, 2);

/**
 * Enqueue docs CSS/JS when viewing a doc page
 */
function fluent_starter_docs_enqueue() {
    if (!get_query_var('tbc_doc')) {
        return;
    }

    $docs_dir = fluent_starter_docs_dir();
    $docs_url = content_url('tbc-docs/');

    // Enqueue docs theme CSS if it exists
    if (file_exists($docs_dir . 'docs-theme.css')) {
        wp_enqueue_style(
            'tbc-docs-theme',
            $docs_url . 'docs-theme.css',
            array(),
            FLUENT_STARTER_VERSION
        );
    }

    // Enqueue docs theme JS if it exists
    if (file_exists($docs_dir . 'docs-theme.js')) {
        wp_enqueue_script(
            'tbc-docs-theme',
            $docs_url . 'docs-theme.js',
            array(),
            FLUENT_STARTER_VERSION,
            true
        );
    }
}
add_action('wp_enqueue_scripts', 'fluent_starter_docs_enqueue');

/**
 * Set the page title for doc pages
 */
function fluent_starter_docs_title($title) {
    $doc_slug = get_query_var('tbc_doc');
    if (!$doc_slug) {
        return $title;
    }

    $file = fluent_starter_docs_dir() . sanitize_file_name($doc_slug) . '.html';
    if (file_exists($file)) {
        $html = file_get_contents($file);
        if (preg_match('/<title>([^<]+)<\/title>/i', $html, $matches)) {
            return esc_html($matches[1]);
        }
    }

    // Fallback: humanize the slug
    return ucwords(str_replace('-', ' ', $doc_slug));
}
add_filter('pre_get_document_title', 'fluent_starter_docs_title', 20);
