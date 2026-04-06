function loadTemplate(selectObject) {
    // Find the closest form and the textarea within it
    const form = jQuery(selectObject).closest('form');
    const targetTextArea = form.find('textarea[name="sms_message"]')[0]; // Using name attribute

    const value = selectObject.value;
    if (value === "template1") {
        targetTextArea.value = "🌟 {name}, we are hosting our pre-ceremony call TONIGHT at 7:30 PM. 🌟\n\n🔗 Quick Join Link: https://us02web.zoom.us/j/9301696301?pwd=VzFsdndNcFJiblRsZ2pJMFlKOC9qdz09\n📞 Meeting ID: 930 169 6301\n🔑 Passcode: love\n\nWe look forward to connecting with you TONIGHT to share this sacred time and answer any questions! 🙏";
    } else if (value === "template2") {
        targetTextArea.value = "🌟 {name}, join us for our Virtual Integration Service call TONIGHT at 7:30 PM! 🌟✨\n\n🔗 Quick Join Link: https://us02web.zoom.us/j/9301696301?pwd=VzFsdndNcFJiblRsZ2pJMFlKOC9qdz09\n📞 Meeting ID: 930 169 6301\n🔑 Passcode: love\n\n🌟 Experience the unity and warmth of our spiritual community from anywhere. Looking forward to connecting and sharing with you! 🙏";
    } else if (value === "template3") {
        targetTextArea.value = "🌟 Today's the Day, {name}! 🌟\n\nWe're so excited to welcome you to our Sacred Ceremony tonight. 🌟\n\n📍 Location: 2493 CR 427, Anna, Texas 75409\n⏰ Timing:\n   - Arrival: 7:00 PM Friday\n   - Departure: 11:00 AM Sunday\n\n🎒 Please Bring:\n   - Refillable Water Bottle\n   - Clothing for the Weekend\n   - Journal\n   - Basic Toiletries\n\nLooking forward to a weekend of deep connection, transformation, and healing. See you tonight! 🙏";
    } else if (value === "template4") {
        targetTextArea.value = "📚 Guess what, {name}? Our Book Club meeting is TONIGHT at 6:00 PM via Zoom! 🧙‍♂️📚🎉\n\n🎧 Free Audiobook: https://community.twobirdschurch.com/book-club/\n🔗 Join Here: https://us02web.zoom.us/j/9301696301?pwd=VzFsdndNcFJiblRsZ2pJMFlKOC9qdz09\n📞 Meeting ID: 930 169 6301\n🔑 Passcode: love\n\n✨ Even if you haven't read the chapters, you're welcome to join for discussion and sharing!\n📄 To leave the Book Club, simply exit the group chat you joined or message us NOBOOK. See you tonight! 🌟";
    } else if (value === "template5") {
        targetTextArea.value = "🎶 Friendly Reminder, {name}: Sound Journey Tonight! 🎵\n\nYou've signed up for our Sound Journey at Two Birds Church. 🌟\n📍 Address: 2493 CR 427, Anna, TX\n⏰ Time: 6:00 PM - 8:00 PM\n\n✨ Bring your intentions, a water bottle, and comfy clothing. We can't wait to see you tonight for this magical experience! 🙏";
    } else if (value === "template6") {
        targetTextArea.value = "🌟 Thank you all for joining the ceremony, {name}! 🌟 We hope you're feeling rested and starting to integrate the experience. Remember, true transformation takes time, so let's nurture that growth together. 🌱✨\n\n📚 You've been enrolled in our Integration course – explore it at your own pace and deepen your journey.\n\n💝 Support Our Mission: Becoming a monthly donor (even $10/month!) helps sustain these sacred experiences. Our goal is 5 new subscribers this month – could you be one of them? 🙏\n\n🌟 Share Your Experience: We'd love to hear your thoughts! Leaving a review not only helps others but also earns you Rose Quartz credits for future ceremonies. 🌟\n\n🎵 Reconnect with Ceremony Vibes: Dive back into the magic with our *Songs of Ceremony* playlist. 🎶\n\nLet's make the most of this journey together. Check the group chat for all the links and details! ✨🌟\n\nWe're so grateful to walk this path with you. A'ho! 🙏";
    } else if (value === "template7") {
        targetTextArea.value = "🌟 Howdy, {name}! Join your Two Birds tribe TONIGHT for a cozy evening of laughter, good company, and shared meals at our community dinner night out. 🌟\n\n🍽 Location: Dimassi's Mediterranean Buffet\n📍 Address: 190 E Stacy Rd STE 3200, Allen, TX 75002\n⏰ Time: Drop in anytime between 6:00 PM - 8:00 PM\n\nLooking forward to seeing you there! 🙏";
    } else if (value === "template8") {
        targetTextArea.value = "🌟 Happy 1st of the Month, {name}! 🌟\n\n✨ A new month means new ceremonies! Registrations for our new Sacred Ceremonies are now open. Since you have a current medical screening, this is your special reminder. 🌟\n\n🔗 Swing by your Ceremony Dashboard to check them out and secure your spot: https://community.twobirdschurch.com/ceremony-dashboard/\n\nLooking forward to exploring and growing together through these new experiences. Hope to see you there! 🙏";
    } else if (value === "template9") {
        targetTextArea.value = "🐸 Hi {name}, a reminder for today's Sapo/Kambo Circle\n⏰ 1:00–2:30pm\n📍 Two Birds Church: 2493 CR 427, Anna, TX 75409\n\nPlease remember:\n💧 Bring at least 8oz of water\n👕 Wear a sleeveless shirt for easier application\n🌮 Bring a light snack if you're staying for Sunday Service (3–6pm)\n\nImportant:\n🚫 No food 4–6 hrs before\n☕ No caffeine today\n✅ Be sure you've followed the prep guidelines & reviewed contradictions in the prep course\n\nSee you soon 💛🕊️";
    } else {
        targetTextArea.value = "";
    }

    // Trigger keyup event to update the character counter and other details
    jQuery(targetTextArea).trigger('keyup');
}

