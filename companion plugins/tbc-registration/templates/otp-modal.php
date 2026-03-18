<?php
/**
 * OTP Modal Template
 *
 * Used in two modes:
 *   1. Overlay modal (profile phone change) — injected into page by JS
 *   2. Full-page (password recovery) — rendered as a standalone HTML page
 *
 * Variables available when rendered as full-page:
 *   $context        string  'recovery'
 *   $session_key    string
 *   $phone_masked   string
 *   $rest_url       string  REST base URL for OTP endpoints
 *   $rest_nonce     string
 *   $voice_enabled  bool
 *
 * @package TBC_Registration
 */

declare(strict_types=1);

defined('ABSPATH') || exit;

$is_fullpage = isset($context) && $context === 'recovery';

if ($is_fullpage): ?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?php esc_html_e('Phone Verification', 'tbc-registration'); ?></title>
    <?php wp_head(); ?>
    <link rel="stylesheet" href="<?php echo esc_url(TBC_REG_URL . 'assets/css/otp-modal.css?ver=' . TBC_REG_VERSION); ?>" />
</head>
<body class="tbc-otp-fullpage">
<?php endif; ?>

<div class="tbc-otp-overlay<?php echo $is_fullpage ? ' tbc-otp-fullpage-overlay' : ''; ?>" id="tbc-otp-overlay">
    <div class="tbc-otp-modal" role="dialog" aria-modal="true" aria-labelledby="tbc-otp-title">

        <div class="tbc-otp-modal__header">
            <h2 class="tbc-otp-modal__title" id="tbc-otp-title">
                <?php esc_html_e('Phone Verification', 'tbc-registration'); ?>
            </h2>
        </div>

        <div class="tbc-otp-modal__body">
            <p class="tbc-otp-modal__instructions" id="tbc-otp-instructions">
                <?php echo esc_html(
                    sprintf(
                        /* translators: %s: masked phone number */
                        __('Enter the 6-digit code sent to %s', 'tbc-registration'),
                        $is_fullpage ? $phone_masked : ''
                    )
                ); ?>
            </p>

            <div class="tbc-otp-modal__input-wrap">
                <input
                    type="text"
                    id="tbc-otp-code"
                    class="tbc-otp-modal__input"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    maxlength="6"
                    pattern="[0-9]{6}"
                    placeholder="000000"
                    autofocus
                />
            </div>

            <div class="tbc-otp-modal__status" id="tbc-otp-status" role="status" aria-live="polite"></div>

            <div class="tbc-otp-modal__actions">
                <button type="button" class="tbc-otp-modal__btn tbc-otp-modal__btn--primary" id="tbc-otp-verify-btn">
                    <?php esc_html_e('Verify Code', 'tbc-registration'); ?>
                </button>
                <button type="button" class="tbc-otp-modal__btn tbc-otp-modal__btn--secondary" id="tbc-otp-back-btn">
                    <?php esc_html_e('Go Back', 'tbc-registration'); ?>
                </button>
            </div>

            <div class="tbc-otp-modal__links">
                <a href="#" class="tbc-otp-modal__link" id="tbc-otp-resend">
                    <?php esc_html_e('Resend SMS', 'tbc-registration'); ?>
                </a>
                <?php if ($is_fullpage ? $voice_enabled : true): ?>
                <a href="#" class="tbc-otp-modal__link tbc-otp-modal__link--voice" id="tbc-otp-voice" style="<?php echo ($is_fullpage && !$voice_enabled) ? 'display:none;' : ''; ?>">
                    <?php esc_html_e('Try voice call', 'tbc-registration'); ?>
                </a>
                <?php endif; ?>
            </div>
        </div>

    </div>
</div>

<?php if ($is_fullpage): ?>
<script>
    // Bootstrap full-page mode with server-provided config (REST-based)
    window.tbcOtpFullpage = {
        sessionKey:   <?php echo wp_json_encode($session_key); ?>,
        phoneMasked:  <?php echo wp_json_encode($phone_masked); ?>,
        context:      'recovery',
        restUrl:      <?php echo wp_json_encode($rest_url); ?>,
        restNonce:    <?php echo wp_json_encode($rest_nonce); ?>,
        voiceEnabled: <?php echo wp_json_encode($voice_enabled); ?>
    };
</script>
<script src="<?php echo esc_url(TBC_REG_URL . 'assets/js/otp-handler.js?ver=' . TBC_REG_VERSION); ?>"></script>
<?php wp_footer(); ?>
</body>
</html>
<?php endif; ?>
