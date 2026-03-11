<?php
/**
 * Comments Class
 * Comment reaction picker - THE FIX vs fca which only swaps icon
 * This provides an actual dropdown picker for comments with proper API calls
 *
 * @package TBC_Multi_Reactions
 */

namespace TBCMultiReactions;

defined('ABSPATH') || exit;

class Comments {

    public function __construct() {}

    /**
     * Inject comments reaction script
     */
    public function inject_comments_script() {
        $settings = get_option('tbc_mr_settings', []);
        if (empty($settings['enabled'])) {
            return;
        }

        $enabled_reactions = Core::get_enabled_reactions();
        $js_reactions = [];
        foreach ($enabled_reactions as $r) {
            $js_reactions[] = [
                'id'       => $r['id'],
                'name'     => $r['name'],
                'emoji'    => $r['emoji'] ?? null,
                'icon_url' => $r['icon_url'] ?? null,
                'color'    => $r['color'],
            ];
        }

        $tbc_rest_url = rest_url('tbc-multi-reactions/v1/');
        $wp_nonce = wp_create_nonce('wp_rest');
        ?>
        <script>
        (function() {
            'use strict';

            const reactions = <?php echo wp_json_encode($js_reactions, JSON_UNESCAPED_UNICODE); ?>;
            const TBC_REST_URL = '<?php echo esc_js($tbc_rest_url); ?>';
            const WP_NONCE = '<?php echo esc_js($wp_nonce); ?>';
            const DISPLAY_COUNT = 5;
            const OVERLAP = 8;
            const STROKE = 0;

            function escHtml(s) { const d = document.createElement('div'); d.appendChild(document.createTextNode(s || '')); return d.innerHTML; }

            // Track comment reactions: commentId -> {type, ...}
            const commentReactions = {};
            // Track comment breakdown data: commentId -> {reaction_breakdown, reaction_total}
            window.tbcMrCommentData = window.tbcMrCommentData || {};
            // Ordered comment IDs per feed for position-based matching
            window.tbcMrCommentIds = window.tbcMrCommentIds || {};

            // --- Read-only XHR response interception (populates caches from FC's own API calls) ---
            const prevOpen = XMLHttpRequest.prototype.open;
            const prevSend = XMLHttpRequest.prototype.send;

            XMLHttpRequest.prototype.open = function(method, url, ...rest) {
                this._tbcMrCUrl = url;
                this._tbcMrCMethod = method;
                return prevOpen.apply(this, [method, url, ...rest]);
            };

            XMLHttpRequest.prototype.send = function(body) {
                const isCommentAPI = this._tbcMrCUrl && (
                    this._tbcMrCUrl.includes('/feeds?') ||
                    (this._tbcMrCUrl.includes('/feeds/') && !this._tbcMrCUrl.includes('/react')) ||
                    this._tbcMrCUrl.includes('/comments') ||
                    this._tbcMrCUrl.includes('/activities?')
                );
                if (this._tbcMrCMethod === 'GET' && isCommentAPI) {
                    const origReady = this.onreadystatechange;
                    const xhr = this;

                    const handleResponse = function() {
                        if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {
                            try {
                                const data = JSON.parse(xhr.responseText);
                                processCommentApiData(data);
                            } catch(e) {}
                        }
                    };

                    if (typeof this.onreadystatechange === 'function') {
                        const prev = this.onreadystatechange;
                        this.onreadystatechange = function() {
                            handleResponse();
                            return prev.apply(this, arguments);
                        };
                    } else {
                        this.onreadystatechange = handleResponse;
                    }

                }

                return prevSend.apply(this, arguments);
            };

            // --- Process API response to extract comment data ---
            function processCommentApiData(data) {
                let comments = [];

                // From feeds endpoint: data.feeds.data[].comments[]
                if (data && data.feeds && data.feeds.data) {
                    data.feeds.data.forEach(function(feed) {
                        if (feed.comments && Array.isArray(feed.comments)) {
                            comments = comments.concat(feed.comments);
                            // Store ordered comment IDs for position-based matching
                            window.tbcMrCommentIds[String(feed.id)] = feed.comments.map(function(c) { return String(c.id); });
                        }
                    });
                }

                // From single feed endpoint: data.feed.comments[]
                if (data && data.feed && data.feed.comments) {
                    comments = comments.concat(data.feed.comments);
                    // Store ordered comment IDs for position-based matching
                    if (data.feed.id) {
                        window.tbcMrCommentIds[String(data.feed.id)] = data.feed.comments.map(function(c) { return String(c.id); });
                    }
                }

                // From comments endpoint: direct array or data.comments
                if (data && Array.isArray(data)) {
                    comments = comments.concat(data);
                } else if (data && data.comments && Array.isArray(data.comments)) {
                    comments = comments.concat(data.comments);
                }

                if (!comments.length) return;

                let hasNewData = false;
                comments.forEach(function(comment) {
                    if (!comment || !comment.id) return;
                    const cid = String(comment.id);

                    // Store breakdown data
                    if (comment.reaction_breakdown) {
                        window.tbcMrCommentData[cid] = {
                            reaction_breakdown: comment.reaction_breakdown,
                            reaction_total: comment.reaction_total || 0,
                        };
                        hasNewData = true;
                    }

                    // Store user's own reaction
                    if (comment.user_reaction_type) {
                        const r = reactions.find(function(x) { return x.id === comment.user_reaction_type; });
                        if (r) {
                            commentReactions[cid] = {
                                type: comment.user_reaction_type,
                                icon_url: comment.user_reaction_icon_url || r.icon_url,
                                name: comment.user_reaction_name || r.name,
                            };
                        }
                    }
                });

                if (hasNewData) {
                    setTimeout(function() {
                        processAllComments();
                        updateExistingCommentButtons();
                        renderAllCommentSummaries();
                    }, 150);
                }
            }

            // --- Update existing comment buttons with correct icons from API data ---
            function updateExistingCommentButtons() {
                document.querySelectorAll('.tbc-mr-comment-wrapper').forEach(function(wrapper) {
                    const commentEl = wrapper.closest('.fcom_comments_react');
                    if (!commentEl) return;
                    const commentId = getCommentId(commentEl);
                    if (!commentId || !commentReactions[commentId]) return;

                    const single = wrapper.querySelector('.tbc-mr-comment-single');
                    if (!single) return;

                    const r = reactions.find(function(x) { return x.id === commentReactions[commentId].type; });
                    if (r) {
                        window.tbcMrSetIcon(single, r, 35);
                        single.classList.add('tbc-mr-active');
                        single.classList.remove('tbc-mr-inactive');
                        wrapper.setAttribute('data-active-type', r.id);
                    }
                });
            }

            // --- Find comment ID from element ---
            function getCommentId(el) {
                // 1. Find the closest .each_comment container
                var container = el.closest('.each_comment');
                if (!container) return null;

                // 2. Check data-comment-id attribute (FC provides this or we stamped it)
                var cid = container.getAttribute('data-comment-id');
                if (cid && !isNaN(cid)) return String(cid);

                // 3. Parse FC's native id attribute (e.g. id="comment_3082")
                if (container.id) {
                    var m = container.id.match(/^comment_(\d+)$/);
                    if (m) {
                        container.setAttribute('data-comment-id', m[1]);
                        return m[1];
                    }
                }

                // 4. Position-based fallback for older FC versions without id attributes
                var feedEl = el.closest('[id^="feed_id_"]');
                if (!feedEl) return null;

                var feedId = feedEl.id.replace('feed_id_', '');
                var ids = window.tbcMrCommentIds[feedId];
                if (!ids) return null;

                // Only match top-level comments (exclude nested replies)
                var commentsContainer = feedEl.querySelector('.fcom_feed_comments') || feedEl;
                var topLevelComments;
                try {
                    topLevelComments = commentsContainer.querySelectorAll(':scope > .each_comment');
                } catch(e) {
                    topLevelComments = Array.from(feedEl.querySelectorAll('.each_comment')).filter(function(c) {
                        return !c.parentElement.closest('.each_comment');
                    });
                }
                var index = Array.from(topLevelComments).indexOf(container);

                if (index >= 0 && index < ids.length) {
                    container.setAttribute('data-comment-id', ids[index]);
                    return ids[index];
                }
                return null;
            }

            // --- Find feed ID from comment element ---
            function getFeedIdFromComment(el) {
                let cur = el, depth = 0;
                while (cur && depth < 20) {
                    if (cur.id) {
                        const m = cur.id.match(/^feed_id_(\d+)$/i);
                        if (m) return m[1];
                    }
                    const fid = cur.getAttribute('data-feed-id') || cur.getAttribute('data-feed_id');
                    if (fid && !isNaN(fid)) return String(fid);
                    cur = cur.parentElement;
                    depth++;
                }
                return null;
            }

            // --- Find comment container element ---
            function getCommentContainer(el) {
                let cur = el, depth = 0;
                while (cur && depth < 10) {
                    if (cur.classList && (cur.classList.contains('each_comment') || cur.classList.contains('comment_item') || cur.classList.contains('fcom_single_comment'))) {
                        return cur;
                    }
                    cur = cur.parentElement;
                    depth++;
                }
                return null;
            }

            // --- Check if comment is liked ---
            function isCommentLiked(el) {
                const icon = el.querySelector('i.el-icon');
                if (icon && icon.classList.contains('user_reacted')) return true;
                const svg = el.querySelector('svg');
                if (svg) {
                    const path = svg.querySelector('path');
                    if (path) {
                        const d = path.getAttribute('d') || '';
                        if (d.includes('M20.884 13.19')) return true;
                    }
                }
                return false;
            }

            // --- Process comment reaction buttons ---
            function processAllComments() {
                document.querySelectorAll('.fcom_comments_react:not([data-tbc-mr-comment-processed])').forEach(processComment);
            }

            function processComment(el) {
                if (el.hasAttribute('data-tbc-mr-comment-processed')) return;
                el.setAttribute('data-tbc-mr-comment-processed', 'true');

                // Resolve IDs now (may be null if XHR data hasn't arrived yet)
                var initCommentId = getCommentId(el);
                const feedId = getFeedIdFromComment(el);
                const iconEl = el.querySelector('i.el-icon');
                if (!iconEl) return;

                const svg = iconEl.querySelector('svg');
                if (svg) svg.style.display = 'none';

                // Helper: resolve commentId at call time (not stale closure)
                function resolveCommentId() {
                    return getCommentId(el);
                }

                // Create wrapper
                const wrapper = document.createElement('span');
                wrapper.className = 'tbc-mr-comment-wrapper';
                wrapper.style.cssText = 'display:inline-flex;align-items:center;position:relative;';

                // Single icon button
                const single = document.createElement('span');
                single.className = 'tbc-mr-comment-single';
                single.style.cssText = 'cursor:pointer;display:inline-flex;align-items:center;';

                const defaultR = reactions[0] || { emoji: '👍', name: 'Like', icon_url: null };
                const isLiked = isCommentLiked(el);

                // Check for existing reaction from API data
                let currentR = defaultR;
                if (initCommentId && commentReactions[initCommentId]) {
                    const r = reactions.find(function(x) { return x.id === commentReactions[initCommentId].type; });
                    if (r) currentR = r;
                }

                window.tbcMrSetIcon(single, currentR, 35);
                if (isLiked || (initCommentId && commentReactions[initCommentId])) {
                    single.classList.add('tbc-mr-active');
                    single.classList.remove('tbc-mr-inactive');
                    wrapper.setAttribute('data-active-type', currentR.id);
                } else {
                    single.classList.add('tbc-mr-inactive');
                    single.classList.remove('tbc-mr-active');
                }

                // Dropdown picker (smaller than feed picker)
                const dropdown = document.createElement('div');
                dropdown.className = 'tbc-mr-comment-dropdown';
                dropdown.style.cssText = 'position:fixed;border-radius:6px;padding:4px;display:none;gap:2px;box-shadow:0 3px 10px rgba(0,0,0,0.12);z-index:99999;background:var(--fcom-primary-bg,#fff);border:1px solid var(--fcom-primary-border,#e1e4e8);';
                if (reactions.length > 6) { dropdown.style.flexWrap = 'wrap'; dropdown.style.maxWidth = '220px'; }

                reactions.forEach(function(r) {
                    const rb = document.createElement('span');
                    rb.className = 'tbc-mr-comment-emoji';
                    rb.title = r.name;
                    rb.style.cssText = 'cursor:pointer;padding:4px;border-radius:4px;transition:background 0.15s;display:inline-block;';
                    rb.appendChild(window.tbcMrRenderIcon(r, 35));

                    rb.addEventListener('mouseenter', function() { this.style.background = 'var(--fcom-hover-bg,#f0f0f0)'; });
                    rb.addEventListener('mouseleave', function() { this.style.background = 'transparent'; });
                    rb.addEventListener('click', function(e) {
                        e.stopPropagation();
                        e.preventDefault();
                        var cid = resolveCommentId();
                        handleCommentReaction(el, cid, feedId, r, single);
                        dropdown.style.display = 'none';
                    });
                    dropdown.appendChild(rb);
                });

                // Position dropdown
                function posDropdown() {
                    const rect = single.getBoundingClientRect();
                    dropdown.style.left = rect.left + 'px';
                    dropdown.style.top = (rect.top - 6) + 'px';
                    dropdown.style.transform = 'translateY(-100%)';
                    const dr = dropdown.getBoundingClientRect();
                    if (dr.left < 10) dropdown.style.left = '10px';
                    if (dr.right > window.innerWidth - 10) dropdown.style.left = (window.innerWidth - dr.width - 10) + 'px';
                    if (dr.top < 10) { dropdown.style.top = (rect.bottom + 6) + 'px'; dropdown.style.transform = 'none'; }
                }

                let hoverT;
                wrapper.addEventListener('mouseenter', function() { hoverT = setTimeout(function() { dropdown.style.display = 'flex'; posDropdown(); }, 300); });
                wrapper.addEventListener('mouseleave', function() { clearTimeout(hoverT); setTimeout(function() { if (!dropdown.matches(':hover')) dropdown.style.display = 'none'; }, 200); });
                dropdown.addEventListener('mouseleave', function() { dropdown.style.display = 'none'; });

                // Click for quick toggle
                single.addEventListener('click', function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    var cid = resolveCommentId();
                    var cur = cid && commentReactions[cid];
                    if (cur || isCommentLiked(el)) {
                        handleCommentRemove(el, cid, feedId, single);
                    } else {
                        handleCommentReaction(el, cid, feedId, defaultR, single);
                    }
                });

                wrapper.appendChild(single);
                document.body.appendChild(dropdown);
                iconEl.appendChild(wrapper);

                // Always create summary — fetchCommentBreakdown resolves data via API
                createCommentSummary(el);
            }

            // --- Comment Reaction Summary ---
            function createCommentSummary(reactButton) {
                // Hide FC's native tooltip trigger (the "🌺 2" count + Likes popup)
                const nativeTooltip = reactButton.querySelector('.el-tooltip__trigger, .el-tooltip_trigger');
                if (nativeTooltip) nativeTooltip.style.display = 'none';

                // Place summary in .reply_box (right side, absolutely positioned)
                const replyBox = reactButton.closest('.reply_box');
                if (!replyBox || replyBox.querySelector('.tbc-mr-comment-summary')) return;

                // Create our summary element (commentId resolved at render/click time)
                const summary = document.createElement('span');
                summary.className = 'tbc-mr-comment-summary';
                summary.setAttribute('data-react-button', 'true');
                summary.style.cssText = 'display:none;align-items:center;cursor:pointer;gap:0;position:absolute;right:0;top:50%;transform:translateY(-50%);';
                summary.addEventListener('click', function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    var cid = getCommentId(reactButton);
                    if (cid) showCommentModal(cid);
                });

                // Store reference to react button for later ID resolution
                summary._tbcReactButton = reactButton;

                // Position reply_box as relative anchor
                replyBox.style.position = 'relative';
                replyBox.appendChild(summary);

                // Try to resolve commentId and fetch data
                var commentId = getCommentId(reactButton);
                if (commentId) {
                    summary.setAttribute('data-comment-id', commentId);
                    fetchCommentBreakdown(commentId);
                }
            }

            function renderAllCommentSummaries() {
                document.querySelectorAll('.tbc-mr-comment-summary').forEach(function(el) {
                    var cid = el.getAttribute('data-comment-id');
                    // Try to resolve if not yet stamped
                    if (!cid && el._tbcReactButton) {
                        cid = getCommentId(el._tbcReactButton);
                        if (cid) el.setAttribute('data-comment-id', cid);
                    }
                    if (cid) fetchCommentBreakdown(cid);
                });
            }

            function renderCommentSummary(commentId) {
                const el = document.querySelector('.tbc-mr-comment-summary[data-comment-id="' + commentId + '"]');
                if (!el) return;

                const fd = window.tbcMrCommentData[commentId];
                if (!fd || !fd.reaction_breakdown || !fd.reaction_breakdown.length || fd.reaction_total === 0) {
                    el.style.display = 'none';
                    return;
                }

                const bd = fd.reaction_breakdown;
                const total = fd.reaction_total || 0;

                let html = '';
                bd.slice(0, DISPLAY_COUNT).forEach(function(item, i) {
                    const ml = i === 0 ? '0' : (-OVERLAP) + 'px';
                    if (item.icon_url) {
                        html += '<img src="' + item.icon_url + '" class="tbc-mr-comment-summary-icon" style="margin-left:' + ml + ';z-index:' + (10+i) + ';--tbc-stroke:' + STROKE + 'px;" alt="' + (item.name || '') + '">';
                    } else if (item.emoji) {
                        html += '<span class="tbc-mr-comment-summary-icon emoji" style="margin-left:' + ml + ';z-index:' + (10+i) + ';--tbc-stroke:' + STROKE + 'px;" aria-label="' + (item.name || '') + '">' + item.emoji + '</span>';
                    }
                });
                html += '<span class="tbc-mr-comment-count" style="margin-left:4px;">' + total + '</span>';
                el.innerHTML = html;
                el.style.display = 'inline-flex';
            }

            // Fetch breakdown from REST API (used for initial load and refresh)
            function fetchCommentBreakdown(commentId) {
                if (!commentId) return;
                var fd = window.tbcMrCommentData[commentId];
                if (fd && fd.reaction_breakdown) {
                    renderCommentSummary(commentId);
                    return;
                }
                fetch(TBC_REST_URL + 'breakdown/comment/' + commentId, {
                    method: 'GET',
                    headers: { 'X-WP-Nonce': WP_NONCE }
                }).then(function(r) { return r.json(); }).then(function(data) {
                    if (data.breakdown && data.breakdown.length) {
                        window.tbcMrCommentData[commentId] = {
                            reaction_breakdown: data.breakdown,
                            reaction_total: data.total || 0,
                        };
                    }
                    // Update button icon from API response (fixes timing race with XHR interception)
                    if (data.user_reaction_type) {
                        var ur = reactions.find(function(x) { return x.id === data.user_reaction_type; });
                        if (ur) {
                            commentReactions[commentId] = { type: data.user_reaction_type };
                            document.querySelectorAll('.tbc-mr-comment-wrapper').forEach(function(wrapper) {
                                var cEl = wrapper.closest('.fcom_comments_react');
                                if (!cEl) return;
                                var cid = getCommentId(cEl);
                                if (cid === commentId) {
                                    var single = wrapper.querySelector('.tbc-mr-comment-single');
                                    if (single) {
                                        window.tbcMrSetIcon(single, ur, 15);
                                        single.classList.add('tbc-mr-active');
                                        single.classList.remove('tbc-mr-inactive');
                                        wrapper.setAttribute('data-active-type', ur.id);
                                    }
                                }
                            });
                        }
                    }
                    renderCommentSummary(commentId);
                }).catch(function() {});
            }

            function refreshCommentSummary(commentId) {
                // Fetch fresh breakdown from API (cache-busting after reaction change)
                fetch(TBC_REST_URL + 'breakdown/comment/' + commentId, {
                    method: 'GET',
                    headers: { 'X-WP-Nonce': WP_NONCE }
                }).then(function(r) { return r.json(); }).then(function(data) {
                    if (data.breakdown) {
                        window.tbcMrCommentData[commentId] = {
                            reaction_breakdown: data.breakdown,
                            reaction_total: data.total || 0,
                        };
                    } else {
                        delete window.tbcMrCommentData[commentId];
                    }
                    renderCommentSummary(commentId);
                }).catch(function() {});
            }

            // --- Comment Breakdown Modal ---
            function showCommentModal(commentId) {
                const modal = document.createElement('div');
                modal.className = 'tbc-mr-modal';
                modal.innerHTML = '<div class="tbc-mr-modal-header"><h3>Reactions</h3><button class="tbc-mr-modal-close">&times;</button></div><div class="tbc-mr-modal-body tbc-mr-loading"><div class="tbc-mr-spinner"></div></div>';
                document.body.appendChild(modal);

                const close = function() { modal.remove(); };
                modal.querySelector('.tbc-mr-modal-close').addEventListener('click', close);
                modal.addEventListener('click', function(e) { if (e.target === modal) close(); });

                fetch(TBC_REST_URL + 'breakdown/comment/' + commentId + '/users', {
                    method: 'GET',
                    headers: { 'X-WP-Nonce': WP_NONCE }
                }).then(function(r) { return r.json(); }).then(function(data) {
                    if (!data.breakdown) {
                        modal.querySelector('.tbc-mr-modal-body').innerHTML = '<p class="tbc-mr-empty">No reactions yet</p>';
                        return;
                    }
                    renderCommentModalContent(modal, data);
                }).catch(function() {
                    modal.querySelector('.tbc-mr-modal-body').innerHTML = '<p class="tbc-mr-error">Failed to load</p>';
                });
            }

            function renderCommentModalContent(modal, data) {
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
                data.breakdown.forEach(function(r) { html += '<button class="tbc-mr-tab" data-tab="' + r.type + '">' + iconHtml(r) + ' ' + r.count + '</button>'; });
                html += '</div><div class="tbc-mr-panels">';

                // All panel
                const all = [];
                data.breakdown.forEach(function(r) { (r.users||[]).forEach(function(u) { all.push(Object.assign({}, u, {icon_url: r.icon_url, emoji: r.emoji})); }); });
                html += '<div class="tbc-mr-panel active" data-panel="all">' + userList(all, iconHtml) + '</div>';
                data.breakdown.forEach(function(r) {
                    html += '<div class="tbc-mr-panel" data-panel="' + r.type + '">' + userList(r.users||[], iconHtml, r) + (r.has_more ? '<p class="tbc-mr-more">And more...</p>' : '') + '</div>';
                });
                html += '</div>';
                body.innerHTML = html;

                body.querySelectorAll('.tbc-mr-tab').forEach(function(tab) {
                    tab.addEventListener('click', function() {
                        body.querySelectorAll('.tbc-mr-tab').forEach(function(t) { t.classList.remove('active'); });
                        body.querySelectorAll('.tbc-mr-panel').forEach(function(p) { p.classList.remove('active'); });
                        tab.classList.add('active');
                        body.querySelector('.tbc-mr-panel[data-panel="' + tab.dataset.tab + '"]').classList.add('active');
                    });
                });
            }

            function userList(users, iconHtml, defaultR) {
                if (!users.length) return '<p class="tbc-mr-empty">No users</p>';
                return users.map(function(u) {
                    const r = u.icon_url || u.emoji ? u : (defaultR || {});
                    return '<a href="' + escHtml(u.user_url) + '" class="tbc-mr-user"><div class="tbc-mr-user-avatar"><img src="' + escHtml(u.avatar) + '"><span class="tbc-mr-user-reaction">' + iconHtml(r) + '</span></div><span class="tbc-mr-user-name">' + escHtml(u.display_name) + '</span></a>';
                }).join('');
            }

            // --- Handle comment reaction (add or swap) ---
            function handleCommentReaction(el, commentId, feedId, reaction, single) {
                const cur = commentId && commentReactions[commentId];

                // Same reaction = remove
                if (cur && cur.type === reaction.id) {
                    handleCommentRemove(el, commentId, feedId, single);
                    return;
                }

                // Swap (already reacted, different type)
                if (cur) {
                    window.tbcMrSetIcon(single, reaction, 35);
                    single.classList.add('tbc-mr-active');
                    single.classList.remove('tbc-mr-inactive');
                    single.parentElement.setAttribute('data-active-type', reaction.id);
                    commentReactions[commentId] = { type: reaction.id };

                    fetch(TBC_REST_URL + 'swap', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': WP_NONCE },
                        body: JSON.stringify({ object_id: commentId, object_type: 'comment', reaction_type: reaction.id })
                    }).then(function() {
                        delete window.tbcMrCommentData[commentId];
                        refreshCommentSummary(commentId);
                    });
                    return;
                }

                // New reaction - call FC's comment endpoint with our header
                window.tbcMrSetIcon(single, reaction, 35);
                single.classList.add('tbc-mr-active');
                single.classList.remove('tbc-mr-inactive');
                single.parentElement.setAttribute('data-active-type', reaction.id);
                commentReactions[commentId] = { type: reaction.id };

                if (feedId && commentId) {
                    const url = '<?php echo esc_js(rest_url('fluent-community/v2/feeds/')); ?>' + feedId + '/comments/' + commentId + '/reactions';
                    fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-WP-Nonce': WP_NONCE,
                            'X-TBC-Reaction-Type': reaction.id,
                        },
                        body: JSON.stringify({ state: 1 })
                    }).then(function() {
                        delete window.tbcMrCommentData[commentId];
                        refreshCommentSummary(commentId);
                    });
                }
            }

            // --- Handle comment reaction remove ---
            function handleCommentRemove(el, commentId, feedId, single) {
                const defaultR = reactions[0] || { emoji: '👍', name: 'Like', icon_url: null };
                window.tbcMrSetIcon(single, defaultR, 35);
                single.classList.add('tbc-mr-inactive');
                single.classList.remove('tbc-mr-active');
                single.parentElement.removeAttribute('data-active-type');
                delete commentReactions[commentId];

                if (feedId && commentId) {
                    const url = '<?php echo esc_js(rest_url('fluent-community/v2/feeds/')); ?>' + feedId + '/comments/' + commentId + '/reactions';
                    fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': WP_NONCE },
                        body: JSON.stringify({ state: 0 })
                    }).then(function() {
                        delete window.tbcMrCommentData[commentId];
                        refreshCommentSummary(commentId);
                    });
                }
            }

            // --- Init ---
            processAllComments();

            // Watch for new comments
            let processT;
            const obs = new MutationObserver(function() {
                clearTimeout(processT);
                processT = setTimeout(function() {
                    processAllComments();
                    updateExistingCommentButtons();
                    renderAllCommentSummaries();
                }, 100);
            });
            obs.observe(document.body, { childList: true, subtree: true });

            // Close comment dropdowns on scroll
            document.addEventListener('scroll', function() {
                document.querySelectorAll('.tbc-mr-comment-dropdown').forEach(function(d) { d.style.display = 'none'; });
            }, true);
        })();
        </script>
        <style>
            .tbc-mr-comment-wrapper .tbc-mr-icon,
            .tbc-mr-comment-wrapper .emoji {
                width: 35px !important;
                height: 35px !important;
            }
            .fcom_comments_react[data-tbc-mr-comment-processed] i.el-icon svg {
                display: none !important;
            }
            .fcom_comments_react[data-tbc-mr-comment-processed] > [class*="el-tooltip"] {
                display: none !important;
            }
        </style>
        <style>
        <?php foreach ($enabled_reactions as $r):
            $hex = ltrim($r['color'] ?? '#1877F2', '#');
            $rgb_r = hexdec(substr($hex, 0, 2));
            $rgb_g = hexdec(substr($hex, 2, 2));
            $rgb_b = hexdec(substr($hex, 4, 2));
            $rid = esc_attr($r['id']);
        ?>
        .tbc-mr-comment-wrapper[data-active-type="<?php echo esc_attr($rid); ?>"] .tbc-mr-comment-single.tbc-mr-active {
            background-color: rgba(<?php echo absint($rgb_r) . ', ' . absint($rgb_g) . ', ' . absint($rgb_b); ?>, 0.12);
        }
        <?php endforeach; ?>
        </style>
        <?php
    }
}
