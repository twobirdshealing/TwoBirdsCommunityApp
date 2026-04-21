/**
 * TBC WooCommerce Calendar - FAQ accordion (frontend)
 *
 * Click a question to toggle its answer. All questions act independently,
 * so multiple can be open at once.
 */
(function ($) {
    'use strict';

    $(function () {
        $(document).on('click', '.tbc-wc-faq-question', function () {
            var $q = $(this);
            $q.toggleClass('active');
            $q.next('.tbc-wc-faq-answer').slideToggle(200);
        });
    });
})(jQuery);
