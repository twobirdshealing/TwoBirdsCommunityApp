<?php
/**
 * WooCommerce + Fluent Community Integration
 *
 * Mini cart in header + WooCommerce pages in Fluent frame.
 * Uses Fluent Community's native classes for proper styling.
 *
 * Moved from tbc-starter-theme in 2.0.0.
 *
 * @package TBC_Cart
 * @since 2.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_Cart_WC_Integration {

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

        // Mini cart in Fluent Community header
        if (tbc_cart_show_mini_cart()) {
            add_action('fluent_community/before_header_right_menu_items', array($this, 'render_mini_cart'), 10, 1);
        }

        // Mini cart CSS/JS on portal pages
        add_action('fluent_community/portal_head', array($this, 'portal_head_assets'));

        // Mini cart assets on regular WP pages
        add_action('wp_enqueue_scripts', array($this, 'enqueue_mini_cart_assets'));

        // WooCommerce content rendering in Fluent frame (direct FC hook)
        add_action('fluent_community/theme_content', array($this, 'handle_wc_content'), 5, 2);

        // AJAX cart fragments
        add_filter('woocommerce_add_to_cart_fragments', array($this, 'cart_fragments'));
    }

    /**
     * Output mini cart CSS + JS and WC component styles on portal pages
     */
    public function portal_head_assets() {
        if (tbc_cart_show_mini_cart()) {
            $this->output_mini_cart_css();
            $this->output_mini_cart_js();
        }
        $this->output_wc_component_css();
    }

    /**
     * Enqueue mini cart assets on regular WP pages
     */
    public function enqueue_mini_cart_assets() {
        if (!tbc_cart_show_mini_cart()) {
            return;
        }

        add_action('wp_head', array($this, 'output_mini_cart_css'), 99);
        add_action('wp_footer', array($this, 'output_mini_cart_js'), 99);
    }

    /**
     * Handle WooCommerce content rendering in Fluent Community frame
     *
     * Hooks directly into FC's theme_content action at priority 5
     * (before theme/default handlers at 10). After rendering WC content,
     * removes all priority 10 handlers to prevent double output.
     * Works with any theme — no theme-specific filters needed.
     *
     * @param string $themeName   The active theme name
     * @param string $wrapperType The wrapper type
     */
    public function handle_wc_content($themeName, $wrapperType = 'default') {
        if (!tbc_cart_is_wc_page()) {
            return;
        }

        $this->render_wc_page_content($wrapperType);
        // Prevent theme/default handler from also rendering content
        remove_all_actions('fluent_community/theme_content', 10);
    }

    /**
     * Output mini cart CSS once (shared between portal and non-portal pages)
     */
    public function output_mini_cart_css() {
        static $output = false;
        if ($output) return;
        $output = true;
        ?>
        <style id="fs-mini-cart-css">
        .fs_cart_dropdown { display: none !important; position: absolute; top: 110%; right: 0; width: 320px; background: var(--fcom-primary-bg, #fff); border-radius: 12px; border: 1px solid var(--fcom-primary-border, #e3e8ee); box-shadow: 0 4px 20px rgba(0,0,0,0.12); padding: 16px; z-index: 99999; }
        .fs_cart_extend.fcom_extend_menu .fs_cart_dropdown { display: block !important; }
        .fs_cart_trigger { cursor: pointer; }
        .fs_cart_items { max-height: 280px; overflow-y: auto; margin-bottom: 12px; }
        .fs_cart_item { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--fcom-secondary-border, #9CA3AF); align-items: center; }
        .fs_cart_item:last-child { border-bottom: none; }
        .fs_cart_item_img { flex-shrink: 0; }
        .fs_cart_item_img img { width: 50px; height: 50px; object-fit: cover; border-radius: 6px; display: block; }
        .fs_cart_item_details { flex: 1; min-width: 0; }
        .fs_cart_item_name { display: block; font-size: 14px; font-weight: 500; color: var(--fcom-primary-text, #19283a); text-decoration: none; line-height: 1.3; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .fs_cart_item_qty { font-size: 13px; color: var(--fcom-secondary-text, #525866); }
        .fs_cart_item_remove { flex-shrink: 0; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; align-self: center; padding: 0 !important; margin: 0; border-radius: 50%; color: var(--fcom-secondary-text, #525866); text-decoration: none; transition: background 0.15s, color 0.15s; }
        .fs_cart_item_remove svg { display: block; }
        .fs_cart_item_remove:hover { background: var(--fcom-light-bg, #E1E4EA); color: var(--fcom-primary-text, #19283a); }
        .fs_cart_item_remove.fs_removing { opacity: 0.4; pointer-events: none; }
        .fs_cart_footer { border-top: 1px solid var(--fcom-secondary-border, #9CA3AF); padding-top: 12px; }
        .fs_cart_subtotal { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 15px; }
        .fs_cart_buttons { display: flex; gap: 8px; }
        .fs_btn { flex: 1; display: inline-flex; align-items: center; justify-content: center; padding: 10px 16px; font-size: 14px; font-weight: 500; text-decoration: none; border-radius: 8px; cursor: pointer; border: none; }
        .fs_btn_primary { background: var(--fcom-primary-button, #2B2E33) !important; color: var(--fcom-primary-button-text, #fff) !important; }
        .fs_btn_secondary { background: var(--fcom-light-bg, #E1E4EA) !important; color: var(--fcom-primary-text, #19283a) !important; border: 1px solid var(--fcom-secondary-border, #9CA3AF) !important; }
        .fs_cart_credits { background: var(--fcom-light-bg, #E1E4EA); border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; }
        .fs_credits_link { display: flex; justify-content: space-between; align-items: center; text-decoration: none; color: inherit; }
        .fs_credits_label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--fcom-secondary-text, #525866); }
        .fs_credits_icon { width: 24px; height: 24px; border-radius: 4px; object-fit: cover; }
        .fs_credits_amount { font-size: 16px; font-weight: 600; color: var(--fcom-text-link, #2271b1); }
        .fs_cart_empty { text-align: center; padding: 20px 0; }
        .fs_cart_empty p { color: var(--fcom-text-off, #959595); margin: 0 0 16px; }
        </style>
        <?php
    }

    /**
     * Output mini cart JS once (shared between portal and non-portal pages)
     */
    public function output_mini_cart_js() {
        static $output = false;
        if ($output) return;
        $output = true;
        $wc_ajax_url = WC_AJAX::get_endpoint('%%endpoint%%');
        ?>
        <script id="fs-mini-cart-js">
        (function() {
            'use strict';
            var wcAjaxUrl = <?php echo wp_json_encode($wc_ajax_url); ?>;

            function initCartDropdown() {
                var cartContainers = document.querySelectorAll('.fs_cart_extend');
                cartContainers.forEach(function(container) {
                    if (container.dataset.fsInitialized) return;
                    container.dataset.fsInitialized = 'true';

                    var trigger = container.querySelector('.fs_cart_trigger');
                    if (!trigger) return;

                    function closeMenu(event) {
                        if (container.contains(event.target)) return;
                        container.classList.remove('fcom_extend_menu');
                        document.removeEventListener('click', closeMenu);
                    }

                    trigger.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();

                        document.querySelectorAll('.fs_cart_extend.fcom_extend_menu').forEach(function(other) {
                            if (other !== container) other.classList.remove('fcom_extend_menu');
                        });

                        container.classList.toggle('fcom_extend_menu');

                        if (container.classList.contains('fcom_extend_menu')) {
                            setTimeout(function() {
                                document.addEventListener('click', closeMenu);
                            }, 10);
                        } else {
                            document.removeEventListener('click', closeMenu);
                        }
                    });
                });
            }

            // Handle remove item clicks via WooCommerce AJAX
            document.addEventListener('click', function(e) {
                var removeBtn = e.target.closest('.fs_cart_item_remove');
                if (!removeBtn) return;

                e.preventDefault();
                e.stopPropagation();

                var cartItemKey = removeBtn.getAttribute('data-cart-item-key');
                if (!cartItemKey) return;

                removeBtn.classList.add('fs_removing');

                var url = wcAjaxUrl.replace('%%endpoint%%', 'remove_from_cart');
                var formData = new FormData();
                formData.append('cart_item_key', cartItemKey);

                fetch(url, {
                    method: 'POST',
                    body: formData,
                    credentials: 'same-origin'
                })
                .then(function(response) { return response.json(); })
                .then(function(data) {
                    if (data.fragments) {
                        for (var selector in data.fragments) {
                            var els = document.querySelectorAll(selector);
                            els.forEach(function(el) {
                                var temp = document.createElement('div');
                                temp.innerHTML = data.fragments[selector];
                                if (temp.firstElementChild) {
                                    el.replaceWith(temp.firstElementChild);
                                }
                            });
                        }
                        initCartDropdown();
                    }
                })
                .catch(function() {
                    removeBtn.classList.remove('fs_removing');
                });
            });

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initCartDropdown);
            } else {
                initCartDropdown();
            }
        })();
        </script>
        <?php
    }

    /**
     * Output WooCommerce component CSS once (tabs, buttons, My Account)
     */
    public function output_wc_component_css() {
        static $output = false;
        if ($output) return;
        $output = true;
        ?>
        <style id="fs-wc-component-css">
        /* WooCommerce Product Tabs - Reset defaults and apply Fluent theming */
        .woocommerce div.product .woocommerce-tabs ul.tabs {
            list-style: none !important;
            padding: 0 !important;
            margin: 0 0 24px 0 !important;
            display: flex !important;
            gap: 0;
            border-bottom: 1px solid var(--fcom-secondary-border, #9CA3AF) !important;
            background: transparent !important;
            overflow: visible !important;
        }
        .woocommerce div.product .woocommerce-tabs ul.tabs::before,
        .woocommerce div.product .woocommerce-tabs ul.tabs::after {
            display: none !important;
        }
        .woocommerce div.product .woocommerce-tabs ul.tabs li {
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            border: none !important;
            border-radius: 0 !important;
            position: relative;
        }
        .woocommerce div.product .woocommerce-tabs ul.tabs li::before,
        .woocommerce div.product .woocommerce-tabs ul.tabs li::after {
            display: none !important;
        }
        .woocommerce div.product .woocommerce-tabs ul.tabs li a {
            display: block !important;
            padding: 12px 20px !important;
            color: var(--fcom-text-off, #959595) !important;
            text-decoration: none !important;
            font-weight: 500 !important;
            font-size: 0.9375rem;
            background: transparent !important;
            border: none !important;
            border-bottom: 2px solid transparent !important;
            margin-bottom: -1px;
            transition: color 0.2s ease, border-color 0.2s ease;
        }
        .woocommerce div.product .woocommerce-tabs ul.tabs li a:hover {
            color: var(--fcom-primary-text, #19283a) !important;
            background: transparent !important;
        }
        .woocommerce div.product .woocommerce-tabs ul.tabs li.active a {
            color: var(--fcom-primary-text, #19283a) !important;
            border-bottom-color: var(--fcom-text-link, #2271b1) !important;
            background: transparent !important;
        }
        /* Tab panel styling */
        .woocommerce div.product .woocommerce-tabs .woocommerce-Tabs-panel,
        .woocommerce div.product .woocommerce-tabs .panel {
            background: var(--fcom-primary-bg, #ffffff) !important;
            padding: 24px !important;
            border: 1px solid var(--fcom-primary-border, #e3e8ee) !important;
            border-radius: 8px !important;
            color: var(--fcom-primary-text, #19283a) !important;
        }
        .woocommerce div.product .woocommerce-tabs .panel h2,
        .woocommerce div.product .woocommerce-tabs .woocommerce-Tabs-panel h2 {
            color: var(--fcom-primary-text, #19283a);
            margin-top: 0;
            font-size: 1.25rem;
            font-weight: 600;
        }
        /* Dark mode for tabs */
        html.dark .woocommerce div.product .woocommerce-tabs ul.tabs {
            border-bottom-color: var(--fcom-secondary-border, #A5A9AD) !important;
        }
        html.dark .woocommerce div.product .woocommerce-tabs ul.tabs li a {
            color: var(--fcom-text-off, #A5A9AD) !important;
        }
        html.dark .woocommerce div.product .woocommerce-tabs ul.tabs li a:hover {
            color: var(--fcom-primary-text, #F0F3F5) !important;
        }
        html.dark .woocommerce div.product .woocommerce-tabs ul.tabs li.active a {
            color: var(--fcom-primary-text, #F0F3F5) !important;
            border-bottom-color: var(--fcom-text-link, #60a5fa) !important;
        }
        html.dark .woocommerce div.product .woocommerce-tabs .woocommerce-Tabs-panel,
        html.dark .woocommerce div.product .woocommerce-tabs .panel {
            background: var(--fcom-secondary-bg, #191B1F) !important;
            border-color: var(--fcom-primary-border, #42464D) !important;
            color: var(--fcom-primary-text, #F0F3F5) !important;
        }
        html.dark .woocommerce div.product .woocommerce-tabs .panel h2,
        html.dark .woocommerce div.product .woocommerce-tabs .woocommerce-Tabs-panel h2 {
            color: var(--fcom-primary-text, #F0F3F5);
        }
        /* WooCommerce buttons - all variants */
        .woocommerce .button,
        .woocommerce button.button,
        .woocommerce input.button,
        .woocommerce a.button,
        .woocommerce .button.alt,
        .woocommerce button.button.alt,
        .woocommerce input.button.alt,
        .woocommerce a.button.alt,
        .woocommerce a.checkout-button,
        .woocommerce #respond input#submit,
        .woocommerce #respond input#submit.alt {
            background: var(--fcom-primary-button, #2B2E33) !important;
            color: var(--fcom-primary-button-text, #ffffff) !important;
            border: none !important;
            border-radius: 8px !important;
            padding: 10px 20px !important;
            font-size: 0.875rem !important;
            font-weight: 500 !important;
            cursor: pointer !important;
            transition: filter 0.2s !important;
            text-decoration: none !important;
        }
        .woocommerce .button:hover,
        .woocommerce button.button:hover,
        .woocommerce input.button:hover,
        .woocommerce a.button:hover,
        .woocommerce .button.alt:hover,
        .woocommerce button.button.alt:hover,
        .woocommerce input.button.alt:hover,
        .woocommerce a.button.alt:hover,
        .woocommerce a.checkout-button:hover,
        .woocommerce #respond input#submit:hover,
        .woocommerce #respond input#submit.alt:hover {
            filter: brightness(1.1) !important;
        }
        .woocommerce .button:disabled,
        .woocommerce button.button:disabled,
        .woocommerce .button.alt:disabled {
            opacity: 0.6 !important;
            cursor: not-allowed !important;
        }
        /* My Account - horizontal tabs layout */
        .woocommerce-account .woocommerce { display: flex !important; flex-wrap: wrap !important; }
        .woocommerce-account .woocommerce-MyAccount-navigation,
        .woocommerce-account .woocommerce-MyAccount-content { width: 100% !important; flex-basis: 100% !important; float: none !important; }
        .woocommerce-account .woocommerce-MyAccount-navigation ul { list-style: none !important; padding: 0 !important; margin: 0 0 24px 0 !important; display: flex !important; flex-wrap: wrap !important; border-bottom: 2px solid var(--fcom-secondary-border, #9CA3AF) !important; }
        .woocommerce-account .woocommerce-MyAccount-navigation ul li { flex: 1 1 auto !important; margin: 0 !important; padding: 0 !important; text-align: center !important; }
        .woocommerce-account .woocommerce-MyAccount-navigation ul li a { display: block !important; padding: 12px 8px !important; color: var(--fcom-text-off, #959595) !important; text-decoration: none !important; font-weight: 500 !important; font-size: 0.875rem !important; border-bottom: 2px solid transparent !important; margin-bottom: -2px !important; white-space: nowrap !important; }
        .woocommerce-account .woocommerce-MyAccount-navigation ul li a:hover { color: var(--fcom-primary-text, #19283a) !important; }
        .woocommerce-account .woocommerce-MyAccount-navigation ul li.is-active a { color: var(--fcom-primary-text, #19283a) !important; border-bottom-color: var(--fcom-text-link, #2271b1) !important; font-weight: 600 !important; }
        .woocommerce-account .woocommerce-MyAccount-content { background: var(--fcom-primary-bg, #ffffff) !important; padding: 24px !important; border: 1px solid var(--fcom-primary-border, #e3e8ee) !important; border-radius: 8px !important; color: var(--fcom-primary-text, #19283a) !important; }
        /* My Account - dark mode */
        html.dark .woocommerce-account .woocommerce-MyAccount-navigation ul { border-bottom-color: var(--fcom-secondary-border, #A5A9AD) !important; }
        html.dark .woocommerce-account .woocommerce-MyAccount-navigation ul li a { color: var(--fcom-text-off, #A5A9AD) !important; }
        html.dark .woocommerce-account .woocommerce-MyAccount-navigation ul li a:hover { color: var(--fcom-primary-text, #F0F3F5) !important; }
        html.dark .woocommerce-account .woocommerce-MyAccount-navigation ul li.is-active a { color: var(--fcom-primary-text, #F0F3F5) !important; border-bottom-color: var(--fcom-text-link, #60a5fa) !important; }
        html.dark .woocommerce-account .woocommerce-MyAccount-content { background: var(--fcom-secondary-bg, #191B1F) !important; border-color: var(--fcom-primary-border, #42464D) !important; color: var(--fcom-primary-text, #F0F3F5) !important; }
        </style>
        <?php
    }

    /**
     * Get GamiPress credits HTML for mini cart
     *
     * @return string HTML output or empty string
     */
    private function get_gamipress_credits_html() {
        // Show credits if GamiPress is active
        if (!function_exists('gamipress_get_user_points')) return '';
        if (!is_user_logged_in()) return '';

        $user_id = get_current_user_id();

        if (!function_exists('gamipress_get_points_types')) return '';

        $point_types = gamipress_get_points_types();
        if (empty($point_types)) return '';

        $point_type_slug = key($point_types);
        $point_type = $point_types[$point_type_slug];
        $point_type_name = $point_type['plural_name'];

        $point_type_id = isset($point_type['ID']) ? $point_type['ID'] : 0;
        $thumbnail_url = '';
        if ($point_type_id && has_post_thumbnail($point_type_id)) {
            $thumbnail_url = get_the_post_thumbnail_url($point_type_id, array(24, 24));
        }

        $points = gamipress_get_user_points($user_id, $point_type_slug);

        /**
         * Filter the GamiPress achievements URL shown in the mini cart credits section.
         *
         * @since 2.0.0
         * @param string $url The achievements page URL.
         */
        $achievements_url = apply_filters('tbc_cart_gamipress_url', home_url('/'));

        $icon_html = $thumbnail_url
            ? sprintf('<img src="%s" alt="" class="fs_credits_icon">', esc_url($thumbnail_url))
            : '';

        return sprintf(
            '<div class="fs_cart_credits">
                <a href="%s" class="fs_credits_link">
                    <span class="fs_credits_label">%s%s:</span>
                    <span class="fs_credits_amount">%s</span>
                </a>
            </div>',
            esc_url($achievements_url),
            $icon_html,
            esc_html($point_type_name),
            number_format($points)
        );
    }

    /**
     * Render mini cart in Fluent header
     *
     * @param object|null $auth Current user profile
     */
    public function render_mini_cart($auth) {
        if (!WC()->cart) {
            return;
        }

        $cart_count = WC()->cart->get_cart_contents_count();
        $cart_total = WC()->cart->get_cart_subtotal();
        ?>
        <li class="top_menu_item fs_mini_cart_wrap fcom_countable_notification_holder">
            <div class="fs_cart_extend">
                <div class="fs_cart_trigger fcom_menu_button fcom_theme_button">
                    <i class="el-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="9" cy="21" r="1"></circle>
                            <circle cx="20" cy="21" r="1"></circle>
                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                        </svg>
                    </i>
                    <?php if ($cart_count > 0): ?>
                        <sup class="el-badge__content el-badge__content--danger is-fixed"><?php echo esc_html($cart_count); ?></sup>
                    <?php endif; ?>
                </div>
                <div class="fs_cart_dropdown">
                    <?php echo $this->get_gamipress_credits_html(); ?>
                    <?php if ($cart_count > 0): ?>
                        <div class="fs_cart_items">
                            <?php
                            foreach (WC()->cart->get_cart() as $cart_item_key => $cart_item) {
                                $product = $cart_item['data'];
                                $product_name = $product->get_name();
                                $product_price = WC()->cart->get_product_price($product);
                                $quantity = $cart_item['quantity'];
                                $thumbnail = $product->get_image(array(50, 50));
                                $product_permalink = $product->get_permalink();
                                ?>
                                <div class="fs_cart_item">
                                    <a href="<?php echo esc_url($product_permalink); ?>" class="fs_cart_item_img">
                                        <?php echo wp_kses_post($thumbnail); ?>
                                    </a>
                                    <div class="fs_cart_item_details">
                                        <a href="<?php echo esc_url($product_permalink); ?>" class="fs_cart_item_name">
                                            <?php echo esc_html($product_name); ?>
                                        </a>
                                        <span class="fs_cart_item_qty"><?php echo esc_html($quantity); ?> &times; <?php echo wp_kses_post($product_price); ?></span>
                                    </div>
                                    <a href="<?php echo esc_url(wc_get_cart_remove_url($cart_item_key)); ?>" class="fs_cart_item_remove" data-cart-item-key="<?php echo esc_attr($cart_item_key); ?>" aria-label="<?php esc_attr_e('Remove item', 'tbc-cart'); ?>"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/></svg></a>
                                </div>
                                <?php
                            }
                            ?>
                        </div>
                        <div class="fs_cart_footer">
                            <div class="fs_cart_subtotal">
                                <span><?php esc_html_e('Subtotal:', 'tbc-cart'); ?></span>
                                <strong><?php echo wp_kses_post($cart_total); ?></strong>
                            </div>
                            <div class="fs_cart_buttons">
                                <a href="<?php echo esc_url(wc_get_cart_url()); ?>" class="fs_btn fs_btn_secondary"><?php esc_html_e('View Cart', 'tbc-cart'); ?></a>
                                <a href="<?php echo esc_url(wc_get_checkout_url()); ?>" class="fs_btn fs_btn_primary"><?php esc_html_e('Checkout', 'tbc-cart'); ?></a>
                            </div>
                        </div>
                    <?php else: ?>
                        <div class="fs_cart_empty">
                            <p><?php esc_html_e('Your cart is empty.', 'tbc-cart'); ?></p>
                            <a href="<?php echo esc_url(wc_get_page_permalink('shop')); ?>" class="fs_btn fs_btn_primary"><?php esc_html_e('Browse Events', 'tbc-cart'); ?></a>
                        </div>
                    <?php endif; ?>
                </div>
            </div>
        </li>
        <?php
    }

    /**
     * Render WooCommerce page content within Fluent frame
     *
     * @param string $wrapperType The wrapper type ('default' or 'full')
     */
    private function render_wc_page_content($wrapperType = 'default') {
        $this->output_wc_component_css();

        $classes = ['fs_wc_content', 'woocommerce'];

        if (function_exists('is_shop') && is_shop()) {
            $classes[] = 'fs_wc_shop';
        } elseif (function_exists('is_product') && is_product()) {
            $classes[] = 'fs_wc_product';
        } elseif (function_exists('is_cart') && is_cart()) {
            $classes[] = 'fs_wc_cart';
        } elseif (function_exists('is_checkout') && is_checkout()) {
            $classes[] = 'fs_wc_checkout';
        } elseif (function_exists('is_account_page') && is_account_page()) {
            $classes[] = 'fs_wc_account';
        }

        echo '<div class="' . esc_attr(implode(' ', $classes)) . '">';

        if (function_exists('is_cart') && (is_cart() || is_checkout() || is_account_page())) {
            if (have_posts()) {
                while (have_posts()) {
                    the_post();
                    the_content();
                }
            }
        } else {
            woocommerce_content();
        }

        echo '</div>';
    }

    /**
     * AJAX cart fragments for mini cart updates
     */
    public function cart_fragments($fragments) {
        ob_start();
        $this->render_mini_cart([]);
        $fragments['.fs_mini_cart_wrap'] = ob_get_clean();
        return $fragments;
    }
}
