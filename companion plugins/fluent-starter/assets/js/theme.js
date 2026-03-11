/**
 * Fluent Starter - Theme JavaScript
 *
 * Minimal JS for dark mode synchronization with Fluent Community
 * Target: ~0.5KB
 *
 * @package Fluent_Starter
 */

(function() {
    'use strict';

    /**
     * Dark Mode Manager
     *
     * Syncs dark mode state with Fluent Community's localStorage
     */
    const DarkMode = {
        storageKey: 'fcom_global_storage',

        /**
         * Initialize dark mode on page load
         */
        init: function() {
            this.applyStoredMode();
            this.watchForChanges();
            this.watchSystemPreference();
        },

        /**
         * Apply dark mode from Fluent Community storage
         */
        applyStoredMode: function() {
            try {
                const storage = localStorage.getItem(this.storageKey);
                if (storage) {
                    const data = JSON.parse(storage);
                    if (data && data.fcom_color_mode === 'dark') {
                        this.setDarkMode(true);
                    } else if (data && data.fcom_color_mode === 'light') {
                        this.setDarkMode(false);
                    }
                }
            } catch (e) {
                // Storage not available or invalid JSON
            }
        },

        /**
         * Set dark mode state
         * @param {boolean} isDark
         */
        setDarkMode: function(isDark) {
            if (isDark) {
                document.documentElement.classList.add('dark');
                document.documentElement.setAttribute('data-color-mode', 'dark');
            } else {
                document.documentElement.classList.remove('dark');
                document.documentElement.setAttribute('data-color-mode', 'light');
            }
        },

        /**
         * Watch for storage changes (when user toggles in Fluent Community)
         */
        watchForChanges: function() {
            window.addEventListener('storage', (e) => {
                if (e.key === this.storageKey) {
                    this.applyStoredMode();
                }
            });
        },

        /**
         * Watch system color scheme preference
         */
        watchSystemPreference: function() {
            if (!window.matchMedia) return;

            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

            // Only apply system preference if no Fluent Community setting exists
            const storage = localStorage.getItem(this.storageKey);
            if (!storage) {
                this.setDarkMode(mediaQuery.matches);
            }

            // Listen for system preference changes
            mediaQuery.addEventListener('change', (e) => {
                // Only apply if no explicit setting in Fluent Community
                const currentStorage = localStorage.getItem(this.storageKey);
                if (!currentStorage) {
                    this.setDarkMode(e.matches);
                }
            });
        }
    };

    // Copy link button
    document.addEventListener('click', function(e) {
        var btn = e.target.closest('.fs-share-copy');
        if (!btn) return;
        var url = btn.getAttribute('data-copy-url');
        if (url && navigator.clipboard) {
            navigator.clipboard.writeText(url).then(function() {
                btn.classList.add('copied');
            });
        }
    });

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => DarkMode.init());
    } else {
        DarkMode.init();
    }
})();
