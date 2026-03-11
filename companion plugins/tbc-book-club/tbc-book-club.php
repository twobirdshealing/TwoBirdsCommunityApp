<?php
/**
 * Plugin Name: TBC - Book Club Manager
 * Description: Manages and displays book club audiobooks with chapter support, progress tracking, and bookmarks.
 * Version: 2.2.0
 * Author: Two Birds Church
 *
 * @see CHANGELOG.md for version history
 */

if (!defined('ABSPATH')) {
    exit;
}

class Tbc_Bc_Audiobook {
    private static $instance = null;
    const VERSION = '2.2.0';
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        require_once plugin_dir_path(__FILE__) . 'includes/book-helpers.php';
        require_once plugin_dir_path(__FILE__) . 'includes/book-ajax.php';
        new Tbc_Bc_Ajax_Handlers();

        add_action('init', array($this, 'init'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_enqueue_scripts', array($this, 'admin_scripts'));
        add_action('wp_enqueue_scripts', array($this, 'frontend_scripts'));
        
        add_shortcode('tbc_bc_player', array($this, 'render_player'));
        add_shortcode('tbc_bc_info', array($this, 'render_current_book_info'));

        add_action('wp_ajax_tbc_bc_load_player', array($this, 'ajax_load_player'));
        add_action('wp_ajax_nopriv_tbc_bc_load_player', array($this, 'ajax_load_player'));
    }
    
    public function init() {}

    private function should_load_assets() {
        if (is_admin()) {
            return false;
        }
        global $post;
        return $post && (has_shortcode($post->post_content, 'tbc_bc_player') || has_shortcode($post->post_content, 'tbc_bc_info'));
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
    
    public function frontend_scripts() {
        if (!$this->should_load_assets()) {
            return;
        }

        wp_enqueue_style('tbc-bc-swiper-css', 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css', [], '11.0.0');
        wp_enqueue_script('tbc-bc-swiper-js', 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js', [], '11.0.0', true);
        wp_enqueue_style('tbc-bc-plyr-css', 'https://cdn.plyr.io/3.7.8/plyr.css', [], '3.7.8');
        wp_enqueue_script('tbc-bc-plyr-js', 'https://cdn.plyr.io/3.7.8/plyr.js', [], '3.7.8', true);
        
        wp_enqueue_script(
            'tbc-bc-player', 
            plugins_url('js/player.js', __FILE__), 
            array('jquery', 'tbc-bc-plyr-js'), 
            self::VERSION, 
            true
        );
        
        wp_enqueue_script(
            'tbc-bc-selector',
            plugins_url('js/book-selector.js', __FILE__),
            array('jquery', 'tbc-bc-swiper-js'),
            self::VERSION,
            true
        );
        
        wp_localize_script('tbc-bc-player', 'tbcBcPlayer', array(
            'ajaxurl' => admin_url('admin-ajax.php'),
            'nonce'   => wp_create_nonce('tbc-bc-player-nonce'),
        ));

        wp_localize_script('tbc-bc-selector', 'tbcBcSelector', array(
            'ajaxurl' => admin_url('admin-ajax.php'),
            'nonce'   => wp_create_nonce('tbc-bc-selector-nonce'),
        ));

        wp_enqueue_style('tbc-bc-base', plugins_url('css/base.css', __FILE__), [], self::VERSION);
        wp_enqueue_style('tbc-bc-main-controls', plugins_url('css/main-controls.css', __FILE__), ['tbc-bc-base'], self::VERSION);
        wp_enqueue_style('tbc-bc-toolbar', plugins_url('css/toolbar.css', __FILE__), ['tbc-bc-base'], self::VERSION);
        wp_enqueue_style('tbc-bc-selector', plugins_url('css/book-selector.css', __FILE__), ['tbc-bc-base'], self::VERSION);
        wp_enqueue_style('tbc-bc-info', plugins_url('css/book-info.css', __FILE__), ['tbc-bc-base'], self::VERSION);
    }    
    
    public function render_player($atts) {
        ob_start();
        include(plugin_dir_path(__FILE__) . 'includes/book-selector.php');
        return ob_get_clean();
    }

    public function render_current_book_info($atts) {
        ob_start();
        include(plugin_dir_path(__FILE__) . 'includes/frontend-book-info.php');
        return ob_get_clean();
    }

    public function ajax_load_player() {
        check_ajax_referer('tbc-bc-selector-nonce', 'nonce');
        
        $book_id = isset($_GET['book_id']) ? intval($_GET['book_id']) : 0;
        
        if (!$book_id) {
            wp_send_json_error('Invalid book ID');
        }

        global $wpdb;
        $book = $wpdb->get_row($wpdb->prepare("
            SELECT * FROM {$wpdb->prefix}tbc_bc_books 
            WHERE id = %d
        ", $book_id));

        if (!$book) {
            wp_send_json_error('Book not found');
        }

        set_query_var('tbc_bc_current_book', $book);
        
        ob_start();
        include(plugin_dir_path(__FILE__) . 'includes/frontend-player.php');
        $html = ob_get_clean();
        
        echo $html;
        wp_die();
    }
}

function tbc_bc_init() {
    return Tbc_Bc_Audiobook::get_instance();
}
add_action('plugins_loaded', 'tbc_bc_init');

register_activation_hook(__FILE__, array('Tbc_Bc_Audiobook', 'activate'));