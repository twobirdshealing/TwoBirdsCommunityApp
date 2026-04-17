<?php
/**
 * Admin Settings View — Profile Completion
 *
 * @package TBC_ProfileCompletion
 */

defined('ABSPATH') || exit;
?>

<div class="wrap tbc-pcom-admin">
    <h1><?php esc_html_e('TBC Profile Completion', 'tbc-pcom'); ?></h1>
    <p class="tbc-pcom-subtitle"><?php esc_html_e('Require users to complete their profile (bio + avatar) before accessing the community.', 'tbc-pcom'); ?></p>

    <?php settings_errors('tbc_pcom_settings'); ?>

    <form method="post" action="options.php">
        <?php settings_fields('tbc_pcom_settings'); ?>

        <h3><?php esc_html_e('Profile Completion Gate', 'tbc-pcom'); ?></h3>
        <p class="description"><?php esc_html_e('Control when and how users are prompted to complete their profile after registration.', 'tbc-pcom'); ?></p>

        <table class="form-table">
            <tr>
                <th scope="row"><?php esc_html_e('Enable Gate', 'tbc-pcom'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_pcom_enabled" value="1" <?php checked(1, TBCPcom\ProfileGate::get_option('enabled', true)); ?> />
                        <?php esc_html_e('Require users to complete their profile before accessing the community.', 'tbc-pcom'); ?>
                    </label>
                </td>
            </tr>
            <tr>
                <th scope="row"><?php esc_html_e('Disable FC Onboarding', 'tbc-pcom'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_pcom_disable_fc_onboarding" value="1" <?php checked(1, TBCPcom\ProfileGate::get_option('disable_fc_onboarding', true)); ?> />
                        <?php esc_html_e("Hide Fluent Community's built-in onboarding/completion widget. Recommended when using this gate instead.", 'tbc-pcom'); ?>
                    </label>
                </td>
            </tr>
        </table>

        <h3><?php esc_html_e('Required Fields', 'tbc-pcom'); ?></h3>
        <p class="description"><?php esc_html_e('Choose which fields must be filled before a profile is considered complete.', 'tbc-pcom'); ?></p>

        <table class="form-table">
            <tr>
                <th scope="row"><?php esc_html_e('Bio', 'tbc-pcom'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_pcom_require_bio" value="1" <?php checked(1, TBCPcom\ProfileGate::get_option('require_bio', true)); ?> />
                        <?php esc_html_e('Require a short bio / about-me text.', 'tbc-pcom'); ?>
                    </label>
                </td>
            </tr>
            <tr>
                <th scope="row"><?php esc_html_e('Avatar', 'tbc-pcom'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="tbc_pcom_require_avatar" value="1" <?php checked(1, TBCPcom\ProfileGate::get_option('require_avatar', true)); ?> />
                        <?php esc_html_e('Require a profile photo / avatar.', 'tbc-pcom'); ?>
                    </label>
                </td>
            </tr>
        </table>

        <?php submit_button(__('Save Profile Completion Settings', 'tbc-pcom')); ?>
    </form>

    <!-- Data Management -->
    <div class="tbc-pcom-section" style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #c3c4c7;">
        <h2><?php esc_html_e('Data Management', 'tbc-pcom'); ?></h2>
        <table class="form-table">
            <tr>
                <th scope="row"><?php esc_html_e('Uninstall Behavior', 'tbc-pcom'); ?></th>
                <td>
                    <label>
                        <input type="checkbox"
                               id="tbc_pcom_delete_data_on_uninstall"
                               name="tbc_pcom_delete_data_on_uninstall"
                               value="1"
                               <?php checked(get_option('tbc_pcom_delete_data_on_uninstall', false)); ?> />
                        <?php esc_html_e('Delete all plugin data when uninstalled', 'tbc-pcom'); ?>
                    </label>
                    <p class="description"><?php esc_html_e('When enabled, uninstalling this plugin will permanently remove all profile completion settings. User profile data (bio, avatar) is stored in Fluent Community and will NOT be removed.', 'tbc-pcom'); ?></p>
                    <?php wp_nonce_field('tbc_pcom_data_mgmt', 'tbc_pcom_data_mgmt_nonce'); ?>
                    <button type="button" class="button button-secondary" style="margin-top: 8px;" onclick="
                        var cb = document.getElementById('tbc_pcom_delete_data_on_uninstall');
                        var nonce = document.querySelector('[name=tbc_pcom_data_mgmt_nonce]').value;
                        fetch(ajaxurl, {
                            method: 'POST',
                            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                            body: 'action=tbc_pcom_save_uninstall_pref&value=' + (cb.checked ? '1' : '0') + '&_wpnonce=' + nonce
                        }).then(function(r) { return r.json(); }).then(function(d) {
                            if (d.success) { alert('<?php echo esc_js(__('Saved.', 'tbc-pcom')); ?>'); }
                        });
                    "><?php esc_html_e('Save Preference', 'tbc-pcom'); ?></button>
                </td>
            </tr>
        </table>
    </div>

</div>
