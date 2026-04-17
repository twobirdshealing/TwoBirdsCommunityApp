/**
 * TBC OTP - Admin JS
 */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        var btn = document.getElementById('tbc-otp-setup-phone-btn');
        if (!btn) return;

        btn.addEventListener('click', function () {
            if (btn.disabled) return;

            var originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Setting up…';

            var body = new URLSearchParams();
            body.append('action', 'tbc_otp_setup_phone_field');
            body.append('_wpnonce', btn.getAttribute('data-nonce') || '');

            fetch(window.ajaxurl, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString(),
            })
                .then(function (r) { return r.json(); })
                .then(function (res) {
                    if (res && res.success) {
                        window.location.reload();
                    } else {
                        var msg = (res && res.data && res.data.message) || 'Setup failed.';
                        alert(msg);
                        btn.disabled = false;
                        btn.textContent = originalText;
                    }
                })
                .catch(function () {
                    alert('Network error — please try again.');
                    btn.disabled = false;
                    btn.textContent = originalText;
                });
        });
    });
})();
