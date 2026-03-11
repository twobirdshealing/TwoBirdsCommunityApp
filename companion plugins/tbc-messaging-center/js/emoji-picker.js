jQuery(document).ready(function($) {
    // Event delegation for the emoji button click within each unique form
    $(document).on('click', '.tbc-mc-emoji-button', function() {
        const form = $(this).closest('form');
        const emojiPickerContainer = form.find('.tbc-mc-emoji-picker-container');

        // Check if the picker is already loaded within this form
        if (!emojiPickerContainer.children().length) {
            const pickerOptions = {
                onEmojiSelect: (emoji) => insertEmoji(emoji.native, form),
                data: async () => {
                    const response = await fetch('https://cdn.jsdelivr.net/npm/@emoji-mart/data');
                    return response.json();
                }
            };
            const picker = new EmojiMart.Picker(pickerOptions);
            emojiPickerContainer.append(picker);
        }
        emojiPickerContainer.toggle();
    });

    // Function to insert emoji at the cursor position in the textarea
    function insertEmoji(emoji, form) {
        const textarea = form.find('textarea[name="sms_message"]')[0];
        const cursorPosition = textarea.selectionStart;
        const text = textarea.value;
        
        // Insert emoji at the cursor position
        textarea.value = text.slice(0, cursorPosition) + emoji + text.slice(cursorPosition);
        
        // Move cursor to the end of the inserted emoji
        textarea.selectionStart = textarea.selectionEnd = cursorPosition + emoji.length;
        form.find('.tbc-mc-emoji-picker-container').hide();
    }

    // Close emoji picker if clicking outside
    $(document).on('click', function(event) {
        const target = $(event.target);
        if (!target.closest('.tbc-mc-emoji-picker-container, .tbc-mc-emoji-button').length) {
            $('.tbc-mc-emoji-picker-container').hide();
        }
    });
});