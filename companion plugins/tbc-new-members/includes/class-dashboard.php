<?php
/**
 * Dashboard Class
 * Community stats using Fluent Community tables (fcom_posts, fcom_post_comments, fcom_post_reactions)
 */
class TBC_Dashboard {
    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('rest_api_init', array($this, 'register_rest_routes'));
    }

    public function register_rest_routes() {
        register_rest_route('tbc-members/v1', '/stats', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_stats'),
            'permission_callback' => function() {
                return is_user_logged_in() && current_user_can('edit_posts');
            }
        ));
    }

    public function get_stats($request) {
        $range = tbc_nm_get_request_date_range();
        $from = $request->get_param('from_date') ?? $range['from'];
        $to = $request->get_param('to_date') ?? $range['to'];

        return rest_ensure_response(array(
            'member_stats' => $this->get_member_stats($from, $to),
            'activity_stats' => $this->get_activity_stats($from, $to),
            'reaction_stats' => $this->get_reaction_stats($from, $to),
            'top_users' => $this->get_top_users_stats($from, $to),
            'historical_data' => $this->get_historical_data()
        ));
    }

    public function get_member_stats($from_date, $to_date) {
        $total_members = count_users();

        return array(
            'total_members' => $total_members['total_users'],
            'new_members' => tbc_nm_count_members_in_range($from_date, $to_date)
        );
    }

    public function get_activity_stats($from_date, $to_date) {
        global $wpdb;

        $posts_table = $wpdb->prefix . 'fcom_posts';
        $comments_table = $wpdb->prefix . 'fcom_post_comments';

        list($from_utc, $to_utc) = tbc_nm_date_range_to_utc($from_date, $to_date);

        $posts_count = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$posts_table}
             WHERE status = 'published'
             AND created_at >= %s AND created_at <= %s",
            $from_utc, $to_utc
        ));

        $comments_count = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$comments_table}
             WHERE status = 'published'
             AND created_at >= %s AND created_at <= %s",
            $from_utc, $to_utc
        ));

        return array(
            'new_posts' => $posts_count,
            'comments' => $comments_count
        );
    }

    public function get_reaction_stats($from_date, $to_date) {
        global $wpdb;

        $reactions_table = $wpdb->prefix . 'fcom_post_reactions';
        list($from_utc, $to_utc) = tbc_nm_date_range_to_utc($from_date, $to_date);

        $total_reactions = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$reactions_table}
             WHERE type = 'like'
             AND created_at >= %s AND created_at <= %s",
            $from_utc, $to_utc
        ));

        return array('total_reactions' => $total_reactions);
    }

    public function get_top_users_stats($from_date, $to_date) {
        global $wpdb;

        $posts_table = $wpdb->prefix . 'fcom_posts';
        $comments_table = $wpdb->prefix . 'fcom_post_comments';
        $reactions_table = $wpdb->prefix . 'fcom_post_reactions';

        list($from_utc, $to_utc) = tbc_nm_date_range_to_utc($from_date, $to_date);

        $top_posters = $wpdb->get_results($wpdb->prepare("
            SELECT u.ID, u.display_name, COUNT(*) as count
            FROM {$wpdb->users} u
            JOIN {$posts_table} p ON u.ID = p.user_id
            WHERE p.status = 'published'
            AND p.created_at >= %s AND p.created_at <= %s
            GROUP BY u.ID ORDER BY count DESC LIMIT 5
        ", $from_utc, $to_utc));

        $top_commenters = $wpdb->get_results($wpdb->prepare("
            SELECT u.ID, u.display_name, COUNT(*) as count
            FROM {$wpdb->users} u
            JOIN {$comments_table} c ON u.ID = c.user_id
            WHERE c.status = 'published'
            AND c.created_at >= %s AND c.created_at <= %s
            GROUP BY u.ID ORDER BY count DESC LIMIT 5
        ", $from_utc, $to_utc));

        $top_reactors = $wpdb->get_results($wpdb->prepare("
            SELECT u.ID, u.display_name, COUNT(*) as count
            FROM {$wpdb->users} u
            JOIN {$reactions_table} r ON u.ID = r.user_id
            WHERE r.type = 'like'
            AND r.created_at >= %s AND r.created_at <= %s
            GROUP BY u.ID ORDER BY count DESC LIMIT 5
        ", $from_utc, $to_utc));

        return array(
            'top_posters' => $top_posters,
            'top_commenters' => $top_commenters,
            'top_reactors' => $top_reactors
        );
    }

    public function get_historical_data($days = 30) {
        global $wpdb;

        $posts_table = $wpdb->prefix . 'fcom_posts';
        $comments_table = $wpdb->prefix . 'fcom_post_comments';
        $reactions_table = $wpdb->prefix . 'fcom_post_reactions';

        $timezone = wp_timezone();
        $start_date = new DateTime('now', $timezone);
        $start_date->modify("-{$days} days");
        $start_str = $start_date->format('Y-m-d');

        $posts_data = $wpdb->get_results($wpdb->prepare(
            "SELECT DATE(created_at) as date, COUNT(*) as posts
             FROM {$posts_table}
             WHERE status = 'published' AND created_at >= %s
             GROUP BY DATE(created_at) ORDER BY date",
            $start_str
        ));

        $comments_data = $wpdb->get_results($wpdb->prepare(
            "SELECT DATE(created_at) as date, COUNT(*) as comments
             FROM {$comments_table}
             WHERE status = 'published' AND created_at >= %s
             GROUP BY DATE(created_at) ORDER BY date",
            $start_str
        ));

        $reactions_data = $wpdb->get_results($wpdb->prepare(
            "SELECT DATE(created_at) as date, COUNT(*) as reactions
             FROM {$reactions_table}
             WHERE type = 'like' AND created_at >= %s
             GROUP BY DATE(created_at) ORDER BY date",
            $start_str
        ));

        $combined = array();
        foreach ($posts_data as $row) {
            $combined[$row->date] = ['date' => $row->date, 'posts' => (int) $row->posts, 'comments' => 0, 'reactions' => 0];
        }
        foreach ($comments_data as $row) {
            if (isset($combined[$row->date])) {
                $combined[$row->date]['comments'] = (int) $row->comments;
            } else {
                $combined[$row->date] = ['date' => $row->date, 'posts' => 0, 'comments' => (int) $row->comments, 'reactions' => 0];
            }
        }
        foreach ($reactions_data as $row) {
            if (isset($combined[$row->date])) {
                $combined[$row->date]['reactions'] = (int) $row->reactions;
            } else {
                $combined[$row->date] = ['date' => $row->date, 'posts' => 0, 'comments' => 0, 'reactions' => (int) $row->reactions];
            }
        }

        ksort($combined);
        return array_values($combined);
    }

    public function render_dashboard() {
        $range = tbc_nm_get_request_date_range();
        $from_date = $range['from'];
        $to_date = $range['to'];

        $member_stats = $this->get_member_stats($from_date, $to_date);
        $activity_stats = $this->get_activity_stats($from_date, $to_date);
        $reaction_stats = $this->get_reaction_stats($from_date, $to_date);
        $historical_data = $this->get_historical_data();
        $top_users = $this->get_top_users_stats($from_date, $to_date);

        $timezone = wp_timezone();
        $from_date_obj = new DateTime($from_date, $timezone);
        $to_date_obj = new DateTime($to_date, $timezone);
        $formatted_date_range = $from_date_obj->format('F j, Y') . ' - ' . $to_date_obj->format('F j, Y');

        ob_start();
        ?>
        <div class="tbc-dashboard-container">
            <div class="dashboard-panel">
                <div class="section-header" id="stats-section-header">
                    <h3>Stats (<?php echo esc_html($formatted_date_range); ?>)</h3>
                    <button type="button" aria-label="Toggle stats visibility">
                        <span class="toggle-icon">−</span>
                    </button>
                </div>

                <div class="section-wrapper stats-wrapper">
                    <div class="quick-stats">
                        <div class="stat-card" id="total-members">
                            <span class="stat-label">Total Members</span>
                            <span class="stat-value"><?php echo number_format($member_stats['total_members']); ?></span>
                        </div>
                        <div class="stat-card" id="new-members">
                            <span class="stat-label">New Members</span>
                            <span class="stat-value"><?php echo number_format($member_stats['new_members']); ?></span>
                        </div>
                        <div class="stat-card" id="new-posts">
                            <span class="stat-label">New Posts</span>
                            <span class="stat-value"><?php echo number_format($activity_stats['new_posts']); ?></span>
                        </div>
                        <div class="stat-card" id="comments">
                            <span class="stat-label">Comments</span>
                            <span class="stat-value"><?php echo number_format($activity_stats['comments']); ?></span>
                        </div>
                        <div class="stat-card" id="reactions">
                            <span class="stat-label">Reactions</span>
                            <span class="stat-value"><?php echo number_format($reaction_stats['total_reactions']); ?></span>
                        </div>
                    </div>
                </div>
            </div>

            <?php if (!empty($top_users['top_posters']) || !empty($top_users['top_commenters']) || !empty($top_users['top_reactors'])): ?>
            <div class="dashboard-panel">
                <div class="section-header" id="users-section-header">
                    <h3>Top Users (<?php echo esc_html($formatted_date_range); ?>)</h3>
                    <button type="button" aria-label="Toggle users visibility">
                        <span class="toggle-icon">−</span>
                    </button>
                </div>

                <div class="section-wrapper users-wrapper">
                    <div class="top-users-grid">
                        <?php if (!empty($top_users['top_posters'])): ?>
                        <div class="top-users-section">
                            <h4>Top Posters</h4>
                            <ul class="top-users-list">
                                <?php foreach ($top_users['top_posters'] as $user): ?>
                                    <li>
                                        <span class="user-name"><?php echo esc_html($user->display_name); ?></span>
                                        <span class="user-count"><?php echo number_format($user->count); ?> posts</span>
                                    </li>
                                <?php endforeach; ?>
                            </ul>
                        </div>
                        <?php endif; ?>

                        <?php if (!empty($top_users['top_commenters'])): ?>
                        <div class="top-users-section">
                            <h4>Top Commenters</h4>
                            <ul class="top-users-list">
                                <?php foreach ($top_users['top_commenters'] as $user): ?>
                                    <li>
                                        <span class="user-name"><?php echo esc_html($user->display_name); ?></span>
                                        <span class="user-count"><?php echo number_format($user->count); ?> comments</span>
                                    </li>
                                <?php endforeach; ?>
                            </ul>
                        </div>
                        <?php endif; ?>

                        <?php if (!empty($top_users['top_reactors'])): ?>
                        <div class="top-users-section">
                            <h4>Top Reactors</h4>
                            <ul class="top-users-list">
                                <?php foreach ($top_users['top_reactors'] as $user): ?>
                                    <li>
                                        <span class="user-name"><?php echo esc_html($user->display_name); ?></span>
                                        <span class="user-count"><?php echo number_format($user->count); ?> reactions</span>
                                    </li>
                                <?php endforeach; ?>
                            </ul>
                        </div>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
            <?php endif; ?>

            <div class="dashboard-panel">
                <div class="section-header" id="trends-section-header">
                    <h3>Activity Trends (Last 30 Days)</h3>
                    <button type="button" aria-label="Toggle trends visibility">
                        <span class="toggle-icon">−</span>
                    </button>
                </div>

                <div class="section-wrapper trends-wrapper">
                    <div class="chart-container">
                        <canvas id="activityChart"></canvas>
                    </div>
                </div>
            </div>
        </div>

        <script>
            window.dashboardData = {
                historical: <?php echo wp_json_encode($historical_data); ?>
            };
        </script>
        <?php
        return ob_get_clean();
    }
}
