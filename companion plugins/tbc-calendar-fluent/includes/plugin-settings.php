<?php
/**
 * TBC WooCommerce Calendar - Plugin Settings
 *
 * Global settings page for the calendar plugin.
 *
 * @package TBC_WC_Calendar
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Add settings page under WooCommerce menu
 */
function tbc_wc_add_settings_page() {
    add_submenu_page(
        'woocommerce',
        'Calendar Settings',
        'Calendar Settings',
        'manage_woocommerce',
        'tbc-wc-calendar-settings',
        'tbc_wc_render_settings_page'
    );
}
add_action('admin_menu', 'tbc_wc_add_settings_page');

/**
 * Register all plugin settings
 */
function tbc_wc_register_settings() {
    // Google Maps API Key
    register_setting('tbc_wc_calendar_settings', 'tbc_wc_google_maps_api_key', [
        'type' => 'string',
        'default' => '',
        'sanitize_callback' => 'sanitize_text_field'
    ]);
}
add_action('admin_init', 'tbc_wc_register_settings');

/**
 * Render the settings page
 */
function tbc_wc_render_settings_page() {
    $google_maps_key = get_option('tbc_wc_google_maps_api_key', '');
    ?>
    <div class="wrap">
        <h1>Calendar Settings</h1>

        <form method="post" action="options.php">
            <?php settings_fields('tbc_wc_calendar_settings'); ?>

            <h2>Google Maps</h2>
            <table class="form-table" role="presentation">
                <tbody>
                    <tr>
                        <th scope="row">
                            <label for="tbc_wc_google_maps_api_key">API Key</label>
                        </th>
                        <td>
                            <input type="text"
                                   name="tbc_wc_google_maps_api_key"
                                   id="tbc_wc_google_maps_api_key"
                                   value="<?php echo esc_attr($google_maps_key); ?>"
                                   class="regular-text"
                                   placeholder="AIzaSy...">
                            <p class="description">
                                Enter your Google Maps API key to enable location maps on event pages.
                                <a href="https://developers.google.com/maps/documentation/javascript/get-api-key" target="_blank">Get an API key</a>
                            </p>
                        </td>
                    </tr>
                </tbody>
            </table>

            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}
