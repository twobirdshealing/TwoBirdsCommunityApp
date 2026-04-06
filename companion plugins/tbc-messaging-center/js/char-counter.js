jQuery(document).ready(function(jQuery) {
    window.CharCounter = {
        // Existing CharCounter object properties remain the same
        GSM_7_SINGLE: 160,
        GSM_7_MULTI: 153,
        UCS_2_SINGLE: 70,
        UCS_2_MULTI: 67,
        SMS_PRICE: 0.0079,
        MMS_OUTBOUND_PRICE: 0.0200,
        DISCOUNT: 0.75,
        getEncodingType: function(message) {
            // SAFETY CHECK: Handle undefined/null message
            if (!message || typeof message !== 'string') {
                return 'GSM-7'; // Default encoding
            }
            
            for (let i = 0; i < message.length; i++) {
                const charCode = message.charCodeAt(i);
                // Check for non-GSM-7 characters (including Euro symbol at 0x20AC)
                if (charCode > 127 || charCode === 0x20AC || ["^", "{", "}", "\\", "[", "]", "~", "|"].includes(message[i])) {
                    return 'UCS-2';
                }
            }
            return 'GSM-7';
        },
        getSegmentCount: function(message, encoding) {
            // SAFETY CHECK: Handle undefined/null message
            if (!message || typeof message !== 'string') {
                return 1; // Default to 1 segment
            }
            
            let maxChars = (encoding === 'GSM-7') ? this.GSM_7_SINGLE : this.UCS_2_SINGLE;
            let maxMultiChars = (encoding === 'GSM-7') ? this.GSM_7_MULTI : this.UCS_2_MULTI;
            if (message.length <= maxChars) {
                return 1;
            } else {
                return Math.ceil(message.length / maxMultiChars);
            }
        },
        calculatePrice: function(segments) {
            const smsPrice = (this.SMS_PRICE * segments) * this.DISCOUNT;
            const mmsPrice = this.MMS_OUTBOUND_PRICE * this.DISCOUNT;
            return { smsPrice, mmsPrice };
        }
    };

    function updateCharCount() {
        // Find the active form
        const activeForm = jQuery('form:visible');
        const messageTextarea = activeForm.find('textarea[name="sms_message"]');
        
        // SAFETY CHECK: Only proceed if we have a visible SMS textarea
        if (messageTextarea.length === 0) {
            return; // No SMS form visible, skip updating
        }
        
        const message = messageTextarea.val() || ''; // Default to empty string
        const encoding = window.CharCounter.getEncodingType(message);
        const segmentCount = window.CharCounter.getSegmentCount(message, encoding);
        
        // Find MMS toggle within the active form
        const sendAsMmsChecked = activeForm.find('input[name="send_as_mms"]').is(':checked');
        
        // Calculate price per number
        const prices = window.CharCounter.calculatePrice(segmentCount);
        
        // Find char count element within the active form
        const countElement = activeForm.find('.char-count');
        
        // SAFETY CHECK: Only update if we have a char count element
        if (countElement.length === 0) {
            return; // No char count element, skip updating
        }
        
        // Update character count display
        const currentLength = message.length;
        let displayMessage = `${currentLength} characters, Segments: ${segmentCount}, Encoding: ${encoding}<br/>`;
        
        if (sendAsMmsChecked) {
            displayMessage += `<span style="color: green;">Sending as MMS. Cost: $${prices.mmsPrice.toFixed(4)} per number.</span>`;
        } else {
            displayMessage += `<span style="color: blue;">Sending as SMS. Cost: $${prices.smsPrice.toFixed(4)} per number.</span>`;
        }

        if (!sendAsMmsChecked && prices.smsPrice > prices.mmsPrice) {
            displayMessage += `<br/><span style="color: orange;">Note: Sending as MMS may be cheaper for this message.</span>`;
        }

        countElement.html(displayMessage);
    }

    // Event listeners - use event delegation for dynamically added elements
    jQuery(document).on('keyup', 'textarea[name="sms_message"]', updateCharCount);
    jQuery(document).on('change', 'input[name="send_as_mms"]', updateCharCount);
    jQuery(document).on('change', 'input[name="upload_image"]', updateCharCount);

    // Initial call to update char count on page load (with safety check)
    updateCharCount();
});