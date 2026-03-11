<?php
/**
 * Maintenance Mode - Frontend blocking for non-admin users
 *
 * Theme-only maintenance mode controlled via Customizer settings.
 * When enabled, blocks all frontend visitors except administrators.
 * Allows wp-login.php and wp-admin access so admins can still log in.
 *
 * @package Fluent_Starter
 * @since 1.0.38
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Check if maintenance mode is enabled
 *
 * @return bool
 */
function fluent_starter_maintenance_enabled() {
    return (bool) get_theme_mod('fluent_starter_maintenance_mode', false);
}

/**
 * Get the maintenance message
 *
 * @return string
 */
function fluent_starter_maintenance_message() {
    return get_theme_mod('fluent_starter_maintenance_message', '');
}

/**
 * Block frontend access when maintenance mode is enabled
 *
 * Hooks into `wp_loaded` — fires after plugins/theme are fully loaded and user
 * auth cookies are resolved, but BEFORE Fluent Community's SPA routing or any
 * template handling. This ensures portal pages are caught too.
 *
 * Allows through:
 * - wp-login.php (so admins can log in)
 * - wp-admin / admin-ajax.php (dashboard + AJAX)
 * - REST API requests (handled separately by plugins)
 * - WP-Cron requests
 * - Customizer preview requests
 */
function fluent_starter_maintenance_redirect() {
    if (!fluent_starter_maintenance_enabled()) {
        return;
    }

    $request_uri = $_SERVER['REQUEST_URI'] ?? '';
    $script_name = $_SERVER['SCRIPT_NAME'] ?? '';

    // Allow wp-admin (includes admin-ajax.php)
    if (is_admin()) {
        return;
    }

    // Allow wp-login.php
    if (strpos($script_name, 'wp-login.php') !== false) {
        return;
    }

    // Allow REST API requests (/wp-json/)
    if (strpos($request_uri, '/wp-json/') !== false || strpos($request_uri, '?rest_route=') !== false) {
        return;
    }
    if (defined('REST_REQUEST') && REST_REQUEST) {
        return;
    }

    // Allow AJAX and cron
    if (wp_doing_ajax() || wp_doing_cron()) {
        return;
    }

    // Allow customizer preview
    if (isset($_GET['customize_changeset_uuid']) || isset($_GET['wp_customize'])) {
        return;
    }

    // Administrators bypass
    if (is_user_logged_in() && current_user_can('manage_options')) {
        return;
    }

    // Show maintenance page
    $message = fluent_starter_maintenance_message();
    fluent_starter_render_maintenance_page($message);
}
add_action('wp_loaded', 'fluent_starter_maintenance_redirect');

/**
 * Add admin bar indicator when maintenance mode is active
 */
function fluent_starter_maintenance_admin_bar($wp_admin_bar) {
    if (!fluent_starter_maintenance_enabled()) {
        return;
    }

    $wp_admin_bar->add_node([
        'id'    => 'fluent-starter-maintenance',
        'title' => '⚠ Maintenance Mode ON',
        'href'  => admin_url('customize.php?autofocus[section]=fluent_starter_maintenance_section'),
        'meta'  => [
            'class' => 'fluent-starter-maintenance-bar',
        ],
    ]);
}
add_action('admin_bar_menu', 'fluent_starter_maintenance_admin_bar', 100);

/**
 * Style the admin bar maintenance indicator
 */
function fluent_starter_maintenance_admin_bar_css() {
    if (!fluent_starter_maintenance_enabled() || !is_admin_bar_showing()) {
        return;
    }
    echo '<style>#wpadminbar .fluent-starter-maintenance-bar > .ab-item { background: #dc2626 !important; color: #fff !important; }</style>';
}
add_action('wp_head', 'fluent_starter_maintenance_admin_bar_css', 99);
add_action('admin_head', 'fluent_starter_maintenance_admin_bar_css', 99);

/**
 * Render the maintenance mode page and exit
 *
 * @param string $message Custom maintenance message
 */
function fluent_starter_render_maintenance_page($message) {
    $message = $message ?: __('We are performing scheduled maintenance. Please check back shortly.', 'fluent-starter');
    $site_name = get_bloginfo('name');

    status_header(503);
    header('Retry-After: 600');
    header('Content-Type: text/html; charset=utf-8');
    nocache_headers();

    ?>
<!DOCTYPE html>
<html lang="<?php echo esc_attr(get_bloginfo('language')); ?>">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title><?php echo esc_html($site_name); ?> — Maintenance</title>
    <script>
    (function(){try{var s=localStorage.getItem('fcom_global_storage');if(s){var d=JSON.parse(s);if(d&&d.fcom_color_mode==='dark'){document.documentElement.classList.add('dark')}}else if(window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches){document.documentElement.classList.add('dark')}}catch(e){}})();
    </script>
    <style>
        :root {
            --bg: #f8f9fa;
            --surface: #ffffff;
            --text: #1a1a2e;
            --text-secondary: #6b7280;
            --border: #e5e7eb;
            --primary: #4f46e5;
            --primary-hover: #4338ca;
        }
        html.dark {
            --bg: #111827;
            --surface: #1f2937;
            --text: #f3f4f6;
            --text-secondary: #9ca3af;
            --border: #374151;
            --primary: #6366f1;
            --primary-hover: #818cf8;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .maintenance-container {
            text-align: center;
            padding: 2rem;
            max-width: 480px;
        }
        .maintenance-icon {
            font-size: 3.5rem;
            margin-bottom: 1.5rem;
            display: block;
        }
        .maintenance-title {
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 0.75rem;
        }
        .maintenance-message {
            font-size: 1rem;
            line-height: 1.6;
            color: var(--text-secondary);
            margin-bottom: 2rem;
            white-space: pre-line;
        }
        .maintenance-retry {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.625rem 1.5rem;
            background: var(--primary);
            color: #fff;
            border: none;
            border-radius: 8px;
            font-size: 0.9375rem;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.15s;
            text-decoration: none;
        }
        .maintenance-retry:hover { background: var(--primary-hover); }
        .maintenance-login {
            display: block;
            margin-top: 1.5rem;
            color: var(--text-secondary);
            font-size: 0.875rem;
            text-decoration: none;
        }
        .maintenance-login:hover { color: var(--text); }
        .maintenance-auto {
            display: block;
            margin-top: 0.75rem;
            color: var(--text-secondary);
            font-size: 0.8125rem;
        }
    </style>
</head>
<body>
    <div class="maintenance-container">
        <span class="maintenance-icon" aria-hidden="true">🔧</span>
        <h1 class="maintenance-title"><?php echo esc_html($site_name); ?></h1>
        <p class="maintenance-message"><?php echo esc_html($message); ?></p>
        <button class="maintenance-retry" onclick="location.reload()">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
            Refresh
        </button>
        <span class="maintenance-auto">Auto-refreshing every 30 seconds</span>
        <a class="maintenance-login" href="<?php echo esc_url(wp_login_url(home_url('/'))); ?>">Admin Login</a>
    </div>
    <script>setTimeout(function(){location.reload()},30000);</script>
</body>
</html>
    <?php
    exit;
}
