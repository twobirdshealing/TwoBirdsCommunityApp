/**
 * TBC Registration — Multi-step registration form
 *
 * Steps 1-4 of registration:
 *   1. Basic info (name, email, username, password)
 *   2. Custom profile fields + terms
 *   3. Email verification (if FC 2FA enabled)
 *   4. Phone OTP (if enabled)
 *
 * Steps 5-6 (bio + avatar) are handled by profile-completion.js
 * via the [tbc_profile_completion] shortcode on the same page.
 *
 * Calls the same REST API as the mobile app (tbc-fp/v1/register/*).
 * Styled with Fluent Community CSS variables for automatic theme matching.
 *
 * @package TBC_Fluent_Profiles
 */
(function () {
    'use strict';

    // ─── Bootstrap ────────────────────────────────────────────────────
    const container = document.getElementById('tbc-registration-app');
    if (!container) return;

    let config;
    try {
        config = JSON.parse(container.getAttribute('data-config'));
    } catch (e) {
        container.innerHTML = '<p class="tbc-reg__error">Failed to load registration form.</p>';
        return;
    }

    const API = config.restUrl;       // e.g. https://site.com/wp-json/tbc-fp/v1/
    let NONCE = config.restNonce;

    // ─── State ────────────────────────────────────────────────────────
    let step = 1;
    let fieldsConfig = null;
    let formData = {};
    let fieldErrors = {};
    let globalError = '';
    let submitting = false;

    // Email verification
    let verificationToken = '';
    let emailResendTimer = 0;
    let emailTimerInterval = null;

    // OTP (step 4)
    let otpSessionKey = '';
    let otpPhoneMasked = '';
    let otpVoiceFallback = false;
    let otpCode = '';
    let otpError = '';
    let otpResendTimer = 0;
    let otpTimerInterval = null;

    // (Steps 5-6 are now handled by profile-completion.js via [tbc_profile_completion] shortcode)

    // ─── API Helpers ──────────────────────────────────────────────────

    async function apiGet(endpoint) {
        const res = await fetch(API + endpoint, {
            headers: { 'X-WP-Nonce': NONCE },
        });
        return res.json();
    }

    async function apiPost(endpoint, body) {
        const res = await fetch(API + endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': NONCE,
            },
            body: JSON.stringify(body),
        });
        return res.json();
    }

    async function apiPostForm(endpoint, formDataObj) {
        const res = await fetch(API + endpoint, {
            method: 'POST',
            headers: { 'X-WP-Nonce': NONCE },
            body: formDataObj,
        });
        return res.json();
    }

    // (FC API helpers removed — no longer needed after steps 5-6 extraction)

    // ─── Init ─────────────────────────────────────────────────────────

    async function init() {
        try {
            fieldsConfig = await apiGet('register/fields');
            if (!fieldsConfig || !fieldsConfig.registration_enabled) {
                container.innerHTML =
                    '<div class="tbc-reg__card">' +
                    '<h2 class="tbc-reg__title">Registration Closed</h2>' +
                    '<p class="tbc-reg__text">' + esc(fieldsConfig?.message || 'Registration is currently closed.') + '</p>' +
                    '<a href="' + esc(config.loginUrl) + '" class="tbc-reg__btn tbc-reg__btn--primary">Back to Login</a>' +
                    '</div>';
                return;
            }
            render();
        } catch (e) {
            container.innerHTML = '<p class="tbc-reg__error">Unable to load registration form. Please refresh.</p>';
        }
    }

    // ─── Field helpers ────────────────────────────────────────────────

    function getFieldsForStep(s) {
        if (!fieldsConfig?.fields) return [];
        return Object.entries(fieldsConfig.fields).filter(function (entry) {
            return entry[1].step === s;
        });
    }

    function validateStep(s) {
        var fields = getFieldsForStep(s);
        var errors = {};

        fields.forEach(function (entry) {
            var key = entry[0], field = entry[1];
            var val = formData[key] || '';

            if (field.required && (!val || (Array.isArray(val) && val.length === 0) || (typeof val === 'string' && val.trim() === ''))) {
                errors[key] = (field.label || key) + ' is required.';
                return;
            }

            if (key === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                errors[key] = 'Please enter a valid email address.';
            }
            if (key === 'username' && val) {
                if (val.length < 4) errors[key] = 'Username must be at least 4 characters.';
                else if (!/^[a-z0-9_]+$/.test(val)) errors[key] = 'Lowercase letters, numbers, and underscores only.';
            }
            if (key === 'conf_password' && val && val !== formData['password']) {
                errors[key] = 'Passwords do not match.';
            }
        });

        fieldErrors = errors;
        return Object.keys(errors).length === 0;
    }

    // ─── Submit Registration ──────────────────────────────────────────

    async function submitRegistration(otpKey, emailCode, emailToken) {
        globalError = '';
        if (!otpKey && !emailCode && !validateStep(2)) { render(); return; }

        submitting = true;
        render();

        try {
            var payload = Object.assign({}, formData, { context: 'web' });

            if (payload.username) {
                payload.username = payload.username.toLowerCase().replace(/[^a-z0-9_]/g, '');
            }

            if (emailCode && emailToken) {
                payload.__two_fa_code = emailCode;
                payload.__two_fa_signed_token = emailToken;
            } else if (verificationToken && formData._emailCode) {
                payload.__two_fa_code = formData._emailCode;
                payload.__two_fa_signed_token = verificationToken;
            }

            if (otpKey) {
                payload.tbc_fp_session_key = otpKey;
            }

            var result = await apiPost('register', payload);

            if (result.email_verification_required && result.verification_token) {
                verificationToken = result.verification_token;
                step = 3;
                submitting = false;
                render();
                return;
            }

            if (result.otp_required && result.session_key) {
                otpSessionKey = result.session_key;
                otpPhoneMasked = result.phone_masked || '';
                otpVoiceFallback = fieldsConfig?.voice_fallback || false;
                otpCode = '';
                otpError = '';
                step = 4;
                submitting = false;
                render();
                return;
            }

            if (result.success && result.user) {
                // Registration complete — auth cookie is set in response headers.
                // Reload the page so the browser has the cookie and the
                // [tbc_profile_completion] shortcode takes over for bio + avatar.
                window.location.href = window.location.pathname;
                return;
            }

            // Errors
            if (result.errors) {
                fieldErrors = result.errors;
                var step1Keys = getFieldsForStep(1).map(function (e) { return e[0]; });
                var hasStep1Err = Object.keys(result.errors).some(function (k) { return step1Keys.indexOf(k) >= 0; });
                step = hasStep1Err ? 1 : 2;
            }
            globalError = result.message || 'Registration failed. Please try again.';
        } catch (e) {
            globalError = 'An unexpected error occurred. Please try again.';
        }

        submitting = false;
        render();
    }

    // ─── Email Verification ───────────────────────────────────────────

    async function verifyEmail() {
        var code = formData._emailCode || '';
        if (!code) { globalError = 'Please enter the verification code.'; render(); return; }
        await submitRegistration(null, code, verificationToken);
    }

    function startEmailResendTimer() {
        emailResendTimer = 60;
        clearInterval(emailTimerInterval);
        emailTimerInterval = setInterval(function () {
            emailResendTimer--;
            if (emailResendTimer <= 0) clearInterval(emailTimerInterval);
            render();
        }, 1000);
    }

    async function resendEmailCode() {
        if (emailResendTimer > 0) return;
        submitting = true; render();

        try {
            var payload = Object.assign({}, formData, { context: 'web' });
            if (payload.username) payload.username = payload.username.toLowerCase().replace(/[^a-z0-9_]/g, '');
            var result = await apiPost('register', payload);

            if (result.email_verification_required && result.verification_token) {
                verificationToken = result.verification_token;
                startEmailResendTimer();
                formData._emailCode = '';
            } else {
                globalError = 'Failed to resend code.';
            }
        } catch (e) {
            globalError = 'Failed to resend code.';
        }
        submitting = false;
        render();
    }

    // ─── OTP Verification ─────────────────────────────────────────────

    async function verifyOtp() {
        if (!otpCode || otpCode.length < 4) {
            otpError = 'Please enter the verification code.';
            render(); return;
        }

        otpError = '';
        submitting = true;
        render();

        try {
            var result = await apiPost('otp/verify', {
                session_key: otpSessionKey,
                code: otpCode,
            });

            if (result.success && result.verified) {
                // OTP verified — resubmit registration with session key
                await submitRegistration(otpSessionKey);
                return;
            }

            otpError = result.message || 'Invalid code. Please try again.';
        } catch (e) {
            otpError = 'Verification failed. Please try again.';
        }
        submitting = false;
        render();
    }

    async function resendOtp() {
        if (otpResendTimer > 0) return;

        try {
            var result = await apiPost('otp/resend', { session_key: otpSessionKey });
            if (result.success) {
                otpError = '';
                startOtpResendTimer();
            } else {
                otpError = result.message || 'Failed to resend.';
            }
        } catch (e) {
            otpError = 'Failed to resend.';
        }
        render();
    }

    async function requestVoiceCall() {
        try {
            var result = await apiPost('otp/voice', { session_key: otpSessionKey });
            if (result.success) {
                otpError = '';
                startOtpResendTimer();
            } else {
                otpError = result.message || 'Call failed.';
            }
        } catch (e) {
            otpError = 'Call failed.';
        }
        render();
    }

    function startOtpResendTimer() {
        otpResendTimer = 30;
        clearInterval(otpTimerInterval);
        otpTimerInterval = setInterval(function () {
            otpResendTimer--;
            if (otpResendTimer <= 0) clearInterval(otpTimerInterval);
            render();
        }, 1000);
    }

    // (Steps 5-6 functions removed — now in profile-completion.js)

    // ─── Render ───────────────────────────────────────────────────────

    function render() {
        var html = '<div class="tbc-reg__card">';

        // Step indicator
        var totalSteps = 2
            + (fieldsConfig?.email_verification_required ? 1 : 0)
            + (fieldsConfig?.otp_required ? 1 : 0);

        html += renderStepIndicator(totalSteps);

        // Title
        var titles = { 1: 'Create Account', 2: 'Your Profile', 3: 'Verify Email', 4: 'Verify Phone' };
        html += '<h2 class="tbc-reg__title">' + esc(titles[step] || '') + '</h2>';

        // Global error
        if (globalError) {
            html += '<div class="tbc-reg__alert tbc-reg__alert--error">' + esc(globalError) + '</div>';
        }

        // Step content
        switch (step) {
            case 1: html += renderStep1(); break;
            case 2: html += renderStep2(); break;
            case 3: html += renderStep3(); break;
            case 4: html += renderStep4(); break;
        }

        html += '</div>'; // .tbc-reg__card

        // Logo above card for steps 1-2
        var wrapper = '';
        if (step <= 2 && config.siteLogoUrl) {
            wrapper += '<div class="tbc-reg__logo-wrap"><img src="' + esc(config.siteLogoUrl) + '" alt="' + esc(config.siteName) + '" class="tbc-reg__logo" /></div>';
        }
        wrapper += html;

        container.innerHTML = wrapper;
        bindEvents();
    }

    function renderStepIndicator(total) {
        var visual = getVisualStep(step);
        var html = '<div class="tbc-reg__steps">';
        for (var i = 1; i <= total; i++) {
            var cls = i <= visual ? ' tbc-reg__step--done' : '';
            if (i === visual) cls += ' tbc-reg__step--active';
            html += '<div class="tbc-reg__step' + cls + '"></div>';
        }
        html += '</div>';
        return html;
    }

    function getVisualStep(s) {
        var v = s;
        if (!fieldsConfig?.email_verification_required && s >= 3) v--;
        if (!fieldsConfig?.otp_required && s >= 4) v--;
        return v;
    }

    // ── Step renderers ────────────────────────────────────────────────

    function renderStep1() {
        var html = '';
        getFieldsForStep(1).forEach(function (entry) {
            html += renderField(entry[0], entry[1]);
        });
        html += '<button type="button" class="tbc-reg__btn tbc-reg__btn--primary" data-action="next"' + dis() + '>Next</button>';
        html += '<a href="' + esc(config.loginUrl) + '" class="tbc-reg__link">Back to Login</a>';
        if (config.privacyUrl) {
            html += '<a href="' + esc(config.privacyUrl) + '" class="tbc-reg__link tbc-reg__link--small" target="_blank">Privacy Policy</a>';
        }
        return html;
    }

    function renderStep2() {
        var html = '';
        getFieldsForStep(2).forEach(function (entry) {
            html += renderField(entry[0], entry[1]);
        });
        html += '<button type="button" class="tbc-reg__btn tbc-reg__btn--primary" data-action="submit"' + dis() + '>' + (submitting ? spinner() : 'Create Account') + '</button>';
        html += '<button type="button" class="tbc-reg__link" data-action="back-to-1">Back</button>';
        return html;
    }

    function renderStep3() {
        var html = '<div class="tbc-reg__center">';
        html += '<p class="tbc-reg__subtitle">Enter the 6-digit code sent to ' + esc(formData.email || 'your email') + '</p>';
        html += '</div>';
        html += '<div class="tbc-reg__field">';
        html += '<input type="text" class="tbc-reg__input tbc-reg__input--code" data-key="_emailCode" inputmode="numeric" maxlength="6" placeholder="000000" value="' + esc(formData._emailCode || '') + '" />';
        html += '</div>';
        html += '<button type="button" class="tbc-reg__btn tbc-reg__btn--primary" data-action="verify-email"' + dis() + '>' + (submitting ? spinner() : 'Verify Email') + '</button>';
        html += '<div class="tbc-reg__actions">';
        html += '<button type="button" class="tbc-reg__link" data-action="resend-email"' + (emailResendTimer > 0 ? ' disabled' : '') + '>';
        html += emailResendTimer > 0 ? 'Resend code (' + emailResendTimer + 's)' : 'Resend code';
        html += '</button>';
        html += '</div>';
        html += '<button type="button" class="tbc-reg__link" data-action="back-to-2">Go Back</button>';
        return html;
    }

    function renderStep4() {
        var html = '<div class="tbc-reg__center">';
        html += '<p class="tbc-reg__subtitle">Enter the code sent to ' + esc(otpPhoneMasked) + '</p>';
        html += '</div>';
        if (otpError) {
            html += '<div class="tbc-reg__alert tbc-reg__alert--error">' + esc(otpError) + '</div>';
        }
        html += '<div class="tbc-reg__field">';
        html += '<input type="text" class="tbc-reg__input tbc-reg__input--code" data-key="_otpCode" inputmode="numeric" maxlength="6" placeholder="000000" value="' + esc(otpCode) + '" />';
        html += '</div>';
        html += '<button type="button" class="tbc-reg__btn tbc-reg__btn--primary" data-action="verify-otp"' + dis() + '>' + (submitting ? spinner() : 'Verify') + '</button>';
        html += '<div class="tbc-reg__actions">';
        html += '<button type="button" class="tbc-reg__link" data-action="resend-otp"' + (otpResendTimer > 0 ? ' disabled' : '') + '>';
        html += otpResendTimer > 0 ? 'Resend code (' + otpResendTimer + 's)' : 'Resend code';
        html += '</button>';
        if (otpVoiceFallback) {
            html += '<button type="button" class="tbc-reg__link" data-action="voice-call">Try voice call</button>';
        }
        html += '</div>';
        html += '<button type="button" class="tbc-reg__link" data-action="back-to-step3or2">Go Back</button>';
        return html;
    }

    // (renderStep5 + renderStep6 removed — now in profile-completion.js)

    // ── Field renderer ────────────────────────────────────────────────

    function renderField(key, field) {
        var isMulti = field.type === 'checkbox' || field.type === 'multiselect';
        var val = isMulti ? (formData[key] || []) : (formData[key] || '');
        var err = fieldErrors[key] || '';
        var html = '<div class="tbc-reg__field' + (err ? ' tbc-reg__field--error' : '') + '">';

        if (field.type !== 'inline_checkbox') {
            html += '<label class="tbc-reg__label">' + esc(field.label);
            if (field.required) html += ' <span class="tbc-reg__required">*</span>';
            html += '</label>';
        }

        if (field.instructions) {
            html += '<p class="tbc-reg__instructions">' + esc(field.instructions) + '</p>';
        }

        switch (field.type) {
            case 'select':
            case 'gender':
                html += '<select class="tbc-reg__select" data-key="' + key + '">';
                html += '<option value="">' + esc(field.placeholder || 'Select...') + '</option>';
                (field.options || []).forEach(function (opt) {
                    html += '<option value="' + esc(opt) + '"' + (val === opt ? ' selected' : '') + '>' + esc(opt) + '</option>';
                });
                html += '</select>';
                break;

            case 'radio':
                html += '<div class="tbc-reg__radio-group" data-key="' + key + '">';
                (field.options || []).forEach(function (opt) {
                    var id = 'radio-' + key + '-' + opt.replace(/\s+/g, '-');
                    html += '<label class="tbc-reg__radio-label" for="' + esc(id) + '">';
                    html += '<input type="radio" id="' + esc(id) + '" name="' + esc(key) + '" value="' + esc(opt) + '"' + (val === opt ? ' checked' : '') + ' />';
                    html += ' <span>' + esc(opt) + '</span>';
                    html += '</label>';
                });
                html += '</div>';
                break;

            case 'checkbox':
                html += '<div class="tbc-reg__checkbox-group" data-key="' + key + '">';
                (field.options || []).forEach(function (opt) {
                    var id = 'chk-' + key + '-' + opt.replace(/\s+/g, '-');
                    var checked = Array.isArray(val) && val.indexOf(opt) !== -1;
                    html += '<label class="tbc-reg__checkbox-label" for="' + esc(id) + '">';
                    html += '<input type="checkbox" id="' + esc(id) + '" value="' + esc(opt) + '"' + (checked ? ' checked' : '') + ' />';
                    html += ' <span>' + esc(opt) + '</span>';
                    html += '</label>';
                });
                html += '</div>';
                break;

            case 'multiselect':
                html += '<select class="tbc-reg__select tbc-reg__select--multi" data-key="' + key + '" multiple>';
                (field.options || []).forEach(function (opt) {
                    var selected = Array.isArray(val) && val.indexOf(opt) !== -1;
                    html += '<option value="' + esc(opt) + '"' + (selected ? ' selected' : '') + '>' + esc(opt) + '</option>';
                });
                html += '</select>';
                break;

            case 'textarea':
                html += '<textarea class="tbc-reg__textarea" data-key="' + key + '" placeholder="' + esc(field.placeholder || '') + '">' + esc(val) + '</textarea>';
                break;

            case 'inline_checkbox':
                html += '<label class="tbc-reg__checkbox">';
                html += '<input type="checkbox" data-key="' + key + '"' + (val ? ' checked' : '') + ' />';
                html += ' <span>' + (field.inline_label || esc(field.label)) + '</span>';
                html += '</label>';
                break;

            default: {
                var inputType = 'text';
                if (key === 'email') inputType = 'email';
                else if (key === 'password' || key === 'conf_password') inputType = 'password';
                else if (field.type === 'phone') inputType = 'tel';
                else if (field.type === 'number') inputType = 'number';
                else if (field.type === 'date') inputType = 'date';
                else if (field.type === 'url') inputType = 'url';

                if (key === 'password' || key === 'conf_password') {
                    // Password field with show/hide toggle
                    html += '<div class="tbc-reg__password-wrap">';
                    html += '<input type="password" class="tbc-reg__input tbc-reg__input--password" data-key="' + key + '" placeholder="' + esc(field.placeholder || '') + '" value="' + esc(val) + '"' + (submitting ? ' disabled' : '') + ' />';
                    html += '<button type="button" class="tbc-reg__password-toggle" data-toggle-password="' + key + '" tabindex="-1" aria-label="Show password">';
                    html += '<svg class="tbc-reg__eye-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
                    html += '<svg class="tbc-reg__eye-off-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
                    html += '</button>';
                    html += '</div>';

                    // Password strength meter (only for main password field)
                    if (key === 'password') {
                        var strength = getPasswordStrength(val);
                        html += '<div class="tbc-reg__password-meter">';
                        html += '<div class="tbc-reg__password-meter-bar">';
                        html += '<div class="tbc-reg__password-meter-fill tbc-reg__password-meter--' + strength.level + '" style="width:' + strength.percent + '%"></div>';
                        html += '</div>';
                        if (val) {
                            html += '<span class="tbc-reg__password-meter-label tbc-reg__password-meter-label--' + strength.level + '">' + esc(strength.label) + '</span>';
                        } else {
                            html += '<span class="tbc-reg__password-meter-label"></span>';
                        }
                        html += '</div>';
                    }
                } else {
                    html += '<input type="' + inputType + '" class="tbc-reg__input" data-key="' + key + '" placeholder="' + esc(field.placeholder || '') + '" value="' + esc(val) + '"' + (submitting ? ' disabled' : '') + ' />';
                }
                break;
            }
        }

        if (err) {
            html += '<p class="tbc-reg__error-text">' + esc(err) + '</p>';
        }

        html += '</div>';
        return html;
    }

    // ─── Event Binding ────────────────────────────────────────────────

    function bindEvents() {
        // Input changes
        container.querySelectorAll('[data-key]').forEach(function (el) {
            var key = el.getAttribute('data-key');
            var event = el.type === 'checkbox' ? 'change' : 'input';
            el.addEventListener(event, function () {
                if (el.type === 'checkbox') {
                    formData[key] = el.checked;
                } else if (key === '_otpCode') {
                    otpCode = el.value.replace(/\D/g, '').slice(0, 6);
                    el.value = otpCode;
                } else if (key === '_emailCode') {
                    formData[key] = el.value.replace(/\D/g, '').slice(0, 6);
                    el.value = formData[key];
                } else {
                    formData[key] = el.value;
                }
                // Live-update password strength meter without full re-render
                if (key === 'password') {
                    var strength = getPasswordStrength(el.value);
                    var fieldEl = el.closest('.tbc-reg__field');
                    if (fieldEl) {
                        var fill = fieldEl.querySelector('.tbc-reg__password-meter-fill');
                        var lbl = fieldEl.querySelector('.tbc-reg__password-meter-label');
                        if (fill) {
                            fill.style.width = strength.percent + '%';
                            fill.className = 'tbc-reg__password-meter-fill tbc-reg__password-meter--' + strength.level;
                        }
                        if (lbl) {
                            lbl.textContent = el.value ? strength.label : '';
                            lbl.className = 'tbc-reg__password-meter-label' + (el.value ? ' tbc-reg__password-meter-label--' + strength.level : '');
                        }
                    }
                }
                // Clear field error on change
                if (fieldErrors[key]) {
                    delete fieldErrors[key];
                    var fieldEl = el.closest('.tbc-reg__field');
                    if (fieldEl) fieldEl.classList.remove('tbc-reg__field--error');
                    var errEl = fieldEl?.querySelector('.tbc-reg__error-text');
                    if (errEl) errEl.remove();
                }
            });
        });

        // Select changes
        container.querySelectorAll('select[data-key]').forEach(function (el) {
            el.addEventListener('change', function () {
                formData[el.getAttribute('data-key')] = el.value;
            });
        });

        // Radio button changes
        container.querySelectorAll('.tbc-reg__radio-group input[type="radio"]').forEach(function (el) {
            el.addEventListener('change', function () {
                formData[el.closest('[data-key]').getAttribute('data-key')] = el.value;
            });
        });

        // Checkbox group changes (multi-value)
        container.querySelectorAll('.tbc-reg__checkbox-group').forEach(function (group) {
            group.querySelectorAll('input[type="checkbox"]').forEach(function (el) {
                el.addEventListener('change', function () {
                    var k = group.getAttribute('data-key');
                    var checked = [];
                    group.querySelectorAll('input[type="checkbox"]:checked').forEach(function (cb) {
                        checked.push(cb.value);
                    });
                    formData[k] = checked;
                });
            });
        });

        // Multi-select changes
        container.querySelectorAll('select[multiple][data-key]').forEach(function (el) {
            el.addEventListener('change', function () {
                var selected = [];
                for (var i = 0; i < el.options.length; i++) {
                    if (el.options[i].selected) selected.push(el.options[i].value);
                }
                formData[el.getAttribute('data-key')] = selected;
            });
        });

        // Button actions
        container.querySelectorAll('[data-action]').forEach(function (el) {
            el.addEventListener('click', function (e) {
                e.preventDefault();
                handleAction(el.getAttribute('data-action'));
            });
        });

        // Enter key on code inputs
        container.querySelectorAll('.tbc-reg__input--code').forEach(function (el) {
            el.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (step === 3) verifyEmail();
                    else if (step === 4) verifyOtp();
                }
            });
        });

        // Password show/hide toggle
        container.querySelectorAll('[data-toggle-password]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var key = btn.getAttribute('data-toggle-password');
                var input = container.querySelector('[data-key="' + key + '"]');
                if (!input) return;
                var isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                var eyeOn = btn.querySelector('.tbc-reg__eye-icon');
                var eyeOff = btn.querySelector('.tbc-reg__eye-off-icon');
                if (eyeOn) eyeOn.style.display = isPassword ? 'none' : '';
                if (eyeOff) eyeOff.style.display = isPassword ? '' : 'none';
                btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
                input.focus();
            });
        });

        // Auto-focus first input
        var firstInput = container.querySelector('.tbc-reg__input, .tbc-reg__select, .tbc-reg__input--code');
        if (firstInput) setTimeout(function () { firstInput.focus(); }, 50);
    }

    function handleAction(action) {
        globalError = '';

        switch (action) {
            case 'next':
                if (!validateStep(1)) { render(); return; }
                step = 2; render(); break;
            case 'submit':
                submitRegistration(); break;
            case 'back-to-1':
                step = 1; render(); break;
            case 'back-to-2':
                step = 2; formData._emailCode = ''; render(); break;
            case 'verify-email':
                verifyEmail(); break;
            case 'resend-email':
                resendEmailCode(); break;
            case 'verify-otp':
                verifyOtp(); break;
            case 'resend-otp':
                resendOtp(); break;
            case 'voice-call':
                requestVoiceCall(); break;
            case 'back-to-step3or2':
                step = fieldsConfig?.email_verification_required ? 3 : 2;
                otpCode = ''; render(); break;
        }
    }

    // ─── Utilities ────────────────────────────────────────────────────

    // Keep in sync with mobile: components/common/PasswordStrengthMeter.tsx
    var STRENGTH_MAP = [
        { level: 'weak',   label: 'Very weak', percent: 10 },
        { level: 'weak',   label: 'Weak',      percent: 25 },
        { level: 'weak',   label: 'Weak',      percent: 40 },
        { level: 'medium', label: 'Fair',       percent: 55 },
        { level: 'medium', label: 'Good',       percent: 70 },
        { level: 'strong', label: 'Strong',     percent: 85 },
        { level: 'strong', label: 'Very strong',percent: 100 }
    ];

    function getPasswordStrength(pw) {
        if (!pw) return { level: 'none', label: '', percent: 0 };
        var score = 0;
        if (pw.length >= 4) score++;
        if (pw.length >= 8) score++;
        if (pw.length >= 12) score++;
        if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
        if (/\d/.test(pw)) score++;
        if (/[^a-zA-Z0-9]/.test(pw)) score++;
        return STRENGTH_MAP[score];
    }

    function esc(str) {
        if (str == null) return '';
        var div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    function dis() {
        return submitting ? ' disabled' : '';
    }

    function spinner() {
        return '<span class="tbc-reg__spinner tbc-reg__spinner--inline"></span>';
    }

    // ─── Start ────────────────────────────────────────────────────────
    init();
})();
