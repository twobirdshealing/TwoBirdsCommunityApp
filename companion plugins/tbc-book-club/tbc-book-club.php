<?php
/**
 * Plugin Name: TBC - Book Club Manager
 * Plugin URI: https://twobirdscode.com
 * Description: Manages and displays book club audiobooks with chapter support, progress tracking, and bookmarks.
 * Version: 2.3.1
 * Author: Two Birds Code
 * Author URI: https://twobirdscode.com
 *
 * @see CHANGELOG.md for version history
 */

if (!defined('ABSPATH')) {
    exit;
}

class Tbc_Bc_Audiobook {
    private static $instance = null;
    const VERSION = '2.3.1';
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        require_once plugin_dir_path(__FILE__) . 'includes/book-helpers.php';
        require_once plugin_dir_path(__FILE__) . 'includes/book-ajax.php';
        require_once plugin_dir_path(__FILE__) . 'includes/class-rest-api.php';
        new Tbc_Bc_Ajax_Handlers();
        Tbc_Bc_Rest_API::get_instance();

        add_action('init', array($this, 'init'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_enqueue_scripts', array($this, 'admin_scripts'));
        add_action('wp_ajax_tbc_bc_save_uninstall_pref', array($this, 'ajax_save_uninstall_pref'));
    }
    
    public function init() {}

    /**
     * AJAX handler: save uninstall data preference
     */
    public function ajax_save_uninstall_pref() {
        check_ajax_referer('tbc_bc_data_mgmt');

        if (!current_user_can('manage_options')) {
            wp_send_json_error('Unauthorized', 403);
        }

        $value = isset($_POST['value']) && $_POST['value'] === '1';
        update_option('tbc_bc_delete_data_on_uninstall', $value);
        wp_send_json_success();
    }

    public static function activate() {
        require_once plugin_dir_path(__FILE__) . 'includes/book-database-create.php';
        tbc_bc_create_tables();
    }
    
    public function add_admin_menu() {
        if (defined('TBC_CA_PLUGIN_DIR')) {
            add_submenu_page(
                'tbc-community-app',
                'Book Club Manager',
                'Book Club',
                'manage_options',
                'tbc-bc-manager',
                array($this, 'render_admin_page')
            );
        } else {
            add_menu_page(
                'Book Club Manager',
                'Book Club',
                'manage_options',
                'tbc-bc-manager',
                array($this, 'render_admin_page'),
                'dashicons-book-alt'
            );
        }
    }

    public function admin_scripts($hook) {
        if (strpos($hook, 'tbc-bc-manager') === false) {
            return;
        }
        
        wp_enqueue_media();
        wp_enqueue_script('jquery-ui-sortable');
        
        wp_enqueue_style(
            'tbc-bc-admin-style', 
            plugins_url('css/admin-style.css', __FILE__), 
            [], 
            self::VERSION
        );
        
        wp_enqueue_script(
            'tbc-bc-admin-script', 
            plugins_url('js/admin-script.js', __FILE__), 
            array('jquery', 'jquery-ui-sortable'), 
            self::VERSION,
            true
        );

        wp_localize_script('tbc-bc-admin-script', 'tbcBcAdmin', array(
            'ajaxurl' => admin_url('admin-ajax.php'),
            'nonce'   => wp_create_nonce('tbc-bc-admin-nonce')
        ));
    }
    
    public function render_admin_page() {
        if (!current_user_can('manage_options')) {
            return;
        }
        
        $action = isset($_GET['action']) ? $_GET['action'] : 'list';
        
        echo '<div class="wrap">';
        echo '<h1>' . esc_html(get_admin_page_title()) . '</h1>';
        
        switch ($action) {
            case 'add':
            case 'edit':
                include(plugin_dir_path(__FILE__) . 'includes/admin-edit-book.php');
                break;
            default:
                include(plugin_dir_path(__FILE__) . 'includes/admin-book-list.php');
                break;
        }
        
        echo '</div>';
    }
    
}

function tbc_bc_init() {
    return Tbc_Bc_Audiobook::get_instance();
}
add_action('plugins_loaded', 'tbc_bc_init');

register_activation_hook(__FILE__, array('Tbc_Bc_Audiobook', 'activate'));