<?php
/**
 * Manual Push Notifications - admin-initiated push sends
 *
 * Renders a "Send Notification" form in the Notifications admin tab
 * and processes the submission via the existing send_to_users() pipeline.
 */

if (!defined('ABSPATH')) {
    exit;
}

class TBC_CA_Push_Manual {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('wp_ajax_tbc_ca_push_preview_count', [$this, 'ajax_preview_count']);
    }

    /**
     * Handle form submission (called from class-settings.php)
     */
    public function handle_submit() {
        if (!isset($_POST['tbc_ca_manual_push']) || !current_user_can('manage_options')) {
            return;
        }

        if (!check_admin_referer('tbc_ca_manual_push_nonce')) {
            return;
        }

        $title = sanitize_text_field(wp_unslash($_POST['push_title'] ?? ''));
        $body = sanitize_textarea_field(wp_unslash($_POST['push_body'] ?? ''));
        $route = sanitize_text_field(wp_unslash($_POST['push_route'] ?? ''));
        $audience = sanitize_key($_POST['push_audience'] ?? 'all');

        if (empty($title) || empty($body)) {
            add_settings_error('tbc_ca_settings', 'push_error',
                __('Title and message are required.', 'tbc-ca'), 'error');
            return;
        }

        $user_ids = $this->resolve_audience($audience);

        if (empty($user_ids)) {
            add_settings_error('tbc_ca_settings', 'push_error',
                __('No users found for the selected audience.', 'tbc-ca'), 'error');
            return;
        }

        // Send via the existing AS queue pipeline with force flag
        $hooks = TBC_CA_Push_Hooks::get_instance();
        $hooks->send_to_users_external(
            $user_ids,
            'manual_notification',
            $title,
            $body,
            !empty($route) ? $route : null,
            null,
            true,    // force — bypass user preference check
            'manual' // source — for logging
        );

        add_settings_error('tbc_ca_settings', 'push_sent',
            sprintf(__('Push notification queued for %d user(s).', 'tbc-ca'), count($user_ids)),
            'success');
    }

    /**
     * Resolve audience selection to user IDs
     *
     * @param string $audience Audience type
     * @return array User IDs
     */
    private function resolve_audience($audience) {
        global $wpdb;
        $device_table = $wpdb->prefix . 'tbc_ca_device_tokens';

        switch ($audience) {
            case 'all':
                return $wpdb->get_col("SELECT DISTINCT user_id FROM {$device_table}");

            case 'space':
                $space_id = absint($_POST['push_space_id'] ?? 0);
                if (!$space_id) {
                    return [];
                }
                $space_table = $wpdb->prefix . 'fcom_space_user';
                // Only users who are in the space AND have a registered device
                return $wpdb->get_col($wpdb->prepare(
                    "SELECT DISTINCT su.user_id
                    FROM {$space_table} su
                    INNER JOIN {$device_table} dt ON dt.user_id = su.user_id
                    WHERE su.space_id = %d AND su.status = 'active'",
                    $space_id
                ));

            case 'role':
                $roles = array_map('sanitize_key', (array) ($_POST['push_roles'] ?? []));
                if (empty($roles)) {
                    return [];
                }
                // Get users with selected roles who have registered devices
                $all_role_users = get_users(['role__in' => $roles, 'fields' => 'ID']);
                $all_role_users = array_unique(array_map('intval', $all_role_users));
                if (empty($all_role_users)) {
                    return [];
                }
                $placeholders = implode(',', array_fill(0, count($all_role_users), '%d'));
                return $wpdb->get_col($wpdb->prepare(
                    "SELECT DISTINCT user_id FROM {$device_table} WHERE user_id IN ({$placeholders})",
                    ...$all_role_users
                ));

            case 'user':
                $user_id = absint($_POST['push_user_id'] ?? 0);
                if (!$user_id) {
                    return [];
                }
                // Verify user has a device
                $has_device = $wpdb->get_var($wpdb->prepare(
                    "SELECT COUNT(*) FROM {$device_table} WHERE user_id = %d",
                    $user_id
                ));
                return $has_device ? [$user_id] : [];

            default:
                return [];
        }
    }

    /**
     * AJAX handler: return device count for selected audience (preview)
     */
    public function ajax_preview_count() {
        check_ajax_referer('tbc_ca_manual_push_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error('Unauthorized');
        }

        $_POST['push_audience'] = sanitize_key($_POST['audience'] ?? 'all');
        $_POST['push_space_id'] = absint($_POST['space_id'] ?? 0);
        $_POST['push_roles'] = array_map('sanitize_key', (array) ($_POST['roles'] ?? []));
        $_POST['push_user_id'] = absint($_POST['user_id'] ?? 0);

        $user_ids = $this->resolve_audience($_POST['push_audience']);

        wp_send_json_success(['count' => count($user_ids)]);
    }

    /**
     * Render the manual send form (called from class-settings.php)
     */
    public function render_form() {
        global $wpdb;

        // Get spaces for dropdown
        $spaces_table = $wpdb->prefix . 'fcom_spaces';
        $spaces = $wpdb->get_results("SELECT id, title FROM {$spaces_table} WHERE status = 'active' ORDER BY title ASC");

        // Get FC roles
        $fc_roles = [
            'community_admin'     => __('Community Admin', 'tbc-ca'),
            'community_moderator' => __('Community Moderator', 'tbc-ca'),
            'member'              => __('Member', 'tbc-ca'),
        ];

        // Get total device count for "all" preview
        $device_table = $wpdb->prefix . 'tbc_ca_device_tokens';
        $total_users = (int) $wpdb->get_var("SELECT COUNT(DISTINCT user_id) FROM {$device_table}");

        $nonce = wp_create_nonce('tbc_ca_manual_push_nonce');
        ?>
        <div class="tbc-ca-manual-push">
            <h3><?php _e('Send Push Notification', 'tbc-ca'); ?></h3>
            <p class="description"><?php _e('Send a one-time push notification to app users. Users cannot opt out of manual notifications.', 'tbc-ca'); ?></p>

            <form method="post" id="tbc-ca-manual-push-form">
                <?php wp_nonce_field('tbc_ca_manual_push_nonce'); ?>
                <input type="hidden" name="tbc_ca_active_tab" value="notifications" />

                <table class="form-table">
                    <tr>
                        <th scope="row"><label for="push_title"><?php _e('Title', 'tbc-ca'); ?></label></th>
                        <td>
                            <input type="text" id="push_title" name="push_title" class="regular-text" required
                                   maxlength="50" placeholder="<?php esc_attr_e('Notification title', 'tbc-ca'); ?>" />
                            <p class="description"><span id="push-title-count">50</span> <?php _e('characters remaining', 'tbc-ca'); ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="push_body"><?php _e('Message', 'tbc-ca'); ?></label></th>
                        <td>
                            <textarea id="push_body" name="push_body" class="large-text" rows="3" required
                                      maxlength="400" placeholder="<?php esc_attr_e('Notification message', 'tbc-ca'); ?>"></textarea>
                            <p class="description"><span id="push-body-count">400</span> <?php _e('characters remaining', 'tbc-ca'); ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="push_route"><?php _e('Route (optional)', 'tbc-ca'); ?></label></th>
                        <td>
                            <input type="text" id="push_route" name="push_route" class="regular-text"
                                   placeholder="<?php esc_attr_e('e.g. /(tabs)/home or /feed/123', 'tbc-ca'); ?>" />
                            <p class="description"><?php _e('App route to open when notification is tapped. Leave empty for default.', 'tbc-ca'); ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><?php _e('Audience', 'tbc-ca'); ?></th>
                        <td>
                            <fieldset>
                                <label style="display: block; margin-bottom: 8px;">
                                    <input type="radio" name="push_audience" value="all" checked />
                                    <?php printf(__('All users with devices (%d users)', 'tbc-ca'), $total_users); ?>
                                </label>

                                <label style="display: block; margin-bottom: 4px;">
                                    <input type="radio" name="push_audience" value="space" />
                                    <?php _e('Specific space members', 'tbc-ca'); ?>
                                </label>
                                <div id="push-audience-space" style="margin-left: 24px; margin-bottom: 8px; display: none;">
                                    <select name="push_space_id" id="push_space_id">
                                        <option value=""><?php _e('Select a space...', 'tbc-ca'); ?></option>
                                        <?php foreach ($spaces as $space): ?>
                                            <option value="<?php echo esc_attr($space->id); ?>">
                                                <?php echo esc_html($space->title); ?>
                                            </option>
                                        <?php endforeach; ?>
                                    </select>
                                </div>

                                <label style="display: block; margin-bottom: 4px;">
                                    <input type="radio" name="push_audience" value="role" />
                                    <?php _e('Specific role(s)', 'tbc-ca'); ?>
                                </label>
                                <div id="push-audience-role" style="margin-left: 24px; margin-bottom: 8px; display: none;">
                                    <?php foreach ($fc_roles as $role_key => $role_label): ?>
                                        <label style="display: block; margin-bottom: 2px;">
                                            <input type="checkbox" name="push_roles[]" value="<?php echo esc_attr($role_key); ?>" />
                                            <?php echo esc_html($role_label); ?>
                                        </label>
                                    <?php endforeach; ?>
                                </div>

                                <label style="display: block; margin-bottom: 4px;">
                                    <input type="radio" name="push_audience" value="user" />
                                    <?php _e('Specific user', 'tbc-ca'); ?>
                                </label>
                                <div id="push-audience-user" style="margin-left: 24px; margin-bottom: 8px; display: none;">
                                    <input type="number" name="push_user_id" id="push_user_id" class="small-text"
                                           placeholder="<?php esc_attr_e('User ID', 'tbc-ca'); ?>" min="1" />
                                    <p class="description"><?php _e('Enter the WordPress user ID.', 'tbc-ca'); ?></p>
                                </div>
                            </fieldset>
                        </td>
                    </tr>
                </table>

                <p>
                    <span id="push-preview-count" style="margin-right: 10px; color: #666;"></span>
                    <button type="submit" name="tbc_ca_manual_push" value="1" class="button button-primary"
                            onclick="return confirm('<?php esc_attr_e('Send this push notification?', 'tbc-ca'); ?>');">
                        <?php _e('Send Notification', 'tbc-ca'); ?>
                    </button>
                </p>
            </form>
        </div>

        <script>
        (function() {
            // Character counters
            var titleInput = document.getElementById('push_title');
            var bodyInput = document.getElementById('push_body');
            var titleCount = document.getElementById('push-title-count');
            var bodyCount = document.getElementById('push-body-count');

            if (titleInput && titleCount) {
                titleInput.addEventListener('input', function() {
                    titleCount.textContent = 50 - this.value.length;
                });
            }
            if (bodyInput && bodyCount) {
                bodyInput.addEventListener('input', function() {
                    bodyCount.textContent = 400 - this.value.length;
                });
            }

            // Audience toggle
            var radios = document.querySelectorAll('input[name="push_audience"]');
            var panels = {
                space: document.getElementById('push-audience-space'),
                role: document.getElementById('push-audience-role'),
                user: document.getElementById('push-audience-user')
            };

            radios.forEach(function(radio) {
                radio.addEventListener('change', function() {
                    Object.keys(panels).forEach(function(key) {
                        if (panels[key]) {
                            panels[key].style.display = radio.value === key ? 'block' : 'none';
                        }
                    });
                    updatePreviewCount();
                });
            });

            // Preview count
            var previewEl = document.getElementById('push-preview-count');
            var nonce = '<?php echo esc_js($nonce); ?>';

            function updatePreviewCount() {
                var audience = document.querySelector('input[name="push_audience"]:checked');
                if (!audience || !previewEl) return;

                var data = new FormData();
                data.append('action', 'tbc_ca_push_preview_count');
                data.append('nonce', nonce);
                data.append('audience', audience.value);

                if (audience.value === 'space') {
                    var spaceSelect = document.getElementById('push_space_id');
                    data.append('space_id', spaceSelect ? spaceSelect.value : '');
                } else if (audience.value === 'role') {
                    document.querySelectorAll('input[name="push_roles[]"]:checked').forEach(function(cb) {
                        data.append('roles[]', cb.value);
                    });
                } else if (audience.value === 'user') {
                    var userInput = document.getElementById('push_user_id');
                    data.append('user_id', userInput ? userInput.value : '');
                }

                fetch(ajaxurl, { method: 'POST', body: data })
                    .then(function(r) { return r.json(); })
                    .then(function(resp) {
                        if (resp.success) {
                            previewEl.textContent = 'Will send to ~' + resp.data.count + ' user(s)';
                        }
                    })
                    .catch(function() {
                        previewEl.textContent = '';
                    });
            }

            // Update count on audience sub-option changes
            var spaceSelect = document.getElementById('push_space_id');
            if (spaceSelect) spaceSelect.addEventListener('change', updatePreviewCount);

            document.querySelectorAll('input[name="push_roles[]"]').forEach(function(cb) {
                cb.addEventListener('change', updatePreviewCount);
            });

            var userInput = document.getElementById('push_user_id');
            if (userInput) userInput.addEventListener('change', updatePreviewCount);

            // Initial count
            updatePreviewCount();
        })();
        </script>
        <?php
    }
}
