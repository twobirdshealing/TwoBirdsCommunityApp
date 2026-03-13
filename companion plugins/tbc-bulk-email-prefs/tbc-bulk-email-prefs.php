<?php
/**
 * Plugin Name: TBC - Bulk Email Preferences
 * Plugin URI: https://twobirdschurch.com
 * Description: Admin tool to bulk-change the per-space "new post" email notification preference for all Fluent Community members at once.
 * Version: 1.0.1
 * Author: Two Birds Church
 * Author URI: https://twobirdschurch.com
 * License: GPL v2 or later
 * Text Domain: tbc-bep
 *
 * @see CHANGELOG.md for version history
 */

if (!defined('ABSPATH')) {
    exit;
}

use FluentCommunity\App\Models\Space;
use FluentCommunity\App\Models\SpaceUserPivot;
use FluentCommunity\App\Models\NotificationSubscription;
use FluentCommunity\App\Functions\Utility;

add_action('plugins_loaded', function () {
    if (!is_admin()) {
        return;
    }

    // Runtime guard: Fluent Community must be active
    if (!class_exists('FluentCommunity\App\Models\Space')) {
        add_action('admin_notices', function () {
            echo '<div class="notice notice-error"><p><strong>TBC Bulk Email Preferences</strong> requires Fluent Community to be active.</p></div>';
        });
        return;
    }

    add_action('admin_menu', 'tbc_bep_add_menu');
});

/**
 * Add submenu under the TBC Community App parent menu.
 * Hooks form handler on the page's own load event (not admin_init).
 */
function tbc_bep_add_menu() {
    $hook = add_submenu_page(
        'tbc-community-app',
        __('Bulk Email Prefs', 'tbc-bep'),
        __('Bulk Email Prefs', 'tbc-bep'),
        'manage_options',
        'tbc-bulk-email-prefs',
        'tbc_bep_render_page'
    );

    // Only run the submit handler when this page is loaded
    add_action("load-{$hook}", 'tbc_bep_handle_submit');
}

/**
 * Notification type constants used by Fluent Community.
 */
const TBC_BEP_TYPE_ADMIN  = 'np_by_admin_mail';
const TBC_BEP_TYPE_MEMBER = 'np_by_member_mail';

/**
 * Level labels shared by handler and render.
 */
function tbc_bep_level_labels() {
    return [
        'disabled'         => __('Email Disabled', 'tbc-bep'),
        'admin_only_posts' => __('Admin Posts Only', 'tbc-bep'),
        'all_member_posts' => __('All Posts', 'tbc-bep'),
    ];
}

/**
 * Handle form submission.
 */
function tbc_bep_handle_submit() {
    if (!isset($_POST['tbc_bep_submit']) || !current_user_can('manage_options')) {
        return;
    }

    if (!check_admin_referer('tbc_bep_action')) {
        return;
    }

    $space_id = sanitize_text_field($_POST['tbc_bep_space'] ?? '');
    $level    = sanitize_key($_POST['tbc_bep_level'] ?? '');

    $valid_levels = array_keys(tbc_bep_level_labels());
    if (!in_array($level, $valid_levels, true)) {
        add_settings_error('tbc_bep', 'invalid_level', __('Invalid notification level.', 'tbc-bep'), 'error');
        return;
    }

    // Determine target spaces
    if ($space_id === 'all') {
        $space_ids = Space::where('status', 'published')->pluck('id')->toArray();
    } else {
        $sid = absint($space_id);
        if ($sid <= 0) {
            add_settings_error('tbc_bep', 'bad_space', __('Invalid space selected.', 'tbc-bep'), 'error');
            return;
        }
        $space_ids = [$sid];
    }

    if (empty($space_ids)) {
        add_settings_error('tbc_bep', 'no_spaces', __('No spaces found.', 'tbc-bep'), 'error');
        return;
    }

    // Determine which notification types to enable
    $types_to_enable = [];
    if ($level === 'admin_only_posts') {
        $types_to_enable = [TBC_BEP_TYPE_ADMIN];
    } elseif ($level === 'all_member_posts') {
        $types_to_enable = [TBC_BEP_TYPE_ADMIN, TBC_BEP_TYPE_MEMBER];
    }

    $total_updated = 0;

    foreach ($space_ids as $sid) {
        // Get active members in batches of 500
        $offset     = 0;
        $batch_size = 500;

        while (true) {
            $members = SpaceUserPivot::where('space_id', $sid)
                ->where('status', 'active')
                ->orderBy('id', 'ASC')
                ->offset($offset)
                ->limit($batch_size)
                ->pluck('user_id')
                ->toArray();

            if (empty($members)) {
                break;
            }

            // Delete existing space email prefs for this batch
            NotificationSubscription::where('object_id', $sid)
                ->where('object_type', 'notification_pref')
                ->whereIn('notification_type', [TBC_BEP_TYPE_ADMIN, TBC_BEP_TYPE_MEMBER])
                ->whereIn('user_id', $members)
                ->delete();

            // Insert new prefs
            foreach ($types_to_enable as $type) {
                foreach ($members as $uid) {
                    NotificationSubscription::updateOrCreate(
                        [
                            'user_id'           => (int) $uid,
                            'notification_type' => $type,
                            'object_id'         => $sid,
                        ],
                        [
                            'is_read'     => 1,
                            'object_type' => 'notification_pref',
                        ]
                    );
                }
            }

            // Clear per-user notification pref caches
            foreach ($members as $uid) {
                Utility::forgetCache('user_notification_pref_' . (int) $uid);
            }

            $total_updated += count($members);
            $offset += $batch_size;

            if (count($members) < $batch_size) {
                break;
            }
        }
    }

    $space_label = ($space_id === 'all') ? __('all spaces', 'tbc-bep') : __('selected space', 'tbc-bep');
    $labels = tbc_bep_level_labels();

    add_settings_error('tbc_bep', 'bulk_done',
        sprintf(
            __('Done! %d user(s) in %s set to "%s".', 'tbc-bep'),
            $total_updated,
            $space_label,
            $labels[$level]
        ),
        'success'
    );
}

