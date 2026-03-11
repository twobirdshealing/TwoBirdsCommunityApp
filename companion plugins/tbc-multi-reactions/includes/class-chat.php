<?php
/**
 * Chat Class
 * Replaces emoji text with custom icons in Fluent Messaging chat reactions.
 * Uses MutationObserver to swap emoji text for <img> when icon_url exists.
 * Targets reaction badges (.message__reaction-emoji) and picker buttons (.message-actions__emoji-option).
 * Handles both full-screen chat (.fluent-messaging) and popup widget (.chat-widget-wrapper).
 *
 * @package TBC_Multi_Reactions
 */

namespace TBCMultiReactions;

defined('ABSPATH') || exit;

class Chat {

    public function __construct() {}

    /**
     * Inject chat reactions icon-replacement script.
     * Runs on all FC portal pages (chat popup is available site-wide).
     */
    public function inject_chat_script() {
        $settings = get_option('tbc_mr_settings', []);
        if (empty($settings['enabled'])) {
            return;
        }

        $enabled_reactions = Core::get_enabled_reactions();

        // Build config with icon_url for JS (same pattern as class-posts.php / class-comments.php)
        $js_reactions = [];
        $has_icons = false;
        foreach ($enabled_reactions as $r) {
            $js_reactions[] = [
                'emoji'    => $r['emoji'] ?? null,
                'icon_url' => $r['icon_url'] ?? null,
                'label'    => $r['name'],
            ];
            if (!empty($r['icon_url'])) {
                $has_icons = true;
            }
        }

        // Only inject if at least one reaction has a custom icon
        if (!$has_icons) {
            return;
        }

        ?>
        <script>
        (function() {
            'use strict';

            // Reaction config passed directly from PHP (same pattern as posts/comments scripts)
            var reactions = <?php echo wp_json_encode($js_reactions, JSON_UNESCAPED_UNICODE); ?>;

            // Build emoji → reaction lookup (only for reactions with custom icons)
            var emojiMap = {};
            reactions.forEach(function(r) {
                if (r.icon_url && r.emoji) {
                    emojiMap[r.emoji] = r;
                }
            });
            if (Object.keys(emojiMap).length === 0) return;

            // Normalize emoji text for matching (strips variation selectors like FE0F)
            function normalizeEmoji(text) {
                return (text || '').replace(/[\uFE00-\uFE0F]/g, '').trim();
            }

            // Build normalized lookup too
            var normalizedMap = {};
            Object.keys(emojiMap).forEach(function(key) {
                normalizedMap[normalizeEmoji(key)] = emojiMap[key];
            });

            // Match emoji text to a reaction with icon_url
            function findReaction(text) {
                var trimmed = text.trim();
                return emojiMap[trimmed] || normalizedMap[normalizeEmoji(trimmed)] || null;
            }

            // Replace emoji text in an element with a custom icon <img>
            function replaceEmoji(el) {
                if (el.getAttribute('data-tbc-mr-chat') === '1') return;
                if (el.querySelector('img.tbc-mr-chat-icon')) return;

                var reaction = findReaction(el.textContent);
                if (!reaction) return;

                el.setAttribute('data-tbc-mr-chat', '1');
                el.textContent = '';

                var img = document.createElement('img');
                img.src = reaction.icon_url;
                img.alt = reaction.label || '';
                img.className = 'tbc-mr-chat-icon';
                img.draggable = false;
                el.appendChild(img);
            }

            // Replace emoji in picker button with custom icon <img>
            function replacePickerEmoji(el) {
                if (el.getAttribute('data-tbc-mr-chat') === '1') return;
                if (el.querySelector('img.tbc-mr-chat-icon')) return;

                var reaction = findReaction(el.textContent);
                if (!reaction) return;

                el.setAttribute('data-tbc-mr-chat', '1');
                el.textContent = '';

                var img = document.createElement('img');
                img.src = reaction.icon_url;
                img.alt = reaction.label || '';
                img.className = 'tbc-mr-chat-icon tbc-mr-picker-icon';
                img.draggable = false;
                el.appendChild(img);
            }

            // Process all visible reaction emoji elements + picker buttons
            function processReactions() {
                // Reaction badges on message bubbles
                document.querySelectorAll('.message__reaction-emoji:not([data-tbc-mr-chat])').forEach(replaceEmoji);
                // Emoji picker buttons (hover action bar)
                document.querySelectorAll('.message-actions__emoji-option:not([data-tbc-mr-chat])').forEach(replacePickerEmoji);
            }

            // Initial pass (may catch already-rendered reactions)
            processReactions();

            // Watch entire document for new chat reactions
            // Process immediately (before paint) when new elements are added — eliminates emoji flash
            var observer = new MutationObserver(function(mutations) {
                for (var i = 0; i < mutations.length; i++) {
                    if (mutations[i].addedNodes.length) {
                        processReactions();
                        return;
                    }
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        })();
        </script>
        <style>
            /* Custom icon inside chat reaction badge */
            .message__reaction-emoji .tbc-mr-chat-icon {
                width: 14px;
                height: 14px;
                object-fit: contain;
                vertical-align: middle;
                display: inline-block;
                image-rendering: -webkit-optimize-contrast;
            }
            /* Custom icon inside emoji picker button */
            .message-actions__emoji-option .tbc-mr-picker-icon {
                width: 22px;
                height: 22px;
                object-fit: contain;
                vertical-align: middle;
                display: inline-block;
                image-rendering: -webkit-optimize-contrast;
            }
        </style>
        <?php
    }
}
