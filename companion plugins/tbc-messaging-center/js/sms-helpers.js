/**
 * SMS Helpers - Unified SMS System
 *
 * All SMS forms (SMS Center, Group SMS, Message Center) use these functions.
 * Single system = consistent behavior, easy maintenance.
 */

/**
 * Centralized AJAX wrapper with nonce and error handling
 * Used across all modules for consistent AJAX behavior
 */
window.tbcMcAjax = function(action, data = {}) {
    return jQuery.post(ajaxurl, {
        action: action,
        nonce: (typeof tbcMC !== 'undefined') ? tbcMC.nonce : '',
        ...data
    }).fail(function(jqXHR) {
        let errorMessage = 'Server error';
        if (jqXHR.status === 0) {
            errorMessage = 'Network error - please check your connection';
        } else if (jqXHR.status === 403) {
            errorMessage = 'Session expired - please refresh the page';
        } else if (jqXHR.status === 500) {
            errorMessage = 'Server error - please try again';
        }
        window.showToast('error', errorMessage);
    });
};

/**
 * Toast notification for modern feedback
 * Creates a floating toast that auto-dismisses
 */
window.showToast = function(type, message) {
    // Remove any existing toasts
    jQuery('.tbc-mc-toast').remove();

    // Create toast element
    var toast = jQuery('<div class="tbc-mc-toast ' + type + '">' + message + '</div>');

    // Add to body (floats above everything)
    jQuery('body').append(toast);

    // After 3 seconds, fade out and remove
    setTimeout(function() {
        toast.addClass('fade-out');
        setTimeout(function() {
            toast.remove();
        }, 300);
    }, 3000);
};

/**
 * Show feedback message to user (inline style)
 * Used across all SMS forms for consistent messaging
 * NOTE: For toast overlays, use showToast() or showFeedback() instead
 */
window.smsFeedback = function(selector, type, message) {
    const feedbackHtml = '<div class="tbc-mc-feedback ' + type + '">' +
        '<p>' + jQuery('<div>').text(message).html() + '</p>' +
        '<span class="tbc-mc-feedback-close">&times;</span>' +
        '</div>';

    jQuery(selector).append(feedbackHtml);
};

// Close button for feedback messages
jQuery(document).on('click', '.tbc-mc-feedback-close', function() {
    jQuery(this).closest('.tbc-mc-feedback').fadeOut(300, function() {
        jQuery(this).remove();
    });
});

/**
 * Phone utilities
 * Normalizes phone numbers to E.164 format for Twilio (+15551234567)
 */
window.PhoneUtils = {
    normalize: function(phone) {
        if (!phone) return '';
        
        phone = phone.toString();
        phone = phone.replace(/[^\d]/g, '');
        
        if (phone.length === 10) {
            return '+1' + phone;
        } else if (phone.length === 11 && phone.startsWith('1')) {
            return '+' + phone;
        } else if (phone.length > 0 && !phone.startsWith('+')) {
            return '+' + phone;
        }
        
        return phone;
    }
};

/**
 * Collect form data from any SMS form
 * Works with SMS Center, Group SMS, and Message Center reply forms
 * FIXED: Updated to use tbc-mc- prefixed container classes
 */
