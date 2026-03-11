<?php
/**
 * BuddyPress Group "Initiate Call" Tab
 */

// Register the tab
add_action('bp_setup_nav', 'tbc_mc_register_call_tab');
function tbc_mc_register_call_tab() {
    if ( ! function_exists('bp_core_new_subnav_item') || 
         ! function_exists('bp_is_single_item') || 
         ! function_exists('bp_is_groups_component') || 
         ! function_exists('bp_get_group_permalink') || 
         empty(get_current_user_id()) ) {
        return;
    }

    if ( bp_is_groups_component() && bp_is_single_item() ) {
        global $bp;
        $user_id = get_current_user_id();
        $group_id = $bp->groups->current_group->id;
        $call_permission = groups_get_groupmeta($group_id, 'call_permission');

        $show_tab = false;
        switch ($call_permission) {
            case 'all_members':
                $show_tab = true;
                break;
            case 'orgs_mods':
                $show_tab = groups_is_user_admin($user_id, $group_id) || groups_is_user_mod($user_id, $group_id);
                break;
            case 'organizers':
                $show_tab = groups_is_user_admin($user_id, $group_id);
                break;
        }

        if ($show_tab) {
            $group_link = bp_get_group_permalink($bp->groups->current_group);
            $tab_args = array(
                'name'                => esc_html__('Initiate Call', 'default'),
                'slug'                => 'initiate-call',
                'screen_function'     => 'tbc_mc_call_tab_screen',
                'position'            => 70,
                'parent_url'          => $group_link,
                'parent_slug'         => $bp->groups->current_group->slug,
                'default_subnav_slug' => 'initiate-call',
                'item_css_id'         => 'initiate-call'
            );

            bp_core_new_subnav_item($tab_args, 'groups');
        }
    }
}

// Set screen output
function tbc_mc_call_tab_screen() {
    add_action('bp_template_title', 'tbc_mc_call_tab_title');
    add_action('bp_template_content', 'tbc_mc_call_tab_content');
    bp_core_load_template('buddypress/members/single/plugins');
}

function tbc_mc_call_tab_title() {
    echo esc_html__('Initiate Call', 'default');
}

function tbc_mc_call_tab_content() {
    global $bp;
    $group_id = $bp->groups->current_group->id;
    echo tbc_mc_render_group_call_form($group_id);
}

// Render call form (formerly call_form_shortcode)
function tbc_mc_render_group_call_form($group_id) {
    $current_user_id = get_current_user_id();
    $personal_phone_number = tbc_mc_get_phone_from_profile($current_user_id);

    if (isset($_POST['call_nonce']) && wp_verify_nonce($_POST['call_nonce'], 'initiate_call_action')) {
        $destination_number = sanitize_text_field($_POST['destination_number']);
        $feedback = tbc_mc_initiate_call($destination_number, $personal_phone_number);
        
        echo tbc_mc_feedback_html($feedback['type'], $feedback['message']);
    }

    ob_start();
    ?>
    <p class="no-margin-bottom">My Number: <?php echo esc_html($personal_phone_number); ?></p>
    <p class="tooltip no-margin-top">
        Make sure this number is correct; it will be called first. To update your number, visit your 
        <a href="https://community.twobirdschurch.com/directory/me/profile/edit/group/1/">profile</a>.
    </p>

    <h3 class="no-margin-bottom">Contact List</h3>
    <p class="tooltip no-margin-top no-margin-bottom">Check the name of the person you would like to call</p>

    <form id="initiate_call_form" action="" method="post">
        <?php echo wp_nonce_field('initiate_call_action', 'call_nonce', true, false); ?>

        <?php if ($group_id) :
            $members = groups_get_group_members(array(
                'group_id' => $group_id,
                'exclude_admins_mods' => 0,
                'exclude_banned' => 0,
                'per_page' => 10000
            ));

            echo '<ul class="tbc-mc-contact-list">';
            foreach ($members['members'] as $member) {
                $first_name = get_user_meta($member->ID, 'first_name', true);
                $last_name  = get_user_meta($member->ID, 'last_name', true);
                $phone      = tbc_mc_get_phone_from_profile($member->ID);
                $display_name = esc_html($first_name . ' ' . $last_name . ' - ' . $phone);

                echo '<li>';
                echo '<input type="checkbox" class="tbc-mc-member-checkbox" data-phone="' . esc_attr($phone) . '"> ' . $display_name;
                echo '</li>';
            }
            echo '</ul>';
        endif; ?>

        <label for="destination_number">Destination Number:</label>
        <input type="tel" name="destination_number" class="tbc-mc-destination-input" required>
        <p class="tooltip small-margin-top">This is the number you are calling. Either check a name above or type in a number</p>
        <button type="submit">Initiate Call</button>
    </form>
    <?php
    return ob_get_clean();
}