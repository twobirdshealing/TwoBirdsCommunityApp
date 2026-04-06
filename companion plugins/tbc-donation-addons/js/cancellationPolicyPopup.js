(function($) {
    $(document).ready(function() {
        $(".cancellation-policy-link").on("click", function(e) {
            e.preventDefault();
            var cancellationPolicy = $(this).data("policy");
            alert(cancellationPolicy);
        });
    });
})(jQuery);