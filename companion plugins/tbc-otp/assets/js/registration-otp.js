/**
 * TBC OTP — Pre-Submit Phone Verification
 *
 * Intercepts FC's registration submit button to require phone OTP
 * BEFORE the form is ever submitted. After verification, the form
 * submits once with the session key — FC handles everything natively.
 *
 * Flow:
 *   1. User fills FC's registration form and clicks submit
 *   2. Click interceptor blocks Vue from seeing the click
 *   3. JS reads phone from form, calls /otp/send REST endpoint
 *   4. OTP modal appears, user enters code, JS verifies via /otp/verify
 *   5. JS sets verified flag and clicks submit button again
 *   6. Click interceptor lets it through — Vue sends the AJAX normally
 *   7. XHR augmentation injects tbc_otp_session_key into FormData
 *   8. Server hook (priority 6) sees verified session, passes through
 *   9. FC (priority 10) creates user, handles email 2FA / redirects natively
 *
 * @package TBC_OTP
 */
(function () {
    'use strict';

    // ─── Config (from wp_localize_script) ──────────────────────────────
    var cfg = window.tbcOtpReg || {};
    var restBase     = cfg.rest_url || '';
    var restNonce    = cfg.rest_nonce || '';
    var voiceEnabled = cfg.voice_enabled || false;
    var phoneSlug    = cfg.phone_slug || '_phone';

    // ─── State ─────────────────────────────────────────────────────────
    var otpVerified    = false;
    var sessionKey     = '';
    var resendCooldown = false;
    var voiceCooldown  = false;

    // ─── Modal HTML ────────────────────────────────────────────────────
    var MODAL_HTML =
        '<div class="tbc-otp-overlay" id="tbc-otp-overlay">' +
            '<div class="tbc-otp-modal" role="dialog" aria-modal="true">' +
                '<div class="tbc-otp-modal__header">' +
                    '<h2 class="tbc-otp-modal__title">Phone Verification</h2>' +
                '</div>' +
                '<div class="tbc-otp-modal__body">' +
                    '<p class="tbc-otp-modal__instructions" id="tbc-otp-instructions"></p>' +
                    '<div class="tbc-otp-modal__input-wrap">' +
                        '<input type="text" id="tbc-otp-code" class="tbc-otp-modal__input" ' +
                            'inputmode="numeric" autocomplete="one-time-code" ' +
                            'maxlength="6" pattern="[0-9]{6}" placeholder="000000" />' +
                    '</div>' +
                    '<div class="tbc-otp-modal__status" id="tbc-otp-status" role="status" aria-live="polite"></div>' +
                    '<div class="tbc-otp-modal__actions">' +
                        '<button type="button" class="tbc-otp-modal__btn tbc-otp-modal__btn--primary" id="tbc-otp-verify-btn">Verify Code</button>' +
                        '<button type="button" class="tbc-otp-modal__btn tbc-otp-modal__btn--secondary" id="tbc-otp-back-btn">Go Back</button>' +
                    '</div>' +
                    '<div class="tbc-otp-modal__links">' +
                        '<a href="#" class="tbc-otp-modal__link" id="tbc-otp-resend">Resend SMS</a>' +
                        '<a href="#" class="tbc-otp-modal__link" id="tbc-otp-voice" ' +
                            'style="' + (voiceEnabled ? '' : 'display:none;') + '">Try voice call</a>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';

    // ─── Initialize ──────────────────────────────────────────────────────
    // Wait for FC's Vue form to render, then attach interceptors.

    var initAttempts = 0;

    function init() {
        var btn = findSubmitButton();
        if (btn) {
            // Capture phase — fires before Vue's bubble-phase handler
            btn.addEventListener('click', handleSubmitClick, true);
            installXhrAugmentation();
        } else if (++initAttempts < 40) {
            setTimeout(init, 250);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 500); });
    } else {
        setTimeout(init, 500);
    }

    // ─── Submit Click Interceptor ────────────────────────────────────────
    // Blocks the click if phone is present and OTP hasn't been verified yet.
    // After OTP, sets otpVerified=true and re-clicks — this time it passes through.

    function handleSubmitClick(e) {
        if (otpVerified) {
            // Already verified — let Vue handle the click normally
            return;
        }

        var phone = getPhoneValue();
        if (!phone) {
            // No phone in form — let FC handle normally (phone might be optional)
            return;
        }

        // Block Vue from seeing this click
        e.stopImmediatePropagation();
        e.preventDefault();

        // Start OTP flow
        startOtp(phone);
    }

    function startOtp(phone) {
        setButtonLoading(true);

        restPost('send', { phone: phone }, function (res) {
            setButtonLoading(false);

            if (res.success) {
                sessionKey = res.session_key;
                showModal(res.phone_masked || '');
            } else {
                showFormError(res.message || 'Failed to send verification code.');
            }
        });
    }

    // ─── XHR Augmentation ────────────────────────────────────────────────
    // Minimal: only injects tbc_otp_session_key into outgoing registration
    // FormData when otpVerified is true. Does NOT intercept responses.

    function installXhrAugmentation() {
        var OrigOpen = XMLHttpRequest.prototype.open;
        var OrigSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (method, url) {
            this._tbcOtpUrl = url;
            return OrigOpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function (body) {
            if (otpVerified && sessionKey) {
                var url = this._tbcOtpUrl || '';
                if (url.indexOf('admin-ajax.php') !== -1) {
                    var isReg = false;

                    if (body instanceof FormData) {
                        isReg = body.get && body.get('action') === 'fcom_user_registration';
                        if (isReg) {
                            body.append('tbc_otp_session_key', sessionKey);
                        }
                    } else if (typeof body === 'string' && body.indexOf('fcom_user_registration') !== -1) {
                        isReg = true;
                        body = body + '&tbc_otp_session_key=' + encodeURIComponent(sessionKey);
                        return OrigSend.call(this, body);
                    }

                    if (isReg) {
                        otpVerified = false;
                    }
                }
            }
            return OrigSend.apply(this, arguments);
        };
    }

    // ─── Modal ─────────────────────────────────────────────────────────

    function showModal(phoneMasked) {
        var existing = document.getElementById('tbc-otp-overlay');
        if (existing) existing.remove();

        var wrapper = document.createElement('div');
        wrapper.innerHTML = MODAL_HTML;
        document.body.appendChild(wrapper.firstElementChild);

        var instr = document.getElementById('tbc-otp-instructions');
        if (instr) {
            instr.textContent = 'Enter the 6-digit code sent to ' + (phoneMasked || 'your phone');
        }

        bindModalEvents();

        var input = document.getElementById('tbc-otp-code');
        if (input) setTimeout(function () { input.focus(); }, 100);
    }

    function hideModal() {
        var overlay = document.getElementById('tbc-otp-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(function () { overlay.remove(); }, 200);
        }
    }

    function bindModalEvents() {
        var verifyBtn  = document.getElementById('tbc-otp-verify-btn');
        var backBtn    = document.getElementById('tbc-otp-back-btn');
        var resendLink = document.getElementById('tbc-otp-resend');
        var voiceLink  = document.getElementById('tbc-otp-voice');
        var codeInput  = document.getElementById('tbc-otp-code');

        if (verifyBtn) verifyBtn.addEventListener('click', handleVerify);
        if (backBtn) backBtn.addEventListener('click', function () { hideModal(); });
        if (resendLink) resendLink.addEventListener('click', handleResend);
        if (voiceLink) voiceLink.addEventListener('click', handleVoice);

        if (codeInput) {
            codeInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); handleVerify(); }
            });
            codeInput.addEventListener('input', function () {
                this.value = this.value.replace(/\D/g, '').slice(0, 6);
            });
        }
    }

    // ─── Verify ────────────────────────────────────────────────────────

    function handleVerify() {
        var code = (document.getElementById('tbc-otp-code') || {}).value || '';
        if (!code || code.length < 4) {
            setStatus('Please enter the verification code.', 'error');
            return;
        }

        setStatus('Verifying...', 'info');
        setVerifyEnabled(false);

        restPost('verify', { code: code, session_key: sessionKey }, function (res) {
            if (res.success) {
                setStatus('Verified! Completing registration...', 'success');
                setTimeout(function () { onVerified(); }, 600);
            } else {
                setStatus(res.message || 'Invalid code. Please try again.', 'error');
                setVerifyEnabled(true);
            }
        });
    }

    // ─── After OTP Verified ──────────────────────────────────────────────
    // Set flag and click FC's submit button again.
    // This time handleSubmitClick lets it through → Vue sends the AJAX →
    // XHR augmentation injects session key → server passes through → FC handles all.

    function onVerified() {
        otpVerified = true;
        hideModal();

        // Re-click FC's submit button — Vue handles the form submission natively
        var btn = findSubmitButton();
        if (btn) {
            btn.click();
        } else {
            window.location.reload();
        }
    }

    // ─── Resend / Voice ────────────────────────────────────────────────

    function handleResend(e) {
        e.preventDefault();
        if (resendCooldown) return;

        setStatus('Sending...', 'info');
        setCooldown('resend', 30);

        restPost('resend', { session_key: sessionKey }, function (res) {
            if (res.success) {
                setStatus(res.message || 'New code sent!', 'success');
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

        restPost('voice', { session_key: sessionKey }, function (res) {
            if (res.success) {
                setStatus(res.message || 'Call initiated!', 'success');
            } else {
                setStatus(res.message || 'Call failed.', 'error');
            }
        });
    }

    // ─── REST Helper ───────────────────────────────────────────────────

    function restPost(action, data, callback) {
        fetch(restBase + action, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': restNonce,
            },
            body: JSON.stringify(data),
            credentials: 'same-origin',
        })
        .then(function (r) { return r.json(); })
        .then(callback)
        .catch(function () { callback({ success: false, message: 'Network error.' }); });
    }

    // ─── DOM Helpers ───────────────────────────────────────────────────

    function findSubmitButton() {
        return document.querySelector(
            '.fcom_signup_form button[type="submit"], ' +
            '.fcom_registration_form button[type="submit"], ' +
            '.fcom_onboard_form button[type="submit"], ' +
            '.fcom_auth_submit_btn'
        );
    }

    function getPhoneValue() {
        // Try by name attribute (FC custom field slug)
        var input = document.querySelector(
            '.fcom_signup_form [name="' + phoneSlug + '"], ' +
            '.fcom_registration_form [name="' + phoneSlug + '"], ' +
            '.fcom_onboard_form [name="' + phoneSlug + '"]'
        );

        // Fallback: any tel input in the registration form
        if (!input) {
            input = document.querySelector(
                '.fcom_signup_form input[type="tel"], ' +
                '.fcom_registration_form input[type="tel"], ' +
                '.fcom_onboard_form input[type="tel"]'
            );
        }

        return input ? input.value.trim() : '';
    }

    function setButtonLoading(loading) {
        var btn = findSubmitButton();
        if (!btn) return;
        btn.disabled = loading;
        if (loading) {
            btn.classList.add('is-loading');
        } else {
            btn.classList.remove('is-loading');
        }
    }

    function showFormError(message) {
        // Try to show error near the phone field, fall back to alert
        var phoneInput = document.querySelector(
            '[name="' + phoneSlug + '"], ' +
            '.fcom_signup_form input[type="tel"], ' +
            '.fcom_registration_form input[type="tel"]'
        );

        if (phoneInput) {
            // Remove any existing OTP error
            var existing = phoneInput.parentElement.querySelector('.tbc-otp-field-error');
            if (existing) existing.remove();

            var errorEl = document.createElement('div');
            errorEl.className = 'tbc-otp-field-error';
            errorEl.style.cssText = 'color:#f5222d;font-size:12px;margin-top:4px;';
            errorEl.textContent = message;
            phoneInput.parentElement.appendChild(errorEl);

            // Auto-remove after 8 seconds
            setTimeout(function () { if (errorEl.parentElement) errorEl.remove(); }, 8000);
        } else {
            alert(message);
        }
    }

    // ─── UI Helpers ────────────────────────────────────────────────────

    function setStatus(msg, type) {
        var el = document.getElementById('tbc-otp-status');
        if (!el) return;
        el.textContent = msg;
        el.className = 'tbc-otp-modal__status tbc-otp-modal__status--' + (type || 'info');
    }

    function setVerifyEnabled(enabled) {
        var btn = document.getElementById('tbc-otp-verify-btn');
        if (btn) btn.disabled = !enabled;
    }

    function setCooldown(type, seconds) {
        var linkId = type === 'voice' ? 'tbc-otp-voice' : 'tbc-otp-resend';
        var link = document.getElementById(linkId);
        if (!link) return;

        if (type === 'resend') resendCooldown = true;
        else voiceCooldown = true;

        link.classList.add('tbc-otp-modal__link--disabled');
        var originalText = link.textContent;
        var remaining = seconds;

        var timer = setInterval(function () {
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

})();
