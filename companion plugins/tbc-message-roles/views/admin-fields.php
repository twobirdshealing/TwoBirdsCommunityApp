<?php
/**
 * Admin Settings View — Role-Based Messaging Restrictions
 *
 * @package TBC_Message_Roles
 */

defined('ABSPATH') || exit;

$all_roles                        = TBCMsgR\Admin::get_roles();
$available_roles                  = TBCMsgR\Admin::get_roles(false);
$enabled                          = (bool) get_option(TBC_MSGR_OPTION_PREFIX . 'enabled', false);
$always_messageable_roles         = get_option(TBC_MSGR_OPTION_PREFIX . 'always_messageable_roles', []);
$always_messageable_fc_roles      = get_option(TBC_MSGR_OPTION_PREFIX . 'always_messageable_fc_roles', []);
$always_messageable_space_roles   = get_option(TBC_MSGR_OPTION_PREFIX . 'always_messageable_space_roles', []);
$dm_roles                         = get_option(TBC_MSGR_OPTION_PREFIX . 'dm_roles', []);
$dm_fc_roles                      = get_option(TBC_MSGR_OPTION_PREFIX . 'dm_fc_roles', []);
$dm_space_roles                   = get_option(TBC_MSGR_OPTION_PREFIX . 'dm_space_roles', []);
$community_roles                  = get_option(TBC_MSGR_OPTION_PREFIX . 'community_roles', []);
$community_fc_roles               = get_option(TBC_MSGR_OPTION_PREFIX . 'community_fc_roles', []);
$community_space_roles            = get_option(TBC_MSGR_OPTION_PREFIX . 'community_space_roles', []);

if (!is_array($always_messageable_roles)) $always_messageable_roles = [];
if (!is_array($always_messageable_fc_roles)) $always_messageable_fc_roles = [];
if (!is_array($always_messageable_space_roles)) $always_messageable_space_roles = [];
if (!is_array($dm_roles)) $dm_roles = [];
if (!is_array($dm_fc_roles)) $dm_fc_roles = [];
if (!is_array($dm_space_roles)) $dm_space_roles = [];
if (!is_array($community_roles)) $community_roles = [];
if (!is_array($community_fc_roles)) $community_fc_roles = [];
if (!is_array($community_space_roles)) $community_space_roles = [];

$fc_global_roles = [
    'admin'     => __('Community Admin', 'tbc-msgr'),
    'moderator' => __('Community Moderator', 'tbc-msgr'),
];

$space_roles = [
    'admin'     => __('Space Admin', 'tbc-msgr'),
    'moderator' => __('Space Moderator', 'tbc-msgr'),
];
?>

