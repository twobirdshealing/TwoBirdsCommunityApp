/**
 * Post Management JavaScript
 * 
 * @package TBC_Participant_Frontend
 * @since 3.0.0
 */
jQuery(document).ready(function($) {
    'use strict';
    
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
    
    $(document).on('click', '.tbc-pf-run-post-btn', function() {
        if (!confirm('Send this post immediately?')) return;
        
        var button = $(this);
        var originalText = button.text();
        
        button.text('Sending...').prop('disabled', true);
        
        tbcPFMakeAjaxRequest(
            'tbc_pf_run_scheduled_post',
            {action_id: button.data('action-id')},
            function(response) {
                alert(response.data.message);
                location.reload();
            },
            function(error) {
                alert(error);
                button.text(originalText).prop('disabled', false);
            }
        );
    });
    
    $(document).on('click', '.tbc-pf-delete-post-btn', function() {
        if (!confirm('Permanently delete this post? This cannot be undone.')) return;
        
        var button = $(this);
        var originalText = button.text();
        
        button.text('Deleting...').prop('disabled', true);
        
        tbcPFMakeAjaxRequest(
            'tbc_pf_delete_scheduled_post',
            {action_id: button.data('action-id')},
            function(response) {
                alert(response.data.message);
                location.reload();
            },
            function(error) {
                alert(error);
                button.text(originalText).prop('disabled', false);
            }
        );
    });
    
    $(document).on('click', '.tbc-pf-reschedule-post-btn', function() {
        if (!confirm('Reschedule this post?')) return;
        
        var button = $(this);
        var originalText = button.text();
        
        button.text('Rescheduling...').prop('disabled', true);
        
        tbcPFMakeAjaxRequest(
            'tbc_pf_reschedule_single_post',
            {
                post_type_id: button.data('post-type-id'),
                group_id: button.data('group-id'),
                product_id: button.data('product-id'),
                event_date: button.data('event-date')
            },
            function(response) {
                alert(response.data.message);
                location.reload();
            },
            function(error) {
                alert(error);
                button.text(originalText).prop('disabled', false);
            }
        );
    });
    
    $('#tbc-pf-schedule-posts-btn').on('click', function() {
        if (!confirm('Schedule all event posts for this event?')) return;
        
        var button = $(this);
        var originalText = button.text();
        
        button.text('Scheduling...').prop('disabled', true);
        
        tbcPFMakeAjaxRequest(
            'tbc_pf_schedule_posts_manually',
            {
                product_id: button.data('product-id'),
                event_date: button.data('event-date'),
                group_id: button.data('group-id')
            },
            function(response) {
                alert(response.data.message);
                location.reload();
            },
            function(error) {
                alert(error);
                button.text(originalText).prop('disabled', false);
            }
        );
    });
});