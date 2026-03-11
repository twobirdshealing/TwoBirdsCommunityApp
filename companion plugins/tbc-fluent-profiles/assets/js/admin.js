/**
 * TBC Fluent Profiles - Admin JS
 * Handles: sortable grid, add/edit/delete field cards, modal interaction, tab switching.
 */
(function ($) {
    'use strict';

    // ---- Tab Switching ----
    $(document).on('click', '.tbc-fp-tabs .nav-tab', function (e) {
        e.preventDefault();
        var tab = $(this).data('tab');
        $('.tbc-fp-tabs .nav-tab').removeClass('nav-tab-active');
        $(this).addClass('nav-tab-active');
        $('.tbc-fp-tab-panel').removeClass('tbc-fp-tab-panel--active').hide();
        $('#tbc-fp-tab-' + tab).addClass('tbc-fp-tab-panel--active').show();
        // Store active tab in URL hash
        if (history.replaceState) {
            history.replaceState(null, null, '#tbc-fp-tab-' + tab);
        }
    });

    // Restore tab from URL hash on load
    $(function () {
        var hash = window.location.hash;
        if (hash && hash.indexOf('#tbc-fp-tab-') === 0) {
            var tabLink = $('.tbc-fp-tabs .nav-tab[href="' + hash + '"]');
            if (tabLink.length) {
                tabLink.trigger('click');
            }
        }
    });

    var currentCard = null;
    var isNewField = false;
    var optionKey = tbcFpAdmin.optionKey || 'tbc_fp_fields';

    // ---- Utilities ----

    function slugify(str) {
        return str
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '')
            .substring(0, 30);
    }

    function getExistingIds() {
        var ids = [];
        $('.tbc-fp-card').not('.tbc-fp-card-add').each(function () {
            ids.push($(this).data('id'));
        });
        return ids;
    }

    function uniqueSlug(base) {
        var ids = getExistingIds();
        var slug = base;
        var i = 2;
        while (ids.indexOf(slug) !== -1) {
            slug = base + '_' + i;
            i++;
        }
        return slug;
    }

    function updateOrder() {
        $('.tbc-fp-card').not('.tbc-fp-card-add').each(function (i) {
            $(this).find('.tbc-fp-data-order').val(i + 1);
        });
    }

    function getTypeIcon(type) {
        var icons = {
            text: 'T', phone: '#', number: '#', date: 'D',
            textarea: 'P', select: 'v', radio: 'o',
            checkbox: 'x', multiselect: 'M', gender: 'G', url: '@'
        };
        return icons[type] || 'T';
    }

    function getTypeLabel(type) {
        if (tbcFpAdmin.typeRegistry && tbcFpAdmin.typeRegistry[type]) {
            return tbcFpAdmin.typeRegistry[type].label;
        }
        return 'Text';
    }

    function getVisLabel(vis) {
        if (tbcFpAdmin.visibilityLevels && tbcFpAdmin.visibilityLevels[vis]) {
            return tbcFpAdmin.visibilityLevels[vis];
        }
        return 'Admins Only';
    }

    // ---- Sortable ----

    $('#tbc-fp-fields-grid').sortable({
        items: '.tbc-fp-card:not(.tbc-fp-card-add)',
        placeholder: 'tbc-fp-card ui-sortable-placeholder',
        tolerance: 'pointer',
        update: function () {
            updateOrder();
        }
    });

    // ---- Card Click -> Open Modal ----

    $(document).on('click', '.tbc-fp-card-edit', function (e) {
        e.stopPropagation();
        openModal($(this).closest('.tbc-fp-card'));
    });

    $(document).on('click', '.tbc-fp-card:not(.tbc-fp-card-add)', function (e) {
        if ($(e.target).closest('.tbc-fp-card-edit').length) return;
        openModal($(this));
    });

    // ---- Add New ----

    $(document).on('click', '#tbc-fp-card-add', function () {
        var tempId = 'field_' + Date.now();

        var html = '<div class="tbc-fp-card" data-id="' + tempId + '">' +
            '<input type="hidden" class="tbc-fp-data-key"         name="' + optionKey + '[' + tempId + '][key]"                 value="' + tempId + '">' +
            '<input type="hidden" class="tbc-fp-data-label"       name="' + optionKey + '[' + tempId + '][label]"               value="">' +
            '<input type="hidden" class="tbc-fp-data-type"        name="' + optionKey + '[' + tempId + '][type]"                value="text">' +
            '<input type="hidden" class="tbc-fp-data-placeholder" name="' + optionKey + '[' + tempId + '][placeholder]"         value="">' +
            '<input type="hidden" class="tbc-fp-data-instructions" name="' + optionKey + '[' + tempId + '][instructions]"       value="">' +
            '<input type="hidden" class="tbc-fp-data-required"    name="' + optionKey + '[' + tempId + '][required]"            value="0">' +
            '<input type="hidden" class="tbc-fp-data-order"       name="' + optionKey + '[' + tempId + '][order]"               value="0">' +
            '<input type="hidden" class="tbc-fp-data-visibility"  name="' + optionKey + '[' + tempId + '][visibility]"          value="admins">' +
            '<input type="hidden" class="tbc-fp-data-allow-override" name="' + optionKey + '[' + tempId + '][allow_user_override]" value="0">' +
            '<input type="hidden" class="tbc-fp-data-show-signup" name="' + optionKey + '[' + tempId + '][show_on_signup]"      value="1">' +
            '<input type="hidden" class="tbc-fp-data-show-profile" name="' + optionKey + '[' + tempId + '][show_in_profile]"    value="1">' +
            '<input type="hidden" class="tbc-fp-data-options"     name="' + optionKey + '[' + tempId + '][options]"              value="">' +
            '<button type="button" class="tbc-fp-card-edit" title="Edit"><svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M13.89 3.39l2.71 2.72c.46.46.42 1.24.03 1.64l-8.01 8.02-2.87.71c-.45.11-.87-.31-.76-.76l.71-2.87 8.01-8.02c.4-.39 1.18-.43 1.64.03zm-2.53 2.53l-6.88 6.88-.36 1.47 1.47-.36 6.88-6.88-1.11-1.11z"/></svg></button>' +
            '<div class="tbc-fp-card-badges"></div>' +
            '<div class="tbc-fp-card-icon">T</div>' +
            '<div class="tbc-fp-card-label">New Field</div>' +
            '<div class="tbc-fp-card-type">Text</div>' +
            '<div class="tbc-fp-card-visibility"><span class="tbc-fp-vis-dot tbc-fp-vis-admins"></span>Admins Only</div>' +
            '</div>';

        var $card = $(html);
        $('#tbc-fp-card-add').before($card);
        updateOrder();

        isNewField = true;
        openModal($card);
    });

    // ---- Modal ----

    function openModal($card) {
        currentCard = $card;

        // Populate modal from hidden fields
        $('#tbc-fp-field-label').val($card.find('.tbc-fp-data-label').val());
        $('#tbc-fp-field-type').val($card.find('.tbc-fp-data-type').val());
        $('#tbc-fp-field-placeholder').val($card.find('.tbc-fp-data-placeholder').val());
        $('#tbc-fp-field-instructions').val($card.find('.tbc-fp-data-instructions').val());
        $('#tbc-fp-field-options').val($card.find('.tbc-fp-data-options').val());
        $('#tbc-fp-field-visibility').val($card.find('.tbc-fp-data-visibility').val());
        $('#tbc-fp-field-required').prop('checked', $card.find('.tbc-fp-data-required').val() === '1');
        $('#tbc-fp-field-show-signup').prop('checked', $card.find('.tbc-fp-data-show-signup').val() === '1');
        $('#tbc-fp-field-show-profile').prop('checked', $card.find('.tbc-fp-data-show-profile').val() === '1');
        $('#tbc-fp-field-allow-override').prop('checked', $card.find('.tbc-fp-data-allow-override').val() === '1');

        // Update char count
        updateLabelCount();

        // Show/hide type-specific fields
        toggleTypeFields();

        // Delete button text
        if (isNewField) {
            $('#tbc-fp-delete-btn').text('Cancel');
            $('#tbc-fp-modal-title').text('Add New Field');
        } else {
            $('#tbc-fp-delete-btn').text('Delete Field');
            $('#tbc-fp-modal-title').text('Edit Field');
        }

        $('#tbc-fp-modal').show();
    }

    function closeModal() {
        $('#tbc-fp-modal').hide();
        currentCard = null;
        isNewField = false;
    }

    // Close modal via overlay or X
    $(document).on('click', '.tbc-fp-modal-overlay, .tbc-fp-modal-close', function () {
        if (isNewField && currentCard) {
            currentCard.remove();
            updateOrder();
        }
        closeModal();
    });

    // ---- Done (Save to card) ----

    $(document).on('click', '#tbc-fp-done-btn', function () {
        if (!currentCard) return;

        var label = $.trim($('#tbc-fp-field-label').val());
        if (!label) {
            $('#tbc-fp-field-label').focus();
            return;
        }

        var type = $('#tbc-fp-field-type').val();
        var placeholder = $.trim($('#tbc-fp-field-placeholder').val());
        var instructions = $.trim($('#tbc-fp-field-instructions').val());
        var options = $.trim($('#tbc-fp-field-options').val());
        var visibility = $('#tbc-fp-field-visibility').val();
        var required = $('#tbc-fp-field-required').is(':checked') ? '1' : '0';
        var showSignup = $('#tbc-fp-field-show-signup').is(':checked') ? '1' : '0';
        var showProfile = $('#tbc-fp-field-show-profile').is(':checked') ? '1' : '0';
        var allowOverride = $('#tbc-fp-field-allow-override').is(':checked') ? '1' : '0';

        // For new fields, generate a proper slug-based ID
        if (isNewField) {
            var newId = uniqueSlug(slugify(label) || 'field');
            var oldId = currentCard.data('id');

            currentCard.attr('data-id', newId).data('id', newId);

            // Update all input names from old temp ID to new slug
            currentCard.find('input[type="hidden"]').each(function () {
                var name = $(this).attr('name');
                if (name) {
                    $(this).attr('name', name.replace('[' + oldId + ']', '[' + newId + ']'));
                }
            });

            currentCard.find('.tbc-fp-data-key').val(newId);
        }

        // Update hidden fields
        currentCard.find('.tbc-fp-data-label').val(label);
        currentCard.find('.tbc-fp-data-type').val(type);
        currentCard.find('.tbc-fp-data-placeholder').val(placeholder);
        currentCard.find('.tbc-fp-data-instructions').val(instructions);
        currentCard.find('.tbc-fp-data-options').val(options);
        currentCard.find('.tbc-fp-data-visibility').val(visibility);
        currentCard.find('.tbc-fp-data-required').val(required);
        currentCard.find('.tbc-fp-data-show-signup').val(showSignup);
        currentCard.find('.tbc-fp-data-show-profile').val(showProfile);
        currentCard.find('.tbc-fp-data-allow-override').val(allowOverride);

        // Update card visual
        currentCard.find('.tbc-fp-card-icon').text(getTypeIcon(type));
        currentCard.find('.tbc-fp-card-label').text(label);
        currentCard.find('.tbc-fp-card-type').text(getTypeLabel(type));

        // Update visibility
        currentCard.find('.tbc-fp-card-visibility').html(
            '<span class="tbc-fp-vis-dot tbc-fp-vis-' + visibility + '"></span>' + getVisLabel(visibility)
        );

        // Update badges
        var badgesHtml = '';
        if (required === '1') {
            badgesHtml += '<span class="tbc-fp-badge tbc-fp-badge-required" title="Required">*</span>';
        }
        if (showSignup === '1') {
            badgesHtml += '<span class="tbc-fp-badge tbc-fp-badge-signup" title="Shown on signup">S</span>';
        }
        currentCard.find('.tbc-fp-card-badges').html(badgesHtml);

        closeModal();
    });

    // ---- Delete ----

    $(document).on('click', '#tbc-fp-delete-btn', function () {
        if (!currentCard) return;

        if (isNewField) {
            // Cancel: just remove and close
            currentCard.remove();
            updateOrder();
            closeModal();
            return;
        }

        if (!confirm('Are you sure you want to delete this field? This will not delete existing user data.')) {
            return;
        }

        currentCard.remove();
        updateOrder();
        closeModal();
    });

    // ---- Type Change -> Toggle Type-Specific Fields ----

    $(document).on('change', '#tbc-fp-field-type', function () {
        toggleTypeFields();
    });

    function toggleTypeFields() {
        var type = $('#tbc-fp-field-type').val();
        var typeConfig = tbcFpAdmin.typeRegistry[type];

        // Options: only for types with user-defined options (not gender's fixed options)
        if (typeConfig && typeConfig.has_options && !typeConfig.fixed_options) {
            $('#tbc-fp-options-group').show();
        } else {
            $('#tbc-fp-options-group').hide();
        }

        // Placeholder: not relevant for radio, checkbox, multiselect
        var noPlaceholder = ['radio', 'checkbox', 'multiselect'];
        if (noPlaceholder.indexOf(type) !== -1) {
            $('#tbc-fp-placeholder-group').hide();
        } else {
            $('#tbc-fp-placeholder-group').show();
        }
    }

    // ---- Label char count ----

    $(document).on('input', '#tbc-fp-field-label', function () {
        updateLabelCount();
    });

    function updateLabelCount() {
        var len = ($('#tbc-fp-field-label').val() || '').length;
        $('#tbc-fp-label-count').text(len);
    }

    // ---- Escape key ----

    $(document).on('keydown', function (e) {
        if (e.key === 'Escape' && $('#tbc-fp-modal').is(':visible')) {
            if (isNewField && currentCard) {
                currentCard.remove();
                updateOrder();
            }
            closeModal();
        }
    });

})(jQuery);
