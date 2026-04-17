<?php
/**
 * Admin class - adds admin menu and enqueues assets
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_Admin {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('admin_menu', [$this, 'add_menu'], 9); // Priority 9 — other TBC plugins add submenus at default 10
        add_action('admin_enqueue_scripts', [$this, 'enqueue_assets']);
    }

    /**
     * Add top-level admin menu (parent for all TBC plugins)
     */
    public function add_menu() {
        add_menu_page(
            __('TBC Community App', 'tbc-ca'),
            __('TBC Community App', 'tbc-ca'),
            'manage_options',
            'tbc-community-app',
            [$this, 'render_page'],
            'dashicons-smartphone',
            30
        );

        // Rename auto-generated first submenu entry to "App Settings"
        add_submenu_page(
            'tbc-community-app',
            __('App Settings', 'tbc-ca'),
            __('App Settings', 'tbc-ca'),
            'manage_options',
            'tbc-community-app', // Same slug as parent — replaces auto-entry
            [$this, 'render_page']
        );
    }

    /**
     * Enqueue admin assets
     */
    public function enqueue_assets($hook) {
        if ($hook !== 'toplevel_page_tbc-community-app') {
            return;
        }

        $css_path = TBC_CA_PLUGIN_DIR . 'assets/admin/admin.css';
        wp_enqueue_style(
            'tbc-ca-admin',
            TBC_CA_PLUGIN_URL . 'assets/admin/admin.css',
            [],
            file_exists($css_path) ? (string) filemtime($css_path) : TBC_CA_VERSION
        );

        wp_add_inline_script('jquery-core', '
            jQuery(function($) {
                var formTabs = ["general", "features", "visibility", "notifications"];
                var $saveBar = $("#tbc-ca-save-bar");
                var isDirty = false;
                var initialFormState = "";
                var dirtyTimer = null;

                function captureFormState() {
                    initialFormState = $("form", ".tbc-ca-admin").serialize();
                }

                function checkDirty() {
                    if (dirtyTimer) clearTimeout(dirtyTimer);
                    dirtyTimer = setTimeout(function() {
                        var currentState = $("form", ".tbc-ca-admin").serialize();
                        isDirty = currentState !== initialFormState;
                        $saveBar.toggleClass("tbc-ca-save-bar--dirty", isDirty);
                    }, 300);
                }

                function switchTab(tab) {
                    $(".tbc-ca-tabs .nav-tab").removeClass("nav-tab-active");
                    $(".tbc-ca-tabs .nav-tab[data-tab=\"" + tab + "\"]").addClass("nav-tab-active");
                    $(".tbc-ca-tab-panel").removeClass("tbc-ca-tab-panel--active");
                    $(".tbc-ca-tab-panel[data-panel=\"" + tab + "\"]").addClass("tbc-ca-tab-panel--active");
                    $("#tbc-ca-active-tab").val(tab);
                    var isFormTab = formTabs.indexOf(tab) !== -1;
                    $saveBar.toggleClass("tbc-ca-save-bar--visible", isFormTab);
                }

                $(".tbc-ca-tabs .nav-tab").on("click", function(e) {
                    e.preventDefault();
                    var tab = $(this).data("tab");
                    switchTab(tab);
                    if (history.replaceState) {
                        var url = new URL(window.location);
                        url.searchParams.set("tab", tab);
                        history.replaceState(null, "", url);
                    }
                });

                // Track changes on all form inputs
                $("form", ".tbc-ca-admin").on("change input", "input, select, textarea", function() {
                    checkDirty();
                });

                // Warn before leaving with unsaved changes
                $(window).on("beforeunload", function() {
                    if (isDirty) return "You have unsaved changes.";
                });

                // Remove warning on form submit
                $("form", ".tbc-ca-admin").on("submit", function() {
                    isDirty = false;
                    $(window).off("beforeunload");
                });

                // Init
                switchTab($(".tbc-ca-tabs .nav-tab-active").data("tab"));
                captureFormState();
            });
        ');
    }

    /**
     * Render admin page
     */
    public function render_page() {
        TBC_CA_Admin_Settings::get_instance()->render();
    }
}
