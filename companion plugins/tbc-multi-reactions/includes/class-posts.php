<?php
/**
 * Feed/post reaction picker — inline JS injected into the FC portal footer.
 *
 * @package TBC_Multi_Reactions
 */

namespace TBCMultiReactions;

defined('ABSPATH') || exit;

class Posts {

    public function inject_posts_script() {
        $settings = get_option('tbc_mr_settings', []);
        if (empty($settings['enabled'])) {
            return;
        }

        $enabled_reactions = Core::get_enabled_reactions();
        $js_reactions = Core::build_js_reaction_config();

        $rest_url = rest_url('fluent-community/v2/feeds/');
        $tbc_rest_url = rest_url('tbc-multi-reactions/v1/');
        $wp_nonce = wp_create_nonce('wp_rest');
        ?>
        <script>
        (function() {
            'use strict';

            const reactions = <?php echo wp_json_encode($js_reactions, JSON_UNESCAPED_UNICODE); ?>;
            const REST_URL = '<?php echo esc_js($rest_url); ?>';
            const TBC_REST_URL = '<?php echo esc_js($tbc_rest_url); ?>';
            const WP_NONCE = '<?php echo esc_js($wp_nonce); ?>';
            const DISPLAY_COUNT = 5;
            const OVERLAP = 8;
            const STROKE = 0;

            function escHtml(s) { const d = document.createElement('div'); d.appendChild(document.createTextNode(s || '')); return d.innerHTML; }

            // Populate caches by reading FC's own feed/activities API responses as they fly past.
            const origOpen = XMLHttpRequest.prototype.open;
            const origSend = XMLHttpRequest.prototype.send;

            XMLHttpRequest.prototype.open = function(method, url, ...rest) {
                this._tbcMrUrl = url;
                this._tbcMrMethod = method;
                return origOpen.apply(this, [method, url, ...rest]);
            };

            XMLHttpRequest.prototype.send = function(body) {
                const isFeedAPI = this._tbcMrUrl && (
                    this._tbcMrUrl.includes('/feeds?') ||
                    (this._tbcMrUrl.includes('/feeds/') && !this._tbcMrUrl.includes('/react')) ||
                    this._tbcMrUrl.includes('/activities?')
                );

                if (isFeedAPI) {
                    const origORS = this.onreadystatechange;
                    this.onreadystatechange = function() {
                        if (this.readyState === 4 && this.status === 200) {
                            try { processFeedResponse(JSON.parse(this.responseText)); } catch(e) {}
                        }
                        if (origORS) origORS.apply(this, arguments);
                    };
                }

                return origSend.apply(this, arguments);
            };

            function processFeedResponse(response) {
                let feeds = null;
                if (response.feeds && response.feeds.data) feeds = response.feeds.data;
                else if (response.feed) feeds = [response.feed];
                else if (response.feeds && Array.isArray(response.feeds)) feeds = response.feeds;
                else if (response.data && Array.isArray(response.data)) feeds = response.data;
                else if (Array.isArray(response)) feeds = response;
                if (!feeds || !feeds.length) return;

                feeds.forEach(feed => {
                    if (!feed || !feed.id) return;
                    const fid = String(feed.id);

                    if (feed.user_reaction_type) {
                        const r = reactions.find(x => x.id === feed.user_reaction_type);
                        if (r) {
                            window.tbcMrUserReactions[fid] = {
                                type: feed.user_reaction_type,
                                icon_url: feed.user_reaction_icon_url || r.icon_url,
                                name: feed.user_reaction_name || r.name,
                                emoji: r.emoji,
                            };
                        }
                    }

                    if (feed.reaction_breakdown) {
                        window.tbcMrFeedData[fid] = {
                            reaction_breakdown: feed.reaction_breakdown,
                            reaction_total: feed.reaction_total || feed.reactions_count || 0,
                        };
                    }
                });

                setTimeout(() => {
                    processAllReactionButtons();
                    updateExistingButtons();
                }, 100);
            }

            function updateExistingButtons() {
                document.querySelectorAll('.tbc-mr-wrapper[data-feed-id]').forEach(wrapper => {
                    const fid = wrapper.getAttribute('data-feed-id');
                    const ud = window.tbcMrUserReactions[fid];
                    const btn = wrapper.querySelector('.tbc-mr-single');
                    if (!btn) return;
                    if (ud) {
                        const r = reactions.find(x => x.id === ud.type) || reactions[0];
                        window.tbcMrSetIcon(btn, r, 35);
                        btn.classList.add('tbc-mr-active');
                        btn.classList.remove('tbc-mr-inactive');
                        btn.title = r.name;
                        wrapper.setAttribute('data-active-type', r.id);
                    }
                });
            }

            function debounce(fn, ms) {
                let t; return function(...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
            }
            const debouncedSummary = debounce(updateEmojiSummary, 100);

            function getFeedId(el) {
                let cur = el, depth = 0;
                while (cur && depth < 15) {
                    if (cur.id) {
                        const m = cur.id.match(/^feed_id_(\d+)$/i);
                        if (m) return m[1];
                    }
                    const fid = cur.getAttribute('data-feed-id') || cur.getAttribute('data-feed_id') || cur.getAttribute('data-id') || cur.getAttribute('data-object-id');
                    if (fid && !isNaN(fid)) return String(fid);
                    cur = cur.parentElement;
                    depth++;
                }
                return null;
            }

            function updateEmojiSummary(feedId) {
                const fd = window.tbcMrFeedData[feedId];
                if (!fd || !fd.reaction_breakdown) {
                    fetch(TBC_REST_URL + 'breakdown/feed/' + feedId, {
                        method: 'GET',
                        headers: { 'X-WP-Nonce': WP_NONCE }
                    }).then(r => r.json()).then(data => {
                        if (data.breakdown) {
                            window.tbcMrFeedData[feedId] = { reaction_breakdown: data.breakdown || [], reaction_total: data.total || 0 };
                        }
                        // Safety net: update button icon from this API response in case the XHR interceptor missed the initial load.
                        if (data.user_reaction_type) {
                            const r = reactions.find(x => x.id === data.user_reaction_type);
                            if (r) {
                                window.tbcMrUserReactions[feedId] = { type: data.user_reaction_type, icon_url: r.icon_url, emoji: r.emoji, name: r.name };
                                const wrapper = document.querySelector('.tbc-mr-wrapper[data-feed-id="' + feedId + '"]');
                                if (wrapper) {
                                    const btn = wrapper.querySelector('.tbc-mr-single');
                                    if (btn) {
                                        window.tbcMrSetIcon(btn, r, 35);
                                        btn.classList.add('tbc-mr-active');
                                        btn.classList.remove('tbc-mr-inactive');
                                        btn.title = r.name;
                                        wrapper.setAttribute('data-active-type', r.id);
                                    }
                                }
                            }
                        }
                        renderSummary(feedId);
                    });
                    return;
                }
                renderSummary(feedId);
            }

            function renderSummary(feedId) {
                const fd = window.tbcMrFeedData[feedId];
                if (!fd || !fd.reaction_breakdown) return;
                const el = document.querySelector('.tbc-mr-summary[data-feed-id="' + feedId + '"]');
                if (!el) return;

                const bd = fd.reaction_breakdown;
                const total = fd.reaction_total || 0;
                if (!bd.length || total === 0) { el.style.display = 'none'; return; }

                let html = '';
                bd.slice(0, DISPLAY_COUNT).forEach((item, i) => {
                    const ml = i === 0 ? '0' : (-OVERLAP) + 'px';
                    if (item.icon_url) {
                        html += '<img src="' + item.icon_url + '" class="tbc-mr-summary-icon" style="margin-left:' + ml + ';z-index:' + (10+i) + ';--tbc-stroke:' + STROKE + 'px;" alt="' + (item.name || '') + '">';
                    } else if (item.emoji) {
                        html += '<span class="tbc-mr-summary-icon emoji" style="margin-left:' + ml + ';z-index:' + (10+i) + ';--tbc-stroke:' + STROKE + 'px;" aria-label="' + (item.name || '') + '">' + item.emoji + '</span>';
                    }
                });
                html += '<span class="tbc-mr-count" style="margin-left:6px;">' + total + '</span>';
                el.innerHTML = html;
                el.style.display = 'inline-flex';
            }

            function processAllReactionButtons() {
                const sels = ['.fcom_reaction i.el-icon svg', '.fcom_reaction_list i.el-icon svg', '.feed_actions button i.el-icon svg'];
                document.querySelectorAll(sels.join(',')).forEach(svg => {
                    const path = svg.querySelector('path');
                    if (!path) return;
                    const d = path.getAttribute('d') || '';
                    if (d.includes('M16.697 5.5') || d.includes('M20.884 13.19')) {
                        const btn = svg.closest('button, li, span, div');
                        if (btn && !btn.hasAttribute('data-tbc-mr-processed')) {
                            processButton(btn);
                        }
                    }
                });
            }

            function processButton(button) {
                if (button.hasAttribute('data-tbc-mr-processed')) return;
                button.setAttribute('data-tbc-mr-processed', 'true');

                if (button.closest('.fcom_comments_react, .each_comment, .comment_item')) return;

                const feedId = getFeedId(button);
                const hasReacted = button.classList.contains('react_active');
                const defaultR = reactions[0] || { emoji: '👍', name: 'Like', icon_url: null };

                const wrapper = document.createElement('div');
                wrapper.className = 'tbc-mr-wrapper';
                wrapper.style.cssText = 'display:inline-flex;align-items:center;';
                wrapper.setAttribute('data-feed-id', feedId || '');

                const single = document.createElement('span');
                single.className = 'tbc-mr-single';
                single.style.cssText = 'cursor:pointer;display:inline-flex;align-items:center;';

                let currentR = defaultR;
                if (feedId && window.tbcMrUserReactions[feedId]) {
                    const ud = window.tbcMrUserReactions[feedId];
                    const r = reactions.find(x => x.id === ud.type);
                    if (r) currentR = r;
                }

                window.tbcMrSetIcon(single, currentR, 35);
                single.title = hasReacted ? currentR.name : 'React';
                if (!hasReacted && !(feedId && window.tbcMrUserReactions[feedId])) {
                    single.classList.add('tbc-mr-inactive');
                } else {
                    single.classList.add('tbc-mr-active');
                    wrapper.setAttribute('data-active-type', currentR.id);
                }

                const dropdown = document.createElement('div');
                dropdown.className = 'tbc-mr-dropdown';
                dropdown.style.cssText = 'position:fixed;border-radius:8px;padding:8px;display:none;gap:4px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:99999;background:var(--fcom-primary-bg,#fff);border:1px solid var(--fcom-primary-border,#e1e4e8);';
                if (reactions.length > 6) { dropdown.style.flexWrap = 'wrap'; dropdown.style.maxWidth = '280px'; }

                reactions.forEach(r => {
                    const rb = document.createElement('span');
                    rb.className = 'tbc-mr-emoji';
                    rb.title = r.name;
                    rb.style.cssText = 'cursor:pointer;padding:6px;border-radius:4px;transition:background 0.2s;display:inline-block;';
                    rb.appendChild(window.tbcMrRenderIcon(r, 35));

                    rb.addEventListener('mouseenter', function() { this.style.background = 'var(--fcom-hover-bg,#f0f0f0)'; });
                    rb.addEventListener('mouseleave', function() { this.style.background = 'transparent'; });
                    rb.addEventListener('click', function(e) {
                        e.stopPropagation();
                        handleClick(button, feedId, r, single, wrapper);
                        dropdown.style.display = 'none';
                    });
                    dropdown.appendChild(rb);
                });

                function posDropdown() {
                    const rect = single.getBoundingClientRect();
                    dropdown.style.left = rect.left + 'px';
                    dropdown.style.top = (rect.top - 8) + 'px';
                    dropdown.style.transform = 'translateY(-100%)';
                    const dr = dropdown.getBoundingClientRect();
                    if (dr.left < 10) dropdown.style.left = '10px';
                    if (dr.right > window.innerWidth - 10) dropdown.style.left = (window.innerWidth - dr.width - 10) + 'px';
                    if (dr.top < 10) { dropdown.style.top = (rect.bottom + 8) + 'px'; dropdown.style.transform = 'none'; }
                }

                let hoverT;
                wrapper.addEventListener('mouseenter', () => { hoverT = setTimeout(() => { dropdown.style.display = 'flex'; posDropdown(); }, 300); });
                wrapper.addEventListener('mouseleave', () => { clearTimeout(hoverT); setTimeout(() => { if (!dropdown.matches(':hover')) dropdown.style.display = 'none'; }, 200); });
                dropdown.addEventListener('mouseleave', () => { dropdown.style.display = 'none'; });

                single.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const cur = feedId && window.tbcMrUserReactions[feedId];
                    if (cur) {
                        const userR = reactions.find(x => x.id === cur.type) || defaultR;
                        handleClick(button, feedId, userR, single, wrapper);
                    } else {
                        handleClick(button, feedId, defaultR, single, wrapper);
                    }
                });

                wrapper.appendChild(single);
                document.body.appendChild(dropdown);

                const svg = button.querySelector('svg');
                if (svg) svg.style.display = 'none';

                const iconEl = button.querySelector('i.el-icon');
                if (iconEl) iconEl.appendChild(wrapper);
                else button.insertBefore(wrapper, button.firstChild);

                createSummary(button, feedId);
            }

            function handleClick(button, feedId, reaction, single, wrapper) {
                const cur = feedId && window.tbcMrUserReactions[feedId];
                const hasReacted = cur || button.classList.contains('react_active');

                if (cur && cur.type === reaction.id) {
                    window.tbcMrSetIcon(single, reactions[0], 35);
                    single.classList.add('tbc-mr-inactive');
                    single.classList.remove('tbc-mr-active');
                    single.title = 'React';
                    wrapper.removeAttribute('data-active-type');
                    delete window.tbcMrUserReactions[feedId];
                    button.classList.remove('react_active');

                    fetch(REST_URL + feedId + '/react', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': WP_NONCE },
                        body: JSON.stringify({ remove: true })
                    }).then(() => { delete window.tbcMrFeedData[feedId]; debouncedSummary(feedId); });
                    return;
                }

                if (cur && cur.type !== reaction.id) {
                    window.tbcMrSetIcon(single, reaction, 35);
                    single.classList.add('tbc-mr-active');
                    single.classList.remove('tbc-mr-inactive');
                    single.title = reaction.name;
                    wrapper.setAttribute('data-active-type', reaction.id);
                    window.tbcMrUserReactions[feedId] = { type: reaction.id, icon_url: reaction.icon_url, emoji: reaction.emoji, name: reaction.name };

                    fetch(TBC_REST_URL + 'swap', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': WP_NONCE },
                        body: JSON.stringify({ object_id: feedId, object_type: 'feed', reaction_type: reaction.id })
                    }).then(() => { delete window.tbcMrFeedData[feedId]; debouncedSummary(feedId); });
                    return;
                }

                window.tbcMrSetIcon(single, reaction, 35);
                single.classList.add('tbc-mr-active');
                single.classList.remove('tbc-mr-inactive');
                single.title = reaction.name;
                wrapper.setAttribute('data-active-type', reaction.id);
                window.tbcMrUserReactions[feedId] = { type: reaction.id, icon_url: reaction.icon_url, emoji: reaction.emoji, name: reaction.name };

                fetch(REST_URL + feedId + '/react', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': WP_NONCE, 'X-TBC-Reaction-Type': reaction.id },
                    body: JSON.stringify({ react_type: 'like' })
                }).then(() => { button.classList.add('react_active'); delete window.tbcMrFeedData[feedId]; debouncedSummary(feedId); });
            }

            function createSummary(button, feedId) {
                if (!feedId) return;
                const container = button.closest('.feed_outer, .fcom_feed_list, [id^="feed_id_"]');
                if (!container) return;

                const reactionsEl = container.querySelector('.fcom_reactions');
                if (!reactionsEl || reactionsEl.querySelector('.tbc-mr-summary')) return;

                const summary = document.createElement('div');
                summary.className = 'tbc-mr-summary';
                summary.setAttribute('data-feed-id', feedId);
                summary.style.cssText = 'display:inline-flex;align-items:center;cursor:pointer;gap:0;';
                summary.addEventListener('click', () => showModal(feedId));

                const avatars = reactionsEl.querySelector('.reactions_avatars');
                if (avatars) avatars.style.display = 'none';

                const countEl = container.querySelector('.fcom_reactions_count');
                if (countEl) {
                    countEl.querySelectorAll('span').forEach(s => {
                        if (s.textContent && s.textContent.toLowerCase().includes('like') && !s.classList.contains('tbc-mr-count')) {
                            s.style.display = 'none';
                        }
                    });
                    countEl.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); showModal(feedId); }, true);
                }

                reactionsEl.appendChild(summary);

                if (window.tbcMrFeedData[feedId]) renderSummary(feedId);
                else debouncedSummary(feedId);
            }

            function showModal(feedId) {
                const modal = document.createElement('div');
                modal.className = 'tbc-mr-modal';
                modal.innerHTML = '<div class="tbc-mr-modal-header"><h3>Reactions</h3><button class="tbc-mr-modal-close">&times;</button></div><div class="tbc-mr-modal-body tbc-mr-loading"><div class="tbc-mr-spinner"></div></div>';
                document.body.appendChild(modal);

                const close = () => modal.remove();
                modal.querySelector('.tbc-mr-modal-close').addEventListener('click', close);
                modal.addEventListener('click', e => { if (e.target === modal) close(); });

                fetch(TBC_REST_URL + 'breakdown/feed/' + feedId + '/users', {
                    method: 'GET',
                    headers: { 'X-WP-Nonce': WP_NONCE }
                }).then(r => r.json()).then(data => {
                    if (!data.breakdown) { modal.querySelector('.tbc-mr-modal-body').innerHTML = '<p class="tbc-mr-empty">No reactions yet</p>'; return; }
                    renderModalContent(modal, data);
                }).catch(() => { modal.querySelector('.tbc-mr-modal-body').innerHTML = '<p class="tbc-mr-error">Failed to load</p>'; });
            }

            function renderModalContent(modal, data) {
                const body = modal.querySelector('.tbc-mr-modal-body');
                body.classList.remove('tbc-mr-loading');

                function iconHtml(item) {
                    if (item.icon_url) return '<img src="' + item.icon_url + '" alt="' + (item.name||'') + '" style="width:22px;height:22px;vertical-align:middle;">';
                    if (item.emoji) {
                        return '<span class="emoji" style="font-size:18px;line-height:22px;vertical-align:middle;" aria-label="' + (item.name||'') + '">' + item.emoji + '</span>';
                    }
                    return '';
                }

                let html = '<div class="tbc-mr-tabs">';
                html += '<button class="tbc-mr-tab active" data-tab="all">All ' + data.total + '</button>';
                data.breakdown.forEach(r => { html += '<button class="tbc-mr-tab" data-tab="' + r.type + '">' + iconHtml(r) + ' ' + r.count + '</button>'; });
                html += '</div><div class="tbc-mr-panels">';

                const all = [];
                data.breakdown.forEach(r => (r.users||[]).forEach(u => all.push({...u, icon_url: r.icon_url, emoji: r.emoji})));
                html += '<div class="tbc-mr-panel active" data-panel="all">' + userList(all, iconHtml) + '</div>';
                data.breakdown.forEach(r => {
                    html += '<div class="tbc-mr-panel" data-panel="' + r.type + '">' + userList(r.users||[], iconHtml, r) + (r.has_more ? '<p class="tbc-mr-more">And more...</p>' : '') + '</div>';
                });
                html += '</div>';
                body.innerHTML = html;

                body.querySelectorAll('.tbc-mr-tab').forEach(tab => {
                    tab.addEventListener('click', function() {
                        body.querySelectorAll('.tbc-mr-tab').forEach(t => t.classList.remove('active'));
                        body.querySelectorAll('.tbc-mr-panel').forEach(p => p.classList.remove('active'));
                        this.classList.add('active');
                        body.querySelector('.tbc-mr-panel[data-panel="' + this.dataset.tab + '"]').classList.add('active');
                    });
                });
            }

            function userList(users, iconHtml, defaultR) {
                if (!users.length) return '<p class="tbc-mr-empty">No users</p>';
                return users.map(u => {
                    const r = u.icon_url || u.emoji ? u : (defaultR || {});
                    return '<a href="' + escHtml(u.user_url) + '" class="tbc-mr-user"><div class="tbc-mr-user-avatar"><img src="' + escHtml(u.avatar) + '"><span class="tbc-mr-user-reaction">' + iconHtml(r) + '</span></div><span class="tbc-mr-user-name">' + escHtml(u.display_name) + '</span></a>';
                }).join('');
            }

            processAllReactionButtons();
            const obs = new MutationObserver(debounce(processAllReactionButtons, 100));
            obs.observe(document.body, { childList: true, subtree: true });
            document.addEventListener('scroll', () => { document.querySelectorAll('.tbc-mr-dropdown').forEach(d => d.style.display = 'none'); }, true);
        })();
        </script>
        <style>
        <?php foreach ($enabled_reactions as $r):
            $hex = ltrim($r['color'] ?? '#1877F2', '#');
            $rgb_r = hexdec(substr($hex, 0, 2));
            $rgb_g = hexdec(substr($hex, 2, 2));
            $rgb_b = hexdec(substr($hex, 4, 2));
            $rid = esc_attr($r['id']);
        ?>
        .tbc-mr-wrapper[data-active-type="<?php echo esc_attr($rid); ?>"] .tbc-mr-single.tbc-mr-active {
            background-color: rgba(<?php echo absint($rgb_r) . ', ' . absint($rgb_g) . ', ' . absint($rgb_b); ?>, 0.12);
        }
        <?php endforeach; ?>
        </style>
        <?php
    }
}
