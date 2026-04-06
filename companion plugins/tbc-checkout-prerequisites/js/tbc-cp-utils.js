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

    function ajax(actionType, data, callbacks) {
        return $.post({
            url: tbc_cp_vars.ajaxurl,
            data: $.extend({
                action: 'tbc_cp_content_action',
                action_type: actionType,
                nonce: tbc_cp_vars.nonce
            }, data),
            success: callbacks.success || function() {},
            error: callbacks.error || function() {},
            complete: callbacks.complete || function() {}
        });
    }

    window.TBC_CP_Utils = {
        escHtml: escHtml,
        showNotice: showNotice,
        ajax: ajax
    };

})(jQuery);
