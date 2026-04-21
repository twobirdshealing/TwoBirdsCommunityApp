/**
 * TBC WooCommerce Calendar - FAQ & Tabs admin UI
 *
 * Sortable tab repeater with:
 *   - Type switcher (Content | FAQ)
 *   - Full wp_editor for Content-type tabs
 *   - Nested sortable Q&A rows for FAQ-type tabs, with a teeny wp_editor
 *     lazy-initialized on first row expand
 *   - Live title mirror in the drag handle
 *   - Reindexing of name attributes on sort / add / remove so PHP receives
 *     a clean 0-indexed array
 */
(function ($) {
    'use strict';

    var $container = null;

    // Unique-id counters — bumped on every add, never reused, so wp.editor
    // ids stay stable for the lifetime of the page.
    var nextTabId = 0;
    var nextFaqId = 0;

    // One shared "teeny" editor preset for both Content and FAQ tabs — lighter
    // than the full wp_editor, native resize handle via statusbar, same toolbar
    // everywhere so admins don't see surprises between tab types.
    var TEENY_SETTINGS = {
        tinymce: {
            toolbar1: 'bold,italic,underline,bullist,numlist,blockquote,link,unlink,undo,redo',
            wpautop: true,
            menubar: false,
            statusbar: true,
            resize: 'both',
            height: 260,
            min_height: 160,
            plugins: 'lists,link,paste,wordpress,wplink'
        },
        quicktags: {
            buttons: 'strong,em,link,ul,ol,li,block,close'
        },
        mediaButtons: false
    };

    $(function () {
        $container = $('.tbc-wc-extra-tabs-container');
        if (!$container.length) {
            return;
        }

        initExistingState();
        bindEvents();
        makeOuterSortable();
        $container.find('.tbc-wc-extra-tab-item').each(function () {
            makeInnerSortable($(this));
        });
    });

    function initExistingState() {
        // Highest existing index + 1 becomes the next id counter.
        var maxTabIdx = -1;
        $container.find('.tbc-wc-extra-tab-item').each(function () {
            var idx = parseInt($(this).attr('data-index'), 10);
            if (!isNaN(idx) && idx > maxTabIdx) {
                maxTabIdx = idx;
            }
            // Reflect enabled checkbox state on the item so CSS can style disabled rows.
            syncEnabledClass($(this));
        });
        nextTabId = maxTabIdx + 1;

        var maxFaqIdx = -1;
        $container.find('.tbc-wc-faq-row').each(function () {
            var idx = parseInt($(this).attr('data-faq-index'), 10);
            if (!isNaN(idx) && idx > maxFaqIdx) {
                maxFaqIdx = idx;
            }
        });
        nextFaqId = maxFaqIdx + 1;
    }

    function bindEvents() {
        // Toggle tab open/closed (ignore clicks on the drag handle).
        $container.on('click', '.tbc-wc-extra-tab-handle', function (e) {
            if ($(e.target).closest('.tbc-wc-extra-tab-drag').length) {
                return;
            }
            $(this).closest('.tbc-wc-extra-tab-item').toggleClass('is-open');
        });

        // Live title mirror.
        $container.on('input', '.tbc-wc-tab-title', function () {
            var val = $.trim($(this).val());
            var $display = $(this).closest('.tbc-wc-extra-tab-item').find('.tbc-wc-extra-tab-title-display').first();
            $display.text(val || 'New Tab');
        });

        // Enabled checkbox → item class.
        $container.on('change', 'input[type="checkbox"][name$="[enabled]"]', function () {
            syncEnabledClass($(this).closest('.tbc-wc-extra-tab-item'));
        });

        // Type switcher.
        $container.on('change', '.tbc-wc-tab-type', function () {
            var $item = $(this).closest('.tbc-wc-extra-tab-item');
            setItemType($item, $(this).val());
        });

        // Remove a tab.
        $container.on('click', '.tbc-wc-remove-tab', function () {
            if (!window.confirm('Remove this tab and all its content?')) {
                return;
            }
            var $item = $(this).closest('.tbc-wc-extra-tab-item');
            // Tear down any initialized editors inside this item.
            $item.find('textarea[id^="tbc_wc_extra_tabs_"]').each(function () {
                removeEditor(this.id);
            });
            $item.remove();
            reindexTabs();
        });

        // Add tab.
        $(document).on('click', '.tbc-wc-add-tab', function () {
            addTab();
        });

        // FAQ row handle toggles + lazy-init editor on first expand.
        $container.on('click', '.tbc-wc-faq-row-handle', function (e) {
            if ($(e.target).closest('.tbc-wc-faq-row-drag').length) {
                return;
            }
            var $row = $(this).closest('.tbc-wc-faq-row');
            $row.toggleClass('is-open');
            if ($row.hasClass('is-open')) {
                ensureFaqEditor($row);
            }
        });

        // Live FAQ question mirror.
        $container.on('input', '.tbc-wc-faq-question-input', function () {
            var val = $.trim($(this).val());
            var $display = $(this).closest('.tbc-wc-faq-row').find('.tbc-wc-faq-row-title-display').first();
            $display.text(val || 'New question');
        });

        // Add Q&A row.
        $container.on('click', '.tbc-wc-add-faq', function () {
            var $item = $(this).closest('.tbc-wc-extra-tab-item');
            addFaqRow($item);
        });

        // Remove Q&A row.
        $container.on('click', '.tbc-wc-remove-faq', function () {
            var $row = $(this).closest('.tbc-wc-faq-row');
            var $item = $row.closest('.tbc-wc-extra-tab-item');
            $row.find('textarea[id^="tbc_wc_extra_tabs_"]').each(function () {
                removeEditor(this.id);
            });
            $row.remove();
            reindexFaqsInItem($item);
        });
    }

    function syncEnabledClass($item) {
        var checked = $item.find('> .tbc-wc-extra-tab-body input[type="checkbox"][name$="[enabled]"]').is(':checked');
        $item.toggleClass('is-enabled', checked);
    }

    function setItemType($item, type) {
        $item.attr('data-type', type);
        var $badge = $item.find('.tbc-wc-extra-tab-type-badge').first();
        var label = type === 'faq' ? $badge.attr('data-faq-label') : $badge.attr('data-content-label');
        $badge.text(label);

        if (type === 'faq') {
            $item.find('> .tbc-wc-extra-tab-body > .tbc-wc-tab-content-pane').hide();
            $item.find('> .tbc-wc-extra-tab-body > .tbc-wc-tab-faq-pane').show();
        } else {
            $item.find('> .tbc-wc-extra-tab-body > .tbc-wc-tab-faq-pane').hide();
            $item.find('> .tbc-wc-extra-tab-body > .tbc-wc-tab-content-pane').show();
            // If content editor hasn't been initialized yet (template row), init now.
            ensureContentEditor($item);
        }
    }

    /**
     * Make sure a content-type tab has its wp_editor initialized.
     * Existing tabs rendered server-side already have it; dynamically-added
     * tabs start with a plain textarea.
     */
    function ensureContentEditor($item) {
        var $textarea = $item.find('> .tbc-wc-extra-tab-body > .tbc-wc-tab-content-pane .tbc-wc-tab-content-textarea').first();
        if (!$textarea.length) {
            return;
        }
        if ($textarea.closest('.wp-editor-wrap').length) {
            return;
        }
        var id = $textarea.attr('id');
        if (!id) {
            return;
        }
        initEditor(id, TEENY_SETTINGS);
    }

    function ensureFaqEditor($row) {
        if ($row.attr('data-editor-initialized') === '1') {
            return;
        }
        var $textarea = $row.find('.tbc-wc-faq-answer-textarea').first();
        if (!$textarea.length) {
            return;
        }
        if ($textarea.closest('.wp-editor-wrap').length) {
            $row.attr('data-editor-initialized', '1');
            return;
        }
        var id = $textarea.attr('id');
        if (!id) {
            return;
        }
        initEditor(id, TEENY_SETTINGS);
        $row.attr('data-editor-initialized', '1');
    }

    function initEditor(id, settings) {
        if (typeof wp === 'undefined' || !wp.editor || typeof wp.editor.initialize !== 'function') {
            return;
        }
        try {
            wp.editor.initialize(id, settings);
        } catch (e) {
            // Fall through silently — worst case the user gets a plain textarea.
            if (window.console && console.warn) {
                console.warn('TBC FAQ & Tabs: wp.editor.initialize failed for ' + id, e);
            }
        }
    }

    function removeEditor(id) {
        if (typeof wp === 'undefined' || !wp.editor || typeof wp.editor.remove !== 'function') {
            return;
        }
        try {
            wp.editor.remove(id);
        } catch (e) {
            // Safe to ignore — editor may never have been initialized.
        }
    }

    function addTab() {
        var $template = $('#tbc-wc-tab-template');
        if (!$template.length) {
            return;
        }
        var idx = nextTabId++;
        var html = $template.html().split('__INDEX__').join(String(idx));
        var $new = $(html);
        $new.addClass('is-open is-enabled');
        // Default to enabled on add.
        $new.find('input[type="checkbox"][name$="[enabled]"]').prop('checked', true);
        $container.append($new);
        makeInnerSortable($new);
        reindexTabs();
        // Initialize the content editor for the new tab (default type = content).
        ensureContentEditor($new);
    }

    function addFaqRow($item) {
        var $template = $('#tbc-wc-faq-row-template');
        if (!$template.length) {
            return;
        }
        var tabIdx = parseInt($item.attr('data-index'), 10);
        if (isNaN(tabIdx)) {
            tabIdx = 0;
        }
        var faqIdx = nextFaqId++;
        var html = $template.html()
            .split('__INDEX__').join(String(tabIdx))
            .split('__FAQINDEX__').join(String(faqIdx));
        var $row = $(html);
        $row.addClass('is-open');
        $item.find('> .tbc-wc-extra-tab-body > .tbc-wc-tab-faq-pane > .tbc-wc-faq-rows').append($row);
        reindexFaqsInItem($item);
        ensureFaqEditor($row);
    }

    function makeOuterSortable() {
        if (!$.fn.sortable) {
            return;
        }
        $container.sortable({
            items: '> .tbc-wc-extra-tab-item',
            handle: '.tbc-wc-extra-tab-drag',
            axis: 'y',
            placeholder: 'tbc-wc-extra-tab-item is-sortable-placeholder',
            forcePlaceholderSize: true,
            tolerance: 'pointer',
            update: function () {
                reindexTabs();
            }
        });
    }

    function makeInnerSortable($item) {
        if (!$.fn.sortable) {
            return;
        }
        var $rows = $item.find('> .tbc-wc-extra-tab-body > .tbc-wc-tab-faq-pane > .tbc-wc-faq-rows');
        if (!$rows.length || $rows.hasClass('ui-sortable')) {
            return;
        }
        $rows.sortable({
            items: '> .tbc-wc-faq-row',
            handle: '.tbc-wc-faq-row-drag',
            axis: 'y',
            placeholder: 'tbc-wc-faq-row is-sortable-placeholder',
            forcePlaceholderSize: true,
            tolerance: 'pointer',
            update: function () {
                reindexFaqsInItem($item);
            }
        });
    }

    /**
     * Rewrite `name` attrs so PHP sees a clean 0-indexed array in DOM order.
     * DO NOT touch `id` attrs — wp.editor tracks editors by id.
     */
    function reindexTabs() {
        $container.find('> .tbc-wc-extra-tab-item').each(function (position) {
            var $item = $(this);
            $item.attr('data-position', position);
            $item.find('[name^="tbc_wc_extra_tabs["]').each(function () {
                var n = $(this).attr('name');
                if (!n) return;
                $(this).attr('name', n.replace(/^tbc_wc_extra_tabs\[\d+\]/, 'tbc_wc_extra_tabs[' + position + ']'));
            });
        });
    }

    function reindexFaqsInItem($item) {
        $item.find('> .tbc-wc-extra-tab-body > .tbc-wc-tab-faq-pane > .tbc-wc-faq-rows > .tbc-wc-faq-row').each(function (position) {
            var $row = $(this);
            $row.attr('data-position', position);
            $row.find('[name*="[faqs]["]').each(function () {
                var n = $(this).attr('name');
                if (!n) return;
                $(this).attr('name', n.replace(/\[faqs\]\[\d+\]/, '[faqs][' + position + ']'));
            });
        });
    }

})(jQuery);
