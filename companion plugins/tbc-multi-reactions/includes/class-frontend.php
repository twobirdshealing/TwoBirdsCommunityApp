<?php
/**
 * Frontend Class
 * Orchestrates CSS/JS injection into FC portal
 *
 * @package TBC_Multi_Reactions
 */

namespace TBCMultiReactions;

defined('ABSPATH') || exit;

class Frontend {

    private $posts;
    private $comments;
    private $chat;

    public function __construct($posts = null, $comments = null, $chat = null) {
        $this->posts = $posts;
        $this->comments = $comments;
        $this->chat = $chat;
    }

    public function enqueue_styles() {
        $settings = get_option('tbc_mr_settings', []);
        if (empty($settings['enabled'])) {
            return;
        }

        $css_path = TBC_MR_DIR . 'assets/css/reactions.css';
        wp_enqueue_style(
            'tbc-mr-reactions',
            TBC_MR_URL . 'assets/css/reactions.css',
            [],
            file_exists($css_path) ? (string) filemtime($css_path) : null
        );
        wp_print_styles('tbc-mr-reactions');
    }

    public function inject_reactions_script() {
        $settings = get_option('tbc_mr_settings', []);
        if (empty($settings['enabled'])) {
            return;
        }

        ?>
        <script>
        (function() {
            window.tbcMrUserReactions = window.tbcMrUserReactions || {};
            window.tbcMrFeedData = window.tbcMrFeedData || {};
            window.tbcMrLastReactionType = null;

            window.tbcMrRenderIcon = function(reaction, size) {
                size = size || 24;
                if (reaction.icon_url) {
                    const img = document.createElement('img');
                    img.src = reaction.icon_url;
                    img.alt = reaction.name || '';
                    img.className = 'tbc-mr-icon';
                    img.draggable = false;
                    img.style.width = size + 'px';
                    img.style.height = size + 'px';
                    img.style.objectFit = 'contain';
                    img.style.display = 'inline-block';
                    img.style.verticalAlign = 'middle';
                    return img;
                }
                if (reaction.emoji) {
                    const span = document.createElement('span');
                    span.textContent = reaction.emoji;
                    span.className = 'emoji tbc-mr-icon';
                    span.setAttribute('aria-label', reaction.name || '');
                    span.style.width = size + 'px';
                    span.style.height = size + 'px';
                    span.style.fontSize = (size * 0.75) + 'px';
                    span.style.lineHeight = size + 'px';
                    span.style.display = 'inline-flex';
                    span.style.alignItems = 'center';
                    span.style.justifyContent = 'center';
                    span.style.verticalAlign = 'middle';
                    return span;
                }
                const span = document.createElement('span');
                span.textContent = reaction.emoji || '?';
                return span;
            };

            window.tbcMrSetIcon = function(el, reaction, size) {
                if (!el) return;
                el.innerHTML = '';
                el.appendChild(window.tbcMrRenderIcon(reaction, size));
            };
        })();
        </script>
        <?php

        if ($this->posts) {
            $this->posts->inject_posts_script();
        }

        if ($this->comments) {
            $this->comments->inject_comments_script();
        }

        if ($this->chat) {
            $this->chat->inject_chat_script();
        }

        $this->output_custom_styles();
    }

    private function output_custom_styles() {
        $enabled = Core::get_enabled_reactions();
        if (empty($enabled)) {
            return;
        }

        ?>
        <style>
            <?php foreach ($enabled as $r): ?>
            .tbc-mr-reaction-<?php echo esc_attr($r['id']); ?> { color: <?php echo esc_attr($r['color']); ?>; }
            .tbc-mr-reaction-<?php echo esc_attr($r['id']); ?>.tbc-mr-active { background-color: <?php echo esc_attr($r['color']); ?>15; border-color: <?php echo esc_attr($r['color']); ?>; }
            <?php endforeach; ?>

            /* Dropdown bg + border set via inline style in class-posts.php using
               --fcom-primary-bg / --fcom-primary-border — auto-switch in dark mode.
               Emoji hover bg defined in reactions.css using --fcom-active-bg. */

            .tbc-mr-summary { visibility: visible !important; opacity: 1 !important; }
            .tbc-mr-summary img { display: inline-block !important; visibility: visible !important; opacity: 1 !important; }
            .tbc-mr-count { display: inline-block !important; visibility: visible !important; opacity: 1 !important; }

            .tbc-mr-modal { background: var(--fcom-primary-bg, #FFFFFF) !important; border: 1px solid var(--fcom-primary-border, #DADDE1) !important; box-shadow: 0 2px 12px rgba(0,0,0,0.1) !important; }
            .tbc-mr-modal .tbc-mr-tab:hover { background: var(--fcom-secondary-bg, #F0F2F5); }
            .tbc-mr-modal .tbc-mr-modal-close:hover { background: var(--fcom-secondary-bg, #F0F2F5) !important; }
        </style>
        <?php
    }
}
