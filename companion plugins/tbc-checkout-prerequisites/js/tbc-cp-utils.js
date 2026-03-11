(function($) {
    'use strict';

    function escHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function showNotice(message, type) {
        $('.tbc-cp-notice').remove();

        var typeClass = {
            error: 'tbc-cp-notice--error',
            warning: 'tbc-cp-notice--warning',
            success: 'tbc-cp-notice--success',
            info: 'tbc-cp-notice--info'
        }[type] || 'tbc-cp-notice--info';

        var $notice = $(`
            <div class="tbc-cp-notice ${typeClass}">
                <div class="tbc-cp-notice__content">
                    <span class="tbc-cp-notice__message">${escHtml(message)}</span>
                    <button class="tbc-cp-notice__close"></button>
                </div>
            </div>
        `);

        $('body').append($notice);

        setTimeout(function() {
            $notice.fadeOut(300, function() {
                $(this).remove();
            });
        }, 5000);

        $notice.find('.tbc-cp-notice__close').click(function() {
            $notice.fadeOut(300, function() {
                $(this).remove();
            });
        });
    }

    function handleSuccessRedirect() {
        var $card = $('.tbc-cp-success-card[data-redirect-url]');
        if ($card.length && !$card.data('redirectStarted')) {
            $card.data('redirectStarted', true);
            setTimeout(function() {
                window.location.href = $card.attr('data-redirect-url');
            }, 2000);
        }
    }

    $(document).ready(handleSuccessRedirect);
    $(document).ajaxComplete(handleSuccessRedirect);

    window.TBC_CP_Utils = {
        escHtml: escHtml,
        showNotice: showNotice
    };

})(jQuery);
