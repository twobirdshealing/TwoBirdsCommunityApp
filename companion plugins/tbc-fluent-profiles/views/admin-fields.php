<?php
/**
 * Admin Fields View
 * Card grid for managing custom profile fields + edit modal.
 *
 * Variables available:
 *   $fields           - array of field definitions (keyed by field key)
 *   $type_registry    - array of supported field types
 *   $visibility_levels - array of visibility level labels
 *
 * @package TBC_Fluent_Profiles
 */

defined('ABSPATH') || exit;

// Sort by order
uasort($fields, function ($a, $b) {
    return ($a['order'] ?? 999) - ($b['order'] ?? 999);
});
?>

<div class="wrap tbc-fp-admin">
    <h1><?php esc_html_e('TBC Fluent Profiles', 'tbc-fluent-profiles'); ?></h1>
    <p class="tbc-fp-subtitle"><?php esc_html_e('Custom profile fields, OTP verification, and registration settings.', 'tbc-fluent-profiles'); ?></p>

    <?php settings_errors(TBCFluentProfiles\Fields::OPTION_KEY); ?>
    <?php settings_errors('tbc_fp_settings_otp'); ?>
    <?php settings_errors('tbc_fp_settings_profile_completion'); ?>
    <?php settings_errors('tbc_fp_settings_bot_protection'); ?>

    <!-- Tab Navigation -->
    <nav class="nav-tab-wrapper tbc-fp-tabs">
        <a href="#tbc-fp-tab-fields" class="nav-tab nav-tab-active" data-tab="fields"><?php esc_html_e('Profile Fields', 'tbc-fluent-profiles'); ?></a>
        <a href="#tbc-fp-tab-otp" class="nav-tab" data-tab="otp"><?php esc_html_e('OTP / Twilio', 'tbc-fluent-profiles'); ?></a>
        <a href="#tbc-fp-tab-profile-completion" class="nav-tab" data-tab="profile-completion"><?php esc_html_e('Profile Completion', 'tbc-fluent-profiles'); ?></a>
        <a href="#tbc-fp-tab-bot-protection" class="nav-tab" data-tab="bot-protection"><?php esc_html_e('Bot Protection', 'tbc-fluent-profiles'); ?></a>
    </nav>

    <!-- Tab: Profile Fields -->
    <div id="tbc-fp-tab-fields" class="tbc-fp-tab-panel tbc-fp-tab-panel--active">
    <form method="post" action="">
        <?php settings_fields('tbc_fp_settings'); ?>

        <div id="tbc-fp-fields-grid" class="tbc-fp-fields-grid">
            <?php foreach ($fields as $key => $field) :
                $type_config = $type_registry[$field['type'] ?? 'text'] ?? $type_registry['text'];
            ?>
            <div class="tbc-fp-card" data-id="<?php echo esc_attr($key); ?>">
                <!-- Hidden form fields -->
                <input type="hidden" class="tbc-fp-data-key"         name="<?php echo esc_attr(TBCFluentProfiles\Fields::OPTION_KEY); ?>[<?php echo esc_attr($key); ?>][key]"                 value="<?php echo esc_attr($field['key'] ?? $key); ?>">
                <input type="hidden" class="tbc-fp-data-label"       name="<?php echo esc_attr(TBCFluentProfiles\Fields::OPTION_KEY); ?>[<?php echo esc_attr($key); ?>][label]"               value="<?php echo esc_attr($field['label'] ?? ''); ?>">
                <input type="hidden" class="tbc-fp-data-type"        name="<?php echo esc_attr(TBCFluentProfiles\Fields::OPTION_KEY); ?>[<?php echo esc_attr($key); ?>][type]"                value="<?php echo esc_attr($field['type'] ?? 'text'); ?>">
                <input type="hidden" class="tbc-fp-data-placeholder" name="<?php echo esc_attr(TBCFluentProfiles\Fields::OPTION_KEY); ?>[<?php echo esc_attr($key); ?>][placeholder]"         value="<?php echo esc_attr($field['placeholder'] ?? ''); ?>">
                <input type="hidden" class="tbc-fp-data-instructions" name="<?php echo esc_attr(TBCFluentProfiles\Fields::OPTION_KEY); ?>[<?php echo esc_attr($key); ?>][instructions]"       value="<?php echo esc_attr($field['instructions'] ?? ''); ?>">
                <input type="hidden" class="tbc-fp-data-required"    name="<?php echo esc_attr(TBCFluentProfiles\Fields::OPTION_KEY); ?>[<?php echo esc_attr($key); ?>][required]"            value="<?php echo esc_attr($field['required'] ? '1' : '0'); ?>">
                <input type="hidden" class="tbc-fp-data-order"       name="<?php echo esc_attr(TBCFluentProfiles\Fields::OPTION_KEY); ?>[<?php echo esc_attr($key); ?>][order]"               value="<?php echo esc_attr($field['order'] ?? 0); ?>">
                <input type="hidden" class="tbc-fp-data-visibility"  name="<?php echo esc_attr(TBCFluentProfiles\Fields::OPTION_KEY); ?>[<?php echo esc_attr($key); ?>][visibility]"          value="<?php echo esc_attr($field['visibility'] ?? 'admins'); ?>">
                <input type="hidden" class="tbc-fp-data-allow-override" name="<?php echo esc_attr(TBCFluentProfiles\Fields::OPTION_KEY); ?>[<?php echo esc_attr($key); ?>][allow_user_override]" value="<?php echo esc_attr(!empty($field['allow_user_override']) ? '1' : '0'); ?>">
                <input type="hidden" class="tbc-fp-data-show-signup" name="<?php echo esc_attr(TBCFluentProfiles\Fields::OPTION_KEY); ?>[<?php echo esc_attr($key); ?>][show_on_signup]"      value="<?php echo esc_attr(!empty($field['show_on_signup']) ? '1' : '0'); ?>">
                <input type="hidden" class="tbc-fp-data-show-profile" name="<?php echo esc_attr(TBCFluentProfiles\Fields::OPTION_KEY); ?>[<?php echo esc_attr($key); ?>][show_in_profile]"    value="<?php echo esc_attr(!empty($field['show_in_profile']) ? '1' : '0'); ?>">
                <input type="hidden" class="tbc-fp-data-options"     name="<?php echo esc_attr(TBCFluentProfiles\Fields::OPTION_KEY); ?>[<?php echo esc_attr($key); ?>][options]"              value="<?php echo esc_attr(is_array($field['options'] ?? null) ? implode("\n", $field['options']) : ''); ?>">

                <!-- Card visual -->
                <button type="button" class="tbc-fp-card-edit" title="<?php esc_attr_e('Edit', 'tbc-fluent-profiles'); ?>">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M13.89 3.39l2.71 2.72c.46.46.42 1.24.03 1.64l-8.01 8.02-2.87.71c-.45.11-.87-.31-.76-.76l.71-2.87 8.01-8.02c.4-.39 1.18-.43 1.64.03zm-2.53 2.53l-6.88 6.88-.36 1.47 1.47-.36 6.88-6.88-1.11-1.11z"/></svg>
                </button>

                <div class="tbc-fp-card-badges">
                    <?php if (!empty($field['required'])) : ?>
                        <span class="tbc-fp-badge tbc-fp-badge-required" title="<?php esc_attr_e('Required', 'tbc-fluent-profiles'); ?>">*</span>
                    <?php endif; ?>
                    <?php if (!empty($field['show_on_signup'])) : ?>
                        <span class="tbc-fp-badge tbc-fp-badge-signup" title="<?php esc_attr_e('Shown on signup', 'tbc-fluent-profiles'); ?>">S</span>
                    <?php endif; ?>
                </div>

                <div class="tbc-fp-card-icon">
                    <?php echo esc_html($this->get_type_icon($field['type'] ?? 'text')); ?>
                </div>

                <div class="tbc-fp-card-label"><?php echo esc_html($field['label'] ?? $key); ?></div>
                <div class="tbc-fp-card-type"><?php echo esc_html($type_config['label'] ?? 'Text'); ?></div>
                <div class="tbc-fp-card-visibility">
                    <span class="tbc-fp-vis-dot tbc-fp-vis-<?php echo esc_attr($field['visibility'] ?? 'admins'); ?>"></span>
                    <?php echo esc_html($visibility_levels[$field['visibility'] ?? 'admins'] ?? 'Admins Only'); ?>
                </div>
            </div>
            <?php endforeach; ?>

            <!-- Add New Card -->
            <div class="tbc-fp-card tbc-fp-card-add" id="tbc-fp-card-add">
                <div class="tbc-fp-card-add-icon">+</div>
                <div class="tbc-fp-card-add-label"><?php esc_html_e('Add New Field', 'tbc-fluent-profiles'); ?></div>
            </div>
        </div>

        <?php submit_button(__('Save Fields', 'tbc-fluent-profiles')); ?>
    </form>
    </div><!-- /tab-fields -->

    <!-- Tab: OTP / Twilio Settings -->
    <div id="tbc-fp-tab-otp" class="tbc-fp-tab-panel" style="display:none;">
    <form method="post" action="options.php">
        <?php settings_fields('tbc_fp_settings_otp'); ?>

        <?php
        // Connection status
        $otp_sid     = TBCFluentProfiles\Helpers::get_option('twilio_sid', '');
        $otp_token   = TBCFluentProfiles\Helpers::get_option('twilio_token', '');
        $otp_svc_sid = TBCFluentProfiles\Helpers::get_option('verify_service_sid', '');

        if (empty($otp_sid) || empty($otp_token) || empty($otp_svc_sid)) : ?>
            <div class="notice notice-warning inline"><p>
                <?php esc_html_e('Configure your Twilio credentials below to enable OTP verification.', 'tbc-fluent-profiles'); ?>
            </p></div>
        <?php endif; ?>

        <h3><?php esc_html_e('Twilio Configuration', 'tbc-fluent-profiles'); ?></h3>
        <p class="description"><?php esc_html_e('Enter your Twilio credentials from the', 'tbc-fluent-profiles'); ?> <a href="https://console.twilio.com/" target="_blank">Twilio Console</a>.</p>

        <table class="form-table">
            <tr>
                <th scope="row"><label for="tbc_fp_twilio_sid"><?php esc_html_e('Account SID', 'tbc-fluent-profiles'); ?></label></th>
                <td>
                    <input type="text" id="tbc_fp_twilio_sid" name="tbc_fp_twilio_sid" value="<?php echo esc_attr((string) TBCFluentProfiles\Helpers::get_option('twilio_sid', '')); ?>" class="regular-text" />
                    <p class="description"><?php esc_html_e('Starts with "AC".', 'tbc-fluent-profiles'); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="tbc_fp_twilio_token"><?php esc_html_e('Auth Token', 'tbc-fluent-profiles'); ?></label></th>
                <td>
                    <input type="password" id="tbc_fp_twilio_token" name="tbc_fp_twilio_token" value="<?php echo esc_attr((string) TBCFluentProfiles\Helpers::get_option('twilio_token', '')); ?>" class="regular-text" />
                    <p class="description"><?php esc_html_e('Keep this secret.', 'tbc-fluent-profiles'); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="tbc_fp_verify_service_sid"><?php esc_html_e('Verify Service SID', 'tbc-fluent-profiles'); ?></label></th>
                <td>
                    <input type="text" id="tbc_fp_verify_service_sid" name="tbc_fp_verify_service_sid" value="<?php echo esc_attr((string) TBCFluentProfiles\Helpers::get_option('verify_service_sid', '')); ?>" class="regular-text" />
                    <p class="description"><?php esc_html_e('Starts with "VA". Create one at Twilio Verify Services.', 'tbc-fluent-profiles'); ?></p>
                </td>
            </tr>
        </table>

        <h3><?php esc_html_e('OTP Features', 'tbc-fluent-profiles'); ?></h3>
        <p class="description"><?php esc_html_e('Enable or disable OTP verification for each feature.', 'tbc-fluent-profiles'); ?></p>

        <table class="form-table">
            <tr>
                <th scope="row"><?php esc_html_e('Registration OTP', 'tbc-fluent-profiles'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_fp_enable_registration_verification" value="1" <?php checked(1, TBCFluentProfiles\Helpers::get_option('enable_registration_verification', true)); ?> />
                        <?php esc_html_e('Require phone OTP during registration.', 'tbc-fluent-profiles'); ?>
                    </label>
                </td>
            </tr>
            <tr>
                <th scope="row"><?php esc_html_e('Email Verification', 'tbc-fluent-profiles'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_fp_enable_email_verification" value="1" <?php checked(1, TBCFluentProfiles\Helpers::get_option('enable_email_verification', true)); ?> />
                        <?php esc_html_e('Require email verification during registration.', 'tbc-fluent-profiles'); ?>
                    </label>
                </td>
            </tr>
            <tr>
                <th scope="row"><?php esc_html_e('Password Recovery OTP', 'tbc-fluent-profiles'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_fp_enable_password_recovery" value="1" <?php checked(1, TBCFluentProfiles\Helpers::get_option('enable_password_recovery', false)); ?> />
                        <?php esc_html_e('Send OTP to phone instead of email for password recovery.', 'tbc-fluent-profiles'); ?>
                    </label>
                </td>
            </tr>
            <tr>
                <th scope="row"><?php esc_html_e('Profile Phone Change OTP', 'tbc-fluent-profiles'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_fp_enable_profile_verification" value="1" <?php checked(1, TBCFluentProfiles\Helpers::get_option('enable_profile_verification', false)); ?> />
                        <?php esc_html_e('Require OTP verification when users change their phone number.', 'tbc-fluent-profiles'); ?>
                    </label>
                </td>
            </tr>
            <tr>
                <th scope="row"><?php esc_html_e('Voice Call Fallback', 'tbc-fluent-profiles'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_fp_enable_voice_fallback" value="1" <?php checked(1, TBCFluentProfiles\Helpers::get_option('enable_voice_fallback', false)); ?> />
                        <?php esc_html_e('Show a "Try voice call" option in the OTP modal.', 'tbc-fluent-profiles'); ?>
                    </label>
                </td>
            </tr>
        </table>

        <h3><?php esc_html_e('Phone & Validation', 'tbc-fluent-profiles'); ?></h3>
        <p class="description"><?php esc_html_e('Configure phone number storage and validation rules.', 'tbc-fluent-profiles'); ?></p>

        <table class="form-table">
            <?php
            $phone_meta_setting = (string) TBCFluentProfiles\Helpers::get_option('phone_meta_key', 'auto');
            $phone_fields       = TBCFluentProfiles\Helpers::get_phone_fields();
            $is_custom          = $phone_meta_setting === 'custom';
            ?>
            <tr>
                <th scope="row"><label for="tbc_fp_phone_meta_key"><?php esc_html_e('Phone Field', 'tbc-fluent-profiles'); ?></label></th>
                <td>
                    <?php if (empty($phone_fields) && !$is_custom) : ?>
                        <p class="description" style="color:#d63638;"><?php esc_html_e('No phone fields found. Add a Phone-type field in Profile Fields, or choose Custom below.', 'tbc-fluent-profiles'); ?></p>
                    <?php endif; ?>

                    <select id="tbc_fp_phone_meta_key" name="tbc_fp_phone_meta_key" class="regular-text">
                        <?php foreach ($phone_fields as $meta_key => $label) : ?>
                            <option value="<?php echo esc_attr($meta_key); ?>" <?php selected($phone_meta_setting, $meta_key); ?>>
                                <?php echo esc_html($label); ?> &mdash; <?php echo esc_html($meta_key); ?>
                            </option>
                        <?php endforeach; ?>
                        <option value="custom" <?php selected($is_custom); ?>><?php esc_html_e('Custom meta key...', 'tbc-fluent-profiles'); ?></option>
                    </select>

                    <div id="tbc-fp-custom-meta-wrap" style="margin-top:8px;<?php echo $is_custom ? '' : 'display:none;'; ?>">
                        <input type="text" id="tbc_fp_phone_meta_key_custom" name="tbc_fp_phone_meta_key_custom" value="<?php echo esc_attr((string) TBCFluentProfiles\Helpers::get_option('phone_meta_key_custom', '')); ?>" class="regular-text" placeholder="e.g. _my_phone_meta" />
                        <p class="description"><?php esc_html_e('A wp_usermeta key from another plugin.', 'tbc-fluent-profiles'); ?></p>
                    </div>

                    <script>
                    (function(){
                        var sel = document.getElementById('tbc_fp_phone_meta_key');
                        var wrap = document.getElementById('tbc-fp-custom-meta-wrap');
                        if (sel && wrap) {
                            sel.addEventListener('change', function(){ wrap.style.display = sel.value === 'custom' ? '' : 'none'; });
                        }
                    })();
                    </script>
                </td>
            </tr>
            <tr>
                <th scope="row"><?php esc_html_e('Prevent Duplicate Phones', 'tbc-fluent-profiles'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_fp_restrict_duplicates" value="1" <?php checked(1, TBCFluentProfiles\Helpers::get_option('restrict_duplicates', false)); ?> />
                        <?php esc_html_e('Prevent the same phone number from being used on multiple accounts.', 'tbc-fluent-profiles'); ?>
                    </label>
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="tbc_fp_blocked_numbers"><?php esc_html_e('Blocked Numbers', 'tbc-fluent-profiles'); ?></label></th>
                <td>
                    <textarea id="tbc_fp_blocked_numbers" name="tbc_fp_blocked_numbers" rows="4" cols="50" class="large-text"><?php echo esc_textarea((string) TBCFluentProfiles\Helpers::get_option('blocked_numbers', '')); ?></textarea>
                    <p class="description"><?php esc_html_e('One number per line in E.164 format (e.g. +12145551234).', 'tbc-fluent-profiles'); ?></p>
                </td>
            </tr>
        </table>

        <h3><?php esc_html_e('SMS Role Management', 'tbc-fluent-profiles'); ?></h3>
        <p class="description"><?php esc_html_e('Automatically assign sms_in / sms_out WordPress roles based on a profile field. Used by the Messaging Center to control SMS eligibility.', 'tbc-fluent-profiles'); ?></p>

        <table class="form-table">
            <?php
            $sms_field_setting = (string) TBCFluentProfiles\Helpers::get_option('sms_optin_field', '');
            $sms_optin_value   = (string) TBCFluentProfiles\Helpers::get_option('sms_optin_value', 'Yes');
            $all_fields        = (new TBCFluentProfiles\Fields())->get_fields();
            $option_fields     = [];
            foreach ($all_fields as $fkey => $fdef) {
                $ftype = $fdef['type'] ?? '';
                if (in_array($ftype, ['radio', 'select', 'checkbox'], true)) {
                    $option_fields[$fkey] = $fdef;
                }
            }
            ?>
            <tr>
                <th scope="row"><label for="tbc_fp_sms_optin_field"><?php esc_html_e('SMS Opt-In Field', 'tbc-fluent-profiles'); ?></label></th>
                <td>
                    <?php if (empty($option_fields)) : ?>
                        <p class="description" style="color:#d63638;"><?php esc_html_e('No radio, select, or checkbox fields found. Create one in Profile Fields first.', 'tbc-fluent-profiles'); ?></p>
                    <?php endif; ?>

                    <select id="tbc_fp_sms_optin_field" name="tbc_fp_sms_optin_field" class="regular-text">
                        <option value=""><?php esc_html_e('— Disabled —', 'tbc-fluent-profiles'); ?></option>
                        <?php foreach ($option_fields as $fkey => $fdef) : ?>
                            <option value="<?php echo esc_attr($fkey); ?>" <?php selected($sms_field_setting, $fkey); ?>>
                                <?php echo esc_html($fdef['label'] ?? $fkey); ?> (<?php echo esc_html($fdef['type'] ?? ''); ?>)
                            </option>
                        <?php endforeach; ?>
                    </select>
                    <p class="description"><?php esc_html_e('Which profile field controls SMS opt-in/out. Leave disabled to skip automatic role assignment.', 'tbc-fluent-profiles'); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="tbc_fp_sms_optin_value"><?php esc_html_e('Opt-In Value', 'tbc-fluent-profiles'); ?></label></th>
                <td>
                    <input type="text" id="tbc_fp_sms_optin_value" name="tbc_fp_sms_optin_value" value="<?php echo esc_attr($sms_optin_value); ?>" class="regular-text" placeholder="Yes" />
                    <p class="description"><?php esc_html_e('The field value that means the user is opted IN to SMS (e.g. "Yes"). Any other value = opted out.', 'tbc-fluent-profiles'); ?></p>
                </td>
            </tr>
        </table>

        <h3><?php esc_html_e('Developer / Testing', 'tbc-fluent-profiles'); ?></h3>
        <table class="form-table">
            <tr>
                <th scope="row"><?php esc_html_e('Disable Rate Limiting', 'tbc-fluent-profiles'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_fp_disable_rate_limit" value="1" <?php checked(1, TBCFluentProfiles\Helpers::get_option('disable_rate_limit', false)); ?> />
                        <?php esc_html_e("Disable FluentCommunity's auth rate limiting (for testing only).", 'tbc-fluent-profiles'); ?>
                    </label>
                </td>
            </tr>
        </table>

        <?php submit_button(__('Save OTP Settings', 'tbc-fluent-profiles')); ?>
    </form>

    <div class="tbc-fp-otp-footer" style="margin-top:20px;padding:16px;background:#f9f9f9;border:1px solid #e0e0e0;border-radius:6px;">
        <p><strong><?php esc_html_e('Version:', 'tbc-fluent-profiles'); ?></strong> <?php echo esc_html(TBC_FP_VERSION); ?></p>
        <p>
            <a href="https://console.twilio.com/us1/develop/verify/overview" target="_blank" class="button button-secondary">
                <span class="dashicons dashicons-external" style="vertical-align:middle;margin-right:4px;"></span>
                <?php esc_html_e('View Twilio Verify Logs', 'tbc-fluent-profiles'); ?>
            </a>
        </p>
    </div>
    </div><!-- /tab-otp -->

    <!-- Tab: Profile Completion -->
    <div id="tbc-fp-tab-profile-completion" class="tbc-fp-tab-panel" style="display:none;">
    <form method="post" action="options.php">
        <?php settings_fields('tbc_fp_settings_profile_completion'); ?>

        <h3><?php esc_html_e('Profile Completion Gate', 'tbc-fluent-profiles'); ?></h3>
        <p class="description"><?php esc_html_e('Control when and how users are prompted to complete their profile after registration.', 'tbc-fluent-profiles'); ?></p>

        <table class="form-table">
            <tr>
                <th scope="row"><?php esc_html_e('Enable Gate', 'tbc-fluent-profiles'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_fp_profile_completion_enabled" value="1" <?php checked(1, TBCFluentProfiles\Helpers::get_option('profile_completion_enabled', true)); ?> />
                        <?php esc_html_e('Require users to complete their profile before accessing the community.', 'tbc-fluent-profiles'); ?>
                    </label>
                </td>
            </tr>
            <tr>
                <th scope="row"><?php esc_html_e('Disable FC Onboarding', 'tbc-fluent-profiles'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_fp_disable_fc_onboarding" value="1" <?php checked(1, TBCFluentProfiles\Helpers::get_option('disable_fc_onboarding', true)); ?> />
                        <?php esc_html_e("Hide Fluent Community's built-in onboarding/completion widget. Recommended when using this gate instead.", 'tbc-fluent-profiles'); ?>
                    </label>
                </td>
            </tr>
        </table>

        <h3><?php esc_html_e('Required Fields', 'tbc-fluent-profiles'); ?></h3>
        <p class="description"><?php esc_html_e('Choose which fields must be filled before a profile is considered complete.', 'tbc-fluent-profiles'); ?></p>

        <table class="form-table">
            <tr>
                <th scope="row"><?php esc_html_e('Bio', 'tbc-fluent-profiles'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_fp_profile_completion_require_bio" value="1" <?php checked(1, TBCFluentProfiles\Helpers::get_option('profile_completion_require_bio', true)); ?> />
                        <?php esc_html_e('Require a short bio / about-me text.', 'tbc-fluent-profiles'); ?>
                    </label>
                </td>
            </tr>
            <tr>
                <th scope="row"><?php esc_html_e('Avatar', 'tbc-fluent-profiles'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_fp_profile_completion_require_avatar" value="1" <?php checked(1, TBCFluentProfiles\Helpers::get_option('profile_completion_require_avatar', true)); ?> />
                        <?php esc_html_e('Require a profile photo / avatar.', 'tbc-fluent-profiles'); ?>
                    </label>
                </td>
            </tr>
        </table>

        <?php submit_button(__('Save Profile Completion Settings', 'tbc-fluent-profiles')); ?>
    </form>
    </div><!-- /tab-profile-completion -->

    <!-- Tab: Bot Protection -->
    <div id="tbc-fp-tab-bot-protection" class="tbc-fp-tab-panel" style="display:none;">
    <form method="post" action="options.php">
        <?php settings_fields('tbc_fp_settings_bot_protection'); ?>

        <h3><?php esc_html_e('Cloudflare Turnstile', 'tbc-fluent-profiles'); ?></h3>
        <p class="description"><?php esc_html_e('Turnstile is a free, invisible bot protection service from Cloudflare. It runs silently in the background — real users see nothing. Get your keys from', 'tbc-fluent-profiles'); ?> <a href="https://dash.cloudflare.com/?to=/:account/turnstile" target="_blank">Cloudflare Dashboard</a>.</p>

        <table class="form-table">
            <tr>
                <th scope="row"><?php esc_html_e('Enable Turnstile', 'tbc-fluent-profiles'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_fp_turnstile_enabled" value="1" <?php checked(1, TBCFluentProfiles\Helpers::get_option('turnstile_enabled', false)); ?> />
                        <?php esc_html_e('Require Turnstile verification on registration.', 'tbc-fluent-profiles'); ?>
                    </label>
                    <p class="description"><?php esc_html_e('When enabled, web registration requires a valid Turnstile token. Mobile app uses the App Token below instead.', 'tbc-fluent-profiles'); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="tbc_fp_turnstile_site_key"><?php esc_html_e('Site Key', 'tbc-fluent-profiles'); ?></label></th>
                <td>
                    <input type="text" id="tbc_fp_turnstile_site_key" name="tbc_fp_turnstile_site_key" value="<?php echo esc_attr((string) TBCFluentProfiles\Helpers::get_option('turnstile_site_key', '')); ?>" class="regular-text" placeholder="0x..." />
                    <p class="description"><?php esc_html_e('Public key — embedded in the registration form.', 'tbc-fluent-profiles'); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="tbc_fp_turnstile_secret_key"><?php esc_html_e('Secret Key', 'tbc-fluent-profiles'); ?></label></th>
                <td>
                    <input type="password" id="tbc_fp_turnstile_secret_key" name="tbc_fp_turnstile_secret_key" value="<?php echo esc_attr((string) TBCFluentProfiles\Helpers::get_option('turnstile_secret_key', '')); ?>" class="regular-text" placeholder="0x..." />
                    <p class="description"><?php esc_html_e('Secret key — used server-side to verify tokens. Keep this private.', 'tbc-fluent-profiles'); ?></p>
                </td>
            </tr>
        </table>

        <h3><?php esc_html_e('Mobile App Token', 'tbc-fluent-profiles'); ?></h3>
        <p class="description"><?php esc_html_e('The mobile app sends this token instead of Turnstile. Copy this value into your app\'s constants/config.ts as APP_TOKEN. Auto-generated on first save.', 'tbc-fluent-profiles'); ?></p>

        <table class="form-table">
            <tr>
                <th scope="row"><label for="tbc_fp_app_token"><?php esc_html_e('App Token', 'tbc-fluent-profiles'); ?></label></th>
                <td>
                    <?php $app_token = (string) TBCFluentProfiles\Helpers::get_option('app_token', ''); ?>
                    <input type="text" id="tbc_fp_app_token" name="tbc_fp_app_token" value="<?php echo esc_attr($app_token); ?>" class="regular-text code" readonly />
                    <button type="button" class="button button-secondary" onclick="
                        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                        var arr = new Uint8Array(48);
                        crypto.getRandomValues(arr);
                        var token = '';
                        for (var i = 0; i < 48; i++) token += chars.charAt(arr[i] % chars.length);
                        document.getElementById('tbc_fp_app_token').value = token;
                        document.getElementById('tbc_fp_app_token').removeAttribute('readonly');
                    "><?php esc_html_e('Regenerate', 'tbc-fluent-profiles'); ?></button>
                    <p class="description"><?php esc_html_e('Shared secret between your server and mobile app. Regenerating requires updating the app config and rebuilding.', 'tbc-fluent-profiles'); ?></p>
                </td>
            </tr>
        </table>

        <h3><?php esc_html_e('Email Protection', 'tbc-fluent-profiles'); ?></h3>

        <table class="form-table">
            <tr>
                <th scope="row"><?php esc_html_e('Block Disposable Emails', 'tbc-fluent-profiles'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_fp_block_disposable_emails" value="1" <?php checked(1, TBCFluentProfiles\Helpers::get_option('block_disposable_emails', true)); ?> />
                        <?php esc_html_e('Reject registration with known disposable email providers (~200 built-in domains).', 'tbc-fluent-profiles'); ?>
                    </label>
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="tbc_fp_blocked_emails"><?php esc_html_e('Blocked Emails & Domains', 'tbc-fluent-profiles'); ?></label></th>
                <td>
                    <textarea id="tbc_fp_blocked_emails" name="tbc_fp_blocked_emails" rows="5" cols="50" class="large-text"><?php echo esc_textarea((string) TBCFluentProfiles\Helpers::get_option('blocked_emails', '')); ?></textarea>
                    <p class="description"><?php esc_html_e('One entry per line. Add full emails (spammer@gmail.com) or domains (sketchy.com). Checked in addition to the built-in disposable list.', 'tbc-fluent-profiles'); ?></p>
                </td>
            </tr>
        </table>

        <?php submit_button(__('Save Bot Protection Settings', 'tbc-fluent-profiles')); ?>
    </form>
    </div><!-- /tab-bot-protection -->

    <!-- Data Management (shown on all tabs) -->
    <div class="tbc-fp-section" style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #c3c4c7;">
        <h2><?php esc_html_e('Data Management', 'tbc-fluent-profiles'); ?></h2>
        <table class="form-table">
            <tr>
                <th scope="row"><?php esc_html_e('Uninstall Behavior', 'tbc-fluent-profiles'); ?></th>
                <td>
                    <label>
                        <input type="checkbox"
                               id="tbc_fp_delete_data_on_uninstall"
                               name="tbc_fp_delete_data_on_uninstall"
                               value="1"
                               <?php checked(get_option('tbc_fp_delete_data_on_uninstall', false)); ?> />
                        <?php esc_html_e('Delete all plugin data when uninstalled', 'tbc-fluent-profiles'); ?>
                    </label>
                    <p class="description"><?php esc_html_e('When enabled, uninstalling this plugin will permanently remove all settings, custom field definitions, and OTP configuration. User profile data (field values) stored in user meta will also be removed. Leave unchecked to preserve data if reinstalling later.', 'tbc-fluent-profiles'); ?></p>
                    <?php wp_nonce_field('tbc_fp_data_mgmt', 'tbc_fp_data_mgmt_nonce'); ?>
                    <button type="button" class="button button-secondary" style="margin-top: 8px;" onclick="
                        var cb = document.getElementById('tbc_fp_delete_data_on_uninstall');
                        var nonce = document.querySelector('[name=tbc_fp_data_mgmt_nonce]').value;
                        fetch(ajaxurl, {
                            method: 'POST',
                            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                            body: 'action=tbc_fp_save_uninstall_pref&value=' + (cb.checked ? '1' : '0') + '&_wpnonce=' + nonce
                        }).then(function(r) { return r.json(); }).then(function(d) {
                            if (d.success) { alert('<?php echo esc_js(__('Saved.', 'tbc-fluent-profiles')); ?>'); }
                        });
                    "><?php esc_html_e('Save Preference', 'tbc-fluent-profiles'); ?></button>
                </td>
            </tr>
        </table>
    </div>

</div>

<!-- Field Editor Modal -->
<div id="tbc-fp-modal" class="tbc-fp-modal" style="display:none;">
    <div class="tbc-fp-modal-overlay"></div>
    <div class="tbc-fp-modal-panel">
        <div class="tbc-fp-modal-header">
            <h2 id="tbc-fp-modal-title"><?php esc_html_e('Edit Field', 'tbc-fluent-profiles'); ?></h2>
            <button type="button" class="tbc-fp-modal-close" title="<?php esc_attr_e('Close', 'tbc-fluent-profiles'); ?>">&times;</button>
        </div>

        <div class="tbc-fp-modal-body">
            <!-- Left column: main settings -->
            <div class="tbc-fp-modal-left">
                <div class="tbc-fp-form-group">
                    <label for="tbc-fp-field-label"><?php esc_html_e('Label', 'tbc-fluent-profiles'); ?></label>
                    <input type="text" id="tbc-fp-field-label" maxlength="50" placeholder="<?php esc_attr_e('e.g. Phone Number', 'tbc-fluent-profiles'); ?>">
                    <span class="tbc-fp-char-count"><span id="tbc-fp-label-count">0</span>/50</span>
                </div>

                <div class="tbc-fp-form-group">
                    <label for="tbc-fp-field-type"><?php esc_html_e('Field Type', 'tbc-fluent-profiles'); ?></label>
                    <select id="tbc-fp-field-type">
                        <?php foreach ($type_registry as $type_key => $type_config) : ?>
                            <option value="<?php echo esc_attr($type_key); ?>"><?php echo esc_html($type_config['label']); ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>

                <div class="tbc-fp-form-group" id="tbc-fp-placeholder-group">
                    <label for="tbc-fp-field-placeholder"><?php esc_html_e('Placeholder', 'tbc-fluent-profiles'); ?></label>
                    <input type="text" id="tbc-fp-field-placeholder" maxlength="100" placeholder="<?php esc_attr_e('e.g. Enter your phone number', 'tbc-fluent-profiles'); ?>">
                </div>

                <div class="tbc-fp-form-group">
                    <label for="tbc-fp-field-instructions"><?php esc_html_e('Instructions', 'tbc-fluent-profiles'); ?></label>
                    <input type="text" id="tbc-fp-field-instructions" maxlength="200" placeholder="<?php esc_attr_e('Help text shown below the field', 'tbc-fluent-profiles'); ?>">
                </div>

                <div class="tbc-fp-form-group tbc-fp-options-group" id="tbc-fp-options-group" style="display:none;">
                    <label for="tbc-fp-field-options"><?php esc_html_e('Options', 'tbc-fluent-profiles'); ?></label>
                    <textarea id="tbc-fp-field-options" rows="4" placeholder="<?php esc_attr_e('One option per line', 'tbc-fluent-profiles'); ?>"></textarea>
                    <p class="description"><?php esc_html_e('Enter one option per line.', 'tbc-fluent-profiles'); ?></p>
                </div>
            </div>

            <!-- Right column: settings -->
            <div class="tbc-fp-modal-right">
                <div class="tbc-fp-form-group">
                    <label for="tbc-fp-field-visibility"><?php esc_html_e('Visibility', 'tbc-fluent-profiles'); ?></label>
                    <select id="tbc-fp-field-visibility">
                        <?php foreach ($visibility_levels as $vis_key => $vis_label) : ?>
                            <option value="<?php echo esc_attr($vis_key); ?>"><?php echo esc_html($vis_label); ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>

                <div class="tbc-fp-toggle-group">
                    <label class="tbc-fp-toggle">
                        <input type="checkbox" id="tbc-fp-field-required">
                        <span class="tbc-fp-toggle-switch"></span>
                        <span class="tbc-fp-toggle-label"><?php esc_html_e('Required', 'tbc-fluent-profiles'); ?></span>
                    </label>
                </div>

                <div class="tbc-fp-toggle-group">
                    <label class="tbc-fp-toggle">
                        <input type="checkbox" id="tbc-fp-field-show-signup">
                        <span class="tbc-fp-toggle-switch"></span>
                        <span class="tbc-fp-toggle-label"><?php esc_html_e('Show on Signup', 'tbc-fluent-profiles'); ?></span>
                    </label>
                </div>

                <div class="tbc-fp-toggle-group">
                    <label class="tbc-fp-toggle">
                        <input type="checkbox" id="tbc-fp-field-show-profile">
                        <span class="tbc-fp-toggle-switch"></span>
                        <span class="tbc-fp-toggle-label"><?php esc_html_e('Show in Profile', 'tbc-fluent-profiles'); ?></span>
                    </label>
                </div>

                <div class="tbc-fp-toggle-group">
                    <label class="tbc-fp-toggle">
                        <input type="checkbox" id="tbc-fp-field-allow-override">
                        <span class="tbc-fp-toggle-switch"></span>
                        <span class="tbc-fp-toggle-label"><?php esc_html_e('User Can Override Visibility', 'tbc-fluent-profiles'); ?></span>
                    </label>
                </div>

                <hr>

                <button type="button" id="tbc-fp-delete-btn" class="button tbc-fp-delete-btn">
                    <?php esc_html_e('Delete Field', 'tbc-fluent-profiles'); ?>
                </button>
            </div>
        </div>

        <div class="tbc-fp-modal-footer">
            <button type="button" id="tbc-fp-done-btn" class="button button-primary"><?php esc_html_e('Done', 'tbc-fluent-profiles'); ?></button>
        </div>
    </div>
</div>

<?php
/**
 * Helper in Admin class scope — returns an emoji icon for a field type.
 * Called from the template above via $this-> since we're inside admin_page().
 * We define it as a method on the calling class below if not already present.
 */
?>