// Function to insert {name} at the cursor position within the closest form
function insertNameTag(button) {
    // Get the closest form and the textarea within it
    const form = jQuery(button).closest('form');
    const targetTextArea = form.find('textarea[name="sms_message"]')[0]; // Using name attribute

    const cursorPos = targetTextArea.selectionStart;
    const textBefore = targetTextArea.value.substring(0, cursorPos);
    const textAfter = targetTextArea.value.substring(cursorPos);
    targetTextArea.value = textBefore + "{name}" + textAfter;
    targetTextArea.focus();
    targetTextArea.selectionEnd = cursorPos + 6; // Place cursor after {name}
    jQuery(targetTextArea).trigger('keyup'); // Update counter
}

// Lock/Unlock Opt-Out Message functionality
jQuery(document).ready(function($) {
    
    // Handle lock/unlock toggle
    $(document).on('click', '.tbc-mc-lock-toggle', function() {
        var button = $(this);
        var isAdmin = button.data('admin') === true || button.data('admin') === 'true';
        var textarea = button.siblings('.tbc-mc-opt-out-message');
        
        // Check admin permissions
        if (!isAdmin) {
            alert('Only administrators can edit the opt-out message.');
            return;
        }
        
        if (button.hasClass('tbc-mc-locked')) {
            // Unlock: change to open lock, enable editing
            button.removeClass('bb-icon-lock-alt tbc-mc-locked')
                  .addClass('bb-icon-lock-alt-open tbc-mc-unlocked')
                  .attr('title', 'Click to lock and save');
            textarea.prop('readonly', false).focus();
        } else {
            // Lock: save message, change to closed lock, disable editing
            var newMessage = textarea.val().trim();
            
            if (newMessage === '') {
                alert('Opt-out message cannot be empty.');
                return;
            }
            
            // Disable button during save
            button.prop('disabled', true);
            
            // Save via AJAX
            $.post(ajaxurl, {
                action: 'tbc_mc_save_opt_out',
                nonce: tbcMC.nonce,
                message: newMessage
            })
            .done(function(response) {
                if (response.success) {
                    // Success: lock the interface
                    button.removeClass('bb-icon-lock-alt-open tbc-mc-unlocked')
                          .addClass('bb-icon-lock-alt tbc-mc-locked')
                          .attr('title', 'Click to unlock (Admin only)');
                    textarea.prop('readonly', true);
                    
                    // Optional: Show brief success feedback
                    var originalTitle = button.attr('title');
                    button.attr('title', 'Saved!');
                    setTimeout(function() {
                        button.attr('title', originalTitle);
                    }, 2000);
                } else {
                    alert('Failed to save opt-out message. Please try again.');
                }
            })
            .fail(function() {
                alert('Error saving opt-out message. Please try again.');
            })
            .always(function() {
                button.prop('disabled', false);
            });
        }
    });
});