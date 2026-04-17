<?php
/**
 * Replaces emoji text with custom icons in Fluent Messaging chat reactions.
 * Uses a MutationObserver to swap emoji text for <img> elements when a matching reaction has icon_url set.
 * Targets reaction badges (.message__reaction-emoji) and picker buttons (.message-actions__emoji-option).
 *
 * @package TBC_Multi_Reactions
 */

namespace TBCMultiReactions;

defined('ABSPATH') || exit;

class Chat {

    public function inject_chat_script() {
        $settings = get_option('tbc_mr_settings', []);
        if (empty($settings['enabled'])) {
            return;
        }

        $js_reactions = Core::build_js_reaction_config();

        $has_icons = false;
        foreach ($js_reactions as $r) {
            if (!empty($r['icon_url'])) {
                $has_icons = true;
                break;
            }
        }
        if (!$has_icons) {
            return;
        }

        ?>
        <script>
        (function() {
            'use strict';

            var reactions = <?php echo wp_json_encode($js_reactions, JSON_UNESCAPED_UNICODE); ?>;

            var emojiMap = {};
            reactions.forEach(function(r) {
                if (r.icon_url && r.emoji) {
                    emojiMap[r.emoji] = r;
                }
            });
            if (Object.keys(emojiMap).length === 0) return;

            // Strip variation selectors (U+FE00..FE0F) so emoji text with and without them both match.
            function normalizeEmoji(text) {
                return (text || '').replace(/[\uFE00-\uFE0F]/g, '').trim();
            }

            var normalizedMap = {};
            Object.keys(emojiMap).forEach(function(key) {
                normalizedMap[normalizeEmoji(key)] = emojiMap[key];
            });

            function findReaction(text) {
                var trimmed = text.trim();
                return emojiMap[trimmed] || normalizedMap[normalizeEmoji(trimmed)] || null;
            }

            function replaceEmoji(el) {
                if (el.getAttribute('data-tbc-mr-chat') === '1') return;
                if (el.querySelector('img.tbc-mr-chat-icon')) return;

                var reaction = findReaction(el.textContent);
                if (!reaction) return;

                el.setAttribute('data-tbc-mr-chat', '1');
                el.textContent = '';

                var img = document.createElement('img');
                img.src = reaction.icon_url;
                img.alt = reaction.name || '';
                img.className = 'tbc-mr-chat-icon';
                img.draggable = false;
                el.appendChild(img);
            }

            function replacePickerEmoji(el) {
                if (el.getAttribute('data-tbc-mr-chat') === '1') return;
                if (el.querySelector('img.tbc-mr-chat-icon')) return;

                var reaction = findReaction(el.textContent);
                if (!reaction) return;

                el.setAttribute('data-tbc-mr-chat', '1');
                el.textContent = '';

                var img = document.createElement('img');
                img.src = reaction.icon_url;
                img.alt = reaction.name || '';
                img.className = 'tbc-mr-chat-icon tbc-mr-picker-icon';
                img.draggable = false;
                el.appendChild(img);
            }

            function processReactions() {
                document.querySelectorAll('.message__reaction-emoji:not([data-tbc-mr-chat])').forEach(replaceEmoji);
                document.querySelectorAll('.message-actions__emoji-option:not([data-tbc-mr-chat])').forEach(replacePickerEmoji);
            }

            processReactions();

            // Process synchronously on mutation (before paint) to eliminate the emoji flash during the swap.
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
