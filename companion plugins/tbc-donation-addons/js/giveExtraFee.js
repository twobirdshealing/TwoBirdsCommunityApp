(function($) {
    $(document).ready(function() {
        $('#give_extra_checkbox').on('change', function() {
            if ($(this).is(':checked')) {
                $('.give-extra-amount').slideDown(function() {
                    $('#give_extra_amount').focus();
                });
            } else {
                $('.give-extra-amount').slideUp();
            }
        });
    });
})(jQuery);