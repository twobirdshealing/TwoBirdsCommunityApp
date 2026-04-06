jQuery(document).ready(function($) {
    // UNIFIED SMS form submission handler - FIXED WITH PREFIXED CLASS
    $(document).on('submit', '.tbc-mc-sms-group-container form', function(event) {
        event.preventDefault();
        window.handleSMSFormSubmission($(this));
    });

    // Handle select all/none functionality
    $('#check_all').on('change', function() {
        const isChecked = $(this).is(':checked');
        $('.user-checkbox').prop('checked', isChecked);
    });
});