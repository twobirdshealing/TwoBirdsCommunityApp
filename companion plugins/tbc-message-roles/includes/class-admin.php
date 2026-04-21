<?php
/**
 * Admin Class
 * WordPress admin page for role-based messaging restrictions.
 *
 * @package TBC_Message_Roles
 */

namespace TBCMsgR;

defined('ABSPATH') || exit;

class Admin {

    /**
     * Add admin menu — submenu under TBC Community App if available, standalone otherwise.
     */
    public function add_admin_menu() {
        if (defined('TBC_CA_PLUGIN_DIR')) {
            add_submenu_page(
                'tbc-community-app',
                __('Message Roles', 'tbc-msgr'),
                __('Message Roles', 'tbc-msgr'),
                'manage_options',
                'tbc-message-roles',
                [$this, 'admin_page']
            );
        } else {
            add_menu_page(
                __('TBC Message Roles', 'tbc-msgr'),
                __('TBC Message Roles', 'tbc-msgr'),
                'manage_options',
                'tbc-message-roles',
                [$this, 'admin_page'],
                'dashicons-lock',
                31
            );
        }
    }

    /**
     * Register settings
     */
    public function register_settings() {
        register_setting('tbc_msgr_settings', TBC_MSGR_OPTION_PREFIX . 'enabled');
        register_setting('tbc_msgr_settings', TBC_MSGR_OPTION_PREFIX . 'always_messageable_roles', [
            'type'              => 'array',
            'sanitize_callback' => [$this, 'sanitize_roles'],
        ]);
        register_setting('tbc_msgr_settings', TBC_MSGR_OPTION_PREFIX . 'always_messageable_fc_roles', [
            'type'              => 'array',
            'sanitize_callback' => [$this, 'sanitize_roles'],
        ]);
        register_setting('tbc_msgr_settings', TBC_MSGR_OPTION_PREFIX . 'always_messageable_space_roles', [
            'type'              => 'array',
            'sanitize_callback' => [$this, 'sanitize_roles'],
        ]);
        register_setting('tbc_msgr_settings', TBC_MSGR_OPTION_PREFIX . 'dm_roles', [
            'type'              => 'array',
            'sanitize_callback' => [$this, 'sanitize_roles'],
        ]);
        register_setting('tbc_msgr_settings', TBC_MSGR_OPTION_PREFIX . 'dm_fc_roles', [
            'type'              => 'array',
            'sanitize_callback' => [$this, 'sanitize_roles'],
        ]);
        register_setting('tbc_msgr_settings', TBC_MSGR_OPTION_PREFIX . 'dm_space_roles', [
            'type'              => 'array',
            'sanitize_callback' => [$this, 'sanitize_roles'],
        ]);
        register_setting('tbc_msgr_settings', TBC_MSGR_OPTION_PREFIX . 'community_roles', [
            'type'              => 'array',
            'sanitize_callback' => [$this, 'sanitize_roles'],
        ]);
        register_setting('tbc_msgr_settings', TBC_MSGR_OPTION_PREFIX . 'community_fc_roles', [
            'type'              => 'array',
            'sanitize_callback' => [$this, 'sanitize_roles'],
        ]);
        register_setting('tbc_msgr_settings', TBC_MSGR_OPTION_PREFIX . 'community_space_roles', [
            'type'              => 'array',
            'sanitize_callback' => [$this, 'sanitize_roles'],
        ]);

        // Fix unchecked checkbox
        add_action('admin_init', [$this, 'fix_checkbox_saves'], 99);
    }

    /**
     * Sanitize role array input.
     *
     * @param mixed $input Raw input.
     * @return array Sanitized role slugs.
     */
    public function sanitize_roles($input) {
        if (!is_array($input)) {
            return [];
        }
        return array_map('sanitize_text_field', $input);
    }

    /**
     * Fix checkbox not saving when unchecked.
     */
    public function fix_checkbox_saves() {
        // phpcs:ignore WordPress.Security.NonceVerification.Missing
        $option_page = $_POST['option_page'] ?? '';

        if ($option_page !== 'tbc_msgr_settings') {
            return;
        }

        $option_name = TBC_MSGR_OPTION_PREFIX . 'enabled';
        // phpcs:ignore WordPress.Security.NonceVerification.Missing
        if (!isset($_POST[$option_name])) {
            update_option($option_name, '0');
        }
    }

    /**
     * Enqueue admin assets
     */
    public function admin_assets($hook) {
        if (strpos($hook, 'tbc-message-roles') === false) {
            return;
        }

        wp_enqueue_style(
            'tbc-msgr-admin',
            TBC_MSGR_URL . 'assets/css/admin.css',
            [],
            tbc_msgr_asset_ver('assets/css/admin.css')
        );
    }

    /**
     * Render admin page
     */
    public function admin_page() {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have sufficient permissions.', 'tbc-msgr'));
        }

        require_once TBC_MSGR_DIR . 'views/admin-fields.php';
    }

    /**
     * Get WordPress roles.
     *
     * @param bool $include_admin Include administrator role (default: true).
     * @return array [ 'slug' => 'Display Name', ... ]
     */
    public static function get_roles(bool $include_admin = true): array {
        $wp_roles = wp_roles();
        $roles = [];

        foreach ($wp_roles->role_names as $slug => $name) {
            if (!$include_admin && $slug === 'administrator') {
                continue;
            }
            $roles[$slug] = translate_user_role($name);
        }

        return $roles;
    }
}
