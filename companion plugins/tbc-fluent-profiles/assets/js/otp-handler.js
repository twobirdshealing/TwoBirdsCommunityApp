/**
 * TBC OTP Handler
 *
 * Responsibilities:
 *   1. XHR interception — catch profile save responses containing otp_required
 *   2. OTP modal — show/hide, code entry, verify, resend, voice call
 *   3. Form resubmission — replay original request with session key after verification
 *
 * Works in two contexts:
 *   - Password recovery (full-page mode, bootstrapped from server)
 *   - Profile update (intercepts FC REST /profile save + tbc_fp_save_fields AJAX)
 *
 * Registration uses its own JS (registration.js) and does NOT use this handler.
 *
 * Uses unified REST OTP endpoints:
 *   POST /tbc-fp/v1/otp/verify
 *   POST /tbc-fp/v1/otp/resend
 *   POST /tbc-fp/v1/otp/voice
 *
 * @package TBC_Fluent_Profiles
 */
(function () {
    'use strict';

    // ─── Config ──────────────────────────────────────────────────────────
    // Provided by wp_localize_script ('tbcOtp') or server-rendered window.tbcOtpFullpage
    const cfg = window.tbcOtp || {};
    const fullpage = window.tbcOtpFullpage || null;

    const restUrl      = fullpage ? fullpage.restUrl : (cfg.rest_url || '');
    const restNonce    = fullpage ? fullpage.restNonce : (cfg.rest_nonce || '');
    const voiceEnabled = fullpage ? fullpage.voiceEnabled : (cfg.voice_enabled || false);
    const i18n         = cfg.i18n || {};

    // ─── State ───────────────────────────────────────────────────────────
    let currentSessionKey   = '';
    let currentContext       = ''; // 'recovery' | 'profile'
    let originalFormData    = null;
    let originalRequestUrl  = '';
    let originalRequestMethod = '';
    let resendCooldown      = false;
    let voiceCooldown       = false;
    let pendingSessionKey   = null; // Set after OTP verified; next profile save injects header

    // ─── Modal HTML (injected once) ──────────────────────────────────────
    const MODAL_HTML = `
        <div class="tbc-otp-overlay" id="tbc-otp-overlay">
            <div class="tbc-otp-modal" role="dialog" aria-modal="true">
                <div class="tbc-otp-modal__header">
                    <h2 class="tbc-otp-modal__title">${esc(i18n.verify_btn || 'Phone Verification')}</h2>
                </div>
                <div class="tbc-otp-modal__body">
                    <p class="tbc-otp-modal__instructions" id="tbc-otp-instructions"></p>
                    <div class="tbc-otp-modal__input-wrap">
                        <input type="text" id="tbc-otp-code" class="tbc-otp-modal__input"
                               inputmode="numeric" autocomplete="one-time-code"
                               maxlength="6" pattern="[0-9]{6}"
                               placeholder="${esc(i18n.code_placeholder || '000000')}" autofocus />
                    </div>
                    <div class="tbc-otp-modal__status" id="tbc-otp-status" role="status" aria-live="polite"></div>
                    <div class="tbc-otp-modal__actions">
                        <button type="button" class="tbc-otp-modal__btn tbc-otp-modal__btn--primary" id="tbc-otp-verify-btn">
                            ${esc(i18n.verify_btn || 'Verify Code')}
                        </button>
                        <button type="button" class="tbc-otp-modal__btn tbc-otp-modal__btn--secondary" id="tbc-otp-back-btn">
                            ${esc(i18n.back_btn || 'Go Back')}
                        </button>
                    </div>
                    <div class="tbc-otp-modal__links">
                        <a href="#" class="tbc-otp-modal__link" id="tbc-otp-resend">${esc(i18n.resend_link || 'Resend SMS')}</a>
                        <a href="#" class="tbc-otp-modal__link tbc-otp-modal__link--voice" id="tbc-otp-voice"
                           style="${voiceEnabled ? '' : 'display:none;'}">${esc(i18n.voice_link || 'Try voice call')}</a>
                    </div>
                </div>
            </div>
        </div>`;

    // ─── Init ────────────────────────────────────────────────────────────

    if (fullpage) {
        // Full-page mode (password recovery): modal is already in the DOM
        initFullpageMode();
    } else {
        // Overlay mode: intercept profile save AJAX/REST responses
        installXHRInterceptor();
    }

    // ─── Full-page mode ──────────────────────────────────────────────────

    function initFullpageMode() {
        currentSessionKey = fullpage.sessionKey;
        currentContext = fullpage.context;

        // Update instructions with phone
        const instr = document.getElementById('tbc-otp-instructions');
        if (instr) {
            instr.textContent = (i18n.enter_code || 'Enter the 6-digit code sent to') + ' ' + fullpage.phoneMasked;
        }

        bindModalEvents();
    }

    // ─── XHR Interceptor ─────────────────────────────────────────────────
    //
    // Profile save only (registration uses its own JS form).
    //
    // FC sets xhr.onload BEFORE send(). Server returns 422 for OTP-required,
    // so FC's error path runs first (clears loading state). Our addEventListener
    // fires second, detects OTP, shows modal. After verification we click FC's
    // save button — pendingSessionKey injects the session header on the retry.

    function installXHRInterceptor() {
        const OrigXHR = XMLHttpRequest;
        const origOpen = OrigXHR.prototype.open;
        const origSend = OrigXHR.prototype.send;

        OrigXHR.prototype.open = function (method, url) {
            this._tbcUrl = url;
            this._tbcMethod = (method || '').toUpperCase();
            return origOpen.apply(this, arguments);
        };

        OrigXHR.prototype.send = function (body) {
            // Bypass flag: resubmit after OTP verification should skip our interceptor
            if (this._tbcOtpBypass) {
                return origSend.apply(this, arguments);
            }

            const xhr = this;
            const url = xhr._tbcUrl || '';
            const method = xhr._tbcMethod || '';

            // ── Classify the request (profile save only) ──
            const isAdminAjax = method === 'POST' && url.indexOf('admin-ajax.php') !== -1;
            let isAjaxProfileSave = false;

            if (isAdminAjax) {
                const bodyStr = typeof body === 'string' ? body : (body instanceof FormData ? formDataToString(body) : '');
                isAjaxProfileSave = bodyStr.indexOf('tbc_fp_save_fields') !== -1;
            }

            const isRestProfileSave = !isAdminAjax
                && (method === 'POST' || method === 'PUT' || method === 'PATCH')
                && url.indexOf('/profile') !== -1;

            const isProfileSave = isAjaxProfileSave || isRestProfileSave;

            // Skip if not a profile save
            if (!isProfileSave) {
                return origSend.apply(this, arguments);
            }

            // Helper: extract OTP data from parsed response
            function extractOtpData(parsed) {
                if (parsed && parsed.otp_required) return parsed;
                if (parsed && parsed.data && parsed.data.otp_required) return parsed.data;
                return null;
            }

            // Helper: handle OTP detection
            function handleOtpDetected(otpData) {
                currentSessionKey = otpData.session_key;
                originalFormData = body;
                originalRequestUrl = url;
                originalRequestMethod = method;
                currentContext = 'profile';

                // Dismiss FC's error notification (422 triggers FC's error path before our listener)
                dismissFCNotifications();

                showModal(otpData.phone_masked);
            }

            // ── Profile save with pending verified session — inject header ──
            if (pendingSessionKey) {
                xhr.setRequestHeader('X-TBC-FP-Session', pendingSessionKey);
                pendingSessionKey = null;
                return origSend.apply(this, arguments);
            }

            // ── Listen for OTP response without suppressing FC's handler ──
            xhr.addEventListener('load', function () {
                try {
                    var data = JSON.parse(xhr.responseText);
                    var otpData = extractOtpData(data);
                    if (otpData) {
                        handleOtpDetected(otpData);
                    }
                } catch (ex) {}
            });

            return origSend.apply(this, arguments);
        };
    }

    // ─── Modal Show / Hide ───────────────────────────────────────────────

    function showModal(phoneMasked) {
        // Remove existing modal if any
        const existing = document.getElementById('tbc-otp-overlay');
        if (existing) existing.remove();

        // Inject modal HTML
        const wrapper = document.createElement('div');
        wrapper.innerHTML = MODAL_HTML;
        document.body.appendChild(wrapper.firstElementChild);

        // Set instructions text
        const instr = document.getElementById('tbc-otp-instructions');
        if (instr) {
            instr.textContent = (i18n.enter_code || 'Enter the 6-digit code sent to') + ' ' + (phoneMasked || '');
        }

        bindModalEvents();

        // Focus input
        const input = document.getElementById('tbc-otp-code');
        if (input) setTimeout(() => input.focus(), 100);
    }

    function hideModal() {
        const overlay = document.getElementById('tbc-otp-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 200);
        }
    }

    // ─── Modal Events ────────────────────────────────────────────────────

    function bindModalEvents() {
        const verifyBtn = document.getElementById('tbc-otp-verify-btn');
        const backBtn   = document.getElementById('tbc-otp-back-btn');
        const resendLink = document.getElementById('tbc-otp-resend');
        const voiceLink = document.getElementById('tbc-otp-voice');
        const codeInput = document.getElementById('tbc-otp-code');

        if (verifyBtn) verifyBtn.addEventListener('click', handleVerify);
        if (backBtn) backBtn.addEventListener('click', handleBack);
        if (resendLink) resendLink.addEventListener('click', handleResend);
        if (voiceLink) voiceLink.addEventListener('click', handleVoice);

        // Enter key on input
        if (codeInput) {
            codeInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleVerify();
                }
            });

            // Numeric only
            codeInput.addEventListener('input', function () {
                this.value = this.value.replace(/\D/g, '').slice(0, 6);
            });
        }
    }

    // ─── Verify ──────────────────────────────────────────────────────────

    function handleVerify() {
        const code = (document.getElementById('tbc-otp-code') || {}).value || '';
        if (!code || code.length < 4) {
            setStatus('Please enter the verification code.', 'error');
            return;
        }

        setStatus(i18n.verifying || 'Verifying...', 'info');
        setVerifyEnabled(false);

        restPost('verify', {
            code: code,
            session_key: currentSessionKey,
        }, function (res) {
            if (res.success) {
                setStatus(i18n.verified || 'Verified!', 'success');

                if (currentContext === 'recovery' && res.redirect_url) {
                    // Password recovery: redirect to reset form
                    setTimeout(() => { window.location.href = res.redirect_url; }, 800);
                } else {
                    // Profile: resubmit with session key
                    setTimeout(() => resubmitOriginal(), 600);
                }
            } else {
                setStatus(res.message || 'Invalid code.', 'error');
                setVerifyEnabled(true);
            }
        });
    }

    // ─── Resubmit original profile save ──────────────────────────────────

    function resubmitOriginal() {
        hideModal();

        if (!originalFormData) {
            window.location.reload();
            return;
        }

        // Re-trigger FC's own save button for native SPA behavior
        pendingSessionKey = currentSessionKey;
        setTimeout(function () {
            var btn = document.querySelector('.fcom_update_profile .fcom_primary_button');
            if (btn) {
                btn.click();
            } else {
                // Fallback: manual XHR resubmit
                pendingSessionKey = null;
                resubmitProfileSave();
            }
        }, 100);
    }

    function resubmitProfileSave() {
        var xhr = new XMLHttpRequest();
        xhr._tbcOtpBypass = true;
        xhr.open(originalRequestMethod || 'POST', originalRequestUrl, true);
        xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
        xhr.setRequestHeader('X-TBC-FP-Session', currentSessionKey);
        xhr.setRequestHeader('X-WP-Nonce', getWPRestNonce());
        xhr.onload = function () { showProfileSaveSuccess(); };
        xhr.onerror = function () { window.location.reload(); };
        xhr.send(originalFormData);
    }

    // ─── Resend / Voice ──────────────────────────────────────────────────

    function handleResend(e) {
        e.preventDefault();
        if (resendCooldown) return;

        setStatus(i18n.sending || 'Sending...', 'info');
        setCooldown('resend', 30);

        restPost('resend', { session_key: currentSessionKey }, function (res) {
            if (res.success) {
                setStatus(res.message || 'Code sent!', 'success');
            } else {
                setStatus(res.message || 'Failed to resend.', 'error');
            }
        });
    }

    function handleVoice(e) {
        e.preventDefault();
        if (voiceCooldown) return;

        setStatus('Calling...', 'info');
        setCooldown('voice', 30);

        restPost('voice', { session_key: currentSessionKey }, function (res) {
            if (res.success) {
                setStatus(res.message || 'Call initiated!', 'success');
            } else {
                setStatus(res.message || 'Call failed.', 'error');
            }
        });
    }

    function handleBack() {
        if (fullpage) {
            window.history.back();
        } else {
            hideModal();
        }
    }

    // ─── REST Helper ─────────────────────────────────────────────────────

    function restPost(action, data, callback) {
        fetch(restUrl + action, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': restNonce,
            },
            body: JSON.stringify(data),
            credentials: 'same-origin',
        })
        .then(r => r.json())
        .then(callback)
        .catch(() => callback({ success: false, message: 'Network error.' }));
    }

    // ─── UI Helpers ──────────────────────────────────────────────────────

    function setStatus(msg, type) {
        const el = document.getElementById('tbc-otp-status');
        if (!el) return;
        el.textContent = msg;
        el.className = 'tbc-otp-modal__status tbc-otp-modal__status--' + (type || 'info');
    }

    function setVerifyEnabled(enabled) {
        const btn = document.getElementById('tbc-otp-verify-btn');
        if (btn) btn.disabled = !enabled;
    }

    function setCooldown(type, seconds) {
        const linkId = type === 'voice' ? 'tbc-otp-voice' : 'tbc-otp-resend';
        const link = document.getElementById(linkId);
        if (!link) return;

        if (type === 'resend') resendCooldown = true;
        else voiceCooldown = true;

        link.classList.add('tbc-otp-modal__link--disabled');
        const originalText = link.textContent;
        let remaining = seconds;

        const timer = setInterval(() => {
            remaining--;
            link.textContent = originalText + ' (' + remaining + 's)';
            if (remaining <= 0) {
                clearInterval(timer);
                link.textContent = originalText;
                link.classList.remove('tbc-otp-modal__link--disabled');
                if (type === 'resend') resendCooldown = false;
                else voiceCooldown = false;
            }
        }, 1000);
    }

    function dismissFCNotifications() {
        setTimeout(function () {
            var notifications = document.querySelectorAll('.el-notification, .el-message--error');
            for (var i = 0; i < notifications.length; i++) {
                notifications[i].remove();
            }
        }, 50);
    }

    function showProfileSaveSuccess() {
        var toast = document.createElement('div');
        toast.className = 'el-message el-message--success';
        toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:99999;' +
            'padding:10px 20px;border-radius:8px;background:#f0f9eb;border:1px solid #e1f3d8;' +
            'color:#67c23a;font-size:14px;box-shadow:0 2px 12px rgba(0,0,0,.1);transition:opacity .3s;';
        toast.textContent = 'Profile has been updated';
        document.body.appendChild(toast);
        setTimeout(function () {
            toast.style.opacity = '0';
            setTimeout(function () { toast.remove(); }, 300);
        }, 3000);
    }

    function formDataToString(fd) {
        const parts = [];
        for (const [key, val] of fd.entries()) {
            parts.push(key + '=' + val);
        }
        return parts.join('&');
    }

    function getWPRestNonce() {
        if (window.fluentComAdmin && window.fluentComAdmin.rest && window.fluentComAdmin.rest.nonce) {
            return window.fluentComAdmin.rest.nonce;
        }
        if (window.fluentCommunityAdmin && window.fluentCommunityAdmin.rest_nonce) {
            return window.fluentCommunityAdmin.rest_nonce;
        }
        return '';
    }

    function esc(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

})();
