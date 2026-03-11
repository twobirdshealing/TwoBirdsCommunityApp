<?php
/**
 * App View class - hides header/footer when viewing in app WebView
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_App_View {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_filter('body_class', [$this, 'add_body_class']);
        add_action('wp_head', [$this, 'output_styles'], 999);
    }

    /**
     * Check if request is from our app's WebView
     */
    public static function is_app_view() {
        $user_agent = $_SERVER['HTTP_USER_AGENT'] ?? '';
        return strpos($user_agent, TBC_CA_APP_USER_AGENT) !== false;
    }

    /**
     * Add body class for app view
     */
    public function add_body_class($classes) {
        if (self::is_app_view()) {
            $classes[] = 'tbc-app-view';
        }
        return $classes;
    }

    /**
     * Output CSS to hide header/footer in app view
     */
    public function output_styles() {
        if (!self::is_app_view()) {
            return;
        }
        ?>
        <style id="tbc-app-view-styles">
            /* =================================================================
             * TBC Community App - App View Mode
             * Hides header/footer when viewing in mobile app WebView
             * ================================================================= */

            /* Universal HTML5 semantic elements */
            body.tbc-app-view > header,
            body.tbc-app-view > footer,
            body.tbc-app-view header.site-header,
            body.tbc-app-view footer.site-footer,
            body.tbc-app-view .site-header,
            body.tbc-app-view .site-footer {
                display: none !important;
            }

            /* Common theme selectors */
            body.tbc-app-view #masthead,
            body.tbc-app-view #colophon,
            body.tbc-app-view #site-header,
            body.tbc-app-view #site-footer,
            body.tbc-app-view .ast-header-sticked,
            body.tbc-app-view .header-wrapper,
            body.tbc-app-view .footer-wrapper {
                display: none !important;
            }

            /* Kadence theme */
            body.tbc-app-view .kadence-header,
            body.tbc-app-view .kadence-footer {
                display: none !important;
            }

            /* Astra theme */
            body.tbc-app-view .ast-header,
            body.tbc-app-view .ast-footer {
                display: none !important;
            }

            /* GeneratePress theme */
            body.tbc-app-view .generate-header,
            body.tbc-app-view .generate-footer {
                display: none !important;
            }

            /* BuddyBoss theme */
            body.tbc-app-view .bb-header,
            body.tbc-app-view .bb-footer,
            body.tbc-app-view #bb-header,
            body.tbc-app-view #bb-footer {
                display: none !important;
            }

            /* Elementor headers/footers */
            body.tbc-app-view .elementor-location-header,
            body.tbc-app-view .elementor-location-footer {
                display: none !important;
            }

            /* Fluent Community portal header and mobile bottom menu */
            body.tbc-app-view .fcom_top_menu,
            body.tbc-app-view .fcom_mobile_menu {
                display: none !important;
            }

            body.tbc-app-view .fhr_wrap {
                padding-top: 0 !important;
            }

            /* WordPress admin bar (should be hidden anyway but just in case) */
            body.tbc-app-view #wpadminbar {
                display: none !important;
            }

            /* Adjust body to remove any header spacing */
            body.tbc-app-view {
                padding-top: 0 !important;
                margin-top: 0 !important;
            }

            /* Make main content full height */
            body.tbc-app-view .site-content,
            body.tbc-app-view .content-area,
            body.tbc-app-view #content,
            body.tbc-app-view main {
                min-height: 100vh;
            }
        </style>
        <?php
    }
}
