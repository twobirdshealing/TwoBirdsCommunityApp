(function($) {
    'use strict';

    var currentNotesEntryId = null;
    var currentScheduleEntryId = null;

    // Color maps for dropdowns
    var approvalColors = {
        '1': { bg: 'rgba(40, 167, 69, 0.1)', border: 'rgba(40, 167, 69, 0.3)', color: '#28a745' },
        '2': { bg: 'rgba(220, 53, 69, 0.1)', border: 'rgba(220, 53, 69, 0.3)', color: '#dc3545' },
        '3': { bg: 'rgba(255, 193, 7, 0.1)', border: 'rgba(255, 193, 7, 0.3)', color: '#856404' }
    };

    var statusColors = {
        '': { bg: 'rgba(255, 193, 7, 0.1)', border: 'rgba(255, 193, 7, 0.3)', color: '#856404' },
        'not_required': { bg: 'rgba(40, 167, 69, 0.1)', border: 'rgba(40, 167, 69, 0.3)', color: '#28a745' },
        'required': { bg: 'rgba(220, 53, 69, 0.1)', border: 'rgba(220, 53, 69, 0.3)', color: '#dc3545' },
        'completed': { bg: 'rgba(40, 167, 69, 0.1)', border: 'rgba(40, 167, 69, 0.3)', color: '#28a745' }
    };

    function applyDropdownColor($select, colorMap) {
        var val = $select.val();
        var style = colorMap[val] || {};
        $select.css({
            'background-color': style.bg || '',
            'border-color': style.border || '',
            'color': style.color || '',
            'font-weight': style.color ? '600' : ''
        });
    }

    // Apply colors on page load
    $(document).ready(function() {
        $('.tbc-cp-er-approval-dropdown').each(function() { applyDropdownColor($(this), approvalColors); });
        $('.tbc-cp-er-screening-dropdown').each(function() { applyDropdownColor($(this), statusColors); });
        $('.tbc-cp-er-spirit-dropdown').each(function() { applyDropdownColor($(this), statusColors); });
    });

    // Phone screening status change
    $(document).on('change', '.tbc-cp-er-screening-dropdown', function() {
        var $select = $(this);
        var entryId = $select.data('entry-id');
        var status = $select.val();

        applyDropdownColor($select, statusColors);

        $.ajax({
            url: tbc_cp_er.ajaxurl,
            type: 'POST',
            data: {
                action: 'tbc_cp_er_update_phone_screening',
                nonce: tbc_cp_er.nonce,
                entry_id: entryId,
                screening_status: status
            },
            success: function(response) {
                if (response.success) {
                    showNotice('Phone screening status updated', 'success');
                    updateApprovalDropdown(entryId);

                    var $row = $('tr[data-entry-id="' + entryId + '"]');
                    var $scheduleInfo = $row.find('.tbc-cp-er-schedule-info');
                    if (status === 'required') {
                        $scheduleInfo.show();
                    } else {
                        $scheduleInfo.hide();
                    }
                } else {
                    showNotice('Error: ' + (response.data || 'Unknown error'), 'error');
                }
            },
            error: function() {
                showNotice('Failed to update. Please try again.', 'error');
            }
        });
    });

    // Spirit pharmacist status change
    $(document).on('change', '.tbc-cp-er-spirit-dropdown', function() {
        var $select = $(this);
        var entryId = $select.data('entry-id');
        var status = $select.val();

        applyDropdownColor($select, statusColors);

        $.ajax({
            url: tbc_cp_er.ajaxurl,
            type: 'POST',
            data: {
                action: 'tbc_cp_er_update_spirit_pharmacist',
                nonce: tbc_cp_er.nonce,
                entry_id: entryId,
                spirit_status: status
            },
            success: function(response) {
                if (response.success) {
                    showNotice('Spirit pharmacist status updated', 'success');
                    updateApprovalDropdown(entryId);
                } else {
                    showNotice('Error: ' + (response.data || 'Unknown error'), 'error');
                }
            },
            error: function() {
                showNotice('Failed to update. Please try again.', 'error');
            }
        });
    });

    // Approval dropdown change — show preview modal for approve/disapprove
    var pendingApproval = null; // { entryId, status, $select }

    $(document).on('change', '.tbc-cp-er-approval-dropdown', function() {
        var $select = $(this);
        var entryId = $select.data('entry-id');
        var status = $select.val();
        var labels = { '1': 'Approve', '2': 'Disapprove', '3': 'Unapprove' };

        // For unapprove, use simple confirm (no message needed)
        if (status === '3') {
            if (!confirm('Are you sure you want to unapprove this entry?')) {
                $select.val($select.data('prev-val') || '3');
                applyDropdownColor($select, approvalColors);
                return;
            }
            doApprovalUpdate(entryId, status, $select);
            return;
        }

        // For approve/disapprove, show preview modal
        pendingApproval = { entryId: entryId, status: status, $select: $select };

        var $modal = $('#tbc-cp-er-approval-preview-modal');
        var $content = $('#tbc-cp-er-approval-preview-content');
        var $loading = $('#tbc-cp-er-approval-preview-loading');
        var $warning = $('#tbc-cp-er-approval-preview-warning');
        var $confirmBtn = $('#tbc-cp-er-approval-confirm');
        var $desc = $('#tbc-cp-er-approval-preview-desc');

        $('#tbc-cp-er-approval-preview-title').text(labels[status] + ' Entry — Message Preview');
        $desc.text('This message will be sent to the user via FluentChat when you confirm.');
        $content.hide().text('');
        $loading.show();
        $warning.hide();
        $confirmBtn.prop('disabled', true);
        $modal.show();

        // Fetch preview
        $.ajax({
            url: tbc_cp_er.ajaxurl,
            type: 'POST',
            data: {
                action: 'tbc_cp_er_preview_message',
                nonce: tbc_cp_er.nonce,
                entry_id: entryId,
                approval_status: status
            },
            success: function(response) {
                $loading.hide();
                if (response.success) {
                    $content.text(response.data.message).show();
                    $confirmBtn.prop('disabled', false);

                    if (!response.data.enabled) {
                        $warning.text('Messaging is disabled. The approval status will be updated but no message will be sent. Enable messaging in Message Settings.').show();
                        $confirmBtn.text('Confirm (No Message)').data('will-send', false);
                    } else if (!response.data.has_sender) {
                        $warning.text('No sender configured. Set a sender in Message Settings to send messages.').show();
                        $confirmBtn.text('Confirm (No Message)').data('will-send', false);
                    } else {
                        $confirmBtn.text('Confirm & Send').data('will-send', true);
                    }
                } else {
                    $content.text('Could not load preview: ' + (response.data || 'Unknown error')).show();
                    $confirmBtn.prop('disabled', false).text('Confirm (No Message)').data('will-send', false);
                }
            },
            error: function() {
                $loading.hide();
                $content.text('Failed to load preview.').show();
                $confirmBtn.prop('disabled', false).text('Confirm (No Message)').data('will-send', false);
            }
        });
    });

    // Approval preview — confirm
    $(document).on('click', '#tbc-cp-er-approval-confirm', function() {
        var $previewModal = $('#tbc-cp-er-approval-preview-modal');
        var previewType = $previewModal.data('preview-type');

        // Phone screening message flow
        if (previewType === 'phone_screening') {
            var phoneEntryId = currentScheduleEntryId;
            var messageText = $('#tbc-cp-er-approval-preview-content').text();
            var $btn = $(this);

            $btn.prop('disabled', true).text('Sending...');

            $.ajax({
                url: tbc_cp_er.ajaxurl,
                type: 'POST',
                data: {
                    action: 'tbc_cp_er_send_phone_screening_message',
                    nonce: tbc_cp_er.nonce,
                    entry_id: phoneEntryId,
                    message: messageText
                },
                success: function(response) {
                    if (response.success) {
                        showNotice('Phone screening message sent', 'success');
                    } else {
                        showNotice('Failed to send message: ' + (response.data || 'Unknown error'), 'error');
                    }
                    $previewModal.hide();
                    $previewModal.removeData('preview-type');
                },
                error: function() {
                    showNotice('Failed to send message.', 'error');
                    $previewModal.hide();
                    $previewModal.removeData('preview-type');
                }
            });
            return;
        }

        if (!pendingApproval) return;

        var $btn = $(this);
        var entryId = pendingApproval.entryId;
        var status = pendingApproval.status;
        var $select = pendingApproval.$select;
        var messageText = $('#tbc-cp-er-approval-preview-content').text();

        var shouldSendMessage = !!$btn.data('will-send');

        $btn.prop('disabled', true).text('Processing...');

        // First update approval status
        doApprovalUpdate(entryId, status, $select, function() {
            // Only send message if messaging is enabled and configured
            if (!shouldSendMessage) {
                $('#tbc-cp-er-approval-preview-modal').hide();
                pendingApproval = null;
                return;
            }

            $.ajax({
                url: tbc_cp_er.ajaxurl,
                type: 'POST',
                data: {
                    action: 'tbc_cp_er_send_approval_message',
                    nonce: tbc_cp_er.nonce,
                    entry_id: entryId,
                    approval_status: status,
                    message: messageText
                },
                success: function(response) {
                    if (response.success) {
                        showNotice('Message sent', 'success');
                    } else {
                        showNotice('Approval saved but message failed: ' + (response.data || 'Unknown error'), 'error');
                    }
                    $('#tbc-cp-er-approval-preview-modal').hide();
                    pendingApproval = null;
                },
                error: function() {
                    showNotice('Approval saved but message failed to send.', 'error');
                    $('#tbc-cp-er-approval-preview-modal').hide();
                    pendingApproval = null;
                }
            });
        });
    });

    // Approval preview — cancel
    $(document).on('click', '#tbc-cp-er-approval-cancel', function() {
        if (pendingApproval) {
            pendingApproval.$select.val(pendingApproval.$select.data('prev-val') || '3');
            applyDropdownColor(pendingApproval.$select, approvalColors);
            pendingApproval = null;
        }
        $('#tbc-cp-er-approval-preview-modal').removeData('preview-type').hide();
    });

    function doApprovalUpdate(entryId, status, $select, onSuccess) {
        $select.prop('disabled', true);

        $.ajax({
            url: tbc_cp_er.ajaxurl,
            type: 'POST',
            data: {
                action: 'tbc_cp_er_update_approval',
                nonce: tbc_cp_er.nonce,
                entry_id: entryId,
                approval_status: status
            },
            success: function(response) {
                $select.prop('disabled', false);

                if (response.success) {
                    showNotice('Entry ' + response.data.label.toLowerCase(), 'success');
                    $select.data('prev-val', status);
                    applyDropdownColor($select, approvalColors);
                    if (onSuccess) onSuccess();
                } else {
                    $select.val($select.data('prev-val') || '3');
                    applyDropdownColor($select, approvalColors);
                    showNotice('Error: ' + (response.data || 'Unknown error'), 'error');
                    $('#tbc-cp-er-approval-preview-modal').hide();
                    pendingApproval = null;
                }
            },
            error: function() {
                $select.prop('disabled', false);
                $select.val($select.data('prev-val') || '3');
                applyDropdownColor($select, approvalColors);
                showNotice('Failed to update approval. Please try again.', 'error');
                $('#tbc-cp-er-approval-preview-modal').hide();
                pendingApproval = null;
            }
        });
    }

    // Store initial approval values for revert
    $(document).ready(function() {
        $('.tbc-cp-er-approval-dropdown').each(function() {
            $(this).data('prev-val', $(this).val());
        });
    });

    // Update approval dropdown enabled/disabled state
    function updateApprovalDropdown(entryId) {
        var $row = $('tr[data-entry-id="' + entryId + '"]');
        var phoneEnabled = $row.data('phone-screening-enabled') === 1;
        var spiritEnabled = $row.data('spirit-pharmacist-enabled') === 1;
        var notesEnabled = $row.data('consult-notes-enabled') === 1;
        var hasNotes = $row.data('has-notes') === 1;
        var $dropdown = $row.find('.tbc-cp-er-approval-dropdown');

        var phoneOk = true;
        if (phoneEnabled) {
            var screeningVal = $row.find('.tbc-cp-er-screening-dropdown').val();
            if (screeningVal === '') {
                phoneOk = false;
            }
        }

        var spiritOk = true;
        if (spiritEnabled) {
            var spiritVal = $row.find('.tbc-cp-er-spirit-dropdown').val();
            if (spiritVal === '') {
                spiritOk = false;
            }
        }

        var notesOk = notesEnabled ? hasNotes : true;
        var canChange = phoneOk && spiritOk && notesOk;

        if (canChange) {
            $dropdown.prop('disabled', false).removeAttr('title');
        } else {
            var reasons = [];
            if (!spiritOk) reasons.push('spirit pharmacist');
            if (!phoneOk) reasons.push('phone screening');
            if (notesEnabled && !hasNotes) reasons.push('consultation notes');
            var title = 'Set ' + reasons.join(' and ') + ' before changing approval';
            $dropdown.prop('disabled', true).attr('title', title);
        }
    }

    // Toggle block (church_user role)
    $(document).on('click', '.tbc-cp-er-block-toggle', function() {
        var $btn = $(this);
        var userId = $btn.data('user-id');
        var currentlyBlocked = $btn.attr('data-blocked') === '1';
        var newState = currentlyBlocked ? '0' : '1';
        var label = currentlyBlocked ? 'unblock' : 'block';

        if (!confirm('Are you sure you want to ' + label + ' this user?')) {
            return;
        }

        $btn.prop('disabled', true);

        $.ajax({
            url: tbc_cp_er.ajaxurl,
            type: 'POST',
            data: {
                action: 'tbc_cp_er_toggle_block',
                nonce: tbc_cp_er.nonce,
                user_id: userId,
                block: newState
            },
            success: function(response) {
                $btn.prop('disabled', false);

                if (response.success) {
                    var blocked = response.data.blocked;
                    $btn.attr('data-blocked', blocked ? '1' : '0')
                        .text(blocked ? 'Blocked' : 'Allowed');
                    showNotice('User ' + (blocked ? 'blocked' : 'unblocked'), 'success');
                } else {
                    showNotice('Error: ' + (response.data || 'Unknown error'), 'error');
                }
            },
            error: function() {
                $btn.prop('disabled', false);
                showNotice('Failed to update. Please try again.', 'error');
            }
        });
    });

    // View Entry modal
    $(document).on('click', '.tbc-cp-er-view-entry', function() {
        var entryId = $(this).data('entry-id');
        var formId = $(this).data('form-id');
        var userName = $(this).data('user-name');

        $('#tbc-cp-er-entry-modal-title').text('Entry Details \u2014 ' + userName);
        $('#tbc-cp-er-entry-fields').html('<div class="tbc-cp-er-loading">Loading entry...</div>');
        $('#tbc-cp-er-entry-modal').show();

        $.ajax({
            url: tbc_cp_er.ajaxurl,
            type: 'POST',
            data: {
                action: 'tbc_cp_er_get_entry_fields',
                nonce: tbc_cp_er.nonce,
                entry_id: entryId,
                form_id: formId
            },
            success: function(response) {
                if (response.success) {
                    $('#tbc-cp-er-entry-fields').html(response.data.html);
                } else {
                    $('#tbc-cp-er-entry-fields').html('<p>Error: ' + (response.data || 'Unknown error') + '</p>');
                }
            },
            error: function() {
                $('#tbc-cp-er-entry-fields').html('<p>Failed to load entry. Please try again.</p>');
            }
        });
    });

    // Copy Entry to clipboard
    $(document).on('click', '.tbc-cp-er-copy-entry', function() {
        var $btn = $(this);
        var entryId = $btn.data('entry-id');
        var formId = $btn.data('form-id');

        $btn.prop('disabled', true).text('Copying...');

        $.ajax({
            url: tbc_cp_er.ajaxurl,
            type: 'POST',
            data: {
                action: 'tbc_cp_er_get_entry_fields',
                nonce: tbc_cp_er.nonce,
                entry_id: entryId,
                form_id: formId,
                format: 'text'
            },
            success: function(response) {
                if (response.success && response.data.text) {
                    navigator.clipboard.writeText(response.data.text).then(function() {
                        $btn.text('Copied!');
                        setTimeout(function() {
                            $btn.prop('disabled', false).text('Copy');
                        }, 1500);
                    }, function() {
                        $btn.prop('disabled', false).text('Copy');
                        showNotice('Clipboard access denied. Try again.', 'error');
                    });
                } else {
                    $btn.prop('disabled', false).text('Copy');
                    showNotice('Error: ' + (response.data || 'Unknown error'), 'error');
                }
            },
            error: function() {
                $btn.prop('disabled', false).text('Copy');
                showNotice('Failed to copy entry data.', 'error');
            }
        });
    });

    // Consultation Notes modal
    $(document).on('click', '.tbc-cp-er-edit-notes', function() {
        currentNotesEntryId = $(this).data('entry-id');
        var $row = $(this).closest('tr');
        var currentNotes = $row.find('.tbc-cp-er-notes-data').val() || '';
        var userName = $(this).data('user-name');

        $('#tbc-cp-er-notes-modal-title').text('Consultation Notes \u2014 ' + userName);
        $('#tbc-cp-er-notes-textarea').val(currentNotes);
        $('#tbc-cp-er-notes-modal').show();
    });

    // Save notes
    $(document).on('click', '#tbc-cp-er-save-notes', function() {
        if (!currentNotesEntryId) return;

        var notes = $('#tbc-cp-er-notes-textarea').val();
        var $btn = $(this);
        $btn.prop('disabled', true).text('Saving...');

        $.ajax({
            url: tbc_cp_er.ajaxurl,
            type: 'POST',
            data: {
                action: 'tbc_cp_er_update_consult_notes',
                nonce: tbc_cp_er.nonce,
                entry_id: currentNotesEntryId,
                notes: notes
            },
            success: function(response) {
                $btn.prop('disabled', false).text('Save Notes');

                if (response.success) {
                    showNotice('Consultation notes saved', 'success');

                    var $row = $('tr[data-entry-id="' + currentNotesEntryId + '"]');
                    var hasNotes = notes.trim().length > 0;
                    var $notesBtn = $row.find('.tbc-cp-er-edit-notes');

                    $row.find('.tbc-cp-er-notes-data').val(notes);
                    $notesBtn.text(hasNotes ? 'Edit Notes' : 'Add Notes')
                        .toggleClass('tbc-cp-er-notes-filled', hasNotes);

                    $row.data('has-notes', hasNotes ? 1 : 0);
                    updateApprovalDropdown(currentNotesEntryId);

                    $('#tbc-cp-er-notes-modal').hide();
                    currentNotesEntryId = null;
                } else {
                    showNotice('Error: ' + (response.data || 'Unknown error'), 'error');
                }
            },
            error: function() {
                $btn.prop('disabled', false).text('Save Notes');
                showNotice('Failed to save notes. Please try again.', 'error');
            }
        });
    });

    // Schedule Call modal — open
    $(document).on('click', '.tbc-cp-er-schedule-call', function() {
        currentScheduleEntryId = $(this).data('entry-id');
        var userName = $(this).data('user-name');
        var currentDate = $(this).data('current-date') || '';
        var currentNote = $(this).data('current-note') || '';

        $('#tbc-cp-er-schedule-modal-title').text('Schedule Phone Screening \u2014 ' + userName);
        $('#tbc-cp-er-schedule-datetime').val(currentDate);
        $('#tbc-cp-er-schedule-note').val(currentNote);
        $('#tbc-cp-er-send-screening-msg').prop('disabled', !currentDate);
        $('#tbc-cp-er-schedule-modal').show();
    });

    // Schedule Call modal — save
    $(document).on('click', '#tbc-cp-er-save-schedule', function() {
        if (!currentScheduleEntryId) return;

        var date = $('#tbc-cp-er-schedule-datetime').val();
        var note = $('#tbc-cp-er-schedule-note').val();
        var $btn = $(this);

        if (!date) {
            alert('Please select a date and time.');
            return;
        }

        $btn.prop('disabled', true).text('Saving...');

        $.ajax({
            url: tbc_cp_er.ajaxurl,
            type: 'POST',
            data: {
                action: 'tbc_cp_er_update_phone_schedule',
                nonce: tbc_cp_er.nonce,
                entry_id: currentScheduleEntryId,
                screening_date: date,
                screening_note: note
            },
            success: function(response) {
                $btn.prop('disabled', false).text('Save Schedule');

                if (response.success) {
                    showNotice('Phone screening scheduled for ' + response.data.formatted_date, 'success');

                    var $row = $('tr[data-entry-id="' + currentScheduleEntryId + '"]');
                    var $info = $row.find('.tbc-cp-er-schedule-info');

                    var now = new Date();
                    var schedDate = new Date(date);
                    var isOverdue = schedDate < now;
                    var badgeClass = isOverdue ? 'tbc-cp-er-schedule-overdue' : 'tbc-cp-er-schedule-set';
                    var badgeContent = isOverdue
                        ? $('<span>').text('Overdue: ' + response.data.formatted_date).html()
                        : '&#128222; ' + $('<span>').text(response.data.formatted_date).html();

                    var userName = $info.closest('tr').find('strong').first().text();
                    var calendarUrl = response.data.calendar_url || '';
                    $info.find('.tbc-cp-er-schedule-badge').remove();
                    $info.find('.tbc-cp-er-schedule-call').remove();
                    $info.find('.tbc-cp-er-schedule-calendar').remove();
                    $info.prepend(
                        '<span class="tbc-cp-er-schedule-badge ' + badgeClass + '">' +
                        badgeContent +
                        '</span>' +
                        '<button type="button" class="tbc-cp-er-schedule-call tbc-cp-er-schedule-edit" ' +
                        'data-entry-id="' + currentScheduleEntryId + '" ' +
                        'data-user-name="' + $('<span>').text(userName).html() + '" ' +
                        'data-current-date="' + $('<span>').text(date).html() + '" ' +
                        'data-current-note="' + $('<span>').text(note).html() + '" ' +
                        'title="Edit Schedule">&#9998;</button>' +
                        (calendarUrl ? '<a href="' + $('<span>').text(calendarUrl).html() + '" class="tbc-cp-er-schedule-calendar" title="Add to calendar" target="_blank">&#128197;</a>' : '')
                    );

                    // Enable Send Message button now that a date is saved
                    $('#tbc-cp-er-send-screening-msg').prop('disabled', false);
                } else {
                    showNotice('Error: ' + (response.data || 'Unknown error'), 'error');
                }
            },
            error: function() {
                $btn.prop('disabled', false).text('Save Schedule');
                showNotice('Failed to save schedule. Please try again.', 'error');
            }
        });
    });

    // Schedule Call modal — clear
    $(document).on('click', '#tbc-cp-er-clear-schedule', function() {
        if (!currentScheduleEntryId) return;
        if (!confirm('Clear the scheduled date for this phone screening?')) return;

        var $btn = $(this);
        $btn.prop('disabled', true);

        $.ajax({
            url: tbc_cp_er.ajaxurl,
            type: 'POST',
            data: {
                action: 'tbc_cp_er_update_phone_schedule',
                nonce: tbc_cp_er.nonce,
                entry_id: currentScheduleEntryId,
                screening_date: '',
                screening_note: ''
            },
            success: function(response) {
                $btn.prop('disabled', false);

                if (response.success) {
                    showNotice('Schedule cleared', 'success');
                    $('#tbc-cp-er-send-screening-msg').prop('disabled', true);

                    var $row = $('tr[data-entry-id="' + currentScheduleEntryId + '"]');
                    var $info = $row.find('.tbc-cp-er-schedule-info');
                    $info.find('.tbc-cp-er-schedule-badge').remove();
                    $info.find('.tbc-cp-er-schedule-call').remove();
                    $info.find('.tbc-cp-er-schedule-calendar').remove();
                    $info.append(
                        '<button type="button" class="tbc-cp-er-btn tbc-cp-er-btn-sm tbc-cp-er-schedule-call" ' +
                        'data-entry-id="' + currentScheduleEntryId + '" ' +
                        'data-user-name="' + $('<span>').text($row.find('strong').first().text()).html() + '" ' +
                        'data-current-date="" data-current-note="">Schedule Call</button>'
                    );

                    $('#tbc-cp-er-schedule-modal').hide();
                    currentScheduleEntryId = null;
                } else {
                    showNotice('Error: ' + (response.data || 'Unknown error'), 'error');
                }
            },
            error: function() {
                $btn.prop('disabled', false);
                showNotice('Failed to clear schedule. Please try again.', 'error');
            }
        });
    });

    // Send Phone Screening Message — show preview
    $(document).on('click', '#tbc-cp-er-send-screening-msg', function() {
        if (!currentScheduleEntryId) return;

        var entryId = currentScheduleEntryId;
        var $modal = $('#tbc-cp-er-approval-preview-modal');
        var $content = $('#tbc-cp-er-approval-preview-content');
        var $loading = $('#tbc-cp-er-approval-preview-loading');
        var $warning = $('#tbc-cp-er-approval-preview-warning');
        var $confirmBtn = $('#tbc-cp-er-approval-confirm');
        var $desc = $('#tbc-cp-er-approval-preview-desc');

        $('#tbc-cp-er-approval-preview-title').text('Phone Screening Scheduled \u2014 Message Preview');
        $desc.text('This message will be sent to the user via FluentChat.');
        $content.hide().text('');
        $loading.show();
        $warning.hide();
        $confirmBtn.prop('disabled', true);

        $modal.data('preview-type', 'phone_screening');
        $modal.show();

        $.ajax({
            url: tbc_cp_er.ajaxurl,
            type: 'POST',
            data: {
                action: 'tbc_cp_er_preview_phone_screening',
                nonce: tbc_cp_er.nonce,
                entry_id: entryId
            },
            success: function(response) {
                $loading.hide();
                if (response.success) {
                    $content.text(response.data.message).show();
                    $confirmBtn.prop('disabled', false);

                    if (!response.data.enabled) {
                        $warning.text('Messaging is disabled. Enable messaging in Message Settings to send messages.').show();
                        $confirmBtn.text('Send Anyway');
                    } else if (!response.data.has_sender) {
                        $warning.text('No sender configured. Set a sender in Message Settings to send messages.').show();
                        $confirmBtn.prop('disabled', true);
                    } else {
                        $confirmBtn.text('Send Message');
                    }
                } else {
                    $content.text('Could not load preview: ' + (response.data || 'Unknown error')).show();
                }
            },
            error: function() {
                $loading.hide();
                $content.text('Failed to load preview.').show();
            }
        });
    });

    // Close modals
    $(document).on('click', '.tbc-cp-er-modal-close', function() {
        var $modal = $(this).closest('.tbc-cp-er-modal');
        $modal.hide();

        if ($modal.is('#tbc-cp-er-notes-modal')) {
            currentNotesEntryId = null;
        } else if ($modal.is('#tbc-cp-er-schedule-modal')) {
            currentScheduleEntryId = null;
        } else if ($modal.is('#tbc-cp-er-approval-preview-modal')) {
            $modal.removeData('preview-type');
            if (pendingApproval) {
                pendingApproval.$select.val(pendingApproval.$select.data('prev-val') || '3');
                applyDropdownColor(pendingApproval.$select, approvalColors);
                pendingApproval = null;
            }
        }
    });

    // No backdrop click closing — only X button and Cancel close modals

    // Message Settings modal — open & load
    $(document).on('click', '#tbc-cp-er-open-msg-settings', function() {
        var $modal = $('#tbc-cp-er-msg-settings-modal');
        $modal.show();

        $.ajax({
            url: tbc_cp_er.ajaxurl,
            type: 'POST',
            data: {
                action: 'tbc_cp_er_get_message_settings',
                nonce: tbc_cp_er.nonce
            },
            success: function(response) {
                if (response.success) {
                    var s = response.data;
                    $('#tbc-cp-er-msg-enabled').prop('checked', !!s.enabled);
                    $('#tbc-cp-er-msg-sender').val(s.sender_user_id || '');
                    $('#tbc-cp-er-msg-approved').val(s.approved_message || '');
                    $('#tbc-cp-er-msg-disapproved').val(s.disapproved_message || '');
                    $('#tbc-cp-er-msg-phone-screening').val(s.phone_screening_message || '');
                    $('#tbc-cp-er-zoom-url').val(s.zoom_join_url || '');
                    $('#tbc-cp-er-zoom-id').val(s.zoom_meeting_id || '');
                    $('#tbc-cp-er-zoom-passcode').val(s.zoom_passcode || '');
                }
            }
        });
    });

    // Message Settings modal — save
    $(document).on('click', '#tbc-cp-er-save-msg-settings', function() {
        var $btn = $(this);
        $btn.prop('disabled', true).text('Saving...');

        $.ajax({
            url: tbc_cp_er.ajaxurl,
            type: 'POST',
            data: {
                action: 'tbc_cp_er_save_message_settings',
                nonce: tbc_cp_er.nonce,
                enabled: $('#tbc-cp-er-msg-enabled').is(':checked') ? '1' : '',
                sender_user_id: $('#tbc-cp-er-msg-sender').val(),
                approved_subject: '',
                approved_message: $('#tbc-cp-er-msg-approved').val(),
                disapproved_subject: '',
                disapproved_message: $('#tbc-cp-er-msg-disapproved').val(),
                phone_screening_message: $('#tbc-cp-er-msg-phone-screening').val(),
                zoom_join_url: $('#tbc-cp-er-zoom-url').val(),
                zoom_meeting_id: $('#tbc-cp-er-zoom-id').val(),
                zoom_passcode: $('#tbc-cp-er-zoom-passcode').val()
            },
            success: function(response) {
                $btn.prop('disabled', false).text('Save Settings');
                if (response.success) {
                    showNotice('Message settings saved', 'success');
                    $('#tbc-cp-er-msg-settings-modal').hide();
                } else {
                    showNotice('Error: ' + (response.data || 'Unknown error'), 'error');
                }
            },
            error: function() {
                $btn.prop('disabled', false).text('Save Settings');
                showNotice('Failed to save settings.', 'error');
            }
        });
    });

    function showNotice(message, type) {
        TBC_CP_Utils.showNotice(message, type);
    }

})(jQuery);
