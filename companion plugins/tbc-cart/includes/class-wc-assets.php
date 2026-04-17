<?php
/**
 * WooCommerce Asset Loading
 *
 * Handles CSS/JS enqueuing for WooCommerce pages on both
 * standalone WP pages and Fluent Community frame pages.
 *
 * Moved from tbc-starter-theme in 2.0.0.
 *
 * @package TBC_Cart
 * @since 2.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_Cart_WC_Assets {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        if (!tbc_cart_wc_integration_enabled()) {
            return;
        }

        // WooCommerce CSS on standalone WP pages
        add_action('wp_enqueue_scripts', array($this, 'enqueue_wc_styles'), 5);

        // WooCommerce CSS on Fluent Community frame pages
        add_action('fluent_community/enqueue_global_assets', array($this, 'enqueue_wc_global_styles'), 10, 1);

        // Product gallery thumbnail sync
        add_action('wp_footer', array($this, 'gallery_thumb_sync'), 20);
    }

    private function enqueue_wc_stylesheet() {
        $css_path = TBC_CART_PLUGIN_DIR . 'assets/css/woocommerce.css';
        wp_enqueue_style(
            'tbc-cart-woocommerce',
            TBC_CART_PLUGIN_URL . 'assets/css/woocommerce.css',
            array(),
            file_exists($css_path) ? (string) filemtime($css_path) : TBC_CART_VERSION
        );
    }

    /**
     * Enqueue WooCommerce styles on standalone WP pages
     */
    public function enqueue_wc_styles() {
        if (!tbc_cart_is_wc_page()) {
            return;
        }

        // Skip portal pages — Fluent frame handles its own enqueuing
        if (function_exists('fluent_starter_is_portal_page') && fluent_starter_is_portal_page()) {
            return;
        }

        $this->enqueue_wc_stylesheet();
    }

    /**
     * Enqueue WooCommerce styles on Fluent Community frame pages
     */
    public function enqueue_wc_global_styles($useDefaultTheme) {
        if (tbc_cart_is_wc_page()) {
            $this->enqueue_wc_stylesheet();
        }
    }

    /**
     * Product gallery thumbnail sync
     *
     * Scrolls the thumbnail filmstrip to keep the active thumb visible
     * when the main image changes (swipe, arrow keys, etc.).
     */
    public function gallery_thumb_sync() {
        if (function_exists('fluent_starter_is_portal_page') && fluent_starter_is_portal_page()) {
            return;
        }
        if (!function_exists('is_product') || !is_product()) {
            return;
        }
        ?>
        <script>
        (function(){
            function initThumbSync() {
                var thumbs = document.querySelector('.flex-control-thumbs');
                if (!thumbs) return false;

                var observer = new MutationObserver(function() {
                    var active = thumbs.querySelector('.flex-active');
                    if (active) {
                        var li = active.parentElement;
                        var scrollTarget = li.offsetLeft - (thumbs.offsetWidth / 2) + (li.offsetWidth / 2);
                        thumbs.scrollTo({ left: scrollTarget, behavior: 'smooth' });
                    }
                });
                thumbs.querySelectorAll('img').forEach(function(img) {
                    observer.observe(img, { attributes: true, attributeFilter: ['class'] });
                });

                return true;
            }

            var attempts = 0;
            var interval = setInterval(function(){
                if (initThumbSync() || ++attempts >= 20) clearInterval(interval);
            }, 250);
        })();
        </script>
        <?php
    }
}
