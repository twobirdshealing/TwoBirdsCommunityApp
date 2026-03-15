<?php
/**
 * Admin Class
 * Handles admin settings page for TBC Multi Reactions
 *
 * @package TBC_Multi_Reactions
 */

namespace TBCMultiReactions;

defined('ABSPATH') || exit;

class Admin {

    public function __construct() {
        // Empty constructor
    }

    /**
     * Add admin menu — under TBC Community App parent if available, else standalone top-level
     */
    public function add_admin_menu() {
        if (defined('TBC_CA_PLUGIN_DIR')) {
            add_submenu_page(
                'tbc-community-app',
                __('Multi Reactions', 'tbc-multi-reactions'),
                __('Multi Reactions', 'tbc-multi-reactions'),
                'manage_options',
                'tbc-multi-reactions',
                [$this, 'admin_page']
            );
        } else {
            add_menu_page(
                __('TBC Multi Reactions', 'tbc-multi-reactions'),
                __('TBC Multi Reactions', 'tbc-multi-reactions'),
                'manage_options',
                'tbc-multi-reactions',
                [$this, 'admin_page'],
                'dashicons-smiley',
                32
            );
        }
    }

    /**
     * Register settings
     */
    public function register_settings() {
        register_setting('tbc_mr_settings', 'tbc_mr_settings', [
            'sanitize_callback' => [$this, 'sanitize_settings'],
        ]);

        self::initialize_default_settings();
    }

    /**
     * Sanitize settings on save
     *
     * The 6 reaction type IDs are fixed and permanent. Admin can update
     * label, emoji, color, icon, enabled, and order — but cannot add or delete slots.
     */
    public function sanitize_settings($input) {
        if (!is_array($input)) {
            $input = [];
        }

        $defaults = self::get_default_reaction_types();
        $fixed_keys = array_keys($defaults);

        $existing = get_option('tbc_mr_settings', []);
        if (!is_array($existing)) {
            $existing = [];
        }

        $reaction_types = isset($existing['reaction_types']) && is_array($existing['reaction_types'])
            ? $existing['reaction_types']
            : $defaults;

        $output = [];
        $output['enabled'] = isset($input['enabled']) && $input['enabled'] === '1';

        // Process submitted reaction types — only accept the 6 fixed keys
        if (isset($input['reaction_types']) && is_array($input['reaction_types'])) {
            foreach ($input['reaction_types'] as $id => $reaction) {
                $id = sanitize_key($id);

                // Ignore any keys that aren't in our fixed set
                if (!in_array($id, $fixed_keys, true)) {
                    continue;
                }

                // Use existing data as base, fall back to defaults
                if (!isset($reaction_types[$id])) {
                    $reaction_types[$id] = $defaults[$id];
                }

                $reaction_types[$id]['name'] = isset($reaction['name'])
                    ? sanitize_text_field($reaction['name'])
                    : $reaction_types[$id]['name'];

                if (isset($reaction['emoji'])) {
                    $emoji_input = sanitize_text_field($reaction['emoji']);
                    if (strpos($emoji_input, '&#') === false && mb_strlen($emoji_input, 'UTF-8') <= 4) {
                        $emoji_input = mb_encode_numericentity($emoji_input, [0x0, 0x10FFFF, 0, 0xFFFFFF], 'UTF-8');
                    }
                    $reaction_types[$id]['emoji'] = $emoji_input;
                }

                $reaction_types[$id]['color'] = isset($reaction['color'])
                    ? sanitize_hex_color($reaction['color'])
                    : $reaction_types[$id]['color'];

                $reaction_types[$id]['enabled'] = isset($reaction['enabled']) && $reaction['enabled'] === '1';

                $reaction_types[$id]['order'] = isset($reaction['order'])
                    ? absint($reaction['order'])
                    : ($reaction_types[$id]['order'] ?? 999);

                // Handle icon (FC Media ID)
                if (isset($reaction['media_id'])) {
                    $media_id = absint($reaction['media_id']);
                    $old_media_id = absint($reaction_types[$id]['media_id'] ?? 0);

                    if ($media_id) {
                        $validation = Icons::validate_icon($media_id);
                        if ($validation === true) {
                            if ($old_media_id && $old_media_id !== $media_id) {
                                Icons::delete_icon($old_media_id);
                            }
                            $reaction_types[$id]['media_id'] = $media_id;
                            $reaction_types[$id]['icon_url'] = Icons::get_icon_url($media_id);
                        }
                    } else {
                        if ($old_media_id) {
                            Icons::delete_icon($old_media_id);
                        }
                        $reaction_types[$id]['media_id'] = 0;
                        $reaction_types[$id]['icon_url'] = '';
                    }
                }
            }
        }

        // Ensure all 6 fixed keys always exist (re-add any missing with defaults)
        foreach ($defaults as $id => $default) {
            if (!isset($reaction_types[$id])) {
                $reaction_types[$id] = $default;
            }
        }

        // Remove any non-fixed keys that may exist from old data
        $reaction_types = array_intersect_key($reaction_types, $defaults);

        $output['reaction_types'] = $reaction_types;
        $output['delete_data_on_uninstall'] = isset($input['delete_data_on_uninstall']) && $input['delete_data_on_uninstall'] === '1';
        return $output;
    }

