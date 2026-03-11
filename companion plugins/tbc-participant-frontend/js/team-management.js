/**
 * Team Management JavaScript
 * 
 * @package TBC_Participant_Frontend
 * @since 3.0.0
 */
jQuery(document).ready(function($) {
    'use strict';
    
    // Initialize Select2 on searchable dropdowns
    if ($.fn.select2) {
        $('.tbc-pf-select2').select2({
            width: '100%',
            allowClear: true,
            placeholder: function() {
                return $(this).data('placeholder') || 'Select...';
            }
        });
    }
    
    function tbcPFShowSaveFeedback(element, message, duration) {
        var feedback = $('<div class="tbc-pf-save-feedback" style="display: none;">' + message + '</div>');
        element.append(feedback);
        feedback.fadeIn().delay(duration).fadeOut(function() { $(this).remove(); });
    }
    
    function tbcPFMakeAjaxRequest(action, data, successCallback, errorCallback) {
        $.ajax({
            url: tbcPFAjax.ajaxurl,
            type: 'POST',
            dataType: 'json',
            data: $.extend({action: action}, data),
            success: function(response) {
                if (response.success) {
                    if (successCallback) successCallback(response);
                } else {
                    var errorMsg = 'Error: ' + (response.data?.message || 'Unknown error');
                    if (errorCallback) {
                        errorCallback(errorMsg);
                    } else {
                        alert(errorMsg);
                    }
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
    
    function tbcPFUpdateSelectAllCheckbox() {
        var totalCheckboxes = $('.tbc-pf-order-checkbox').length;
        var checkedCheckboxes = $('.tbc-pf-order-checkbox:checked').length;
        $('#tbc-pf-select-all-checkbox').prop('checked', totalCheckboxes > 0 && totalCheckboxes === checkedCheckboxes);
    }
    
    $('#tbc-pf-select-all-checkbox').on('change', function() {
        $('.tbc-pf-order-checkbox').prop('checked', this.checked);
    });
    
    $(document).on('change', '.tbc-pf-order-checkbox', tbcPFUpdateSelectAllCheckbox);
    
    $('#tbc-pf-update-team-settings').on('click', function() {
        var selectedOrderIds = $('.tbc-pf-order-checkbox:checked').map(function() {
            return $(this).val();
        }).get();
        
        if (selectedOrderIds.length === 0) {
            alert('Please select at least one order to update.');
            return;
        }
        
        var groupId = $('#tbc-pf-chat-group-select').val();
        var facilitatorIds = $('#tbc-pf-facilitators-select').val() || [];
        var productId = $('#tbc-pf-chat-group-select').data('product-id');
        var eventDate = $('#tbc-pf-chat-group-select').data('event-date');
        var feedbackContainer = $('.tbc-pf-save-feedback-container');
        
        tbcPFMakeAjaxRequest(
            'tbc_pf_update_event_team_settings',
            {
                group_id: groupId,
                facilitator_ids: facilitatorIds,
                product_id: productId,
                event_date: eventDate,
                order_ids: selectedOrderIds
            },
            function(response) {
                tbcPFShowSaveFeedback(feedbackContainer, response.data.message, 3000);
                
                if (groupId) {
                    $('.tbc-pf-chat-button').each(function() {
                        $(this).data('group-id', groupId).attr('data-group-id', groupId);
                    });
                }
                
                setTimeout(function() { location.reload(); }, 3000);
            },
            function(error) {
                tbcPFShowSaveFeedback(feedbackContainer, error, 3000);
            }
        );
    });
    
    $('#tbc-pf-auto-generate-group').on('click', function() {
        if (!confirm('Create a new chat group for this event?')) return;
        
        var button = $(this);
        var productId = button.data('product-id');
        var eventDate = button.data('event-date');
        
        button.prop('disabled', true).text('Creating...');
        
        tbcPFMakeAjaxRequest(
            'tbc_pf_auto_generate_chat_group',
            {product_id: productId, event_date: eventDate},
            function(response) {
                if (response.data.group_id) {
                    $('#tbc-pf-chat-group-select').append(
                        $('<option></option>')
                            .attr('value', response.data.group_id)
                            .text(response.data.group_name)
                    );
                    $('#tbc-pf-chat-group-select').val(response.data.group_id).trigger('change');
                    button.parent().remove();
                } else {
                    alert('Group created but ID not returned');
                    button.prop('disabled', false).text('Auto-Generate Chat Group');
                }
            },
            function(error) {
                alert(error);
                button.prop('disabled', false).text('Auto-Generate Chat Group');
            }
        );
    });
});