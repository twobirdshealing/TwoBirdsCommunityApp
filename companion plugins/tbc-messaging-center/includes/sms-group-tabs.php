<?php
/**
 * BuddyPress Group "Send SMS" Tab with Group SMS Form
 */

// Register the 'Send SMS' tab in BuddyPress groups
add_action( 'bp_setup_nav', 'tbc_mc_register_sms_tab' );
function tbc_mc_register_sms_tab() {
    if (
        ! function_exists( 'bp_core_new_subnav_item' ) ||
        ! function_exists( 'bp_is_groups_component' ) ||
        ! function_exists( 'groups_get_current_group' ) ||
        ! is_user_logged_in()
    ) {
        return;
    }

    if ( ! bp_is_groups_component() || ! bp_is_single_item() ) {
        return;
    }

    $user_id = get_current_user_id();
    $group   = groups_get_current_group();

    if ( ! $group || empty( $group->id ) ) {
        return;
    }

    $group_id       = intval( $group->id );
    $sms_permission = groups_get_groupmeta( $group_id, 'sms_permission' );
    $show_tab       = false;

    switch ( $sms_permission ) {
        case 'all_members':
            $show_tab = true;
            break;
        case 'orgs_mods':
            $show_tab = groups_is_user_admin( $user_id, $group_id ) || groups_is_user_mod( $user_id, $group_id );
            break;
        case 'organizers':
            $show_tab = groups_is_user_admin( $user_id, $group_id );
            break;
        case 'off':
        default:
            $show_tab = false;
            break;
    }

    if ( ! $show_tab ) {
        return;
    }

    $tab_args = array(
        'name'                => esc_html__( 'Send SMS', 'default' ),
        'slug'                => 'send-sms',
        'screen_function'     => 'tbc_mc_sms_tab_screen',
        'position'            => 60,
        'parent_url'          => bp_get_group_permalink( $group ),
        'parent_slug'         => $group->slug,
        'default_subnav_slug' => 'send-sms',
        'item_css_id'         => 'send-sms',
    );

    bp_core_new_subnav_item( $tab_args, 'groups' );
}

// Set the screen content for the "Send SMS" tab
function tbc_mc_sms_tab_screen() {
    add_action( 'bp_template_title', 'tbc_mc_sms_tab_title' );
    add_action( 'bp_template_content', 'tbc_mc_sms_tab_content' );
    bp_core_load_template( 'buddypress/members/single/plugins' );
}

function tbc_mc_sms_tab_title() {
    echo esc_html__( 'Send SMS', 'default' );
}

function tbc_mc_sms_tab_content() {
    $group = groups_get_current_group();

    if ( ! $group || empty( $group->id ) ) {
        echo '<div class="bp-feedback error">' . esc_html__( 'Group not found.', 'default' ) . '</div>';
        return;
    }

    echo tbc_mc_render_group_sms_form( $group->id );
}

// Render the SMS form directly (formerly shortcode handler)
function tbc_mc_render_group_sms_form( $group_id ) {
    $contact_list_data = tbc_mc_generate_contact_list( $group_id );
    $contact_list_html = $contact_list_data['html'];
    $total_users       = $contact_list_data['total_users'];
    $opted_out_count   = $contact_list_data['opted_out_count'];

    ob_start();

    echo '<div id="feedback"></div>';

    $message = sprintf(
        esc_html__('%1$d users loaded! %2$d users have opted out.', 'twobirdschurch'),
        $total_users,
        $opted_out_count
    );
    echo tbc_mc_feedback_html( 'success', $message );

    echo '<div class="tbc-mc-sms-group-container">' . tbc_mc_render_sms_form(
        'send_sms_action',
        'send_sms_nonce',
        $contact_list_html
    ) . '</div>';

    return ob_get_clean();
}

// Generate the group contact list
function tbc_mc_generate_contact_list( $group_id ) {
    $group         = new BP_Groups_Group( $group_id );
    $members       = groups_get_group_members([
        'group_id'           => $group_id,
        'exclude_admins_mods'=> 0,
        'exclude_banned'     => 0,
        'per_page'           => 10000
    ]);

    $total_users     = count($members['members']);
    $opted_out_count = 0;

    $html  = '<h3>' . esc_html__('Group:', 'twobirdschurch') . ' ' . esc_html($group->name) . '</h3>';
    $html .= '<label for="check_all"><input id="check_all" type="checkbox" /> ' . esc_html__('Check/Uncheck All', 'twobirdschurch') . '</label>';
    $html .= '<ul class="tbc-mc-contact-list">';

    foreach ( $members['members'] as $member ) {
        $first_name   = get_user_meta($member->ID, 'first_name', true);
        $last_name    = get_user_meta($member->ID, 'last_name', true);
        $phone        = tbc_mc_get_phone_from_profile($member->ID);
        $user_roles   = (array) get_userdata($member->ID)->roles;
        $is_sms_out   = in_array('sms_out', $user_roles, true);

        if ( $is_sms_out ) {
            $opted_out_count++;
        }

        $display_name = esc_html("{$first_name} {$last_name} - " . ($phone ?: __('N/A', 'twobirdschurch')));

        if ( $is_sms_out ) {
            $html .= "<li style='text-decoration: line-through;'>{$display_name}</li>";
        } else {
            $html .= "<li><input type='checkbox' name='members[]' value='" . esc_attr($phone) . "' data-phone='" . esc_attr($phone) . "' data-name='" . esc_attr("{$first_name} {$last_name}") . "' class='user-checkbox'> {$display_name}</li>";
        }
    }

    $html .= '</ul>';

    return [
        'html'            => $html,
        'total_users'     => $total_users,
        'opted_out_count' => $opted_out_count,
    ];
}