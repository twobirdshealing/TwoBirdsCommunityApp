<?php
/**
 * WooCommerce Settings Page
 *
 * Registers admin settings page under TBC Community App menu (or WooCommerce as fallback)
 * and provides helper functions to retrieve settings.
 *
 * Settings are stored as wp_options.
 *
 * @package TBC_Cart
 * @since 2.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_Cart_WC_Settings {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('admin_menu', array($this, 'add_menu'));
        add_action('admin_init', array($this, 'register_settings'));
    }

    /**
     * Add settings page under TBC Community App menu (or WooCommerce as fallback)
     */
    public function add_menu() {
        // Try TBC Community App parent menu first (registered at priority 9)
        global $menu;
        $parent_slug = null;

        foreach ((array) $menu as $item) {
            if (isset($item[2]) && $item[2] === 'tbc-community-app') {
                $parent_slug = 'tbc-community-app';
                break;
            }
        }

        // Fallback to WooCommerce menu if TBC Community App not available
        if (!$parent_slug) {
            $parent_slug = 'woocommerce';
        }

        add_submenu_page(
            $parent_slug,
            __('Cart & WooCommerce', 'tbc-cart'),
            __('Cart & WooCommerce', 'tbc-cart'),
            'manage_options',
            'tbc-cart-settings',
            array($this, 'render_page')
        );
    }

    /**
     * Register settings with WordPress Settings API
     */
    public function register_settings() {
        // Fluent Community Integration section
        add_settings_section(
            'tbc_cart_fluent_section',
            __('Fluent Community Integration', 'tbc-cart'),
            array($this, 'render_fluent_section'),
            'tbc-cart-settings'
        );

        // Enable WooCommerce Integration
        register_setting('tbc_cart_settings', 'tbc_cart_wc_integration', array(
            'type'              => 'boolean',
            'default'           => false,
            'sanitize_callback' => array($this, 'sanitize_checkbox'),
        ));

        add_settings_field(
            'tbc_cart_wc_integration',
            __('Enable WooCommerce Integration', 'tbc-cart'),
            array($this, 'render_checkbox'),
            'tbc-cart-settings',
            'tbc_cart_fluent_section',
            array(
                'id'          => 'tbc_cart_wc_integration',
                'default'     => false,
                'description' => __('Display shop and product pages within Fluent Community frame.', 'tbc-cart'),
            )
        );

        // WooCommerce Template
        register_setting('tbc_cart_settings', 'tbc_cart_wc_template', array(
            'type'              => 'string',
            'default'           => 'frame-full',
            'sanitize_callback' => array($this, 'sanitize_template_choice'),
        ));

        add_settings_field(
            'tbc_cart_wc_template',
            __('WooCommerce Template', 'tbc-cart'),
            array($this, 'render_select'),
            'tbc-cart-settings',
            'tbc_cart_fluent_section',
            array(
                'id'          => 'tbc_cart_wc_template',
                'default'     => 'frame-full',
                'description' => __('Choose the Fluent Community frame template for WooCommerce pages.', 'tbc-cart'),
                'choices'     => array(
                    'frame'      => __('Fluent Community Frame (Constrained Width)', 'tbc-cart'),
                    'frame-full' => __('Fluent Community Frame Full Width', 'tbc-cart'),
                ),
            )
        );

        // Mini Cart section
        add_settings_section(
            'tbc_cart_mini_cart_section',
            __('Mini Cart', 'tbc-cart'),
            array($this, 'render_mini_cart_section'),
            'tbc-cart-settings'
        );

        // Show Mini Cart in Header
        register_setting('tbc_cart_settings', 'tbc_cart_wc_mini_cart', array(
            'type'              => 'boolean',
            'default'           => true,
            'sanitize_callback' => array($this, 'sanitize_checkbox'),
        ));

        add_settings_field(
            'tbc_cart_wc_mini_cart',
            __('Show Mini Cart in Header', 'tbc-cart'),
            array($this, 'render_checkbox'),
            'tbc-cart-settings',
            'tbc_cart_mini_cart_section',
            array(
                'id'          => 'tbc_cart_wc_mini_cart',
                'default'     => true,
                'description' => __('Display a mini cart dropdown in the Fluent Community header.', 'tbc-cart'),
            )
        );

        // Data Management section
        add_settings_section(
            'tbc_cart_data_section',
            __('Data Management', 'tbc-cart'),
            array($this, 'render_data_section'),
            'tbc-cart-settings'
        );

        register_setting('tbc_cart_settings', 'tbc_cart_delete_data_on_uninstall', array(
            'type'              => 'boolean',
            'default'           => false,
            'sanitize_callback' => array($this, 'sanitize_checkbox'),
        ));

        add_settings_field(
            'tbc_cart_delete_data_on_uninstall',
            __('Uninstall Behavior', 'tbc-cart'),
            array($this, 'render_checkbox'),
            'tbc-cart-settings',
            'tbc_cart_data_section',
            array(
                'id'          => 'tbc_cart_delete_data_on_uninstall',
                'default'     => false,
                'description' => __('Delete all plugin settings when uninstalled. Leave disabled if uninstalling for testing.', 'tbc-cart'),
            )
        );
    }

    /**
     * Render section descriptions
     */
    public function render_fluent_section() {
        if (!tbc_cart_has_fluent_community()) {
            echo '<p style="color: #d63638;">' . esc_html__('Fluent Community is not active. These settings require the Fluent Community plugin.', 'tbc-cart') . '</p>';
            return;
        }
        echo '<p>' . esc_html__('Control how WooCommerce pages appear inside the Fluent Community frame.', 'tbc-cart') . '</p>';
    }

    public function render_mini_cart_section() {
        echo '<p>' . esc_html__('Configure the mini cart dropdown in the Fluent Community header.', 'tbc-cart') . '</p>';
    }

    public function render_data_section() {
        echo '<p>' . esc_html__('Control what happens to plugin settings when the plugin is uninstalled.', 'tbc-cart') . '</p>';
    }

    /**
     * Render a checkbox field
     */
    public function render_checkbox($args) {
        $id = $args['id'];
        $default = isset($args['default']) ? $args['default'] : false;
        $value = get_option($id, $default);
        printf(
            '<label><input type="checkbox" id="%s" name="%s" value="1" %s /> %s</label>',
            esc_attr($id),
            esc_attr($id),
            checked($value, true, false),
            esc_html($args['description'])
        );
    }

    /**
     * Render a select field
     */
    public function render_select($args) {
        $id = $args['id'];
        $default = isset($args['default']) ? $args['default'] : '';
        $value = get_option($id, $default);
        printf('<select id="%s" name="%s">', esc_attr($id), esc_attr($id));
        foreach ($args['choices'] as $key => $label) {
            printf(
                '<option value="%s" %s>%s</option>',
                esc_attr($key),
                selected($value, $key, false),
                esc_html($label)
            );
        }
        echo '</select>';
        if (!empty($args['description'])) {
            printf('<p class="description">%s</p>', esc_html($args['description']));
        }
    }

    /**
     * Render the settings page
     */
    public function render_page() {
        if (!current_user_can('manage_options')) {
            return;
        }
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            <form action="options.php" method="post">
                <?php
                settings_fields('tbc_cart_settings');
                do_settings_sections('tbc-cart-settings');
                submit_button();
                ?>
            </form>
        </div>
        <?php
    }

    /**
     * Sanitize checkbox values
     */
    public function sanitize_checkbox($checked) {
        return ((isset($checked) && true == $checked) ? true : false);
    }

    /**
     * Sanitize template choice
     */
    public function sanitize_template_choice($choice) {
        $valid = array('frame', 'frame-full');
        return in_array($choice, $valid, true) ? $choice : 'frame';
    }
}

