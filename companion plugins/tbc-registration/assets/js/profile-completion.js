/**
 * TBC Profile Completion — Bio + Avatar form
 *
 * Standalone IIFE for logged-in users with incomplete profiles.
 * Two steps:
 *   1. Bio + website + social links (bio required)
 *   2. Avatar + cover photo (avatar required by default, cover optional)
 *
 * Reuses the same CSS classes as registration.js for consistent styling.
 *
 * @package TBC_Registration
 */
(function () {
    'use strict';

    const container = document.getElementById('tbc-profile-completion-app');
    if (!container) return;

    let config;
    try {
        config = JSON.parse(container.getAttribute('data-config'));
    } catch (e) {
        container.innerHTML = '<p class="tbc-reg__error">Failed to load profile completion form.</p>';
        return;
    }

    const API = config.restUrl;
    const FC_API = config.fcRestUrl || API.replace('tbc-reg/v1/', 'fluent-community/v2/');
    const NONCE = config.restNonce;

    // State
    let step = 1;
    let submitting = false;
    let loading = true;
    let globalError = '';

    // Step 1: bio + social
    let bioValue = '';
    let websiteValue = '';
    const socialLinks = {};

    // Step 2: avatar + cover
    let avatarUrl = '';
    let coverUrl = '';

    // ─── API helpers ─────────────────────────────────────────────────

    function apiPost(endpoint, body) {
        return fetch(API + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': NONCE },
            credentials: 'same-origin',
            body: JSON.stringify(body),
        }).then(function (r) { return r.json(); });
    }

    function fcJson(method, endpoint, body) {
        return fetch(FC_API + endpoint, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': NONCE },
            credentials: 'same-origin',
            body: body ? JSON.stringify(body) : undefined,
        }).then(function (r) { return r.json().then(function (d) { return { status: r.status, data: d }; }); });
    }

    function fcPostForm(endpoint, formData) {
        return fetch(FC_API + endpoint, {
            method: 'POST',
            headers: { 'X-WP-Nonce': NONCE },
            credentials: 'same-origin',
            body: formData,
        }).then(function (r) { return r.json().then(function (d) { return { status: r.status, data: d }; }); });
    }

    // ─── Load existing profile data from server-injected config ──────

    function loadExistingProfile() {
        const existing = config.existing || {};

        if (existing.bio) bioValue = existing.bio;
        if (existing.website) websiteValue = existing.website;
        if (existing.avatar && !isPlaceholderAvatar(existing.avatar)) avatarUrl = existing.avatar;
        if (existing.coverPhoto) coverUrl = existing.coverPhoto;

        if (existing.socialLinks && typeof existing.socialLinks === 'object') {
            Object.keys(existing.socialLinks).forEach(function (key) {
                if (existing.socialLinks[key]) {
                    socialLinks[key] = existing.socialLinks[key];
                }
            });
        }

        loading = false;
        render();
    }

    // ─── Step 1: Bio + Social Links ──────────────────────────────────

    async function saveStep1() {
        if (!bioValue.trim()) {
            globalError = 'Please write a short bio before continuing.';
            render();
            return;
        }

        submitting = true;
        render();

        try {
            const username = config.username || '';
            const profileData = {
                username: username,
                first_name: config.firstName || '',
                last_name: config.lastName || '',
                short_description: bioValue.trim(),
            };
            if (websiteValue.trim()) {
                profileData.website = websiteValue.trim();
            }
            const hasLinks = Object.values(socialLinks).some(function (v) { return v.trim() !== ''; });
            if (hasLinks) {
                profileData.social_links = socialLinks;
            }

            const res = await fcJson('POST', 'profile/' + encodeURIComponent(username), { data: profileData });

            if (res.status < 300) {
                step = 2;
            } else {
                globalError = 'Could not save profile. Please try again.';
            }
        } catch (e) {
            globalError = 'Could not save profile. Please try again.';
        }
        submitting = false;
        render();
    }

    // ─── Step 2: Avatar + Cover ──────────────────────────────────────

    async function uploadFile(file, type) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('type', type);

        submitting = true;
        render();

        try {
            const username = config.username || '';
            const objectSource = type === 'avatar' ? 'user_avatar' : 'user_cover_photo';
            fd.append('object_source', objectSource);

            const uploadRes = await fcPostForm('feeds/media-upload', fd);

            if (uploadRes.status >= 300 || !uploadRes.data) {
                globalError = 'Upload failed. You can add it later from your profile.';
                submitting = false;
                render();
                return;
            }

            const fileUrl = (uploadRes.data.media && uploadRes.data.media.url) || uploadRes.data.url || '';
            if (!fileUrl) {
                globalError = 'Upload failed. You can add it later from your profile.';
                submitting = false;
                render();
                return;
            }

            const profileData = {};
            profileData[type] = fileUrl;
            const updateRes = await fcJson('PUT', 'profile/' + encodeURIComponent(username), { data: profileData });

            if (updateRes.status < 300) {
                if (type === 'avatar') avatarUrl = fileUrl;
                if (type === 'cover_photo') coverUrl = fileUrl;
            } else {
                globalError = 'Upload succeeded but profile update failed. You can set it from your profile.';
            }
        } catch (e) {
            globalError = 'Upload failed. You can add it later from your profile.';
        }
        submitting = false;
        render();
    }

    function handleFileSelect(type) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = function () {
            if (input.files && input.files[0]) {
                uploadFile(input.files[0], type);
            }
        };
        input.click();
    }

    async function finish() {
        // Avatar required — validate before completing
        if (config.requireAvatar && !avatarUrl) {
            globalError = 'Please add a profile photo before continuing.';
            render();
            return;
        }

        try {
            const res = await apiPost('register/complete', {});
            if (res && res.success === false && res.missing) {
                globalError = 'Please complete all required fields before continuing.';
                render();
                return;
            }
        } catch (e) { /* non-critical */ }
        window.location.href = config.communityUrl;
    }

    // ─── Render ──────────────────────────────────────────────────────

    function render() {
        if (loading) {
            container.innerHTML = '<div class="tbc-reg__card"><div class="tbc-reg__loading"><div class="tbc-reg__spinner"></div><p>Loading your profile...</p></div></div>';
            return;
        }

        let html = '';

        // Logo above card (same as registration form)
        if (config.siteLogoUrl) {
            html += '<div class="tbc-reg__logo-wrap"><img src="' + esc(config.siteLogoUrl) + '" alt="' + esc(config.siteName || '') + '" class="tbc-reg__logo" /></div>';
        }

        html += '<div class="tbc-reg__card">';

        // Step indicator (2 steps)
        html += '<div class="tbc-reg__steps">';
        for (let i = 1; i <= 2; i++) {
            let cls = i <= step ? ' tbc-reg__step--done' : '';
            if (i === step) cls += ' tbc-reg__step--active';
            html += '<div class="tbc-reg__step' + cls + '"></div>';
        }
        html += '</div>';

        // Title
        html += '<h2 class="tbc-reg__title">' + (step === 1 ? 'About You' : 'Personalize') + '</h2>';

        // Global error
        if (globalError) {
            html += '<div class="tbc-reg__alert tbc-reg__alert--error">' + esc(globalError) + '</div>';
        }

        if (step === 1) {
            html += renderStep1();
        } else {
            html += renderStep2();
        }

        html += '</div>';
        container.innerHTML = html;
        bindEvents();
    }

    function renderStep1() {
        let html = '<div class="tbc-reg__center">';
        html += '<p class="tbc-reg__subtitle">Tell us a bit about yourself</p>';
        html += '</div>';

        // Bio (required)
        html += '<div class="tbc-reg__field">';
        html += '<label class="tbc-reg__label">Bio <span class="tbc-reg__required">*</span></label>';
        html += '<textarea class="tbc-reg__textarea" data-bio placeholder="A short intro about yourself..." rows="3">' + esc(bioValue) + '</textarea>';
        html += '</div>';

        // Website (optional)
        html += '<div class="tbc-reg__field">';
        html += '<label class="tbc-reg__label">Website</label>';
        html += '<input type="url" class="tbc-reg__input" data-website placeholder="https://yoursite.com" value="' + esc(websiteValue) + '" />';
        html += '</div>';

        // Social providers injected from FC's ProfileHelper (matches FC admin config)
        const providers = config.socialProviders || [];

        if (providers.length > 0) {
            html += '<div class="tbc-reg__field">';
            html += '<label class="tbc-reg__label" style="margin-top:8px">Social Links</label>';
            html += '<p class="tbc-reg__instructions">Let others find you on social media</p>';
            html += '</div>';
        }

        providers.forEach(function (p) {
            html += '<div class="tbc-reg__field">';
            html += '<label class="tbc-reg__label">' + esc(p.label) + '</label>';
            html += '<input type="url" class="tbc-reg__input" data-social="' + p.key + '" placeholder="' + esc(p.placeholder) + '" value="' + esc(socialLinks[p.key] || '') + '" />';
            html += '</div>';
        });

        html += '<button type="button" class="tbc-reg__btn tbc-reg__btn--primary" data-action="save-step1"' + dis() + '>' + (submitting ? spinner() : 'Save & Continue') + '</button>';
        return html;
    }

    function renderStep2() {
        const hasPhotos = avatarUrl || coverUrl;
        let html = '<div class="tbc-reg__center">';
        html += '<p class="tbc-reg__subtitle">' + (hasPhotos ? 'Update your profile photo and cover image' : 'Add a profile photo and cover image') + '</p>';
        html += '</div>';

        // Profile header layout — avatar overlapping cover, centered
        html += '<div class="tbc-reg__profile-header">';

        // Cover photo area
        html += '<div class="tbc-reg__cover" data-action="pick-cover">';
        if (coverUrl) {
            html += '<img src="' + esc(coverUrl) + '" alt="Cover" />';
            html += '<div class="tbc-reg__cover-overlay"><span>Change Cover Photo</span></div>';
            html += '<button type="button" class="tbc-reg__remove-btn tbc-reg__remove-btn--cover" data-action="remove-cover" title="Remove cover photo">&times;</button>';
        } else {
            html += '<div class="tbc-reg__cover-placeholder"><span>+ Add Cover Photo</span></div>';
        }
        html += '</div>';

        // Avatar — overlapping cover, centered
        html += '<div class="tbc-reg__avatar-wrap">';
        html += '<div class="tbc-reg__avatar" data-action="pick-avatar">';
        if (avatarUrl) {
            html += '<img src="' + esc(avatarUrl) + '" alt="Avatar" />';
            html += '<div class="tbc-reg__avatar-overlay"><span>Change</span></div>';
        } else {
            const initials = (config.firstName || config.username || 'U').charAt(0).toUpperCase();
            html += '<div class="tbc-reg__avatar-placeholder">' + esc(initials) + '</div>';
        }
        html += '</div>';
        if (avatarUrl) {
            html += '<button type="button" class="tbc-reg__remove-btn tbc-reg__remove-btn--avatar" data-action="remove-avatar" title="Remove avatar">&times;</button>';
        }
        html += '</div>';

        html += '</div>'; // end profile-header

        let finishLabel = 'Skip for now';
        if (avatarUrl) {
            finishLabel = 'Done';
        } else if (config.requireAvatar) {
            finishLabel = 'Add a photo to continue';
        }
        html += '<button type="button" class="tbc-reg__btn tbc-reg__btn--primary" data-action="finish"' + dis() + '>' + finishLabel + '</button>';
        return html;
    }

    // ─── Event Binding ───────────────────────────────────────────────

    function bindEvents() {
        const bioEl = container.querySelector('[data-bio]');
        if (bioEl) {
            bioEl.addEventListener('input', function () { bioValue = bioEl.value; });
        }

        const websiteEl = container.querySelector('[data-website]');
        if (websiteEl) {
            websiteEl.addEventListener('input', function () { websiteValue = websiteEl.value; });
        }

        container.querySelectorAll('[data-social]').forEach(function (el) {
            el.addEventListener('input', function () {
                socialLinks[el.getAttribute('data-social')] = el.value;
            });
        });

        container.querySelectorAll('[data-action]').forEach(function (el) {
            el.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                handleAction(el.getAttribute('data-action'));
            });
        });
    }

    async function removeMedia(type) {
        submitting = true;
        render();
        try {
            const username = config.username || '';
            const profileData = {};
            profileData[type] = '';
            const res = await fcJson('PUT', 'profile/' + encodeURIComponent(username), { data: profileData });
            if (res.status < 300) {
                if (type === 'avatar') avatarUrl = '';
                if (type === 'cover_photo') coverUrl = '';
            } else {
                globalError = 'Could not remove image. Please try again.';
            }
        } catch (e) {
            globalError = 'Could not remove image. Please try again.';
        }
        submitting = false;
        render();
    }

    function handleAction(action) {
        globalError = '';
        switch (action) {
            case 'save-step1': saveStep1(); break;
            case 'pick-avatar': handleFileSelect('avatar'); break;
            case 'pick-cover': handleFileSelect('cover_photo'); break;
            case 'remove-avatar': removeMedia('avatar'); break;
            case 'remove-cover': removeMedia('cover_photo'); break;
            case 'finish': finish(); break;
        }
    }

    // ─── Utilities ───────────────────────────────────────────────────

    function isPlaceholderAvatar(url) {
        return !url || url.indexOf('fluent-community/assets/images/placeholder') !== -1;
    }

    function esc(str) {
        if (str == null) return '';
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    }

    function dis() {
        return submitting ? ' disabled' : '';
    }

    function spinner() {
        return '<span class="tbc-reg__spinner tbc-reg__spinner--inline"></span>';
    }

    // ─── Init ────────────────────────────────────────────────────────
    render(); // show loading spinner
    loadExistingProfile(); // fetch existing data, then re-render
})();
