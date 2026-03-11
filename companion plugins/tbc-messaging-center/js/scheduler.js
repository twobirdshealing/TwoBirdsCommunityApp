/**
 * SMS Scheduler Frontend JavaScript - CLEANED VERSION
 * Handles scheduling interface only - form collection moved to sms-helpers.js
 */

jQuery(document).ready(function($) {
    
    // Initialize scheduler interface
    initializeSchedulerInterface();
    
    /**
     * Initialize all scheduler-related functionality
     */
    function initializeSchedulerInterface() {
        // Show/hide schedule options based on radio selection
        $(document).on('change', 'input[name="send_timing"]', handleSendTimingChange);
        
        // Handle schedule type changes
        $(document).on('change', 'select[name="schedule_type"]', handleScheduleTypeChange);
        
        // Handle cancel entire blast buttons
        $(document).on('click', '.tbc-mc-cancel-all-btn', handleCancelBlast);
        
        // Handle delete entire blast buttons
        $(document).on('click', '.tbc-mc-delete-all-btn', handleDeleteBlast);
        
        // Handle refresh scheduler interface
        $(document).on('click', '.tbc-mc-refresh-scheduler-btn', handleRefreshScheduler);
        
        // Initialize date/time pickers if available
        initializeDateTimePickers();
    }
    
    /**
     * Handle send timing radio button changes
     * FIXED: Updated to use tbc-mc- prefixed class
     */
    function handleSendTimingChange() {
        const sendTiming = $('input[name="send_timing"]:checked').val();
        const scheduleOptions = $('.tbc-mc-schedule-options');
        
        if (sendTiming === 'schedule') {
            scheduleOptions.slideDown('fast');
        } else {
            scheduleOptions.slideUp('fast');
        }
    }
    
    /**
     * Handle schedule type dropdown changes
     */
    function handleScheduleTypeChange() {
        const scheduleType = $(this).val();
        const form = $(this).closest('form');
        
        // Hide all schedule-specific options
        form.find('.tbc-mc-schedule-once-options, .tbc-mc-schedule-recurring-options').hide();
        
        // Show relevant options based on type
        if (scheduleType === 'once') {
            form.find('.tbc-mc-schedule-once-options').show();
        } else if (scheduleType.startsWith('daily') || scheduleType.startsWith('weekly') || scheduleType.startsWith('monthly')) {
            form.find('.tbc-mc-schedule-recurring-options').show();
            updateRecurringOptions(scheduleType, form);
        }
    }
    
    /**
     * Update recurring schedule options based on type
     */
    function updateRecurringOptions(scheduleType, form) {
        const daySelector = form.find('.tbc-mc-day-selector');
        const timeSelector = form.find('.tbc-mc-time-selector');
        
        // Always show time selector
        timeSelector.show();
        
        // Show day selector for weekly and monthly options
        if (scheduleType === 'weekly' || scheduleType === 'monthly_custom') {
            daySelector.show();
            
            if (scheduleType === 'weekly') {
                daySelector.find('label').text('Day of Week:');
                updateDayOptions('weekdays', form);
            } else if (scheduleType === 'monthly_custom') {
                daySelector.find('label').text('Day of Month:');
                updateDayOptions('monthdays', form);
            }
        } else {
            daySelector.hide();
        }
    }
    
    /**
     * Update day dropdown options
     */
    function updateDayOptions(type, form) {
        const select = form.find('select[name="schedule_day"]');
        select.empty();
        
        if (type === 'weekdays') {
            const weekdays = [
                {value: 1, text: 'Monday'},
                {value: 2, text: 'Tuesday'},
                {value: 3, text: 'Wednesday'},
                {value: 4, text: 'Thursday'},
                {value: 5, text: 'Friday'},
                {value: 6, text: 'Saturday'},
                {value: 0, text: 'Sunday'}
            ];
            
            weekdays.forEach(day => {
                select.append(`<option value="${day.value}">${day.text}</option>`);
            });
        } else if (type === 'monthdays') {
            for (let i = 1; i <= 31; i++) {
                select.append(`<option value="${i}">${i}</option>`);
            }
        }
    }
    
    /**
     * Handle cancelling entire message blast by parent_id
     */
    function handleCancelBlast() {
        const button = $(this);
        const parentId = button.data('parent-id');
        const messageGroup = button.closest('.tbc-mc-scheduled-message-group');
        
        if (!confirm('Are you sure you want to cancel this entire message blast? This will cancel all chunks.')) {
            return;
        }
        
        const originalHtml = button.html();
        button.prop('disabled', true).html('<i class="bb-icon-loading"></i> Cancelling...');
        
        $.post(ajaxurl, {
            action: 'tbc_mc_cancel_blast',
            nonce: tbcMC.nonce,
            parent_id: parentId
        })
        .done(function(response) {
            if (response.success && response.data && response.data.html) {
                // Show feedback
                $('#scheduler-feedback').html(response.data.html);
                
                // Remove the message group if successful
                if (response.data.html.includes('bp-feedback success')) {
                    messageGroup.fadeOut(300, function() {
                        $(this).remove();
                        
                        // Check if no messages left
                        if ($('.tbc-mc-scheduled-message-group').length === 0) {
                            location.reload(); // Reload to show "no messages" state
                        }
                    });
                }
            } else {
                smsFeedback('#scheduler-feedback', 'error', 'Failed to cancel message blast.');
                button.prop('disabled', false).html(originalHtml);
            }
        })
        .fail(function() {
            smsFeedback('#scheduler-feedback', 'error', 'An error occurred while cancelling the blast.');
            button.prop('disabled', false).html(originalHtml);
        });
    }
    
    /**
     * Handle deleting entire message blast by parent_id
     */
    function handleDeleteBlast() {
        const button = $(this);
        const parentId = button.data('parent-id');
        const messageGroup = button.closest('.tbc-mc-scheduled-message-group');
        
        if (!confirm('Are you sure you want to delete this entire message blast from the database? This cannot be undone.')) {
            return;
        }
        
        const originalHtml = button.html();
        button.prop('disabled', true).html('<i class="bb-icon-loading"></i> Deleting...');
        
        $.post(ajaxurl, {
            action: 'tbc_mc_delete_blast',
            nonce: tbcMC.nonce,
            parent_id: parentId
        })
        .done(function(response) {
            if (response.success && response.data && response.data.html) {
                // Show feedback
                $('#scheduler-feedback').html(response.data.html);
                // Remove the message group if successful
                if (response.data.html.includes('bp-feedback success')) {
                    messageGroup.fadeOut(300, function() {
                        $(this).remove();
                        
                        // Check if no messages left
                        if ($('.tbc-mc-scheduled-message-group').length === 0) {
                            location.reload(); // Reload to show "no messages" state
                        }
                    });
                }
            } else {
                smsFeedback('#scheduler-feedback', 'error', 'Failed to delete message blast.');
                button.prop('disabled', false).html(originalHtml);
            }
        })
        .fail(function() {
            smsFeedback('#scheduler-feedback', 'error', 'An error occurred while deleting the blast.');
            button.prop('disabled', false).html(originalHtml);
        });
    }
    
    /**
     * Handle refresh scheduler interface
     */
    function handleRefreshScheduler() {
        location.reload();
    }
    
    /**
     * Initialize date/time pickers if jQuery UI is available
     */
    function initializeDateTimePickers() {
        if ($.datepicker) {
            $('input[name="schedule_date"]').datepicker({
                dateFormat: 'yy-mm-dd',
                minDate: 0
            });
        }
    }
    
    /**
     * Generate cron expression from schedule data
     */
    function generateCronExpression(scheduleData) {
        const timeParts = scheduleData.time.split(':');
        const hour = parseInt(timeParts[0], 10) || 9;
        const minute = parseInt(timeParts[1], 10) || 0;
        const day = parseInt(scheduleData.day, 10) || 0;
        
        switch (scheduleData.type) {
            case 'daily':
                return `${minute} ${hour} * * *`;
            case 'weekly':
                return `${minute} ${hour} * * ${day}`;
            case 'monthly_first':
                return `${minute} ${hour} 1 * *`;
            case 'monthly_fifteenth':
                return `${minute} ${hour} 15 * *`;
            case 'monthly_last':
                return `${minute} ${hour} L * *`;
            case 'monthly_custom':
                return `${minute} ${hour} ${day} * *`;
            default:
                return '';
        }
    }
    
    /**
     * Collect schedule-specific data from form
     */
    function collectScheduleData(form) {
        const scheduleType = form.find('select[name="schedule_type"]').val();
        const scheduleDate = form.find('input[name="schedule_date"]').val();
        const scheduleTime = form.find('input[name="schedule_time"]').val();
        const scheduleDay = form.find('select[name="schedule_day"]').val();
        const messageTitle = form.find('input[name="message_title"]').val() || '';
        
        return {
            type: scheduleType,
            date: scheduleDate,
            time: scheduleTime,
            day: scheduleDay,
            message_title: messageTitle
        };
    }
    
    /**
     * Submit scheduled message to server
     */
    function submitScheduledMessage(formData, scheduleData, form) {
        // Show loading state
        const submitButton = $('.tbc-mc-sms-button').filter(':visible').first();
        const originalText = submitButton.data('original-text') || 'Send';
        submitButton.prop('disabled', true).html('<i class="bb-icon-clock"></i> Scheduling...');

        let ajaxData = {
            action: 'tbc_mc_schedule_sms',
            nonce: tbcMC.nonce,
            message_data: formData
        };

        // Add message title from schedule data if available
        if (scheduleData && scheduleData.message_title) {
            ajaxData.message_data.message_title = scheduleData.message_title;
        }

        // Add schedule-specific data
        if (scheduleData && scheduleData.type === 'once') {
            // Convert to timestamp
            const scheduledDateTime = new Date(scheduleData.date + ' ' + scheduleData.time);
            ajaxData.schedule_time = Math.floor(scheduledDateTime.getTime() / 1000);
            ajaxData.schedule_type = 'scheduled';
        } else if (scheduleData && (scheduleData.type.startsWith('daily') || scheduleData.type.startsWith('weekly') || scheduleData.type.startsWith('monthly'))) {
            // Generate cron expression
            const cronExpression = generateCronExpression(scheduleData);
            ajaxData.schedule_type = 'recurring';
            ajaxData.cron_expression = cronExpression;
        } else {
            // "Send Now" case - schedule for immediate execution
            ajaxData.schedule_type = 'immediate';
        }

        $.post(ajaxurl, ajaxData)
        .done(function(response) {
            try {
                if (response && response.success && response.data && response.data.html) {
                    var isSuccess = response.data.html.includes('bp-feedback success');

                    // Extract plain text from server HTML for toast
                    var temp = $('<div>').html(response.data.html);
                    var msg = temp.find('p').text() || (isSuccess ? 'Message sent!' : 'Something went wrong');
                    window.showToast(isSuccess ? 'success' : 'error', msg);

                    // Clear form on success
                    if (isSuccess) {
                        clearFormAfterSuccess();
                    }
                } else {
                    var errorMsg = (response && response.data && response.data.message) || 'Invalid response from server';
                    window.showToast('error', 'Failed to schedule message: ' + errorMsg);
                }
            } catch (e) {
                console.error('Error processing response:', e);
                window.showToast('error', 'Error processing server response');
            }
        })
        .fail(function(jqXHR, textStatus, errorThrown) {
            console.error('AJAX Error:', textStatus, errorThrown);
            let errorMessage = 'An error occurred while scheduling message.';

            if (jqXHR.responseJSON && jqXHR.responseJSON.data && jqXHR.responseJSON.data.message) {
                errorMessage = jqXHR.responseJSON.data.message;
            } else if (textStatus === 'timeout') {
                errorMessage = 'Request timed out. Please try again.';
            } else if (textStatus === 'parsererror') {
                errorMessage = 'Server response error. Please try again.';
            }

            window.showToast('error', errorMessage);
        })
        .always(function() {
            // Always restore button and reset form state
            submitButton.prop('disabled', false).html('<i class="bb-icon-bell-plus"></i> ' + originalText);

            // Reset submitting state
            if (form) {
                form.data('submitting', false);
            }
        });
    }
    
    /**
     * Clear form after successful scheduling
     */
    function clearFormAfterSuccess() {
        setTimeout(function() {
            // Clear message and title
            $('textarea[name="sms_message"]').val('');
            $('input[name="message_title"]').val('');
            
            // Uncheck recipients
            $('.user-checkbox:checked, input[name="users[]"]:checked, input[name="members[]"]:checked, input[name="customers[]"]:checked').prop('checked', false);
            
            // Reset send timing to "now"
            $('input[name="send_timing"][value="now"]').prop('checked', true);
            $('.tbc-mc-schedule-options').slideUp('fast');
            
            // Clear media
            $('.tbc-mc-media-url').val('');
            $('.uploaded-filename').text('');
            $('.clear-image').hide();
            
            // Update character counter
            if (window.CharCounter) {
                $('textarea[name="sms_message"]').trigger('keyup');
            }
        }, 2000);
    }
    
    // Global scheduleSMS function that other JS files can call
    // FIXED: Updated to use tbc-mc- prefixed class
    window.scheduleSMS = function(options) {
        const form = $('.tbc-mc-sms-form:visible').first();
        
        // Ensure we have a valid form
        if (form.length === 0) {
            smsFeedback('#feedback', 'error', 'Form not found. Please try again.');
            return false;
        }
        
        // Prevent double submission
        if (form.data('submitting') === true) {
            return false;
        }
        
        // Mark as submitting
        form.data('submitting', true);
        
        // Check send timing
        const sendTiming = form.find('input[name="send_timing"]:checked').val() || 'now';
        
        if (sendTiming === 'schedule') {
            // Get schedule information from form
            const scheduleData = collectScheduleData(form);
            
            // Simple validation
            if (!scheduleData.type) {
                form.data('submitting', false);
                smsFeedback('#feedback', 'error', 'Please select a schedule type.');
                return false;
            }
            
            // Submit as scheduled message
            submitScheduledMessage(options, scheduleData, form);
        } else {
            // "Send Now" = schedule for immediate execution
            submitScheduledMessage(options, null, form);
        }
        
        return true;
    };
});