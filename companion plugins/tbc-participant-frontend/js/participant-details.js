/**
 * Participant Details JavaScript
 * 
 * @package TBC_Participant_Frontend
 * @since 3.0.0
 */
jQuery(document).ready(function($) {
    'use strict';
    
    function tbcPFShowSaveFeedback($container, message, duration, isError) {
        var $pill = $container.find('.tbc-pf-save-feedback');
        if (!$pill.length) {
            $pill = $('<div class="tbc-pf-save-feedback" style="display:none;"></div>').appendTo($container);
        }
        $pill
            .toggleClass('error', !!isError)
            .stop(true, true)
            .text(message)
            .fadeIn(120)
            .delay(duration || 1200)
            .fadeOut(250, function() { $(this).remove(); });
    }
    
    var tbcPFColumnVisibility = $('.tbc-pf-column-checkboxes').data('column-prefs') || {};
    
    function tbcPFApplyColumnVisibility() {
        $.each(tbcPFColumnVisibility, function(column, visible) {
            var selector = '[data-column="' + column + '"]';
            $(selector).toggle(!!visible);
        });
    }
    
    tbcPFApplyColumnVisibility();
    
    $('#tbc-pf-toggle-columns').on('click', function() {
        $('.tbc-pf-column-toggles-content').slideToggle(300);
        $(this).text($(this).text() === 'Show' ? 'Hide' : 'Show');
    });
    
    var tbcPFSaveTimeout;
    $(document).on('change', '.tbc-pf-column-toggle', function() {
        var column = $(this).data('column');
        var visible = $(this).is(':checked');
        var feedbackContainer = $(this).closest('.tbc-pf-column-checkboxes').find('.tbc-pf-column-save-feedback');

        tbcPFColumnVisibility[column] = visible;
        $('[data-column="' + column + '"]').toggle(!!visible);

        clearTimeout(tbcPFSaveTimeout);
        tbcPFSaveTimeout = setTimeout(function() {
            $.ajax({
                url: tbcPFAjax.ajaxurl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'tbc_pf_save_column_prefs',
                    columns: tbcPFColumnVisibility
                },
                success: function(resp) {
                    tbcPFShowSaveFeedback(
                        feedbackContainer,
                        resp && resp.success ? 'Saved!' : 'Error saving preferences',
                        1500,
                        !(resp && resp.success)
                    );
                },
                error: function() {
                    tbcPFShowSaveFeedback(feedbackContainer, 'Error saving preferences', 1800, true);
                }
            });
        }, 500);
    });
    
    function tbcPFMakeAjaxRequest(action, data, successMessage, successCallback, errorCallback) {
        $.ajax({
            url: tbcPFAjax.ajaxurl,
            type: 'POST',
            dataType: 'json',
            data: $.extend({action: action}, data),
            success: function(response) {
                if (response.success) {
                    if (successMessage) alert(successMessage);
                    if (successCallback) successCallback(response);
                } else {
                    alert('Error: ' + (response.data?.message || 'Unknown error'));
                }
            },
            error: function(xhr, status, error) {
                var errorMsg = 'Error: ' + error;
                if (errorCallback) {
                    errorCallback(errorMsg);
                } else {
                    alert(errorMsg);
                }
            }
        });
    }

    function tbcPFOpenModal(selector, dataAttr, modalPrefix) {
        $(document).on('click', selector, function() {
            var id = $(this).data(dataAttr);
            $('#' + modalPrefix + id).show();
        });
    }

    tbcPFOpenModal('.tbc-pf-open-modal', 'order-id', 'tbc-pf-modal-');
    tbcPFOpenModal('.tbc-pf-open-gravity-form-modal', 'entry-id', 'tbc-pf-modal-form-entry-');
    tbcPFOpenModal('.tbc-pf-open-medical-consult-modal', 'entry-id', 'tbc-pf-modal-medical-consult-');

    $(document).on('click', '.tbc-pf-close-modal, .tbc-pf-close-modal-top', function() {
        $(this).closest('.tbc-pf-modal').hide();
    });

    $(document).on('submit', '.tbc-pf-medical-consult-form', function(e) {
        e.preventDefault();
        var form = $(this);
        var entryId = form.data('entry-id');
        var medicalConsultData = form.find('textarea[name="medical_consult"]').val();

        tbcPFMakeAjaxRequest(
            'tbc_pf_save_medical_consult',
            {entry_id: entryId, medical_consult: medicalConsultData},
            'Medical consult saved successfully'
        );
    });

    $(document).on('click', '.tbc-pf-quick-followup-btn', function() {
        var modal = $(this).closest('.tbc-pf-modal');
        modal.find('.tbc-pf-followup-date-picker').val($(this).data('date'));
    });

    $(document).on('click', '.tbc-pf-add-followup-btn', function() {
        var entryId = $(this).data('entry-id');
        var modal = $(this).closest('.tbc-pf-modal');
        var form = modal.find('.tbc-pf-medical-consult-form');
        var followupDate = modal.find('.tbc-pf-followup-date-picker').val();
        var followupNote = modal.find('.tbc-pf-followup-note-input').val();

        if (!followupDate) {
            alert('Please select a follow-up date');
            return;
        }

        tbcPFMakeAjaxRequest(
            'tbc_pf_save_medical_consult',
            {
                entry_id: entryId,
                followup_action: 'add',
                followup_date: followupDate,
                followup_note: followupNote,
                event_date: form.data('event-date'),
                event_name: form.data('event-name')
            },
            'Follow-up added successfully',
            function() { location.reload(); }
        );
    });

    $(document).on('click', '.tbc-pf-complete-followup-btn', function() {
        if (!confirm('Mark this follow-up as complete?')) return;

        tbcPFMakeAjaxRequest(
            'tbc_pf_save_medical_consult',
            {
                entry_id: $(this).data('entry-id'),
                followup_action: 'complete',
                followup_index: $(this).data('index')
            },
            'Follow-up marked complete',
            function() { location.reload(); }
        );
    });

    $(document).on('click', '.tbc-pf-remove-followup-btn', function() {
        if (!confirm('Remove this follow-up?')) return;

        tbcPFMakeAjaxRequest(
            'tbc_pf_save_medical_consult',
            {
                entry_id: $(this).data('entry-id'),
                followup_action: 'remove',
                followup_index: $(this).data('index')
            },
            'Follow-up removed',
            function() { location.reload(); }
        );
    });

    $(document).on('submit', '.tbc-pf-event-notes-form', function(e) {
        e.preventDefault();
        var form = $(this);
        var orderId = form.data('order-id');
        var notes = form.find('textarea[name="event_notes"]').val();

        tbcPFMakeAjaxRequest(
            'tbc_pf_save_event_notes',
            {order_id: orderId, notes: notes},
            'Notes saved successfully',
            function() { $('#tbc-pf-modal-' + orderId).hide(); }
        );
    });

    $(document).on('change', '.tbc-pf-order-status-dropdown', function() {
        tbcPFMakeAjaxRequest(
            'tbc_pf_update_order_status',
            {order_id: $(this).data('order-id'), status: $(this).val()},
            'Order status updated successfully'
        );
    });

    $('.tbc-pf-enroll-button').on('click', function() {
        var button = this;
        var userId = button.dataset.userId;
        var courseId = button.dataset.courseId;

        fetch('/wp-admin/admin-ajax.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: 'action=tbc_pf_enroll_user_to_course&user_id=' + userId + '&course_id=' + courseId
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.success) {
                alert('User has been enrolled!');
                button.parentElement.innerHTML = '0% Complete';
            } else {
                alert('Failed to enroll user: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(function(error) {
            console.error('Error enrolling user:', error);
        });
    });

    $('.tbc-pf-chat-button').on('click', function() {
        var button = $(this);
        var userId = button.data('user-id');
        var groupId = button.data('group-id');
        var isJoined = button.hasClass('tbc-pf-joined');

        var confirmMessage = isJoined ? 
            'Are you sure you want to remove this user from the group?' : 
            'Are you sure you want to add this user to the group?';

        if (!confirm(confirmMessage)) return;

        var action = isJoined ? 'tbc_pf_leave_group' : 'tbc_pf_join_group';

        $.ajax({
            url: tbcPFAjax.ajaxurl,
            type: 'POST',
            data: {action: action, user_id: userId, group_id: groupId},
            success: function(response) {
                if (response.success) {
                    if (isJoined) {
                        button.removeClass('tbc-pf-joined').addClass('tbc-pf-not-joined').text('Not Joined');
                    } else {
                        button.removeClass('tbc-pf-not-joined').addClass('tbc-pf-joined').text('Joined');
                    }
                    alert(isJoined ? 'User removed from the group!' : 'User added to the group!');
                } else {
                    alert('Failed: ' + response.data);
                }
            },
            error: function(jqXHR, textStatus) {
                alert('An error occurred: ' + textStatus);
            }
        });
    });
});