<div class="wrap tbc-msgr-admin">
    <h1><?php esc_html_e('Message Roles', 'tbc-msgr'); ?></h1>
    <p class="tbc-msgr-subtitle"><?php esc_html_e('Control which roles can send messages in Fluent Community.', 'tbc-msgr'); ?></p>

    <?php settings_errors('tbc_msgr_settings'); ?>

    <form method="post" action="options.php">
        <?php settings_fields('tbc_msgr_settings'); ?>

        <!-- Enable -->
        <div class="tbc-msgr-card">
            <label class="tbc-msgr-toggle">
                <input type="checkbox" name="<?php echo esc_attr(TBC_MSGR_OPTION_PREFIX . 'enabled'); ?>" value="1" <?php checked($enabled); ?> />
                <strong><?php esc_html_e('Enable Role Restrictions', 'tbc-msgr'); ?></strong>
            </label>
            <p class="description"><?php esc_html_e('Replaces Fluent Messaging\'s points-based system with role checks.', 'tbc-msgr'); ?></p>
        </div>

        <!-- Always Messageable -->
        <div class="tbc-msgr-card">
            <h2><?php esc_html_e('Always Messageable', 'tbc-msgr'); ?></h2>
            <p class="description"><?php esc_html_e('Users with these roles can always receive DMs from anyone, even restricted users. Leave all unchecked for no exceptions.', 'tbc-msgr'); ?></p>

            <div class="tbc-msgr-role-sections">
                <div class="tbc-msgr-role-section">
                    <h4><?php esc_html_e('Global Manager Roles', 'tbc-msgr'); ?></h4>
                    <div class="tbc-msgr-role-grid">
                        <?php foreach ($fc_global_roles as $slug => $name) : ?>
                            <label class="tbc-msgr-role-chip">
                                <input type="checkbox"
                                       name="<?php echo esc_attr(TBC_MSGR_OPTION_PREFIX . 'always_messageable_fc_roles[]'); ?>"
                                       value="<?php echo esc_attr($slug); ?>"
                                       <?php checked(in_array($slug, $always_messageable_fc_roles, true)); ?> />
                                <span><?php echo esc_html($name); ?></span>
                            </label>
                        <?php endforeach; ?>
                    </div>
                </div>

                <div class="tbc-msgr-role-section">
                    <h4><?php esc_html_e('Space-Level Roles', 'tbc-msgr'); ?></h4>
                    <p class="description tbc-msgr-section-desc"><?php esc_html_e('Matches users who hold this role in any space.', 'tbc-msgr'); ?></p>
                    <div class="tbc-msgr-role-grid">
                        <?php foreach ($space_roles as $slug => $name) : ?>
                            <label class="tbc-msgr-role-chip">
                                <input type="checkbox"
                                       name="<?php echo esc_attr(TBC_MSGR_OPTION_PREFIX . 'always_messageable_space_roles[]'); ?>"
                                       value="<?php echo esc_attr($slug); ?>"
                                       <?php checked(in_array($slug, $always_messageable_space_roles, true)); ?> />
                                <span><?php echo esc_html($name); ?></span>
                            </label>
                        <?php endforeach; ?>
                    </div>
                </div>

                <div class="tbc-msgr-role-section">
                    <h4><?php esc_html_e('WordPress Roles', 'tbc-msgr'); ?></h4>
                    <div class="tbc-msgr-role-grid">
                        <?php foreach ($all_roles as $slug => $name) : ?>
                            <label class="tbc-msgr-role-chip">
                                <input type="checkbox"
                                       name="<?php echo esc_attr(TBC_MSGR_OPTION_PREFIX . 'always_messageable_roles[]'); ?>"
                                       value="<?php echo esc_attr($slug); ?>"
                                       <?php checked(in_array($slug, $always_messageable_roles, true)); ?> />
                                <span><?php echo esc_html($name); ?></span>
                            </label>
                        <?php endforeach; ?>
                    </div>
                </div>
            </div>
        </div>

        <!-- DM Restrictions -->
        <div class="tbc-msgr-card">
            <h2><?php esc_html_e('Direct Messages (DMs)', 'tbc-msgr'); ?></h2>
            <p class="description"><?php esc_html_e('Which roles can initiate DMs. Leave all unchecked = no restriction.', 'tbc-msgr'); ?></p>

            <div class="tbc-msgr-role-sections">
                <div class="tbc-msgr-role-section">
                    <h4><?php esc_html_e('Global Manager Roles', 'tbc-msgr'); ?></h4>
                    <div class="tbc-msgr-role-grid">
                        <?php foreach ($fc_global_roles as $slug => $name) : ?>
                            <label class="tbc-msgr-role-chip">
                                <input type="checkbox"
                                       name="<?php echo esc_attr(TBC_MSGR_OPTION_PREFIX . 'dm_fc_roles[]'); ?>"
                                       value="<?php echo esc_attr($slug); ?>"
                                       <?php checked(in_array($slug, $dm_fc_roles, true)); ?> />
                                <span><?php echo esc_html($name); ?></span>
                            </label>
                        <?php endforeach; ?>
                    </div>
                </div>

                <div class="tbc-msgr-role-section">
                    <h4><?php esc_html_e('Space-Level Roles', 'tbc-msgr'); ?></h4>
                    <p class="description tbc-msgr-section-desc"><?php esc_html_e('Matches users who hold this role in any space.', 'tbc-msgr'); ?></p>
                    <div class="tbc-msgr-role-grid">
                        <?php foreach ($space_roles as $slug => $name) : ?>
                            <label class="tbc-msgr-role-chip">
                                <input type="checkbox"
                                       name="<?php echo esc_attr(TBC_MSGR_OPTION_PREFIX . 'dm_space_roles[]'); ?>"
                                       value="<?php echo esc_attr($slug); ?>"
                                       <?php checked(in_array($slug, $dm_space_roles, true)); ?> />
                                <span><?php echo esc_html($name); ?></span>
                            </label>
                        <?php endforeach; ?>
                    </div>
                </div>

                <div class="tbc-msgr-role-section">
                    <h4><?php esc_html_e('WordPress Roles', 'tbc-msgr'); ?></h4>
                    <div class="tbc-msgr-role-grid">
                        <?php foreach ($available_roles as $slug => $name) : ?>
                            <label class="tbc-msgr-role-chip">
                                <input type="checkbox"
                                       name="<?php echo esc_attr(TBC_MSGR_OPTION_PREFIX . 'dm_roles[]'); ?>"
                                       value="<?php echo esc_attr($slug); ?>"
                                       <?php checked(in_array($slug, $dm_roles, true)); ?> />
                                <span><?php echo esc_html($name); ?></span>
                            </label>
                        <?php endforeach; ?>
                    </div>
                </div>
            </div>
        </div>

        <!-- Community Chat Restrictions -->
        <div class="tbc-msgr-card">
            <h2><?php esc_html_e('Community / Space Chats', 'tbc-msgr'); ?></h2>
            <p class="description"><?php esc_html_e('Which roles can send in space chat threads. Leave all unchecked = no restriction.', 'tbc-msgr'); ?></p>

            <div class="tbc-msgr-role-sections">
                <div class="tbc-msgr-role-section">
                    <h4><?php esc_html_e('Global Manager Roles', 'tbc-msgr'); ?></h4>
                    <div class="tbc-msgr-role-grid">
                        <?php foreach ($fc_global_roles as $slug => $name) : ?>
                            <label class="tbc-msgr-role-chip">
                                <input type="checkbox"
                                       name="<?php echo esc_attr(TBC_MSGR_OPTION_PREFIX . 'community_fc_roles[]'); ?>"
                                       value="<?php echo esc_attr($slug); ?>"
                                       <?php checked(in_array($slug, $community_fc_roles, true)); ?> />
                                <span><?php echo esc_html($name); ?></span>
                            </label>
                        <?php endforeach; ?>
                    </div>
                </div>

                <div class="tbc-msgr-role-section">
                    <h4><?php esc_html_e('Space-Level Roles', 'tbc-msgr'); ?></h4>
                    <p class="description tbc-msgr-section-desc"><?php esc_html_e('Matches users who hold this role in any space.', 'tbc-msgr'); ?></p>
                    <div class="tbc-msgr-role-grid">
                        <?php foreach ($space_roles as $slug => $name) : ?>
                            <label class="tbc-msgr-role-chip">
                                <input type="checkbox"
                                       name="<?php echo esc_attr(TBC_MSGR_OPTION_PREFIX . 'community_space_roles[]'); ?>"
                                       value="<?php echo esc_attr($slug); ?>"
                                       <?php checked(in_array($slug, $community_space_roles, true)); ?> />
                                <span><?php echo esc_html($name); ?></span>
                            </label>
                        <?php endforeach; ?>
                    </div>
                </div>

                <div class="tbc-msgr-role-section">
                    <h4><?php esc_html_e('WordPress Roles', 'tbc-msgr'); ?></h4>
                    <div class="tbc-msgr-role-grid">
                        <?php foreach ($available_roles as $slug => $name) : ?>
                            <label class="tbc-msgr-role-chip">
                                <input type="checkbox"
                                       name="<?php echo esc_attr(TBC_MSGR_OPTION_PREFIX . 'community_roles[]'); ?>"
                                       value="<?php echo esc_attr($slug); ?>"
                                       <?php checked(in_array($slug, $community_roles, true)); ?> />
                                <span><?php echo esc_html($name); ?></span>
                            </label>
                        <?php endforeach; ?>
                    </div>
                </div>
            </div>
        </div>

        <?php submit_button(__('Save Settings', 'tbc-msgr')); ?>
    </form>

    <div class="tbc-msgr-footer">
        <p><strong><?php esc_html_e('Version:', 'tbc-msgr'); ?></strong> <?php echo esc_html(TBC_MSGR_VERSION); ?></p>
    </div>
</div>
