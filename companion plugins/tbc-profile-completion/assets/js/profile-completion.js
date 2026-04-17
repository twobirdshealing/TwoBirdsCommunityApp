/**
 * TBC Profile Completion — Overlay
 *
 * Persistent full-page overlay for incomplete profiles.
 * Injected on FC portal pages — user must add bio + avatar before
 * they can access the community.
 *
 * Config via window.tbcPcomConfig (set by PHP):
 *   - restUrl:        tbc-pcom/v1/ base
 *   - fcRestUrl:      fluent-community/v2/ base
 *   - restNonce:      WP REST nonce
 *   - communityUrl:   FC portal URL
 *   - username:       current user login
 *   - firstName:      current user first name
 *   - siteName:       site name
 *   - siteLogoUrl:    logo URL
 *   - existing:       {bio, avatar}
 *   - requireAvatar:  bool
 *   - socialProviders: [{key, label, placeholder}] or null
 *
 * @package TBC_ProfileCompletion
 */
(function () {
    'use strict';

    var cfg = window.tbcPcomConfig || {};
    var restUrl   = cfg.restUrl || '';
    var fcRestUrl = cfg.fcRestUrl || '';
    var nonce     = cfg.restNonce || '';

    // ─── State ─────────────────────────────────────────────────────────
    var avatarFile    = null;
    var coverFile     = null;
    var avatarPreview = cfg.existing ? cfg.existing.avatar : '';
    var coverPreview  = cfg.existing ? cfg.existing.coverPhoto : '';
    var bioValue      = cfg.existing ? cfg.existing.bio : '';
    var saving        = false;

    // ─── Build Overlay ─────────────────────────────────────────────────

    function init() {
        var overlay = document.createElement('div');
        overlay.id = 'tbc-pcom-overlay';
        overlay.className = 'tbc-pcom-overlay';
        overlay.innerHTML = buildHTML();
        document.body.appendChild(overlay);

        bindEvents();

        // Pre-fill existing values
        var bioInput = document.getElementById('tbc-pcom-bio');
        if (bioInput && bioValue) {
            bioInput.value = bioValue;
        }

        if (coverPreview) {
            updateCoverPreview(coverPreview);
        }
        if (avatarPreview) {
            updateAvatarPreview(avatarPreview);
        }

        updateButtonState();
    }

    function buildHTML() {
        var name = cfg.firstName || cfg.username || '';
        var greeting = name ? 'Welcome, ' + escHtml(name) + '!' : 'Welcome!';

        // Cover photo area (banner)
        var coverSection =
            '<div class="tbc-pcom__cover" id="tbc-pcom-cover">' +
                '<div class="tbc-pcom__cover-placeholder" id="tbc-pcom-cover-placeholder">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20">' +
                        '<path d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21z" />' +
                    '</svg>' +
                    '<span>Add Cover Photo</span>' +
                '</div>' +
                '<input type="file" id="tbc-pcom-cover-input" accept="image/*" style="display:none" />' +
            '</div>';

        // Avatar (overlapping cover)
        var avatarSection =
            '<div class="tbc-pcom__avatar-area">' +
                '<div class="tbc-pcom__avatar" id="tbc-pcom-avatar">' +
                    '<div class="tbc-pcom__avatar-img" id="tbc-pcom-avatar-preview">' +
                        '<svg class="tbc-pcom__avatar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
                            '<path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0zM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632z" />' +
                        '</svg>' +
                    '</div>' +
                    '<div class="tbc-pcom__avatar-badge">' +
                        '<svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">' +
                            '<path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9z" />' +
                            '<path fill-rule="evenodd" d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.2.32.548.524.926.555a48.776 48.776 0 0 1 3.81.52c1.102.206 1.955 1.137 1.955 2.254v6.143c0 1.117-.853 2.048-1.955 2.254a48.79 48.79 0 0 1-8.545.745 48.79 48.79 0 0 1-8.545-.745C4.353 17.498 3.5 16.567 3.5 15.45V9.307c0-1.117.853-2.048 1.955-2.254a48.79 48.79 0 0 1 3.81-.52c.378-.031.726-.235.926-.555l.821-1.317a2.614 2.614 0 0 1 2.332-1.39zM12 10.5a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5z" clip-rule="evenodd" />' +
                        '</svg>' +
                    '</div>' +
                    '<input type="file" id="tbc-pcom-avatar-input" accept="image/*" style="display:none" />' +
                '</div>' +
                '<div class="tbc-pcom__user-info">' +
                    '<span class="tbc-pcom__display-name">' + escHtml(name) + '</span>' +
                '</div>' +
            '</div>';

        var socialSection = '';
        if (cfg.socialProviders && cfg.socialProviders.length > 0) {
            var socialInputs = '';
            for (var i = 0; i < cfg.socialProviders.length; i++) {
                var sp = cfg.socialProviders[i];
                var existingVal = '';
                if (cfg.existing && cfg.existing.socialLinks && cfg.existing.socialLinks[sp.key]) {
                    existingVal = cfg.existing.socialLinks[sp.key];
                }
                // icon_svg is inline SVG from Fluent Community core — trusted source, not user input.
                socialInputs +=
                    '<div class="tbc-pcom__social-row">' +
                        '<label class="tbc-pcom__social-label">' + escHtml(sp.label) + '</label>' +
                        '<div class="tbc-pcom__social-field">' +
                            '<span class="tbc-pcom__social-icon">' + (sp.icon_svg || '') + '</span>' +
                            '<span class="tbc-pcom__social-prefix">' + escHtml(sp.domain || '') + '</span>' +
                            '<input type="text" class="tbc-pcom__social-input" ' +
                                'name="social_' + escAttr(sp.key) + '" ' +
                                'placeholder="' + escAttr(sp.placeholder || '') + '" ' +
                                'value="' + escAttr(existingVal) + '" />' +
                        '</div>' +
                    '</div>';
            }

            socialSection =
                '<div class="tbc-pcom__field tbc-pcom__social-section">' +
                    '<button type="button" class="tbc-pcom__social-toggle" id="tbc-pcom-social-toggle">+ Add social links</button>' +
                    '<div class="tbc-pcom__social-fields" id="tbc-pcom-social-fields">' +
                        socialInputs +
                    '</div>' +
                '</div>';
        }

        return (
            '<div class="tbc-pcom__card">' +
                '<div class="tbc-pcom__header-text">' +
                    '<p class="tbc-pcom__subtitle">' + greeting + ' Complete your profile to join ' + escHtml(cfg.siteName || 'the community') + '</p>' +
                '</div>' +
                coverSection +
                avatarSection +
                '<div class="tbc-pcom__body">' +
                    '<div class="tbc-pcom__field">' +
                        '<label class="tbc-pcom__label" for="tbc-pcom-bio">About You</label>' +
                        '<textarea id="tbc-pcom-bio" class="tbc-pcom__textarea" ' +
                            'placeholder="Tell us a little about yourself..." ' +
                            'rows="2" maxlength="500"></textarea>' +
                        '<p class="tbc-pcom__hint"><span id="tbc-pcom-bio-count">0</span>/500</p>' +
                    '</div>' +
                    socialSection +
                    '<div class="tbc-pcom__status" id="tbc-pcom-status" role="status" aria-live="polite"></div>' +
                    '<button type="button" class="tbc-pcom__submit" id="tbc-pcom-submit" disabled>' +
                        'Complete Profile' +
                    '</button>' +
                '</div>' +
            '</div>'
        );
    }

    // ─── Events ────────────────────────────────────────────────────────

    function bindEvents() {
        var coverEl    = document.getElementById('tbc-pcom-cover');
        var coverInput = document.getElementById('tbc-pcom-cover-input');
        var avatarEl   = document.getElementById('tbc-pcom-avatar');
        var avatarInput = document.getElementById('tbc-pcom-avatar-input');
        var bioInput    = document.getElementById('tbc-pcom-bio');
        var submitBtn   = document.getElementById('tbc-pcom-submit');

        // Cover photo click
        if (coverEl) {
            coverEl.addEventListener('click', function () { coverInput.click(); });
        }
        if (coverInput) {
            coverInput.addEventListener('change', function () {
                if (this.files && this.files[0]) {
                    coverFile = this.files[0];
                    var reader = new FileReader();
                    reader.onload = function (e) {
                        updateCoverPreview(e.target.result);
                    };
                    reader.readAsDataURL(coverFile);
                }
            });
        }

        // Avatar click
        if (avatarEl) {
            avatarEl.addEventListener('click', function (e) {
                e.stopPropagation(); // Don't trigger cover click
                avatarInput.click();
            });
        }
        if (avatarInput) {
            avatarInput.addEventListener('change', function () {
                if (this.files && this.files[0]) {
                    avatarFile = this.files[0];
                    var reader = new FileReader();
                    reader.onload = function (e) {
                        updateAvatarPreview(e.target.result);
                    };
                    reader.readAsDataURL(avatarFile);
                    updateButtonState();
                }
            });
        }

        if (bioInput) {
            bioInput.addEventListener('input', function () {
                bioValue = this.value;
                var counter = document.getElementById('tbc-pcom-bio-count');
                if (counter) counter.textContent = bioValue.length;
                updateButtonState();
            });
            // Init counter
            var counter = document.getElementById('tbc-pcom-bio-count');
            if (counter) counter.textContent = bioValue.length;
        }

        var socialToggle = document.getElementById('tbc-pcom-social-toggle');
        if (socialToggle) {
            socialToggle.addEventListener('click', function () {
                var fields = document.getElementById('tbc-pcom-social-fields');
                if (fields) {
                    var isOpen = fields.classList.toggle('tbc-pcom__social-fields--open');
                    socialToggle.textContent = isOpen ? '- Hide social links' : '+ Add social links';
                }
            });
        }

        if (submitBtn) {
            submitBtn.addEventListener('click', handleSubmit);
        }
    }

    function updateCoverPreview(src) {
        var coverEl = document.getElementById('tbc-pcom-cover');
        if (!coverEl) return;

        if (src) {
            coverEl.style.backgroundImage = 'url(' + src + ')';
            coverEl.classList.add('tbc-pcom__cover--has-image');
            var placeholder = document.getElementById('tbc-pcom-cover-placeholder');
            if (placeholder) placeholder.style.opacity = '0';
        }
    }

    function updateAvatarPreview(src) {
        var preview = document.getElementById('tbc-pcom-avatar-preview');
        if (!preview) return;

        if (src) {
            preview.innerHTML = '<img src="' + escAttr(src) + '" alt="Profile photo" />';
        }
    }

    function updateButtonState() {
        var btn = document.getElementById('tbc-pcom-submit');
        if (!btn) return;

        var hasAvatar = !!avatarFile || !!avatarPreview;
        var hasBio = bioValue.trim().length > 0;

        var requireAvatar = cfg.requireAvatar !== false;

        btn.disabled = saving || !hasBio || (requireAvatar && !hasAvatar);
    }

    // ─── Submit ────────────────────────────────────────────────────────

    function handleSubmit() {
        if (saving) return;
        saving = true;
        updateButtonState();
        setStatus('Saving your profile...', 'info');

        // 1. Upload photos in parallel
        var mediaData = {};
        var uploads = [];

        if (avatarFile) {
            uploads.push(uploadFile(avatarFile, 'photo').then(function (url) { mediaData.avatar = url; }));
        }
        if (coverFile) {
            uploads.push(uploadFile(coverFile, 'cover photo').then(function (url) { mediaData.cover_photo = url; }));
        }

        // Collect text fields for POST (must include username to avoid
        // FC's can_customize_username validation treating missing as a change)
        var textData = {
            first_name: cfg.firstName || cfg.username || '',
            username: cfg.username,
        };
        if (cfg.lastName) {
            textData.last_name = cfg.lastName;
        }
        if (bioValue.trim()) {
            textData.short_description = bioValue.trim();
        }

        // Collect social links
        if (cfg.socialProviders && cfg.socialProviders.length > 0) {
            var socialLinks = {};
            for (var i = 0; i < cfg.socialProviders.length; i++) {
                var sp = cfg.socialProviders[i];
                var input = document.querySelector('[name="social_' + sp.key + '"]');
                if (input && input.value.trim()) {
                    socialLinks[sp.key] = input.value.trim();
                }
            }
            if (Object.keys(socialLinks).length > 0) {
                textData.social_links = socialLinks;
            }
        }

        Promise.all(uploads)
            .then(function () {
                // 2. POST text fields (bio, social links, name)
                return saveProfileText(textData);
            })
            .then(function () {
                // 3. PUT media fields (avatar, cover_photo) — only if we have any
                if (Object.keys(mediaData).length > 0) {
                    return saveProfileMedia(mediaData);
                }
            })
            .then(markComplete)
            .then(function () {
                setStatus('Profile complete! Redirecting...', 'success');
                setTimeout(function () {
                    window.location.href = cfg.communityUrl || window.location.pathname;
                }, 800);
            })
            .catch(function (err) {
                setStatus(err.message || 'Something went wrong. Please try again.', 'error');
                saving = false;
                updateButtonState();
            });
    }

    function uploadFile(file, label) {
        var formData = new FormData();
        formData.append('file', file);
        formData.append('object_source', 'profile');

        return fetch(fcRestUrl + 'feeds/media-upload', {
            method: 'POST',
            headers: { 'X-WP-Nonce': nonce },
            body: formData,
            credentials: 'same-origin',
        })
        .then(function (r) {
            if (!r.ok) throw new Error('Failed to upload ' + label + '.');
            return r.json();
        })
        .then(function (data) {
            var url = data.media && data.media.url;
            if (!url) throw new Error('Failed to upload ' + label + '.');
            return url;
        });
    }

    /**
     * POST text fields (bio, name, social links, website) via FC's updateProfile.
     */
    function saveProfileText(fields) {
        return fetch(fcRestUrl + 'profile/' + cfg.username, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': nonce,
            },
            body: JSON.stringify({ data: fields }),
            credentials: 'same-origin',
        })
        .then(function (r) {
            if (!r.ok) {
                return r.json().then(function (err) {
                    throw new Error(err.message || 'Failed to save profile.');
                });
            }
            return r.json();
        });
    }

    /**
     * PUT media URLs (avatar, cover_photo) via FC's patchProfile.
     */
    function saveProfileMedia(fields) {
        return fetch(fcRestUrl + 'profile/' + cfg.username, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': nonce,
            },
            body: JSON.stringify({ data: fields }),
            credentials: 'same-origin',
        })
        .then(function (r) {
            if (!r.ok) {
                return r.json().then(function (err) {
                    throw new Error(err.message || 'Failed to save profile media.');
                });
            }
            return r.json();
        });
    }

    function markComplete() {
        return fetch(restUrl + 'complete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': nonce,
            },
            body: '{}',
            credentials: 'same-origin',
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (!data.success) {
                throw new Error(data.message || 'Could not verify profile completion.');
            }
        });
    }

    // ─── UI Helpers ────────────────────────────────────────────────────

    function setStatus(msg, type) {
        var el = document.getElementById('tbc-pcom-status');
        if (!el) return;
        el.textContent = msg;
        el.className = 'tbc-pcom__status tbc-pcom__status--' + (type || 'info');
    }

    function escHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function escAttr(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // ─── Init ──────────────────────────────────────────────────────────

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