window.collectSMSFormData = function(form) {
    const message = form.find('textarea[name="sms_message"]').val().trim();
    const optOutMessage = form.find('textarea[name="opt_out_message"]').val();
    const includeOptOut = form.find('input[name="include_opt_out"]').is(':checked');
    const mediaUrl = form.find('input[name="upload_image"]').val();
    const sendAsMms = form.find('input[name="send_as_mms"]').is(':checked');
    const includeInLog = form.find('input[name="include_in_log"]').is(':checked');
    
    // Determine form type by parent container
    let formSource = 'unknown';
    if (form.closest('.tbc-mc-sms-center-container').length) {
        formSource = 'sms_center';
    } else if (form.closest('.tbc-mc-sms-group-container').length) {
        formSource = 'group_tab';
    } else if (form.closest('.tbc-mc-reply-panel-content').length) {
        formSource = 'message_center_reply';
    } else if (form.closest('.tbc-mc-compose-slide-content').length) {
        formSource = 'compose_panel';
    }

    // Collect recipients based on form type
    const recipients = [];

    if (formSource === 'message_center_reply') {
        // Single recipient from hidden field in reply form
        const senderNumber = form.find('input[name="sender_number"]').val();
        const recipientName = form.find('.tbc-mc-contact-name').text() || 'Friend';

        if (senderNumber) {
            recipients.push({
                phone: window.PhoneUtils.normalize(senderNumber),
                name: recipientName
            });
        }
    } else if (formSource === 'compose_panel') {
        // Recipients from hidden JSON field set by updateComposeFormRecipients()
        const phoneNumbersJson = form.find('input[name="phone_numbers"]').val();
        if (phoneNumbersJson) {
            try {
                const phoneNumbers = JSON.parse(phoneNumbersJson);
                phoneNumbers.forEach(function(entry) {
                    if (entry.phone) {
                        recipients.push({
                            phone: window.PhoneUtils.normalize(entry.phone),
                            name: entry.name || 'Contact'
                        });
                    }
                });
            } catch (e) {
                console.error('Error parsing compose recipients:', e);
            }
        }
    } else {
        // Multiple recipients from checkboxes (SMS Center, Group, etc.)
        form.find('.user-checkbox:checked, input[name="users[]"]:checked, input[name="members[]"]:checked, input[name="customers[]"]:checked').each(function() {
            const phone = jQuery(this).data('phone') || jQuery(this).val();
            const name = jQuery(this).data('name') || 'Contact';

            if (phone) {
                recipients.push({
                    phone: window.PhoneUtils.normalize(phone),
                    name: name
                });
            }
        });
    }
    
    return {
        message: message,
        recipients: recipients,
        media_url: mediaUrl,
        send_as_mms: sendAsMms,
        include_opt_out: includeOptOut,
        opt_out_message: includeOptOut ? optOutMessage : '',
        include_in_log: includeInLog,
        form_source: formSource
    };
};

/**
 * Calculate cost and show confirmation dialog
 * Shows recipient count, total cost, schedule info, and suggests cheaper option
 */
window.calculateCostAndConfirm = function(formData, recipientName = null, scheduleInfo = null) {
    const recipients = formData.recipients;
    const message = formData.message;
    const sendAsMms = formData.send_as_mms;
    const hasMedia = formData.media_url && formData.media_url.trim() !== '';
    const mediaCount = hasMedia ? formData.media_url.split(',').filter(u => u.trim()).length : 0;
    const includeInLog = formData.include_in_log;
    
    // Validate
    if (!message) {
        return { confirmed: false, error: 'Please enter a message to send.' };
    }
    
    if (recipients.length === 0) {
        return { confirmed: false, error: 'No recipients selected. Please select at least one user.' };
    }
    
    // Calculate costs using CharCounter
    const encoding = window.CharCounter.getEncodingType(message);
    const segmentCount = window.CharCounter.getSegmentCount(message, encoding);
    const prices = window.CharCounter.calculatePrice(segmentCount);
    const pricePerNumber = sendAsMms ? prices.mmsPrice : prices.smsPrice;
    const totalCost = (pricePerNumber * recipients.length).toFixed(4);
    
    // Build confirmation message
    const recipientText = recipientName ? recipientName : `${recipients.length} users`;
    let confirmationMessage = `You are about to send a message to ${recipientText}.\n`;
    confirmationMessage += `Sending as ${sendAsMms ? 'MMS' : 'SMS'} will cost $${totalCost}.\n`;
    
    // Add media attachment info
    if (mediaCount > 0) {
        confirmationMessage += `Attachments: ${mediaCount} image${mediaCount > 1 ? 's' : ''}.\n`;
    }
    
    // Add log status
    confirmationMessage += `Log to database: ${includeInLog ? 'Yes' : 'No'}.\n`;
    
    // Add schedule info
    if (scheduleInfo) {
        confirmationMessage += scheduleInfo + '\n';
    } else {
        confirmationMessage += 'This will be sent immediately.\n';
    }
    
    // Suggest cheaper option ONLY if no media attachments
    // With media, user MUST send as MMS, so no point suggesting SMS
    if (!hasMedia) {
        if (!sendAsMms && prices.smsPrice > prices.mmsPrice) {
            const mmsTotal = (prices.mmsPrice * recipients.length).toFixed(4);
            confirmationMessage += `Note: Sending as MMS would cost $${mmsTotal}, which is cheaper.\n`;
        } else if (sendAsMms && prices.mmsPrice > prices.smsPrice) {
            const smsTotal = (prices.smsPrice * recipients.length).toFixed(4);
            confirmationMessage += `Note: Sending as SMS would cost $${smsTotal}, which is cheaper.\n`;
        }
    }
    
    confirmationMessage += 'Do you want to proceed?';
    
    const confirmed = confirm(confirmationMessage);
    return { confirmed: confirmed, error: null };
};

