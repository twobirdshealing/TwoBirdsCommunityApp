/**
 * TBC Registration - Portal Profile Fields JS
 *
 * Injects custom profile field display and edit UI into the
 * FluentCommunity Vue SPA using MutationObserver + XHR interception.
 *
 * Data strategy (same pattern as tbc-multi-reactions):
 *   READ:  Intercept FC's own XHR response to GET /profile/ — extract
 *          custom_fields and cache them. No duplicate API call needed.
 *   WRITE: Intercept FC's own XHR request to POST /profile/ — inject
 *          custom_fields via X-TBC-REG-Fields header + body injection.
 *
 * DOM Structure (from FC compiled app.js):
 *   Profile About card:  .about_wrap > .about_body > .about_items > .about_item
 *   Profile Edit form:   .fcom_update_profile > .fcom_sub_group > .fcom_sub_group_content
 */
(function () {
    'use strict';

    var config = window.tbcRegConfig || {};
    var fields = config.fields || {};
    var xhrPatched = false;

    // Cached profile data (populated by XHR response interception)
    window._tbcRegProfileData = null;
    window._tbcRegProfileConfigs = null;

    // Debounce timer
    var debounceTimer = null;

    // =========================================================================
    // FIELD TYPE ICONS (SVG)
    // =========================================================================

    var typeIcons = {
        phone: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>',
        text: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>',
        number: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line></svg>',
        date: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
        textarea: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>',
        select: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>',
        radio: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>',
        checkbox: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>',
        multiselect: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>',
        gender: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"></circle><path d="M20 21a8 8 0 0 0-16 0"></path></svg>',
        url: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
    };

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    function init() {
        patchXHR();
        observeDOM();
    }

    // =========================================================================
    // DOM OBSERVER
    // =========================================================================

    function observeDOM() {
        var observer = new MutationObserver(function () {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(function () {
                checkProfileAbout();
                checkEditForm();
                checkSignupForm();
            }, 200);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        setTimeout(function () {
            checkProfileAbout();
            checkEditForm();
            checkSignupForm();
        }, 500);
    }

    // =========================================================================
    // SIGNUP FORM - Inject instructions below custom fields
    // =========================================================================

    var signupInstructions = config.signupInstructions || {};

    function checkSignupForm() {
        var signupForm = document.getElementById('fcom_user_registration_form');
        if (!signupForm) return;
        if (signupForm.getAttribute('data-tbc-reg-signup')) return;
        signupForm.setAttribute('data-tbc-reg-signup', '1');

        var keys = Object.keys(signupInstructions);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var text = signupInstructions[key];
            if (!text) continue;

            // FC wraps each field in div#fcom_group_{key}.fcom_form-group
            var wrapper = document.getElementById('fcom_group_' + key);
            if (!wrapper) continue;

            // Don't inject twice
            if (wrapper.querySelector('.tbc-reg-signup-instructions')) continue;

            var hint = document.createElement('div');
            hint.className = 'tbc-reg-signup-instructions';
            hint.textContent = text;
            wrapper.appendChild(hint);
        }
    }

    // =========================================================================
    // PROFILE DISPLAY - About Card
    // =========================================================================

    function checkProfileAbout() {
        // Don't inject display fields on the edit page
        if (document.querySelector('.fcom_update_profile')) return;

        var aboutWrap = document.querySelector('.about_wrap');
        if (!aboutWrap) return;
        if (aboutWrap.querySelector('.tbc-reg-fields')) return;

        var match = window.location.pathname.match(/\/u\/([^\/]+)/);
        if (!match) return;

        // Data already cached from XHR interception? Render immediately.
        if (window._tbcRegProfileData) {
            renderProfileFields(aboutWrap, window._tbcRegProfileData);
            return;
        }

        // Fallback: if XHR interception missed (timing), fetch directly
        fetchProfileAndRender(match[1], aboutWrap);
    }

    function fetchProfileAndRender(username, aboutWrap) {
        if (aboutWrap.getAttribute('data-tbc-reg-loading')) return;
        aboutWrap.setAttribute('data-tbc-reg-loading', '1');

        var restUrl = config.restUrl || '/wp-json/fluent-community/v2/';
        var headers = { 'Content-Type': 'application/json' };
        var nonce = getNonce();
        if (nonce) {
            headers['X-WP-Nonce'] = nonce;
        }

        fetch(restUrl + 'profile/' + encodeURIComponent(username), {
            method: 'GET',
            credentials: 'same-origin',
            headers: headers,
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                processProfileResponse(data);
                if (window._tbcRegProfileData) {
                    renderProfileFields(aboutWrap, window._tbcRegProfileData);
                }
            })
            .catch(function (err) {
                console.warn('TBC Reg: Could not fetch profile data', err);
            });
    }

    function renderProfileFields(aboutWrap, customFields) {
        if (aboutWrap.querySelector('.tbc-reg-fields')) return;

        var aboutItems = aboutWrap.querySelector('.about_body .about_items') ||
                         aboutWrap.querySelector('.about_body') ||
                         aboutWrap;

        var wrapper = document.createElement('div');
        wrapper.className = 'tbc-reg-fields';

        var hasFields = false;
        var keys = Object.keys(customFields);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var field = customFields[key];
            if (!field.value) continue;

            hasFields = true;
            var item = document.createElement('div');
            item.className = 'about_item tbc-reg-item';

            var icon = typeIcons[field.type] || typeIcons.text;
            var displayValue = formatDisplayValue(field.value, field.type, key);

            item.innerHTML =
                '<span class="tbc-reg-icon">' + icon + '</span>' +
                '<span>' + escapeHtml(field.label) + ': ' + displayValue + '</span>';
            wrapper.appendChild(item);
        }

        if (hasFields) {
            aboutItems.appendChild(wrapper);
        }
    }

    /**
     * Format a field value for display based on type.
     */
    function formatDisplayValue(value, type, key) {
        if (!value) return '';

        switch (type) {
            case 'url':
                var safeUrl = escapeAttr(value);
                return '<a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(value) + '</a>';

            case 'checkbox':
            case 'multiselect':
                try {
                    var arr = JSON.parse(value);
                    if (Array.isArray(arr)) {
                        return escapeHtml(arr.join(', '));
                    }
                } catch (e) {}
                return escapeHtml(value);

            case 'phone':
                return '<a href="tel:' + escapeAttr(value) + '">' + escapeHtml(value) + '</a>';

            default:
                return escapeHtml(value);
        }
    }

    // =========================================================================
    // PROFILE EDIT FORM
    // =========================================================================

    function checkEditForm() {
        var editForm = document.querySelector('.fcom_update_profile');
        if (!editForm) return;
        if (editForm.querySelector('.tbc-reg-edit-fields')) return;

        // Data already cached from XHR interception?
        if (window._tbcRegProfileData) {
            injectEditSection(editForm);
            return;
        }

        // Fallback: fetch if cache miss
        var match = window.location.pathname.match(/\/u\/([^\/]+)/);
        if (match) {
            fetchProfileDataOnly(match[1], function () {
                injectEditSection(editForm);
            });
            return;
        }

        injectEditSection(editForm);
    }

    function fetchProfileDataOnly(username, callback) {
        var restUrl = config.restUrl || '/wp-json/fluent-community/v2/';
        var headers = { 'Content-Type': 'application/json' };
        var nonce = getNonce();
        if (nonce) headers['X-WP-Nonce'] = nonce;

        fetch(restUrl + 'profile/' + encodeURIComponent(username), {
            method: 'GET',
            credentials: 'same-origin',
            headers: headers,
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                processProfileResponse(data);
                callback();
            })
            .catch(function () { callback(); });
    }

    function injectEditSection(editForm) {
        if (editForm.querySelector('.tbc-reg-edit-fields')) return;

        var customFields = window._tbcRegProfileData || {};
        var fieldConfigs = window._tbcRegProfileConfigs || fields;

        // Build section matching native .fcom_sub_group structure
        var section = document.createElement('div');
        section.className = 'fcom_sub_group tbc-reg-edit-fields';

        var header = document.createElement('div');
        header.className = 'fcom_sub_group_header';
        header.innerHTML = '<h5>Additional Info</h5>';
        section.appendChild(header);

        var content = document.createElement('div');
        content.className = 'fcom_sub_group_content';

        var keys = Object.keys(fieldConfigs);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var fieldDef = fieldConfigs[key];
            var currentValue = (customFields[key] && customFields[key].value) || '';

            var formItem = document.createElement('div');
            formItem.className = 'el-form-item';

            var labelHtml = '<label class="el-form-item__label">' + escapeHtml(fieldDef.label);
            if (fieldDef.required) {
                labelHtml += ' <span class="tbc-reg-required">*</span>';
            }
            labelHtml += '</label>';

            var inputHtml = buildInputHtml(key, fieldDef, currentValue);

            var instructionsHtml = '';
            if (fieldDef.instructions) {
                instructionsHtml = '<div class="tbc-reg-instructions">' + escapeHtml(fieldDef.instructions) + '</div>';
            }

            var visibilityHtml = '';
            if (fieldDef.allow_user_override) {
                var currentVis = (customFields[key] && customFields[key].visibility) || 'public';
                visibilityHtml = buildVisibilityDropdown(key, currentVis);
            }

            formItem.innerHTML = labelHtml + visibilityHtml +
                '<div class="el-form-item__content">' + inputHtml + instructionsHtml + '</div>';
            content.appendChild(formItem);
        }

        section.appendChild(content);

        // Insert BEFORE Social Links — find Social Links group by header text
        var subGroups = editForm.querySelectorAll('.fcom_sub_group');
        var socialGroup = null;

        for (var j = 0; j < subGroups.length; j++) {
            var headerEl = subGroups[j].querySelector('.fcom_sub_group_header h5');
            if (headerEl) {
                var text = headerEl.textContent.trim().toLowerCase();
                if (text.indexOf('social') !== -1) {
                    socialGroup = subGroups[j];
                    break;
                }
            }
        }

        if (socialGroup) {
            socialGroup.parentNode.insertBefore(section, socialGroup);
        } else if (subGroups.length > 0) {
            // Fallback: insert after the last .fcom_sub_group
            var lastGroup = subGroups[subGroups.length - 1];
            lastGroup.parentNode.insertBefore(section, lastGroup.nextSibling);
        } else {
            editForm.appendChild(section);
        }
    }

    /**
     * Build the appropriate input HTML based on field type.
     */
    function buildInputHtml(key, fieldDef, value) {
        var type = fieldDef.type || 'text';
        var dataAttr = 'data-tbc-reg-key="' + escapeAttr(key) + '"';
        var placeholder = escapeAttr(fieldDef.placeholder || '');

        switch (type) {
            case 'textarea':
                return '<div class="el-textarea">' +
                    '<textarea class="el-textarea__inner" ' + dataAttr +
                    ' placeholder="' + placeholder + '" rows="3">' + escapeHtml(value) + '</textarea>' +
                    '</div>';

            case 'select':
            case 'gender':
                var options = fieldDef.options || [];
                var optionsHtml = '<option value="">' + escapeHtml(fieldDef.placeholder || '-- Select --') + '</option>';
                for (var i = 0; i < options.length; i++) {
                    var selected = (options[i] === value) ? ' selected' : '';
                    optionsHtml += '<option value="' + escapeAttr(options[i]) + '"' + selected + '>' +
                        escapeHtml(options[i]) + '</option>';
                }
                return '<div class="el-select tbc-reg-select-wrap">' +
                    '<select class="el-input__inner" ' + dataAttr + '>' + optionsHtml + '</select>' +
                    '</div>';

            case 'radio':
                var radioOptions = fieldDef.options || [];
                var radioHtml = '<div class="tbc-reg-radio-group" ' + dataAttr + '>';
                for (var r = 0; r < radioOptions.length; r++) {
                    var checked = (radioOptions[r] === value) ? ' checked' : '';
                    var radioId = 'tbc-reg-' + key + '-' + r;
                    radioHtml += '<label class="tbc-reg-radio" for="' + radioId + '">' +
                        '<input type="radio" id="' + radioId + '" name="tbc_reg_' + escapeAttr(key) + '" ' +
                        'value="' + escapeAttr(radioOptions[r]) + '"' + checked + '>' +
                        '<span>' + escapeHtml(radioOptions[r]) + '</span></label>';
                }
                radioHtml += '</div>';
                return radioHtml;

            case 'checkbox':
            case 'multiselect':
                var cbOptions = fieldDef.options || [];
                var selectedValues = [];
                try {
                    var parsed = JSON.parse(value);
                    if (Array.isArray(parsed)) selectedValues = parsed;
                } catch (e) {
                    if (value) selectedValues = [value];
                }

                if (type === 'multiselect') {
                    var msHtml = '<div class="tbc-reg-multiselect-wrap">' +
                        '<select class="el-input__inner" ' + dataAttr + ' multiple>';
                    for (var m = 0; m < cbOptions.length; m++) {
                        var mSelected = (selectedValues.indexOf(cbOptions[m]) !== -1) ? ' selected' : '';
                        msHtml += '<option value="' + escapeAttr(cbOptions[m]) + '"' + mSelected + '>' +
                            escapeHtml(cbOptions[m]) + '</option>';
                    }
                    msHtml += '</select></div>';
                    return msHtml;
                }

                // Checkbox group
                var cbHtml = '<div class="tbc-reg-checkbox-group" ' + dataAttr + '>';
                for (var c = 0; c < cbOptions.length; c++) {
                    var cbChecked = (selectedValues.indexOf(cbOptions[c]) !== -1) ? ' checked' : '';
                    var cbId = 'tbc-reg-' + key + '-' + c;
                    cbHtml += '<label class="tbc-reg-checkbox" for="' + cbId + '">' +
                        '<input type="checkbox" id="' + cbId + '" ' +
                        'value="' + escapeAttr(cbOptions[c]) + '"' + cbChecked + '>' +
                        '<span>' + escapeHtml(cbOptions[c]) + '</span></label>';
                }
                cbHtml += '</div>';
                return cbHtml;

            case 'phone':
                return '<div class="el-input">' +
                    '<div class="el-input__wrapper">' +
                    '<input class="el-input__inner" type="tel" ' + dataAttr +
                    ' placeholder="' + placeholder + '" value="' + escapeAttr(value) + '" />' +
                    '</div></div>';

            case 'number':
                return '<div class="el-input">' +
                    '<div class="el-input__wrapper">' +
                    '<input class="el-input__inner" type="number" ' + dataAttr +
                    ' placeholder="' + placeholder + '" value="' + escapeAttr(value) + '" />' +
                    '</div></div>';

            case 'date':
                return '<div class="el-input">' +
                    '<div class="el-input__wrapper">' +
                    '<input class="el-input__inner" type="date" ' + dataAttr +
                    ' value="' + escapeAttr(value) + '" />' +
                    '</div></div>';

            case 'url':
                return '<div class="el-input">' +
                    '<div class="el-input__wrapper">' +
                    '<input class="el-input__inner" type="url" ' + dataAttr +
                    ' placeholder="' + placeholder + '" value="' + escapeAttr(value) + '" />' +
                    '</div></div>';

            case 'text':
            default:
                return '<div class="el-input">' +
                    '<div class="el-input__wrapper">' +
                    '<input class="el-input__inner" type="text" ' + dataAttr +
                    ' placeholder="' + placeholder + '" value="' + escapeAttr(value) + '" />' +
                    '</div></div>';
        }
    }

    /**
     * Build a visibility override dropdown for a field.
     */
    function buildVisibilityDropdown(key, currentVis) {
        var attr = 'data-tbc-reg-visibility="' + escapeAttr(key) + '"';
        var opts = [
            { value: 'public',  label: 'Public' },
            { value: 'members', label: 'Members Only' },
            { value: 'friends', label: 'Friends Only' },
            { value: 'admins',  label: 'Admins Only' },
        ];
        var html = '<div class="tbc-reg-visibility-wrap">' +
            '<label class="tbc-reg-visibility-label">Who can see this:</label>' +
            '<select class="tbc-reg-visibility-select" ' + attr + '>';
        for (var i = 0; i < opts.length; i++) {
            var sel = (opts[i].value === currentVis) ? ' selected' : '';
            html += '<option value="' + opts[i].value + '"' + sel + '>' + escapeHtml(opts[i].label) + '</option>';
        }
        html += '</select></div>';
        return html;
    }

    // =========================================================================
    // XHR INTERCEPTION
    // =========================================================================

    function patchXHR() {
        if (xhrPatched) return;
        xhrPatched = true;

        var origOpen = XMLHttpRequest.prototype.open;
        var origSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (method, url) {
            this._tbcReg = {
                method: (method || '').toUpperCase(),
                url: url || '',
            };
            return origOpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function (body) {
            var info = this._tbcReg;

            if (info && info.url.indexOf('/profile') !== -1) {

                // --- READ: Intercept GET responses to cache custom_fields ---
                if (info.method === 'GET') {
                    var origOnReadyStateChange = this.onreadystatechange;
                    var xhr = this;

                    this.onreadystatechange = function () {
                        if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {
                            try {
                                var data = JSON.parse(xhr.responseText);
                                processProfileResponse(data);
                            } catch (e) {}
                        }
                        if (origOnReadyStateChange) {
                            origOnReadyStateChange.apply(this, arguments);
                        }
                    };
                }

                // --- WRITE: Inject custom_fields into POST/PUT/PATCH requests ---
                if (info.method === 'POST' || info.method === 'PUT' || info.method === 'PATCH') {
                    var cfValues = collectEditFieldValues();
                    if (Object.keys(cfValues).length) {
                        // Strategy 1: Custom header
                        try {
                            this.setRequestHeader('X-TBC-REG-Fields', JSON.stringify(cfValues));
                        } catch (e) {}

                        // Strategy 2: Inject into JSON body
                        if (body && typeof body === 'string') {
                            try {
                                var parsed = JSON.parse(body);
                                parsed.custom_fields = cfValues;
                                if (parsed.data) {
                                    parsed.data.custom_fields = cfValues;
                                }
                                body = JSON.stringify(parsed);
                            } catch (e) {}
                        }
                    }
                }
            }

            return origSend.call(this, body);
        };
    }

    /**
     * Process a profile API response and cache custom_fields data.
     */
    function processProfileResponse(data) {
        if (!data) return;

        var profile = data.profile || data;
        var customFields = profile.custom_fields;

        if (customFields) {
            window._tbcRegProfileData = customFields;
            window._tbcRegProfileConfigs = profile.custom_field_configs || null;
        }
    }

    /**
     * Collect values from all injected edit inputs.
     * Handles all input types: text, select, radio, checkbox, multiselect, textarea.
     */
    function collectEditFieldValues() {
        var values = {};

        // Standard inputs, selects, textareas with data-tbc-reg-key
        var inputs = document.querySelectorAll('[data-tbc-reg-key]');
        for (var i = 0; i < inputs.length; i++) {
            var el = inputs[i];
            var key = el.getAttribute('data-tbc-reg-key');

            if (el.tagName === 'SELECT' && el.multiple) {
                // Multiselect
                var selected = [];
                for (var s = 0; s < el.options.length; s++) {
                    if (el.options[s].selected) selected.push(el.options[s].value);
                }
                values[key] = JSON.stringify(selected);
            } else if (el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' ||
                       (el.tagName === 'INPUT' && el.type !== 'radio' && el.type !== 'checkbox')) {
                values[key] = el.value;
            } else if (el.classList.contains('tbc-reg-radio-group')) {
                // Radio group: find checked radio
                var checked = el.querySelector('input[type="radio"]:checked');
                values[key] = checked ? checked.value : '';
            } else if (el.classList.contains('tbc-reg-checkbox-group')) {
                // Checkbox group: collect checked values
                var checkedBoxes = el.querySelectorAll('input[type="checkbox"]:checked');
                var cbValues = [];
                for (var c = 0; c < checkedBoxes.length; c++) {
                    cbValues.push(checkedBoxes[c].value);
                }
                values[key] = JSON.stringify(cbValues);
            }
        }

        // Collect visibility overrides
        var visSelects = document.querySelectorAll('[data-tbc-reg-visibility]');
        for (var v = 0; v < visSelects.length; v++) {
            var visEl = visSelects[v];
            var visKey = visEl.getAttribute('data-tbc-reg-visibility');
            values[visKey + '_visibility'] = visEl.value;
        }

        return values;
    }

    // =========================================================================
    // UTILITIES
    // =========================================================================

    function getNonce() {
        if (window.fluentComAdmin && window.fluentComAdmin.nonce) {
            return window.fluentComAdmin.nonce;
        }
        if (window.fluentCommunityAdmin && window.fluentCommunityAdmin.rest_nonce) {
            return window.fluentCommunityAdmin.rest_nonce;
        }
        return config.nonce || '';
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    function escapeAttr(str) {
        return (str || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // =========================================================================
    // START
    // =========================================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
