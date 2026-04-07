<?php
/**
 * Members List Class
 * Shows new members in date range with easy-copy for welcome posts
 */
class TBC_Members_List {
    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {}

    public function render_members_page() {
        $range = tbc_nm_get_request_date_range();
        $from_date = $range['from'];
        $to_date = $range['to'];

        $new_members = tbc_nm_get_members_in_range($from_date, $to_date);

        // Batch-prefetch profile URLs (avoids N+1 queries)
        $member_ids = array_map(function($m) { return $m->ID; }, $new_members);
        $profile_urls = tbc_nm_get_profile_urls($member_ids);

        // Prime user meta cache for all members in one query
        if (!empty($member_ids)) {
            cache_users($member_ids);
        }

        $timezone = wp_timezone();
        $from_display = new DateTime($from_date, $timezone);
        $to_display = new DateTime($to_date, $timezone);

        ob_start();
        ?>
        <div class="members-page-container">
            <div class="members-panel panel">
                <div class="panel-header">
                    <h2><?php echo count($new_members); ?> New Members (<?php echo $from_display->format('M d'); ?> - <?php echo $to_display->format('M d, Y'); ?>)</h2>
                    <?php if (!empty($new_members)): ?>
                        <div class="copy-actions">
                            <button type="button" id="copy-names" class="copy-btn" title="Copy names list">
                                Copy Names
                            </button>
                            <button type="button" id="copy-mentions" class="copy-btn" title="Copy @mentions list">
                                Copy @Mentions
                            </button>
                        </div>
                    <?php endif; ?>
                </div>

                <?php if (!empty($new_members)): ?>
                    <div class="members-select-bar">
                        <label class="select-all-label">
                            <input type="checkbox" id="select-all"> Select All
                        </label>
                        <span class="selected-count" id="selected-count">0 selected</span>
                    </div>

                    <table class="members-table">
                        <thead>
                            <tr>
                                <th class="col-check"><input type="checkbox" id="select-all-header"></th>
                                <th>Name</th>
                                <th>Username</th>
                                <th>Email</th>
                                <th>Join Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($new_members as $member):
                                $first_name = get_user_meta($member->ID, 'first_name', true);
                                $last_name = get_user_meta($member->ID, 'last_name', true);
                                $display_name = trim($first_name . ' ' . $last_name) ?: $member->display_name;
                                $profile_url = $profile_urls[$member->ID] ?? get_author_posts_url($member->ID);
                            ?>
                                <tr>
                                    <td class="col-check">
                                        <input type="checkbox" class="member-checkbox"
                                               value="<?php echo esc_attr($member->ID); ?>"
                                               data-name="<?php echo esc_attr($display_name); ?>"
                                               data-username="<?php echo esc_attr($member->user_nicename); ?>">
                                    </td>
                                    <td class="member-name-cell">
                                        <a href="<?php echo esc_url($profile_url); ?>" target="_blank">
                                            <?php echo esc_html($display_name); ?>
                                        </a>
                                    </td>
                                    <td class="member-username">@<?php echo esc_html($member->user_nicename); ?></td>
                                    <td class="member-email"><?php echo esc_html($member->user_email); ?></td>
                                    <td class="member-date"><?php
                                        $user_date = new DateTime($member->user_registered, new DateTimeZone('UTC'));
                                        $user_date->setTimezone($timezone);
                                        echo $user_date->format('M d, Y');
                                    ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php else: ?>
                    <div class="empty-state">
                        <p>No new members found in this date range.</p>
                    </div>
                <?php endif; ?>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }
}