/**
 * Main SMS form submission handler
 * Entry point for all SMS forms - validates, confirms, then sends
 * 
 * Flow: Collect data â†’ Build schedule info â†’ Show confirmation â†’ Submit to scheduleSMS()
 */
window.handleSMSFormSubmission = function(form, recipientName = null) {
    // Prevent double submission
    if (form.data('submitting') === true) {
        return false;
    }
    
    // Collect form data
    const formData = window.collectSMSFormData(form);
    
    // Collect schedule information for confirmation popup
    let scheduleInfo = null;
    const sendTiming = form.find('input[name="send_timing"]:checked').val() || 'now';
    
    if (sendTiming === 'schedule') {
        const scheduleType = form.find('select[name="schedule_type"]').val();
        const scheduleDate = form.find('input[name="schedule_date"]').val();
        const scheduleTime = form.find('input[name="schedule_time"]').val();
        const scheduleDay = form.find('select[name="schedule_day"]').val();
        
        // Build human-readable schedule description
        if (scheduleType === 'once' && scheduleDate && scheduleTime) {
            const scheduledDateTime = new Date(scheduleDate + ' ' + scheduleTime);
            scheduleInfo = `This will be sent on ${scheduledDateTime.toLocaleString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric', 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
            })}.`;
        } else if (scheduleType && scheduleType.startsWith('daily')) {
            scheduleInfo = `This will recur daily at ${scheduleTime}.`;
        } else if (scheduleType && scheduleType.startsWith('weekly')) {
            const dayName = form.find('select[name="schedule_day"] option:selected').text();
            scheduleInfo = `This will recur every ${dayName} at ${scheduleTime}.`;
        } else if (scheduleType && scheduleType.startsWith('monthly')) {
            scheduleInfo = `This will recur monthly on day ${scheduleDay} at ${scheduleTime}.`;
        }
    }
    
    // Show confirmation with cost and schedule
    const confirmation = window.calculateCostAndConfirm(formData, recipientName, scheduleInfo);
    
    if (!confirmation.confirmed) {
        if (confirmation.error) {
            const feedbackSelector = window.getFeedbackSelector();
            if (feedbackSelector) {
                window.smsFeedback(feedbackSelector, 'error', confirmation.error);
            } else {
                window.showToast('error', confirmation.error);
            }
        }
        return false;
    }
    
    // Convert to scheduleSMS() format
    const options = {
        message: formData.message,
        recipients: formData.recipients,
        media_url: formData.media_url,
        send_as_mms: formData.send_as_mms,
        include_opt_out: formData.include_opt_out,
        opt_out_message: formData.opt_out_message,
        include_in_log: formData.include_in_log,
        form_source: formData.form_source
    };
    
    // Submit to scheduleSMS() which handles AJAX and Action Scheduler
    window.scheduleSMS(options);
    
    return true;
};

/**
 * Get feedback selector for current page
 * Returns appropriate feedback container based on which page is active
 */
window.getFeedbackSelector = function() {
    if (jQuery('#scheduler-feedback').length) {
        return '#scheduler-feedback';
    } else if (jQuery('#feedback').length) {
        return '#feedback';
    } else if (jQuery('#message-center-feedback').length) {
        return '#message-center-feedback';
    }
    return null;
};