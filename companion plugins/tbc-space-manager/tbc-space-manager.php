<?php
/**
 * Plugin Name: TBC - Space Manager
 * Plugin URI:  https://twobirdschurch.com
 * Description: Admin tool to bulk-add all users to a Fluent Community space and subscribe them to notifications.
 * Version:     1.0.0
 * Author:      Two Birds Church
 * Author URI:  https://twobirdschurch.com
 * Text Domain: tbc-space-manager
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

define('TBC_SM_VERSION', '1.0.0');

use FluentCommunity\App\Models\Space;
use FluentCommunity\App\Models\SpaceUserPivot;
use FluentCommunity\App\Models\NotificationSubscription;
use FluentCommunity\App\Services\Helper as FCHelper;
use FluentCommunity\App\Functions\Utility;

add_action('plugins_loaded', function () {
    if (!is_admin()) {
        return;
    }

    if (!defined('SUSPENDED') && !class_exists('FluentCommunity\App\Services\Helper')) {
        add_action('admin_notices', function () {
            echo '<div class="notice notice-error"><p><strong>TBC Space Manager</strong> requires Fluent Community to be active.</p></div>';
        });
        return;
    }

    new TBC_Space_Manager();
});

class TBC_Space_Manager
{
    public function __construct()
    {
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('wp_ajax_tbc_sm_add_users_batch', [$this, 'ajax_add_users_batch']);
        add_action('wp_ajax_tbc_sm_subscribe_users_batch', [$this, 'ajax_subscribe_users_batch']);
    }

    public function add_admin_menu()
    {
        add_management_page(
            'Space Manager',
            'Space Manager',
            'manage_options',
            'tbc-space-manager',
            [$this, 'render_page']
        );
    }

    // =========================================================================
    // AJAX: Add all WP users to a space in batches
    // =========================================================================
    public function ajax_add_users_batch()
    {
        check_ajax_referer('tbc_sm_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error('Unauthorized');
        }

        $space_id   = absint($_POST['space_id'] ?? 0);
        $offset     = absint($_POST['offset'] ?? 0);
        $batch_size = absint($_POST['batch_size'] ?? 50);

        if (!$space_id) {
            wp_send_json_error('No space selected.');
        }

        $total_users = (int) count_users()['total_users'];
        $user_ids    = get_users([
            'fields' => 'ID',
            'number' => $batch_size,
            'offset' => $offset,
            'orderby' => 'ID',
            'order'   => 'ASC',
        ]);

        $added   = 0;
        $skipped = 0;
        $failed  = 0;

        foreach ($user_ids as $uid) {
            try {
                $result = FCHelper::addToSpace($space_id, (int) $uid, 'member', 'by_admin');
                if ($result) {
                    $added++;
                } else {
                    $skipped++;
                }
            } catch (\Exception $e) {
                $failed++;
            }
        }

        $next_offset = $offset + $batch_size;

        wp_send_json_success([
            'added'       => $added,
            'skipped'     => $skipped,
            'failed'      => $failed,
            'has_more'    => $next_offset < $total_users,
            'next_offset' => $next_offset,
            'total_users' => $total_users,
        ]);
    }

    // =========================================================================
    // AJAX: Subscribe all space members to notifications in batches
    // =========================================================================
    public function ajax_subscribe_users_batch()
    {
        check_ajax_referer('tbc_sm_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error('Unauthorized');
        }

        $space_id   = absint($_POST['space_id'] ?? 0);
        $offset     = absint($_POST['offset'] ?? 0);
        $batch_size = absint($_POST['batch_size'] ?? 50);

        if (!$space_id) {
            wp_send_json_error('No space selected.');
        }

        $total_members = SpaceUserPivot::where('space_id', $space_id)
            ->where('status', 'active')
            ->count();

        $members = SpaceUserPivot::where('space_id', $space_id)
            ->where('status', 'active')
            ->orderBy('id', 'ASC')
            ->offset($offset)
            ->limit($batch_size)
            ->get();

        $subscribed = 0;

        foreach ($members as $member) {
            $userId = (int) $member->user_id;

            foreach (['np_by_member_mail', 'np_by_admin_mail'] as $type) {
                NotificationSubscription::updateOrCreate(
                    [
                        'user_id'           => $userId,
                        'notification_type' => $type,
                        'object_id'         => $space_id,
                    ],
                    [
                        'is_read'     => 1,
                        'object_type' => 'notification_pref',
                    ]
                );
            }

            Utility::forgetCache('user_notification_pref_' . $userId);
            $subscribed++;
        }

        $next_offset = $offset + $batch_size;

        wp_send_json_success([
            'subscribed'    => $subscribed,
            'has_more'      => $next_offset < $total_members,
            'next_offset'   => $next_offset,
            'total_members' => $total_members,
        ]);
    }

    // =========================================================================
    // Admin page render
    // =========================================================================
    public function render_page()
    {
        if (!current_user_can('manage_options')) {
            return;
        }

        $spaces = Space::orderBy('title', 'ASC')->get();
        $nonce  = wp_create_nonce('tbc_sm_nonce');
        ?>
        <style>
            .tbc-sm-wrap { max-width: 600px; margin-top: 20px; }
            .tbc-sm-wrap h1 { margin-bottom: 20px; }
            .tbc-sm-field { margin-bottom: 16px; }
            .tbc-sm-field label { display: block; font-weight: 600; margin-bottom: 6px; }
            .tbc-sm-field select { width: 100%; max-width: 400px; }
            .tbc-sm-actions { display: flex; gap: 10px; margin-bottom: 20px; }
            .tbc-sm-actions .button { min-width: 180px; text-align: center; }
            #tbc-sm-log {
                background: #f0f0f1; border: 1px solid #c3c4c7; border-radius: 4px;
                padding: 12px 16px; min-height: 60px; max-height: 300px; overflow-y: auto;
                font-family: monospace; font-size: 13px; line-height: 1.6;
                display: none; white-space: pre-wrap;
            }
            .tbc-sm-progress { margin-bottom: 12px; display: none; }
            .tbc-sm-progress-bar {
                height: 24px; background: #ddd; border-radius: 4px; overflow: hidden;
            }
            .tbc-sm-progress-fill {
                height: 100%; background: #2271b1; transition: width 0.3s; width: 0%;
            }
            .tbc-sm-progress-text { margin-top: 4px; font-size: 13px; color: #50575e; }
        </style>

        <div class="wrap tbc-sm-wrap">
            <h1>TBC Space Manager</h1>
            <p>Bulk-add all WordPress users to a Fluent Community space and/or subscribe them to notifications.</p>

            <div class="tbc-sm-field">
                <label for="tbc-sm-space">Select Space</label>
                <select id="tbc-sm-space">
                    <option value="">-- Choose a space --</option>
                    <?php foreach ($spaces as $space) : ?>
                        <option value="<?php echo esc_attr($space->id); ?>">
                            <?php echo esc_html($space->title); ?>
                            (<?php echo esc_html(ucfirst($space->privacy)); ?>)
                        </option>
                    <?php endforeach; ?>
                </select>
            </div>

            <div class="tbc-sm-actions">
                <button id="tbc-sm-add" class="button button-primary" onclick="tbcSmAddAll()">
                    Add All Users to Space
                </button>
                <button id="tbc-sm-subscribe" class="button button-secondary" onclick="tbcSmSubscribeAll()">
                    Subscribe All Members
                </button>
            </div>

            <div class="tbc-sm-progress" id="tbc-sm-progress">
                <div class="tbc-sm-progress-bar">
                    <div class="tbc-sm-progress-fill" id="tbc-sm-progress-fill"></div>
                </div>
                <div class="tbc-sm-progress-text" id="tbc-sm-progress-text"></div>
            </div>

            <div id="tbc-sm-log"></div>
        </div>

        <script>
        (function () {
            const ajaxurl = '<?php echo esc_url(admin_url('admin-ajax.php')); ?>';
            const nonce   = '<?php echo esc_js($nonce); ?>';

            const $log      = document.getElementById('tbc-sm-log');
            const $progress = document.getElementById('tbc-sm-progress');
            const $fill     = document.getElementById('tbc-sm-progress-fill');
            const $ptext    = document.getElementById('tbc-sm-progress-text');
            const $addBtn   = document.getElementById('tbc-sm-add');
            const $subBtn   = document.getElementById('tbc-sm-subscribe');

            function getSpaceId() {
                return document.getElementById('tbc-sm-space').value;
            }

            function log(msg) {
                $log.style.display = 'block';
                $log.textContent += msg + '\n';
                $log.scrollTop = $log.scrollHeight;
            }

            function setProgress(current, total) {
                $progress.style.display = 'block';
                const pct = total > 0 ? Math.round((current / total) * 100) : 0;
                $fill.style.width = pct + '%';
                $ptext.textContent = current + ' / ' + total + ' (' + pct + '%)';
            }

            function setButtons(disabled) {
                $addBtn.disabled = disabled;
                $subBtn.disabled = disabled;
            }

            function runBatch(action, spaceId, offset, totals, onDone) {
                const data = new FormData();
                data.append('action', action);
                data.append('nonce', nonce);
                data.append('space_id', spaceId);
                data.append('offset', offset);
                data.append('batch_size', 50);

                fetch(ajaxurl, { method: 'POST', body: data })
                    .then(r => r.json())
                    .then(res => {
                        if (!res.success) {
                            log('ERROR: ' + (res.data || 'Unknown error'));
                            setButtons(false);
                            return;
                        }

                        const d = res.data;
                        onDone(d, totals);

                        const total = d.total_users || d.total_members || 0;
                        setProgress(d.next_offset > total ? total : d.next_offset, total);

                        if (d.has_more) {
                            runBatch(action, spaceId, d.next_offset, totals, onDone);
                        } else {
                            log('--- DONE ---');
                            setButtons(false);
                        }
                    })
                    .catch(err => {
                        log('FETCH ERROR: ' + err.message);
                        setButtons(false);
                    });
            }

            window.tbcSmAddAll = function () {
                const spaceId = getSpaceId();
                if (!spaceId) { alert('Select a space first.'); return; }
                if (!confirm('Add ALL WordPress users to this space?')) return;

                $log.textContent = '';
                setButtons(true);
                log('Starting: Add all users to space #' + spaceId + '...');

                const totals = { added: 0, skipped: 0, failed: 0 };

                runBatch('tbc_sm_add_users_batch', spaceId, 0, totals, function (d, t) {
                    t.added   += d.added;
                    t.skipped += d.skipped;
                    t.failed  += d.failed;
                    log('Batch: +' + d.added + ' added, ' + d.skipped + ' skipped, ' + d.failed + ' failed  |  Running total: ' + t.added + ' added, ' + t.skipped + ' skipped');
                });
            };

            window.tbcSmSubscribeAll = function () {
                const spaceId = getSpaceId();
                if (!spaceId) { alert('Select a space first.'); return; }
                if (!confirm('Subscribe ALL members of this space to notifications?')) return;

                $log.textContent = '';
                setButtons(true);
                log('Starting: Subscribe all members of space #' + spaceId + '...');

                const totals = { subscribed: 0 };

                runBatch('tbc_sm_subscribe_users_batch', spaceId, 0, totals, function (d, t) {
                    t.subscribed += d.subscribed;
                    log('Batch: ' + d.subscribed + ' subscribed  |  Running total: ' + t.subscribed);
                });
            };
        })();
        </script>
        <?php
    }
}
