<?php
/**
 * Admin Settings View — OTP Registration Verification
 *
 * @package TBC_OTP
 */

defined('ABSPATH') || exit;

$fc_field_defs       = TBCOTP\Admin::get_fc_field_definitions();
$cpf_enabled         = TBCOTP\Admin::is_custom_profile_fields_enabled();
$has_fc_pro          = TBCOTP\Admin::has_fluent_community_pro();
$phone_slug_setting  = (string) TBCOTP\Helpers::get_option('phone_field_slug', '');
$needs_phone_setup   = !$cpf_enabled || empty($phone_slug_setting) || empty($fc_field_defs);
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
                <th scope="row"><?php esc_html_e('Email 2FA', 'tbc-otp'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_otp_enable_email_2fa" value="1" <?php checked(1, TBCOTP\Helpers::get_option('enable_email_2fa', false)); ?> />
                        <?php esc_html_e('Require email verification during registration.', 'tbc-otp'); ?>
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
        </table>

        <h3><?php esc_html_e('Phone & Validation', 'tbc-otp'); ?></h3>
        <p class="description"><?php esc_html_e('Configure which FC native custom field stores the phone number.', 'tbc-otp'); ?></p>

        <table class="form-table">
            <tr>
                <th scope="row"><label for="tbc_otp_phone_field_slug"><?php esc_html_e('Phone Field', 'tbc-otp'); ?></label></th>
                <td>
                    <select id="tbc_otp_phone_field_slug" name="tbc_otp_phone_field_slug" class="regular-text">
                        <option value="" <?php selected($phone_slug_setting, ''); ?>><?php esc_html_e('— Select a field —', 'tbc-otp'); ?></option>
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
                    <p class="description">
                        <?php esc_html_e('The FC native custom field used for phone number storage and OTP.', 'tbc-otp'); ?>
                        <?php if ($cpf_enabled) : ?>
                            <a href="<?php echo esc_url(admin_url('admin.php?page=fluent-community#/admin/custom-profile-fields')); ?>" target="_blank">
                                <?php esc_html_e('Edit in Fluent Community &rarr;', 'tbc-otp'); ?>
                            </a>
                        <?php endif; ?>
                    </p>

                    <?php if ($needs_phone_setup) : ?>
                        <div class="tbc-otp-phone-setup" style="margin-top:10px;padding:10px 12px;background:#fcf9e8;border-left:4px solid #dba617;">
                            <?php if (!$cpf_enabled) : ?>
                                <p style="margin:0 0 8px;">
                                    <strong><?php esc_html_e("Fluent Community's Custom Profile Fields feature is disabled.", 'tbc-otp'); ?></strong>
                                    <?php esc_html_e('OTP needs a phone custom field to attach to.', 'tbc-otp'); ?>
                                </p>
                            <?php elseif (empty($fc_field_defs)) : ?>
                                <p style="margin:0 0 8px;">
                                    <strong><?php esc_html_e('No custom profile fields exist yet.', 'tbc-otp'); ?></strong>
                                </p>
                            <?php else : ?>
                                <p style="margin:0 0 8px;">
                                    <?php esc_html_e('Pick an existing field above, or let OTP create one for you.', 'tbc-otp'); ?>
                                </p>
                            <?php endif; ?>

                            <?php if ($has_fc_pro) : ?>
                                <button type="button" class="button button-primary" id="tbc-otp-setup-phone-btn"
                                        data-nonce="<?php echo esc_attr(wp_create_nonce('tbc_otp_setup_phone_field')); ?>">
                                    <?php esc_html_e('Run one-click phone field setup', 'tbc-otp'); ?>
                                </button>
                                <span class="description" style="margin-left:8px;">
                                    <?php esc_html_e('Enables Custom Profile Fields, creates a Phone field, and links it here.', 'tbc-otp'); ?>
                                </span>
                            <?php else : ?>
                                <p class="description" style="margin:0;color:#d63638;">
                                    <?php esc_html_e('Custom Profile Fields requires Fluent Community Pro. Install and activate Fluent Community Pro to continue.', 'tbc-otp'); ?>
                                </p>
                            <?php endif; ?>
                        </div>
                    <?php endif; ?>
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

        <h2 style="margin-top:30px;padding-top:20px;border-top:1px solid #c3c4c7;"><?php esc_html_e('Data Management', 'tbc-otp'); ?></h2>
        <table class="form-table">
            <tr>
                <th scope="row"><?php esc_html_e('Uninstall Behavior', 'tbc-otp'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_otp_delete_data_on_uninstall" value="1" <?php checked(1, TBCOTP\Helpers::get_option('delete_data_on_uninstall', false)); ?> />
                        <?php esc_html_e('Delete all plugin data when uninstalled', 'tbc-otp'); ?>
                    </label>
                    <p class="description"><?php esc_html_e('When enabled, uninstalling this plugin permanently removes all settings including Twilio credentials and any in-flight OTP session transients. Leave disabled if you uninstall for testing and want to keep your Twilio configuration.', 'tbc-otp'); ?></p>
                </td>
            </tr>
        </table>

        <?php submit_button(__('Save OTP Settings', 'tbc-otp')); ?>
    </form>

    <div class="tbc-otp-footer" style="margin-top:20px;padding:16px;background:#f9f9f9;border:1px solid #e0e0e0;border-radius:6px;">
        <p>
            <a href="https://console.twilio.com/us1/develop/verify/overview" target="_blank" class="button button-secondary">
                <span class="dashicons dashicons-external" style="vertical-align:middle;margin-right:4px;"></span>
                <?php esc_html_e('View Twilio Verify Logs', 'tbc-otp'); ?>
            </a>
        </p>
    </div>

</div>