    /**
     * Enqueue admin assets
     */
    public function admin_assets($hook) {
        if (strpos($hook, 'tbc-multi-reactions') === false) {
            return;
        }

        wp_enqueue_style('wp-color-picker');
        wp_enqueue_script('jquery-ui-sortable');

        wp_enqueue_style(
            'tbc-mr-admin',
            TBC_MR_URL . 'assets/css/admin.css',
            [],
            TBC_MR_VERSION
        );

        wp_enqueue_script(
            'tbc-mr-admin',
            TBC_MR_URL . 'assets/js/admin.js',
            ['jquery', 'wp-color-picker', 'jquery-ui-sortable'],
            TBC_MR_VERSION,
            true
        );

        wp_localize_script('tbc-mr-admin', 'tbcMrAdmin', [
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce'   => wp_create_nonce('tbc_mr_nonce'),
        ]);

        // Inject FC theme CSS variables for admin page styling
        if (class_exists('\FluentCommunity\App\Functions\Utility')) {
            $css = \FluentCommunity\App\Functions\Utility::getColorCssVariables();
            if ($css) {
                wp_add_inline_style('tbc-mr-admin', $css);
            }
        }
    }

    /**
     * Get the 6 fixed reaction types aligned with Fluent Messaging 2.2.0
     *
     * Type IDs are permanent and stored in DB (tbc_mr_reaction_type column).
     * Labels and emojis are display defaults — admin can customize freely.
     */
    public static function get_default_reaction_types() {
        return [
            'heart' => [
                'name' => 'Love',
                'emoji' => '&#10084;&#65039;',
                'color' => '#F02849',
                'enabled' => true,
                'order' => 1,
                'media_id' => 0,
                'icon_url' => '',
            ],
            'thumbsup' => [
                'name' => 'Like',
                'emoji' => '&#128077;',
                'color' => '#1877F2',
                'enabled' => true,
                'order' => 2,
                'media_id' => 0,
                'icon_url' => '',
            ],
            'laugh' => [
                'name' => 'Laugh',
                'emoji' => '&#128514;',
                'color' => '#FEEB30',
                'enabled' => true,
                'order' => 3,
                'media_id' => 0,
                'icon_url' => '',
            ],
            'wow' => [
                'name' => 'Wow',
                'emoji' => '&#128558;',
                'color' => '#FEEB30',
                'enabled' => true,
                'order' => 4,
                'media_id' => 0,
                'icon_url' => '',
            ],
            'cry' => [
                'name' => 'Sad',
                'emoji' => '&#128546;',
                'color' => '#FEEB30',
                'enabled' => true,
                'order' => 5,
                'media_id' => 0,
                'icon_url' => '',
            ],
            'party' => [
                'name' => 'Party',
                'emoji' => '&#127881;',
                'color' => '#F59E0B',
                'enabled' => true,
                'order' => 6,
                'media_id' => 0,
                'icon_url' => '',
            ],
        ];
    }

    /**
     * Initialize default settings if they don't exist.
     * Ensures all 6 fixed reaction keys are present on every load.
     */
    public static function initialize_default_settings() {
        $defaults = self::get_default_reaction_types();
        $settings = get_option('tbc_mr_settings', false);

        if ($settings === false) {
            $settings = [
                'reaction_types' => $defaults,
                'enabled' => false,
            ];
            add_option('tbc_mr_settings', $settings, '', 'yes');
        } else {
            $needs_update = false;

            if (empty($settings['reaction_types']) || !is_array($settings['reaction_types'])) {
                $settings['reaction_types'] = $defaults;
                $needs_update = true;
            } else {
                // Ensure all 6 fixed keys exist, add missing ones with defaults
                foreach ($defaults as $id => $default) {
                    if (!isset($settings['reaction_types'][$id])) {
                        $settings['reaction_types'][$id] = $default;
                        $needs_update = true;
                    }
                }
                // Remove any non-fixed keys from old data
                $old_count = count($settings['reaction_types']);
                $settings['reaction_types'] = array_intersect_key($settings['reaction_types'], $defaults);
                if (count($settings['reaction_types']) !== $old_count) {
                    $needs_update = true;
                }
            }

            if ($needs_update) {
                update_option('tbc_mr_settings', $settings);
            }
        }

        return $settings;
    }

    /**
     * Admin page callback
     */
    public function admin_page() {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have sufficient permissions.', 'tbc-multi-reactions'));
        }

        // Handle manual save
        if (isset($_POST['submit']) && isset($_POST['tbc_mr_settings']) && check_admin_referer('tbc_mr_settings-options')) {
            $sanitized = $this->sanitize_settings(wp_unslash($_POST['tbc_mr_settings'])); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Sanitized in sanitize_settings().
            update_option('tbc_mr_settings', $sanitized);
            add_settings_error('tbc_mr_settings', 'settings_updated', __('Settings saved.', 'tbc-multi-reactions'), 'updated');
        }

        $settings = get_option('tbc_mr_settings', []);
        if (empty($settings) || !is_array($settings)) {
            $settings = self::initialize_default_settings();
        }

        require_once TBC_MR_DIR . 'views/admin-settings.php';
    }
}
