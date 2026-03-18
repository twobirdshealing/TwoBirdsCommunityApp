<?php
/**
 * Admin Settings View — OTP Registration Verification
 *
 * @package TBC_OTP
 */

defined('ABSPATH') || exit;

// FC native field definitions (for phone selector)
$fc_field_defs = TBCOTP\Admin::get_fc_field_definitions();
?>

<div class="wrap tbc-otp-admin">
    <h1><?php esc_html_e('TBC OTP Verification', 'tbc-otp'); ?></h1>
    <p class="tbc-otp-subtitle"><?php esc_html_e('Phone OTP verification via Twilio for registration.', 'tbc-otp'); ?></p>

    <?php settings_errors('tbc_otp_settings'); ?>

    <form method="post" action="options.php">
        <?php settings_fields('tbc_otp_settings'); ?>

        <?php
        // Connection status
        $otp_sid     = TBCOTP\Helpers::get_option('twilio_sid', '');
        $otp_token   = TBCOTP\Helpers::get_option('twilio_token', '');
        $otp_svc_sid = TBCOTP\Helpers::get_option('verify_service_sid', '');

        if (empty($otp_sid) || empty($otp_token) || empty($otp_svc_sid)) : ?>
            <div class="notice notice-warning inline"><p>
                <?php esc_html_e('Configure your Twilio credentials below to enable OTP verification.', 'tbc-otp'); ?>
            </p></div>
        <?php endif; ?>

        <h3><?php esc_html_e('Twilio Configuration', 'tbc-otp'); ?></h3>
        <p class="description"><?php esc_html_e('Enter your Twilio credentials from the', 'tbc-otp'); ?> <a href="https://console.twilio.com/" target="_blank">Twilio Console</a>.</p>

        <table class="form-table">
            <tr>
                <th scope="row"><label for="tbc_otp_twilio_sid"><?php esc_html_e('Account SID', 'tbc-otp'); ?></label></th>
                <td>
                    <input type="text" id="tbc_otp_twilio_sid" name="tbc_otp_twilio_sid" value="<?php echo esc_attr((string) TBCOTP\Helpers::get_option('twilio_sid', '')); ?>" class="regular-text" />
                    <p class="description"><?php esc_html_e('Starts with "AC".', 'tbc-otp'); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="tbc_otp_twilio_token"><?php esc_html_e('Auth Token', 'tbc-otp'); ?></label></th>
                <td>
                    <input type="password" id="tbc_otp_twilio_token" name="tbc_otp_twilio_token" value="<?php echo esc_attr((string) TBCOTP\Helpers::get_option('twilio_token', '')); ?>" class="regular-text" />
                    <p class="description"><?php esc_html_e('Keep this secret.', 'tbc-otp'); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="tbc_otp_verify_service_sid"><?php esc_html_e('Verify Service SID', 'tbc-otp'); ?></label></th>
                <td>
                    <input type="text" id="tbc_otp_verify_service_sid" name="tbc_otp_verify_service_sid" value="<?php echo esc_attr((string) TBCOTP\Helpers::get_option('verify_service_sid', '')); ?>" class="regular-text" />
                    <p class="description"><?php esc_html_e('Starts with "VA". Create one at Twilio Verify Services.', 'tbc-otp'); ?></p>
                </td>
            </tr>
        </table>

        <h3><?php esc_html_e('Registration Settings', 'tbc-otp'); ?></h3>

        <table class="form-table">
            <tr>
                <th scope="row"><?php esc_html_e('Registration OTP', 'tbc-otp'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_otp_enable_registration_verification" value="1" <?php checked(1, TBCOTP\Helpers::get_option('enable_registration_verification', true)); ?> />
                        <?php esc_html_e('Require phone OTP during registration.', 'tbc-otp'); ?>
                    </label>
                </td>
            </tr>
            <tr>
                <th scope="row"><?php esc_html_e('Voice Call Fallback', 'tbc-otp'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_otp_enable_voice_fallback" value="1" <?php checked(1, TBCOTP\Helpers::get_option('enable_voice_fallback', false)); ?> />
                        <?php esc_html_e('Show a "Try voice call" option during OTP verification.', 'tbc-otp'); ?>
                    </label>
                </td>
            </tr>
            <tr>
                <th scope="row"><?php esc_html_e('Disable Email 2FA', 'tbc-otp'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_otp_disable_email_verification" value="1" <?php checked(1, TBCOTP\Helpers::get_option('disable_email_verification', true)); ?> />
                        <?php esc_html_e("Skip FluentCommunity's email verification when phone OTP is active.", 'tbc-otp'); ?>
                    </label>
                    <p class="description"><?php esc_html_e('Recommended. Phone OTP already proves identity. Uncheck to require both phone OTP and email verification.', 'tbc-otp'); ?></p>
                </td>
            </tr>
        </table>

        <h3><?php esc_html_e('Phone & Validation', 'tbc-otp'); ?></h3>
        <p class="description"><?php esc_html_e('Configure which FC native custom field stores the phone number.', 'tbc-otp'); ?></p>

        <table class="form-table">
            <?php
            $phone_slug_setting = (string) TBCOTP\Helpers::get_option('phone_field_slug', '_phone');
            ?>
            <tr>
                <th scope="row"><label for="tbc_otp_phone_field_slug"><?php esc_html_e('Phone Field', 'tbc-otp'); ?></label></th>
                <td>
                    <?php if (empty($fc_field_defs)) : ?>
                        <p class="description" style="color:#d63638;"><?php esc_html_e('No FC native custom fields found. Create fields in Fluent Community → Settings → Custom Profile Fields.', 'tbc-otp'); ?></p>
                    <?php endif; ?>

                    <select id="tbc_otp_phone_field_slug" name="tbc_otp_phone_field_slug" class="regular-text">
                        <?php foreach ($fc_field_defs as $fd) :
                            $slug = $fd['slug'] ?? '';
                            $label = $fd['label'] ?? $slug;
                            if (empty($slug)) continue;
                        ?>
                            <option value="<?php echo esc_attr($slug); ?>" <?php selected($phone_slug_setting, $slug); ?>>
                                <?php echo esc_html($label); ?> &mdash; <?php echo esc_html($slug); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                    <p class="description"><?php esc_html_e('The FC native custom field used for phone number storage and OTP.', 'tbc-otp'); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row"><?php esc_html_e('Prevent Duplicate Phones', 'tbc-otp'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_otp_restrict_duplicates" value="1" <?php checked(1, TBCOTP\Helpers::get_option('restrict_duplicates', false)); ?> />
                        <?php esc_html_e('Prevent the same phone number from being used on multiple accounts.', 'tbc-otp'); ?>
                    </label>
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="tbc_otp_blocked_numbers"><?php esc_html_e('Blocked Numbers', 'tbc-otp'); ?></label></th>
                <td>
                    <textarea id="tbc_otp_blocked_numbers" name="tbc_otp_blocked_numbers" rows="4" cols="50" class="large-text"><?php echo esc_textarea((string) TBCOTP\Helpers::get_option('blocked_numbers', '')); ?></textarea>
                    <p class="description"><?php esc_html_e('One number per line in E.164 format (e.g. +12145551234).', 'tbc-otp'); ?></p>
                </td>
            </tr>
        </table>

        <h3><?php esc_html_e('Developer / Testing', 'tbc-otp'); ?></h3>
        <table class="form-table">
            <tr>
                <th scope="row"><?php esc_html_e('Disable Rate Limiting', 'tbc-otp'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_otp_disable_rate_limit" value="1" <?php checked(1, TBCOTP\Helpers::get_option('disable_rate_limit', false)); ?> />
                        <?php esc_html_e("Disable FluentCommunity's auth rate limiting (for testing only).", 'tbc-otp'); ?>
                    </label>
                </td>
            </tr>
        </table>

        <?php submit_button(__('Save OTP Settings', 'tbc-otp')); ?>
    </form>

    <div class="tbc-otp-footer" style="margin-top:20px;padding:16px;background:#f9f9f9;border:1px solid #e0e0e0;border-radius:6px;">
        <p><strong><?php esc_html_e('Version:', 'tbc-otp'); ?></strong> <?php echo esc_html(TBC_OTP_VERSION); ?></p>
        <p>
            <a href="https://console.twilio.com/us1/develop/verify/overview" target="_blank" class="button button-secondary">
                <span class="dashicons dashicons-external" style="vertical-align:middle;margin-right:4px;"></span>
                <?php esc_html_e('View Twilio Verify Logs', 'tbc-otp'); ?>
            </a>
        </p>
    </div>

    <!-- Data Management -->
    <div class="tbc-otp-section" style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #c3c4c7;">
        <h2><?php esc_html_e('Data Management', 'tbc-otp'); ?></h2>
        <table class="form-table">
            <tr>
                <th scope="row"><?php esc_html_e('Uninstall Behavior', 'tbc-otp'); ?></th>
                <td>
                    <label>
                        <input type="checkbox"
                               id="tbc_otp_delete_data_on_uninstall"
                               name="tbc_otp_delete_data_on_uninstall"
                               value="1"
                               <?php checked(get_option('tbc_otp_delete_data_on_uninstall', false)); ?> />
                        <?php esc_html_e('Delete all plugin data when uninstalled', 'tbc-otp'); ?>
                    </label>
                    <p class="description"><?php esc_html_e('When enabled, uninstalling this plugin will permanently remove all OTP settings and Twilio configuration.', 'tbc-otp'); ?></p>
                    <?php wp_nonce_field('tbc_otp_data_mgmt', 'tbc_otp_data_mgmt_nonce'); ?>
                    <button type="button" class="button button-secondary" style="margin-top: 8px;" onclick="
                        var cb = document.getElementById('tbc_otp_delete_data_on_uninstall');
                        var nonce = document.querySelector('[name=tbc_otp_data_mgmt_nonce]').value;
                        fetch(ajaxurl, {
                            method: 'POST',
                            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                            body: 'action=tbc_otp_save_uninstall_pref&value=' + (cb.checked ? '1' : '0') + '&_wpnonce=' + nonce
                        }).then(function(r) { return r.json(); }).then(function(d) {
                            if (d.success) { alert('<?php echo esc_js(__('Saved.', 'tbc-otp')); ?>'); }
                        });
                    "><?php esc_html_e('Save Preference', 'tbc-otp'); ?></button>
                </td>
            </tr>
        </table>
    </div>

</div>
