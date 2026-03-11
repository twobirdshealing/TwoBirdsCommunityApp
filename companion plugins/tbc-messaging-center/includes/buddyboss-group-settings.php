<?php
function tbc_mc_group_metabox() {
    add_meta_box(
        'sms_call_group_setting_id',
        __('SMS/Call Settings', 'textdomain'),
        'tbc_mc_group_settings_html',
        get_current_screen()->id,
        'side',
        'core'
    );
}
add_action('bp_groups_admin_meta_boxes', 'tbc_mc_group_metabox');

function tbc_mc_group_settings_html($item) {
    $group_id = isset($_GET['gid']) ? $_GET['gid'] : 0;
    // Fetch existing settings or set default to 'off'
    $sms_setting = groups_get_groupmeta($group_id, 'sms_permission') ?: 'off';
    $call_setting = groups_get_groupmeta($group_id, 'call_permission') ?: 'off';
    
    // Define options, including 'off'
    $options = [
        'off' => __('Do Not Show', 'textdomain'),
        'all_members' => __('All Members', 'textdomain'),
        'orgs_mods' => __('Organizers and Moderators', 'textdomain'),
        'organizers' => __('Organizers', 'textdomain'),
    ];

    // SMS Settings
    echo '<div><strong>' . __('SMS Settings', 'textdomain') . '</strong>';
    foreach ($options as $value => $label) {
        echo '<div>';
        echo '<label>';
        echo '<input type="radio" name="sms_permission" value="' . esc_attr($value) . '"' . checked($sms_setting, $value, false) . '/>';
        echo esc_html($label);
        echo '</label>';
        echo '</div>';
    }
    echo '</div>';

    // Call Settings
    echo '<div><strong>' . __('Call Settings', 'textdomain') . '</strong>';
    foreach ($options as $value => $label) {
        echo '<div>';
        echo '<label>';
        echo '<input type="radio" name="call_permission" value="' . esc_attr($value) . '"' . checked($call_setting, $value, false) . '/>';
        echo esc_html($label);
        echo '</label>';
        echo '</div>';
    }
    echo '</div>';

    wp_nonce_field('tbc_mc_save_group_settings', 'sms_call_group_setting_nonce');
}

function tbc_mc_save_group_settings($group_id) {
    if (isset($_POST['sms_call_group_setting_nonce']) && wp_verify_nonce($_POST['sms_call_group_setting_nonce'], 'tbc_mc_save_group_settings')) {
        // Save SMS setting
        if (isset($_POST['sms_permission'])) {
            $sms_permission = $_POST['sms_permission'];
            groups_update_groupmeta($group_id, 'sms_permission', $sms_permission);
        }

        // Save Call setting
        if (isset($_POST['call_permission'])) {
            $call_permission = $_POST['call_permission'];
            groups_update_groupmeta($group_id, 'call_permission', $call_permission);
        }
    }
}
add_action('bp_group_admin_edit_after', 'tbc_mc_save_group_settings');