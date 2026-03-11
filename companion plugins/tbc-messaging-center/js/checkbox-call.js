jQuery(document).ready(function($) {
    $('.tbc-mc-member-checkbox').on('click', function() {
        var destinationInput = $('.tbc-mc-destination-input');

        // If the checkbox is checked
        if ($(this).prop('checked')) {
            // Get the phone number from the data-phone attribute of the checkbox
            var phoneNumber = $(this).data('phone');

            // Set this phone number in the destination-input field
            destinationInput.val(phoneNumber);

            // Optionally, you can uncheck other checkboxes to ensure only one member is selected at a time
            $('.tbc-mc-member-checkbox').not(this).prop('checked', false);
        } else {
            // If the checkbox is unchecked, clear the destination-input field
            destinationInput.val('');
        }
    });
});