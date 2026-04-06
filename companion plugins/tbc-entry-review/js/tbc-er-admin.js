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
            'border-color': style.border || '#ddd',
            'color': style.color || '',
            'font-weight': style.color ? '600' : ''
        });
    }

    // Apply colors on page load
    $(document).ready(function() {
        $('.tbc-er-approval-dropdown').each(function() { applyDropdownColor($(this), approvalColors); });
        $('.tbc-er-screening-dropdown').each(function() { applyDropdownColor($(this), statusColors); });
        $('.tbc-er-spirit-dropdown').each(function() { applyDropdownColor($(this), statusColors); });
    });

    // Phone screening status change
    $(document).on('change', '.tbc-er-screening-dropdown', function() {
        var $select = $(this);
        var entryId = $select.data('entry-id');
        var status = $select.val();

        applyDropdownColor($select, statusColors);

        $.ajax({
            url: tbc_er.ajaxurl,
            type: 'POST',
            data: {
                action: 'tbc_er_update_phone_screening',
                nonce: tbc_er.nonce,
                entry_id: entryId,
                screening_status: status
            },
            success: function(response) {
                if (response.success) {
                    showNotice('Phone screening status updated', 'success');
                    updateApprovalDropdown(entryId);

                    // Show/hide schedule info based on new status
                    var $row = $('tr[data-entry-id="' + entryId + '"]');
                    var $scheduleInfo = $row.find('.tbc-er-schedule-info');
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
    $(document).on('change', '.tbc-er-spirit-dropdown', function() {
        var $select = $(this);
        var entryId = $select.data('entry-id');
        var status = $select.val();

        applyDropdownColor($select, statusColors);

        $.ajax({
            url: tbc_er.ajaxurl,
            type: 'POST',
            data: {
                action: 'tbc_er_update_spirit_pharmacist',
                nonce: tbc_er.nonce,
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

    // Approval dropdown change
    $(document).on('change', '.tbc-er-approval-dropdown', function() {
        var $select = $(this);
        var entryId = $select.data('entry-id');
        var status = $select.val();
        var labels = { '1': 'approve', '2': 'disapprove', '3': 'unapprove' };

        if (!confirm('Are you sure you want to ' + labels[status] + ' this entry?')) {
            // Revert to previous value
            $select.val($select.data('prev-val') || '3');
            applyDropdownColor($select, approvalColors);
            return;
        }

        $select.prop('disabled', true);

        $.ajax({
            url: tbc_er.ajaxurl,
            type: 'POST',
            data: {
                action: 'tbc_er_update_approval',
                nonce: tbc_er.nonce,
                entry_id: entryId,
                approval_status: status
            },
            success: function(response) {
                $select.prop('disabled', false);

                if (response.success) {
                    showNotice('Entry ' + response.data.label.toLowerCase(), 'success');
                    $select.data('prev-val', status);
                    applyDropdownColor($select, approvalColors);
                } else {
                    // Revert on error
                    $select.val($select.data('prev-val') || '3');
                    applyDropdownColor($select, approvalColors);
                    showNotice('Error: ' + (response.data || 'Unknown error'), 'error');
                }
            },
            error: function() {
                $select.prop('disabled', false);
                $select.val($select.data('prev-val') || '3');
                applyDropdownColor($select, approvalColors);
                showNotice('Failed to update approval. Please try again.', 'error');
            }
        });
    });

    // Store initial approval values for revert
    $(document).ready(function() {
        $('.tbc-er-approval-dropdown').each(function() {
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
        var $dropdown = $row.find('.tbc-er-approval-dropdown');

        var phoneOk = true;
        if (phoneEnabled) {
            var screeningVal = $row.find('.tbc-er-screening-dropdown').val();
            if (screeningVal === '') {
                phoneOk = false;
            }
        }

        var spiritOk = true;
        if (spiritEnabled) {
            var spiritVal = $row.find('.tbc-er-spirit-dropdown').val();
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
    $(document).on('click', '.tbc-er-block-toggle', function() {
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
            url: tbc_er.ajaxurl,
            type: 'POST',
            data: {
                action: 'tbc_er_toggle_block',
                nonce: tbc_er.nonce,
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
    $(document).on('click', '.tbc-er-view-entry', function() {
        var entryId = $(this).data('entry-id');
        var formId = $(this).data('form-id');
        var userName = $(this).data('user-name');

        $('#tbc-er-entry-modal-title').text('Entry Details — ' + userName);
        $('#tbc-er-entry-fields').html('<div class="tbc-er-loading">Loading entry...</div>');
        $('#tbc-er-entry-modal').show();

        $.ajax({
            url: tbc_er.ajaxurl,
            type: 'POST',
            data: {
                action: 'tbc_er_get_entry_fields',
                nonce: tbc_er.nonce,
                entry_id: entryId,
                form_id: formId
            },
            success: function(response) {
                if (response.success) {
                    $('#tbc-er-entry-fields').html(response.data.html);
                } else {
                    $('#tbc-er-entry-fields').html('<p>Error: ' + (response.data || 'Unknown error') + '</p>');
                }
            },
            error: function() {
                $('#tbc-er-entry-fields').html('<p>Failed to load entry. Please try again.</p>');
            }
        });
    });

    // Copy Entry to clipboard
    $(document).on('click', '.tbc-er-copy-entry', function() {
        var $btn = $(this);
        var entryId = $btn.data('entry-id');
        var formId = $btn.data('form-id');

        $btn.prop('disabled', true).text('Copying...');

        $.ajax({
            url: tbc_er.ajaxurl,
            type: 'POST',
            data: {
                action: 'tbc_er_get_entry_fields',
                nonce: tbc_er.nonce,
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
    $(document).on('click', '.tbc-er-edit-notes', function() {
        currentNotesEntryId = $(this).data('entry-id');
        var $row = $(this).closest('tr');
        var currentNotes = $row.find('.tbc-er-notes-data').val() || '';
        var userName = $(this).data('user-name');

        $('#tbc-er-notes-modal-title').text('Consultation Notes — ' + userName);
        $('#tbc-er-notes-textarea').val(currentNotes);
        $('#tbc-er-notes-modal').show();
    });

    // Save notes
    $('#tbc-er-save-notes').on('click', function() {
        if (!currentNotesEntryId) return;

        var notes = $('#tbc-er-notes-textarea').val();
        var $btn = $(this);
        $btn.prop('disabled', true).text('Saving...');

        $.ajax({
            url: tbc_er.ajaxurl,
            type: 'POST',
            data: {
                action: 'tbc_er_update_consult_notes',
                nonce: tbc_er.nonce,
                entry_id: currentNotesEntryId,
                notes: notes
            },
            success: function(response) {
                $btn.prop('disabled', false).text('Save Notes');

                if (response.success) {
                    showNotice('Consultation notes saved', 'success');

                    // Update the row
                    var $row = $('tr[data-entry-id="' + currentNotesEntryId + '"]');
                    var hasNotes = notes.trim().length > 0;
                    var $notesBtn = $row.find('.tbc-er-edit-notes');

                    // Update button appearance and hidden textarea
                    $row.find('.tbc-er-notes-data').val(notes);
                    $notesBtn.text(hasNotes ? 'Edit Notes' : 'Add Notes')
                        .toggleClass('tbc-er-notes-filled', hasNotes);

                    // Update row data attribute and re-evaluate approval dropdown
                    $row.data('has-notes', hasNotes ? 1 : 0);
                    updateApprovalDropdown(currentNotesEntryId);

                    $('#tbc-er-notes-modal').hide();
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

    // Copy scheduling message
    $(document).on('click', '.tbc-er-schedule-copy', function() {
        var $btn = $(this);
        var userName = $btn.data('user-name');
        var date = $btn.data('date');
        var calendarUrl = $btn.data('calendar-url') || '';
        var firstName = userName.split(' ')[0];

        var message = 'Hi ' + firstName + ',\n\n' +
            'Your phone consultation has been scheduled for ' + date + '.\n\n' +
            'Please join using the Zoom link below:\n\n' +
            'Quick Join Link: https://us02web.zoom.us/j/9301696301?pwd=VzFsdndNcFJiblRsZ2pJMFlKOC9qdz09\n' +
            'Meeting ID: 930 169 6301\n' +
            'Passcode: love\n\n';

        if (calendarUrl) {
            message += 'Add to your calendar: ' + calendarUrl + '\n\n';
        }

        message += 'If you need to reschedule, please let us know as soon as possible.\n\n' +
            'Blessings,\nTwo Birds Church';

        navigator.clipboard.writeText(message).then(function() {
            showNotice('Scheduling message copied to clipboard', 'success');
        }, function() {
            showNotice('Clipboard access denied. Try again.', 'error');
        });
    });

    // Schedule Call modal — open
    $(document).on('click', '.tbc-er-schedule-call', function() {
        currentScheduleEntryId = $(this).data('entry-id');
        var userName = $(this).data('user-name');
        var currentDate = $(this).data('current-date') || '';
        var currentNote = $(this).data('current-note') || '';

        $('#tbc-er-schedule-modal-title').text('Schedule Phone Screening — ' + userName);
        $('#tbc-er-schedule-datetime').val(currentDate);
        $('#tbc-er-schedule-note').val(currentNote);
        $('#tbc-er-schedule-modal').show();
    });

    // Schedule Call modal — save
    $('#tbc-er-save-schedule').on('click', function() {
        if (!currentScheduleEntryId) return;

        var date = $('#tbc-er-schedule-datetime').val();
        var note = $('#tbc-er-schedule-note').val();
        var $btn = $(this);

        if (!date) {
            alert('Please select a date and time.');
            return;
        }

        $btn.prop('disabled', true).text('Saving...');

        $.ajax({
            url: tbc_er.ajaxurl,
            type: 'POST',
            data: {
                action: 'tbc_er_update_phone_schedule',
                nonce: tbc_er.nonce,
                entry_id: currentScheduleEntryId,
                screening_date: date,
                screening_note: note
            },
            success: function(response) {
                $btn.prop('disabled', false).text('Save Schedule');

                if (response.success) {
                    showNotice('Phone screening scheduled for ' + response.data.formatted_date, 'success');

                    var $row = $('tr[data-entry-id="' + currentScheduleEntryId + '"]');
                    var $info = $row.find('.tbc-er-schedule-info');

                    // Update badge
                    var now = new Date();
                    var schedDate = new Date(date);
                    var isOverdue = schedDate < now;
                    var badgeClass = isOverdue ? 'tbc-er-schedule-overdue' : 'tbc-er-schedule-set';
                    var badgeContent = isOverdue
                        ? $('<span>').text('Overdue: ' + response.data.formatted_date).html()
                        : '&#128222; ' + $('<span>').text(response.data.formatted_date).html();

                    // Replace all schedule content with badge + pencil + copy + calendar
                    var userName = $info.closest('tr').find('a').first().text();
                    var calendarUrl = response.data.calendar_url || '';
                    $info.find('.tbc-er-schedule-badge').remove();
                    $info.find('.tbc-er-schedule-call').remove();
                    $info.find('.tbc-er-schedule-copy').remove();
                    $info.find('.tbc-er-schedule-calendar').remove();
                    $info.prepend(
                        '<span class="tbc-er-schedule-badge ' + badgeClass + '">' +
                        badgeContent +
                        '</span>' +
                        '<button type="button" class="tbc-er-schedule-call tbc-er-schedule-edit" ' +
                        'data-entry-id="' + currentScheduleEntryId + '" ' +
                        'data-user-name="' + $('<span>').text(userName).html() + '" ' +
                        'data-current-date="' + $('<span>').text(date).html() + '" ' +
                        'data-current-note="' + $('<span>').text(note).html() + '" ' +
                        'title="Edit Schedule">&#9998;</button>' +
                        '<button type="button" class="tbc-er-schedule-copy" ' +
                        'data-user-name="' + $('<span>').text(userName).html() + '" ' +
                        'data-date="' + $('<span>').text(response.data.formatted_date).html() + '" ' +
                        'data-calendar-url="' + $('<span>').text(calendarUrl).html() + '" ' +
                        'title="Copy scheduling message">&#128203;</button>' +
                        (calendarUrl ? '<a href="' + $('<span>').text(calendarUrl).html() + '" class="tbc-er-schedule-calendar" title="Add to calendar" target="_blank">&#128197;</a>' : '')
                    );

                    $('#tbc-er-schedule-modal').hide();
                    currentScheduleEntryId = null;
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
    $('#tbc-er-clear-schedule').on('click', function() {
        if (!currentScheduleEntryId) return;
        if (!confirm('Clear the scheduled date for this phone screening?')) return;

        var $btn = $(this);
        $btn.prop('disabled', true);

        $.ajax({
            url: tbc_er.ajaxurl,
            type: 'POST',
            data: {
                action: 'tbc_er_update_phone_schedule',
                nonce: tbc_er.nonce,
                entry_id: currentScheduleEntryId,
                screening_date: '',
                screening_note: ''
            },
            success: function(response) {
                $btn.prop('disabled', false);

                if (response.success) {
                    showNotice('Schedule cleared', 'success');

                    var $row = $('tr[data-entry-id="' + currentScheduleEntryId + '"]');
                    var $info = $row.find('.tbc-er-schedule-info');
                    $info.find('.tbc-er-schedule-badge').remove();
                    $info.find('.tbc-er-schedule-call').remove();
                    $info.append(
                        '<button type="button" class="button button-small tbc-er-schedule-call" ' +
                        'data-entry-id="' + currentScheduleEntryId + '" ' +
                        'data-user-name="' + $('<span>').text($row.find('a').first().text()).html() + '" ' +
                        'data-current-date="" data-current-note="">Schedule Call</button>'
                    );

                    $('#tbc-er-schedule-modal').hide();
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

    // Close modals
    $(document).on('click', '.tbc-er-modal-close', function() {
        $(this).closest('.tbc-er-modal').hide();
        currentNotesEntryId = null;
        currentScheduleEntryId = null;
    });

    // Close modal on backdrop click
    $(document).on('click', '.tbc-er-modal', function(e) {
        if (e.target === this) {
            $(this).hide();
            currentNotesEntryId = null;
            currentScheduleEntryId = null;
        }
    });

    // Close modal on Escape key
    $(document).on('keydown', function(e) {
        if (e.key === 'Escape') {
            $('.tbc-er-modal:visible').hide();
            currentNotesEntryId = null;
            currentScheduleEntryId = null;
        }
    });

    // Admin notices
    function showNotice(message, type) {
        $('.tbc-er-admin-notice').remove();

        var wpType = type === 'error' ? 'notice-error' : 'notice-success';
        var $notice = $('<div class="notice ' + wpType + ' is-dismissible tbc-er-admin-notice"><p>' +
            $('<span>').text(message).html() + '</p></div>');

        $('.tbc-er-page > h1').after($notice);

        $notice.find('.notice-dismiss').on('click', function() {
            $notice.fadeOut(200, function() { $(this).remove(); });
        });

        setTimeout(function() {
            $notice.fadeOut(300, function() { $(this).remove(); });
        }, 4000);
    }

})(jQuery);