// ==========================================================================
// Global Helper Functions
// ==========================================================================

/**
 * Check if WooCommerce Fluent integration is enabled
 *
 * @return bool
 */
function tbc_cart_wc_integration_enabled() {
    if (!class_exists('WooCommerce')) {
        return false;
    }
    return (bool) get_option('tbc_cart_wc_integration', false);
}

/**
 * Get the WooCommerce template file
 *
 * @return string Template filename
 */
function tbc_cart_get_wc_template() {
    $template = get_option('tbc_cart_wc_template', 'frame-full');
    return $template === 'frame-full'
        ? 'fluent-community-frame-full.php'
        : 'fluent-community-frame.php';
}

/**
 * Check if mini cart should be shown
 *
 * @return bool
 */
function tbc_cart_show_mini_cart() {
    if (!tbc_cart_wc_integration_enabled()) {
        return false;
    }
    return (bool) get_option('tbc_cart_wc_mini_cart', true);
}

/**
 * Check if current page is a WooCommerce page
 *
 * @return bool
 */
function tbc_cart_is_wc_page() {
    if (!function_exists('is_woocommerce')) {
        return false;
    }
    return is_woocommerce() || is_cart() || is_checkout() || is_account_page();
}

/**
 * Check if Fluent Community is active
 *
 * @return bool
 */
function tbc_cart_has_fluent_community() {
    return defined('FLUENT_COMMUNITY_PLUGIN_VERSION') || function_exists('fluentCommunityApp');
}

