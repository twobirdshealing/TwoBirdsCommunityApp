<?php
/**
 * Admin Settings View
 * Tabs: OTP/Twilio, Profile Completion.
 *
 * Profile fields are now managed natively in Fluent Community Pro → Custom Profile Fields.
 *
 * @package TBC_Registration
 */

defined('ABSPATH') || exit;

// FC native field definitions (for phone selector and SMS opt-in selector)
$fc_field_defs = TBCRegistration\Helpers::get_fc_field_definitions();
?>

<div class="wrap tbc-reg-admin">
    <h1><?php esc_html_e('TBC Registration', 'tbc-registration'); ?></h1>
    <p class="tbc-reg-subtitle"><?php esc_html_e('OTP verification, profile completion gate, and SMS role settings.', 'tbc-registration'); ?></p>
    <p class="description"><?php esc_html_e('Profile fields are now managed in Fluent Community → Settings → Custom Profile Fields.', 'tbc-registration'); ?></p>

    <?php settings_errors('tbc_reg_settings_otp'); ?>
    <?php settings_errors('tbc_reg_settings_profile_completion'); ?>
    <!-- Tab Navigation -->
    <nav class="nav-tab-wrapper tbc-reg-tabs">
        <a href="#tbc-reg-tab-otp" class="nav-tab nav-tab-active" data-tab="otp"><?php esc_html_e('OTP / Twilio', 'tbc-registration'); ?></a>
        <a href="#tbc-reg-tab-profile-completion" class="nav-tab" data-tab="profile-completion"><?php esc_html_e('Profile Completion', 'tbc-registration'); ?></a>
    </nav>

    <!-- Tab: OTP / Twilio Settings -->
    <div id="tbc-reg-tab-otp" class="tbc-reg-tab-panel tbc-reg-tab-panel--active">
    <form method="post" action="options.php">
        <?php settings_fields('tbc_reg_settings_otp'); ?>

        <?php
        // Connection status
        $otp_sid     = TBCRegistration\Helpers::get_option('twilio_sid', '');
        $otp_token   = TBCRegistration\Helpers::get_option('twilio_token', '');
        $otp_svc_sid = TBCRegistration\Helpers::get_option('verify_service_sid', '');

        if (empty($otp_sid) || empty($otp_token) || empty($otp_svc_sid)) : ?>
            <div class="notice notice-warning inline"><p>
                <?php esc_html_e('Configure your Twilio credentials below to enable OTP verification.', 'tbc-registration'); ?>
            </p></div>
        <?php endif; ?>

        <h3><?php esc_html_e('Twilio Configuration', 'tbc-registration'); ?></h3>
        <p class="description"><?php esc_html_e('Enter your Twilio credentials from the', 'tbc-registration'); ?> <a href="https://console.twilio.com/" target="_blank">Twilio Console</a>.</p>

        <table class="form-table">
            <tr>
                <th scope="row"><label for="tbc_reg_twilio_sid"><?php esc_html_e('Account SID', 'tbc-registration'); ?></label></th>
                <td>
                    <input type="text" id="tbc_reg_twilio_sid" name="tbc_reg_twilio_sid" value="<?php echo esc_attr((string) TBCRegistration\Helpers::get_option('twilio_sid', '')); ?>" class="regular-text" />
                    <p class="description"><?php esc_html_e('Starts with "AC".', 'tbc-registration'); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="tbc_reg_twilio_token"><?php esc_html_e('Auth Token', 'tbc-registration'); ?></label></th>
                <td>
                    <input type="password" id="tbc_reg_twilio_token" name="tbc_reg_twilio_token" value="<?php echo esc_attr((string) TBCRegistration\Helpers::get_option('twilio_token', '')); ?>" class="regular-text" />
                    <p class="description"><?php esc_html_e('Keep this secret.', 'tbc-registration'); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="tbc_reg_verify_service_sid"><?php esc_html_e('Verify Service SID', 'tbc-registration'); ?></label></th>
                <td>
                    <input type="text" id="tbc_reg_verify_service_sid" name="tbc_reg_verify_service_sid" value="<?php echo esc_attr((string) TBCRegistration\Helpers::get_option('verify_service_sid', '')); ?>" class="regular-text" />
                    <p class="description"><?php esc_html_e('Starts with "VA". Create one at Twilio Verify Services.', 'tbc-registration'); ?></p>
                </td>
            </tr>
        </table>

        <h3><?php esc_html_e('OTP Features', 'tbc-registration'); ?></h3>
        <p class="description"><?php esc_html_e('Enable or disable OTP verification for each feature.', 'tbc-registration'); ?></p>

        <table class="form-table">
            <tr>
                <th scope="row"><?php esc_html_e('Registration OTP', 'tbc-registration'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_reg_enable_registration_verification" value="1" <?php checked(1, TBCRegistration\Helpers::get_option('enable_registration_verification', true)); ?> />
                        <?php esc_html_e('Require phone OTP during registration.', 'tbc-registration'); ?>
                    </label>
                </td>
            </tr>
            <tr>
                <th scope="row"><?php esc_html_e('Email Verification', 'tbc-registration'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_reg_enable_email_verification" value="1" <?php checked(1, TBCRegistration\Helpers::get_option('enable_email_verification', true)); ?> />
                        <?php esc_html_e('Require email verification during registration.', 'tbc-registration'); ?>
                    </label>
                </td>
            </tr>
            <tr>
                <th scope="row"><?php esc_html_e('Password Recovery OTP', 'tbc-registration'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_reg_enable_password_recovery" value="1" <?php checked(1, TBCRegistration\Helpers::get_option('enable_password_recovery', false)); ?> />
                        <?php esc_html_e('Send OTP to phone instead of email for password recovery.', 'tbc-registration'); ?>
                    </label>
                </td>
            </tr>
            <tr>
                <th scope="row"><?php esc_html_e('Profile Phone Change OTP', 'tbc-registration'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_reg_enable_profile_verification" value="1" <?php checked(1, TBCRegistration\Helpers::get_option('enable_profile_verification', false)); ?> />
                        <?php esc_html_e('Require OTP verification when users change their phone number.', 'tbc-registration'); ?>
                    </label>
                </td>
            </tr>
            <tr>
                <th scope="row"><?php esc_html_e('Voice Call Fallback', 'tbc-registration'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_reg_enable_voice_fallback" value="1" <?php checked(1, TBCRegistration\Helpers::get_option('enable_voice_fallback', false)); ?> />
                        <?php esc_html_e('Show a "Try voice call" option in the OTP modal.', 'tbc-registration'); ?>
                    </label>
                </td>
            </tr>
        </table>

        <h3><?php esc_html_e('Phone & Validation', 'tbc-registration'); ?></h3>
        <p class="description"><?php esc_html_e('Configure which FC native custom field stores the phone number.', 'tbc-registration'); ?></p>

        <table class="form-table">
            <?php
            $phone_slug_setting = (string) TBCRegistration\Helpers::get_option('phone_field_slug', '_phone');
            ?>
            <tr>
                <th scope="row"><label for="tbc_reg_phone_field_slug"><?php esc_html_e('Phone Field', 'tbc-registration'); ?></label></th>
                <td>
                    <?php if (empty($fc_field_defs)) : ?>
                        <p class="description" style="color:#d63638;"><?php esc_html_e('No FC native custom fields found. Create fields in Fluent Community → Settings → Custom Profile Fields.', 'tbc-registration'); ?></p>
                    <?php endif; ?>

                    <select id="tbc_reg_phone_field_slug" name="tbc_reg_phone_field_slug" class="regular-text">
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
                    <p class="description"><?php esc_html_e('The FC native custom field used for phone number storage and OTP.', 'tbc-registration'); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row"><?php esc_html_e('Prevent Duplicate Phones', 'tbc-registration'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_reg_restrict_duplicates" value="1" <?php checked(1, TBCRegistration\Helpers::get_option('restrict_duplicates', false)); ?> />
                        <?php esc_html_e('Prevent the same phone number from being used on multiple accounts.', 'tbc-registration'); ?>
                    </label>
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="tbc_reg_blocked_numbers"><?php esc_html_e('Blocked Numbers', 'tbc-registration'); ?></label></th>
                <td>
                    <textarea id="tbc_reg_blocked_numbers" name="tbc_reg_blocked_numbers" rows="4" cols="50" class="large-text"><?php echo esc_textarea((string) TBCRegistration\Helpers::get_option('blocked_numbers', '')); ?></textarea>
                    <p class="description"><?php esc_html_e('One number per line in E.164 format (e.g. +12145551234).', 'tbc-registration'); ?></p>
                </td>
            </tr>
        </table>

        <h3><?php esc_html_e('SMS Role Management', 'tbc-registration'); ?></h3>
        <p class="description"><?php esc_html_e('Automatically assign sms_in / sms_out WordPress roles based on a profile field. Used by the Messaging Center to control SMS eligibility.', 'tbc-registration'); ?></p>

        <table class="form-table">
            <?php
            $sms_field_setting = (string) TBCRegistration\Helpers::get_option('sms_optin_field', '');
            $sms_optin_value   = (string) TBCRegistration\Helpers::get_option('sms_optin_value', 'Yes');
            // Filter FC native fields to ones with options (select, radio, multiselect)
            $option_fields = [];
            foreach ($fc_field_defs as $fd) {
                $ftype = $fd['type'] ?? '';
                $fslug = $fd['slug'] ?? '';
                if (!empty($fslug) && in_array($ftype, ['radio', 'select', 'multiselect'], true)) {
                    $option_fields[$fslug] = $fd;
                }
            }
            ?>
            <tr>
                <th scope="row"><label for="tbc_reg_sms_optin_field"><?php esc_html_e('SMS Opt-In Field', 'tbc-registration'); ?></label></th>
                <td>
                    <?php if (empty($option_fields)) : ?>
                        <p class="description" style="color:#d63638;"><?php esc_html_e('No select/radio fields found in FC native custom fields.', 'tbc-registration'); ?></p>
                    <?php endif; ?>

                    <select id="tbc_reg_sms_optin_field" name="tbc_reg_sms_optin_field" class="regular-text">
                        <option value=""><?php esc_html_e('— Disabled —', 'tbc-registration'); ?></option>
                        <?php foreach ($option_fields as $fslug => $fd) : ?>
                            <option value="<?php echo esc_attr($fslug); ?>" <?php selected($sms_field_setting, $fslug); ?>>
                                <?php echo esc_html($fd['label'] ?? $fslug); ?> (<?php echo esc_html($fd['type'] ?? ''); ?>)
                            </option>
                        <?php endforeach; ?>
                    </select>
                    <p class="description"><?php esc_html_e('Which FC native profile field controls SMS opt-in/out. Leave disabled to skip automatic role assignment.', 'tbc-registration'); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="tbc_reg_sms_optin_value"><?php esc_html_e('Opt-In Value', 'tbc-registration'); ?></label></th>
                <td>
                    <input type="text" id="tbc_reg_sms_optin_value" name="tbc_reg_sms_optin_value" value="<?php echo esc_attr($sms_optin_value); ?>" class="regular-text" placeholder="Yes" />
                    <p class="description"><?php esc_html_e('The field value that means the user is opted IN to SMS (e.g. "Yes"). Any other value = opted out.', 'tbc-registration'); ?></p>
                </td>
            </tr>
        </table>

        <h3><?php esc_html_e('Developer / Testing', 'tbc-registration'); ?></h3>
        <table class="form-table">
            <tr>
                <th scope="row"><?php esc_html_e('Disable Rate Limiting', 'tbc-registration'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_reg_disable_rate_limit" value="1" <?php checked(1, TBCRegistration\Helpers::get_option('disable_rate_limit', false)); ?> />
                        <?php esc_html_e("Disable FluentCommunity's auth rate limiting (for testing only).", 'tbc-registration'); ?>
                    </label>
                </td>
            </tr>
        </table>

        <?php submit_button(__('Save OTP Settings', 'tbc-registration')); ?>
    </form>

    <div class="tbc-reg-otp-footer" style="margin-top:20px;padding:16px;background:#f9f9f9;border:1px solid #e0e0e0;border-radius:6px;">
        <p><strong><?php esc_html_e('Version:', 'tbc-registration'); ?></strong> <?php echo esc_html(TBC_REG_VERSION); ?></p>
        <p>
            <a href="https://console.twilio.com/us1/develop/verify/overview" target="_blank" class="button button-secondary">
                <span class="dashicons dashicons-external" style="vertical-align:middle;margin-right:4px;"></span>
                <?php esc_html_e('View Twilio Verify Logs', 'tbc-registration'); ?>
            </a>
        </p>
    </div>
    </div><!-- /tab-otp -->

    <!-- Tab: Profile Completion -->
    <div id="tbc-reg-tab-profile-completion" class="tbc-reg-tab-panel" style="display:none;">
    <form method="post" action="options.php">
        <?php settings_fields('tbc_reg_settings_profile_completion'); ?>

        <h3><?php esc_html_e('Profile Completion Gate', 'tbc-registration'); ?></h3>
        <p class="description"><?php esc_html_e('Control when and how users are prompted to complete their profile after registration.', 'tbc-registration'); ?></p>

        <table class="form-table">
            <tr>
                <th scope="row"><?php esc_html_e('Enable Gate', 'tbc-registration'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_reg_profile_completion_enabled" value="1" <?php checked(1, TBCRegistration\Helpers::get_option('profile_completion_enabled', true)); ?> />
                        <?php esc_html_e('Require users to complete their profile before accessing the community.', 'tbc-registration'); ?>
                    </label>
                </td>
            </tr>
            <tr>
                <th scope="row"><?php esc_html_e('Disable FC Onboarding', 'tbc-registration'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_reg_disable_fc_onboarding" value="1" <?php checked(1, TBCRegistration\Helpers::get_option('disable_fc_onboarding', true)); ?> />
                        <?php esc_html_e("Hide Fluent Community's built-in onboarding/completion widget. Recommended when using this gate instead.", 'tbc-registration'); ?>
                    </label>
                </td>
            </tr>
        </table>

        <h3><?php esc_html_e('Required Fields', 'tbc-registration'); ?></h3>
        <p class="description"><?php esc_html_e('Choose which fields must be filled before a profile is considered complete.', 'tbc-registration'); ?></p>

        <table class="form-table">
            <tr>
                <th scope="row"><?php esc_html_e('Bio', 'tbc-registration'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_reg_profile_completion_require_bio" value="1" <?php checked(1, TBCRegistration\Helpers::get_option('profile_completion_require_bio', true)); ?> />
                        <?php esc_html_e('Require a short bio / about-me text.', 'tbc-registration'); ?>
                    </label>
                </td>
            </tr>
            <tr>
                <th scope="row"><?php esc_html_e('Avatar', 'tbc-registration'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_reg_profile_completion_require_avatar" value="1" <?php checked(1, TBCRegistration\Helpers::get_option('profile_completion_require_avatar', true)); ?> />
                        <?php esc_html_e('Require a profile photo / avatar.', 'tbc-registration'); ?>
                    </label>
                </td>
            </tr>
        </table>

        <?php submit_button(__('Save Profile Completion Settings', 'tbc-registration')); ?>
    </form>
    </div><!-- /tab-profile-completion -->

    <!-- Data Management (shown on all tabs) -->
    <div class="tbc-reg-section" style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #c3c4c7;">
        <h2><?php esc_html_e('Data Management', 'tbc-registration'); ?></h2>
        <table class="form-table">
            <tr>
                <th scope="row"><?php esc_html_e('Uninstall Behavior', 'tbc-registration'); ?></th>
                <td>
                    <label>
                        <input type="checkbox"
                               id="tbc_reg_delete_data_on_uninstall"
                               name="tbc_reg_delete_data_on_uninstall"
                               value="1"
                               <?php checked(get_option('tbc_reg_delete_data_on_uninstall', false)); ?> />
                        <?php esc_html_e('Delete all plugin data when uninstalled', 'tbc-registration'); ?>
                    </label>
                    <p class="description"><?php esc_html_e('When enabled, uninstalling this plugin will permanently remove all settings and OTP configuration. User profile data is now stored in FC native custom fields and will NOT be removed.', 'tbc-registration'); ?></p>
                    <?php wp_nonce_field('tbc_reg_data_mgmt', 'tbc_reg_data_mgmt_nonce'); ?>
                    <button type="button" class="button button-secondary" style="margin-top: 8px;" onclick="
                        var cb = document.getElementById('tbc_reg_delete_data_on_uninstall');
                        var nonce = document.querySelector('[name=tbc_reg_data_mgmt_nonce]').value;
                        fetch(ajaxurl, {
                            method: 'POST',
                            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                            body: 'action=tbc_reg_save_uninstall_pref&value=' + (cb.checked ? '1' : '0') + '&_wpnonce=' + nonce
                        }).then(function(r) { return r.json(); }).then(function(d) {
                            if (d.success) { alert('<?php echo esc_js(__('Saved.', 'tbc-registration')); ?>'); }
                        });
                    "><?php esc_html_e('Save Preference', 'tbc-registration'); ?></button>
                </td>
            </tr>
        </table>
    </div>

</div>
