<?php
/**
 * Admin Class - Settings page for TBC YouTube
 *
 * @package TBC_YouTube
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_YT_Admin {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_init', [$this, 'register_settings']);
    }

    /**
     * Add admin menu — under TBC Community App parent if available, else standalone top-level
     */
    public function add_admin_menu() {
        if (defined('TBC_CA_PLUGIN_DIR')) {
            add_submenu_page(
                'tbc-community-app',
                __('YouTube', 'tbc-youtube'),
                __('YouTube', 'tbc-youtube'),
                'manage_options',
                'tbc-youtube',
                [$this, 'admin_page']
            );
        } else {
            add_menu_page(
                __('TBC YouTube', 'tbc-youtube'),
                __('TBC YouTube', 'tbc-youtube'),
                'manage_options',
                'tbc-youtube',
                [$this, 'admin_page'],
                'dashicons-youtube',
                32
            );
        }
    }

    /**
     * Register settings
     */
    public function register_settings() {
        register_setting('tbc_youtube_settings', 'tbc_youtube_settings', [
            'sanitize_callback' => [$this, 'sanitize_settings'],
        ]);
    }

    /**
     * Sanitize settings on save
     */
    public function sanitize_settings($input) {
        $sanitized = [];

        $sanitized['api_key'] = isset($input['api_key'])
            ? sanitize_text_field($input['api_key'])
            : '';

        $sanitized['channel_id'] = isset($input['channel_id'])
            ? sanitize_text_field($input['channel_id'])
            : '';

        $sanitized['channel_url'] = isset($input['channel_url'])
            ? esc_url_raw($input['channel_url'])
            : '';

        $sanitized['delete_data_on_uninstall'] = !empty($input['delete_data_on_uninstall']);

        // Clear cache if requested
        if (!empty($input['clear_cache'])) {
            TBC_YT_API::get_instance()->clear_cache();
            add_settings_error('tbc_youtube_settings', 'cache_cleared', __('YouTube cache cleared.', 'tbc-youtube'), 'success');
        }

        return $sanitized;
    }

    /**
     * Render admin page
     */
    public function admin_page() {
        if (!current_user_can('manage_options')) {
            return;
        }

        $settings = get_option('tbc_youtube_settings', []);
        $api_key     = $settings['api_key'] ?? '';
        $channel_id  = $settings['channel_id'] ?? '';
        $channel_url = $settings['channel_url'] ?? '';
        ?>
        <div class="wrap">
            <h1><?php _e('TBC YouTube Settings', 'tbc-youtube'); ?></h1>
            <p class="description"><?php _e('YouTube Data API v3 integration for the TBC Community App.', 'tbc-youtube'); ?></p>

            <?php settings_errors('tbc_youtube_settings'); ?>

            <form method="post" action="options.php">
                <?php settings_fields('tbc_youtube_settings'); ?>

                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row">
                            <label for="tbc_yt_api_key"><?php _e('YouTube API Key', 'tbc-youtube'); ?></label>
                        </th>
                        <td>
                            <input type="password"
                                   id="tbc_yt_api_key"
                                   name="tbc_youtube_settings[api_key]"
                                   autocomplete="off"
                                   value="<?php echo esc_attr($api_key); ?>"
                                   class="large-text"
                                   placeholder="<?php esc_attr_e('AIzaSy...', 'tbc-youtube'); ?>" />
                            <p class="description">
                                <?php _e('Get a key from the <a href="https://console.cloud.google.com/apis/credentials" target="_blank">Google Cloud Console</a> with YouTube Data API v3 enabled.', 'tbc-youtube'); ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <label for="tbc_yt_channel_id"><?php _e('Channel ID', 'tbc-youtube'); ?></label>
                        </th>
                        <td>
                            <input type="text"
                                   id="tbc_yt_channel_id"
                                   name="tbc_youtube_settings[channel_id]"
                                   value="<?php echo esc_attr($channel_id); ?>"
                                   class="regular-text"
                                   placeholder="UCxxxxxxxxxxxxxxxxxxxxxxxxx" />
                            <p class="description">
                                <?php _e('YouTube channel ID (starts with UC). Required — find it at <a href="https://www.youtube.com/account_advanced" target="_blank">youtube.com/account_advanced</a>.', 'tbc-youtube'); ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <label for="tbc_yt_channel_url"><?php _e('Channel URL', 'tbc-youtube'); ?></label>
                        </th>
                        <td>
                            <input type="url"
                                   id="tbc_yt_channel_url"
                                   name="tbc_youtube_settings[channel_url]"
                                   value="<?php echo esc_attr($channel_url); ?>"
                                   class="large-text"
                                   placeholder="https://www.youtube.com/c/yourchannel" />
                            <p class="description">
                                <?php _e('YouTube channel page URL. Used for the "Subscribe" button in the mobile app. Tip: add <code>?sub_confirmation=1</code> to prompt users to subscribe.', 'tbc-youtube'); ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><?php _e('Cache', 'tbc-youtube'); ?></th>
                        <td>
                            <label>
                                <input type="checkbox"
                                       name="tbc_youtube_settings[clear_cache]"
                                       value="1" />
                                <?php _e('Clear YouTube cache on save', 'tbc-youtube'); ?>
                            </label>
                            <p class="description">
                                <?php _e('YouTube data is cached for 6 hours. Check this box and save to clear the cache immediately.', 'tbc-youtube'); ?>
                            </p>
                        </td>
                    </tr>
                </table>

                <hr />
                <h2><?php _e('API Endpoints', 'tbc-youtube'); ?></h2>
                <p class="description"><?php _e('These public REST endpoints are available for the mobile app (no authentication required):', 'tbc-youtube'); ?></p>
                <table class="widefat striped" style="max-width: 700px;">
                    <thead>
                        <tr>
                            <th><?php _e('Endpoint', 'tbc-youtube'); ?></th>
                            <th><?php _e('Description', 'tbc-youtube'); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><code>/wp-json/tbc-yt/v1/latest</code></td>
                            <td><?php _e('Latest uploads from channel', 'tbc-youtube'); ?></td>
                        </tr>
                        <tr>
                            <td><code>/wp-json/tbc-yt/v1/playlists</code></td>
                            <td><?php _e('All channel playlists', 'tbc-youtube'); ?></td>
                        </tr>
                        <tr>
                            <td><code>/wp-json/tbc-yt/v1/playlists/{id}/videos</code></td>
                            <td><?php _e('Videos in a specific playlist', 'tbc-youtube'); ?></td>
                        </tr>
                        <tr>
                            <td><code>/wp-json/tbc-yt/v1/config</code></td>
                            <td><?php _e('Module config (channel URL)', 'tbc-youtube'); ?></td>
                        </tr>
                    </tbody>
                </table>
                <p class="description" style="margin-top: 8px;">
                    <?php _e('Legacy endpoints under <code>/wp-json/tbc-ca/v1/youtube/*</code> are also registered for backward compatibility.', 'tbc-youtube'); ?>
                </p>

                <hr />
                <h2><?php _e('Data Management', 'tbc-youtube'); ?></h2>
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><?php _e('Uninstall Behavior', 'tbc-youtube'); ?></th>
                        <td>
                            <label>
                                <input type="checkbox"
                                       name="tbc_youtube_settings[delete_data_on_uninstall]"
                                       value="1"
                                       <?php checked(!empty($settings['delete_data_on_uninstall'])); ?> />
                                <?php _e('Delete all plugin data when uninstalled', 'tbc-youtube'); ?>
                            </label>
                            <p class="description">
                                <?php _e('When enabled, uninstalling this plugin will permanently remove all settings and cached data. Leave unchecked to preserve data if reinstalling later.', 'tbc-youtube'); ?>
                            </p>
                        </td>
                    </tr>
                </table>

                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }
}