/**
 * Render the admin page.
 */
function tbc_bep_render_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    $spaces = Space::where('status', 'published')
        ->orderBy('type', 'ASC')
        ->orderBy('title', 'ASC')
        ->get();

    // Attach member counts (single query)
    $space_ids = $spaces->pluck('id')->toArray();
    $counts = [];
    if (!empty($space_ids)) {
        $rows = SpaceUserPivot::whereIn('space_id', $space_ids)
            ->where('status', 'active')
            ->selectRaw('space_id, COUNT(*) as cnt')
            ->groupBy('space_id')
            ->get();
        foreach ($rows as $row) {
            $counts[$row->space_id] = $row->cnt;
        }
    }

    // Group by type
    $grouped = [];
    foreach ($spaces as $space) {
        $space->member_count = $counts[$space->id] ?? 0;
        $grouped[$space->type][] = $space;
    }

    $labels = tbc_bep_level_labels();
    ?>
    <div class="wrap">
        <h1><?php _e('Bulk Email Preferences', 'tbc-bep'); ?></h1>
        <p><?php echo wp_kses_post(__('Change the per-space "new post" email notification setting for all members at once. This is the same setting users see in Fluent Community under <em>Notification Preferences &rarr; Subscribe to new posts by space</em>.', 'tbc-bep')); ?></p>

        <?php settings_errors('tbc_bep'); ?>

        <?php if ($spaces->isEmpty()): ?>
            <div class="notice notice-warning"><p><?php _e('No published spaces found.', 'tbc-bep'); ?></p></div>
        <?php else: ?>
            <form method="post">
                <?php wp_nonce_field('tbc_bep_action'); ?>

                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="tbc_bep_space"><?php _e('Space', 'tbc-bep'); ?></label></th>
                        <td>
                            <select name="tbc_bep_space" id="tbc_bep_space" style="min-width: 350px;">
                                <option value="all"><?php _e('-- All Spaces --', 'tbc-bep'); ?></option>
                                <?php foreach ($grouped as $type => $type_spaces): ?>
                                    <optgroup label="<?php echo esc_attr(ucfirst($type)); ?>">
                                        <?php foreach ($type_spaces as $space): ?>
                                            <option value="<?php echo intval($space->id); ?>">
                                                <?php echo esc_html($space->title); ?>
                                                (<?php printf(__('%d members', 'tbc-bep'), intval($space->member_count)); ?>)
                                            </option>
                                        <?php endforeach; ?>
                                    </optgroup>
                                <?php endforeach; ?>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="tbc_bep_level"><?php _e('Notification Level', 'tbc-bep'); ?></label></th>
                        <td>
                            <select name="tbc_bep_level" id="tbc_bep_level" style="min-width: 350px;">
                                <?php foreach ($labels as $value => $label): ?>
                                    <option value="<?php echo esc_attr($value); ?>"><?php echo esc_html($label); ?></option>
                                <?php endforeach; ?>
                            </select>
                            <p class="description"><?php _e('This overwrites the existing preference for every active member.', 'tbc-bep'); ?></p>
                        </td>
                    </tr>
                </table>

                <?php submit_button(
                    __('Apply to All Members', 'tbc-bep'),
                    'primary',
                    'tbc_bep_submit',
                    true,
                    ['onclick' => "return confirm('" . esc_js(__('This will overwrite email notification preferences for all members of the selected space(s). Continue?', 'tbc-bep')) . "');"]
                ); ?>
            </form>

            <hr />
            <h2><?php _e('Space Overview', 'tbc-bep'); ?></h2>
            <table class="widefat striped" style="max-width: 700px;">
                <thead>
                    <tr>
                        <th><?php _e('Space', 'tbc-bep'); ?></th>
                        <th><?php _e('Type', 'tbc-bep'); ?></th>
                        <th><?php _e('Members', 'tbc-bep'); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($spaces as $space): ?>
                    <tr>
                        <td><strong><?php echo esc_html($space->title); ?></strong></td>
                        <td><?php echo esc_html(ucfirst($space->type)); ?></td>
                        <td><?php echo intval($space->member_count); ?></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>
    </div>
    <?php
}
