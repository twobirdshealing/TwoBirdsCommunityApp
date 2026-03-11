<?php
/**
 * TBC WooCommerce Calendar - Waitlist Class
 * 
 * Manages event waitlists with single-parameter URLs and full date-range awareness.
 * 
 * @package TBC_WC_Calendar
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Waitlist management class
 */
class TBC_WC_Waitlist {

    /**
     * Initialize waitlist functionality
     */
    public static function init() {
        add_filter('woocommerce_product_data_tabs', [__CLASS__, 'add_waitlist_tab']);
        add_action('woocommerce_product_data_panels', [__CLASS__, 'add_waitlist_tab_content']);
        add_action('wp_ajax_tbc_wc_send_waitlist_notification', [__CLASS__, 'send_waitlist_notification']);
        add_action('wp_ajax_tbc_wc_remove_from_waitlist', [__CLASS__, 'ajax_remove_from_waitlist']);

        add_action('init', [__CLASS__, 'process_waitlist_actions']);
        add_action('display_waitlist_button', [__CLASS__, 'display_waitlist_button'], 10, 2);
        add_shortcode('tbc_wc_waitlist', [__CLASS__, 'waitlist_shortcode']);
    }

    /**
     * ==========================================================================
     * HELPERS
     * ==========================================================================
     */

    /**
     * Get end date for an event
     */
    private static function get_end_date($product_id, $start_date, $stored_end_date = '') {
        if (!empty($stored_end_date)) return $stored_end_date;
        
        $events = tbc_wc_get_events($product_id, [
            'start_date' => $start_date,
            'end_date'   => $start_date,
        ]);
        
        foreach ($events as $e) {
            if ($e['start'] === $start_date) return $e['end'];
        }
        
        return $start_date;
    }

    /**
     * Get product title
     */
    private static function product_title($product_id) {
        $p = wc_get_product($product_id);
        return $p ? $p->get_name() : '';
    }

    /**
     * Get user profile link
     */
    private static function get_user_profile_link($user_id, $name) {
        if (function_exists('bp_core_get_user_domain')) {
            $url = bp_core_get_user_domain($user_id);
            if ($url) return '<a href="' . esc_url($url) . '">' . esc_html($name) . '</a>';
        }
        if (current_user_can('list_users')) {
            $url = get_edit_user_link($user_id);
            if ($url) return '<a href="' . esc_url($url) . '">' . esc_html($name) . '</a>';
        }
        return esc_html($name);
    }

    /**
     * Get user screening link
     */
    private static function get_user_screening_link($user_id) {
        if (!class_exists('GFAPI')) return '-';
        $entries = GFAPI::get_entries(1, ['field_filters' => [['key' => 'created_by', 'value' => $user_id]]]);
        if (!empty($entries) && !is_wp_error($entries)) {
            $entry_id = $entries[0]['id'];
            return '<a href="' . esc_url(admin_url("admin.php?page=gf_entries&view=entry&id=1&lid=$entry_id")) . '" target="_blank">View Screening</a>';
        }
        return '-';
    }

    /**
     * Format email status
     */
    private static function format_email_status($e) {
        $sent = (int)($e['sent_count'] ?? 0);
        $err  = (int)($e['error_count'] ?? 0);
        if (!$sent && !$err) return '—';
        $parts = [];
        if ($sent) $parts[] = $sent === 1 ? 'Sent' : "Sent x$sent";
        if ($err)  $parts[] = $err  === 1 ? 'Error' : "Error x$err";
        return implode(', ', $parts);
    }

    /**
     * ==========================================================================
     * ADMIN TAB
     * ==========================================================================
     */

    /**
     * Add waitlist tab
     */
    public static function add_waitlist_tab($tabs) {
        global $post;
        if (!tbc_wc_is_event_product($post)) return $tabs;
        $tabs['tbc_wc_waitlist_tab'] = [
            'label'  => __('Waitlist', 'tbc-wc-calendar'),
            'target' => 'tbc_wc_waitlist_data',
            'class'  => ['show_if_simple', 'show_if_variable'],
        ];
        return $tabs;
    }

    /**
     * Add waitlist tab content
     */
    public static function add_waitlist_tab_content() {
        global $post;
        if (!tbc_wc_is_event_product($post)) return;

        $product_id = $post->ID;
        $product    = wc_get_product($product_id);
        $waitlist   = self::get_product_waitlist($product_id);

        echo '<div id="tbc_wc_waitlist_data" class="panel woocommerce_options_panel">';

        if (empty($waitlist)) {
            echo '<p>No users on the waitlist for this product.</p></div>';
            return;
        }

        $event_dates = [];
        foreach ($waitlist as $entry) {
            $start = $entry['event_date'] ?? '';
            if (!$start) continue;
            
            $end = self::get_end_date($product_id, $start, $entry['event_end_date'] ?? '');
            $event_dates[$start] = tbc_wc_get_formatted_time($start, $end, []);
        }

        echo '<div class="tbc-wc-waitlist-filters">';
        echo '<label for="tbc-wc-filter-event-date">Filter by Event Date: </label>';
        echo '<select id="tbc-wc-filter-event-date"><option value="all">All Dates</option>';
        foreach ($event_dates as $date => $label) {
            echo '<option value="' . esc_attr($date) . '">' . esc_html($label) . '</option>';
        }
        echo '</select>';

        echo '<div class="tbc-wc-waitlist-bulk-actions">';
        echo '<button type="button" class="button tbc-wc-notify-selected" data-product-id="' . esc_attr($product_id) . '">Notify Selected</button> ';
        echo '<button type="button" class="button tbc-wc-remove-selected" data-product-id="' . esc_attr($product_id) . '">Remove Selected</button>';
        echo '</div></div>';

        echo '<table class="wp-list-table widefat fixed striped tbc-wc-waitlist-users-table"><thead><tr>';
        echo '<th class="check-column"><input type="checkbox" class="tbc-wc-select-all-checkbox" /></th>';
        echo '<th>Name</th><th>Screening</th><th>Email</th><th>Event Date</th><th>Date Added</th><th>Email Status</th><th>Actions</th>';
        echo '</tr></thead><tbody>';

        foreach ($waitlist as $entry) {
            $uid  = (int)($entry['user_id'] ?? 0);
            $name = $entry['name'] ?? '';
            $mail = $entry['email'] ?? '';
            $start = $entry['event_date'] ?? '';
            if (!$start) continue;
            
            $end = self::get_end_date($product_id, $start, $entry['event_end_date'] ?? '');
            $range = tbc_wc_get_formatted_time($start, $end, []);

            echo '<tr data-event-date="' . esc_attr($start) . '" data-user-id="' . esc_attr($uid) . '">';
            echo '<td><input type="checkbox" class="tbc-wc-user-select" data-user-id="' . esc_attr($uid) . '" data-event-date="' . esc_attr($start) . '" /></td>';
            echo '<td>' . self::get_user_profile_link($uid, $name) . '</td>';
            echo '<td>' . self::get_user_screening_link($uid) . '</td>';
            echo '<td>' . esc_html($mail) . '</td>';
            echo '<td>' . esc_html($range) . '</td>';
            echo '<td>' . date_i18n(get_option('date_format') . ' ' . get_option('time_format'), strtotime($entry['date_added'])) . '</td>';
            echo '<td class="tbc-wc-email-status">' . esc_html(self::format_email_status($entry)) . '</td>';
            echo '<td>';
            echo '<button type="button" class="button tbc-wc-notify-user" data-product-id="' . esc_attr($product_id) . '" data-event-date="' . esc_attr($start) . '" data-user-id="' . esc_attr($uid) . '">Notify</button> ';
            echo '<button type="button" class="button tbc-wc-remove-user" data-product-id="' . esc_attr($product_id) . '" data-event-date="' . esc_attr($start) . '" data-user-id="' . esc_attr($uid) . '">Remove</button>';
            echo '</td></tr>';
        }

        echo '</tbody></table>';

        echo '<div class="tbc-wc-waitlist-email-settings">';
        echo '<h3>Email Settings</h3>';
        echo '<p><strong>Available Placeholders:</strong><br>';
        echo '<code>{product_title}</code> - Product name<br>';
        echo '<code>{event_date}</code> - Event date range<br>';
        echo '<code>{event_url}</code> - Link to event page</p>';

        $subject = get_option('tbc_wc_waitlist_subject', 'Spots Available for {product_title}');
        $content = get_option('tbc_wc_waitlist_content', 
            "Good news! Spots are now available for {product_title} on {event_date}.\n\n" .
            "Register now: {event_url}\n\n" .
            "This is an automated notification. You received this because you joined the waitlist for this event."
        );

        echo '<table class="form-table"><tbody>';
        echo '<tr><th scope="row"><label for="tbc-wc-waitlist-email-subject">Email Subject</label></th><td>';
        echo '<input type="text" id="tbc-wc-waitlist-email-subject" name="tbc_wc_waitlist_email_subject" value="' . esc_attr($subject) . '" class="large-text" />';
        echo '</td></tr>';
        echo '<tr><th scope="row"><label for="tbc-wc-waitlist-email-content">Email Content</label></th><td>';
        echo '<textarea id="tbc-wc-waitlist-email-content" name="tbc_wc_waitlist_email_content" rows="10" class="large-text">' . esc_textarea($content) . '</textarea>';
        echo '</td></tr>';
        echo '</tbody></table>';

        echo '<button type="button" class="button button-primary tbc-wc-save-email-settings">Save Email Settings</button>';
        echo '</div>';

        echo '<script>
        jQuery(function($) {
            $(".tbc-wc-save-email-settings").on("click", function() {
                var subject = $("#tbc-wc-waitlist-email-subject").val();
                var content = $("#tbc-wc-waitlist-email-content").val();
                $.post(ajaxurl, {
                    action: "tbc_wc_save_waitlist_email_settings",
                    nonce: "' . wp_create_nonce('tbc_wc_waitlist_admin') . '",
                    subject: subject,
                    content: content
                }, function(response) {
                    if (response.success) {
                        alert("Email settings saved successfully!");
                    } else {
                        alert("Error saving settings: " + (response.data || "Unknown error"));
                    }
                });
            });
        });
        </script>';

        echo '</div>';
    }

    /**
     * ==========================================================================
     * DATA MANAGEMENT
     * ==========================================================================
     */

    /**
     * Get product waitlist
     */
    public static function get_product_waitlist($product_id) {
        $waitlist = get_option("tbc_wc_waitlist_{$product_id}", []);
        return is_array($waitlist) ? $waitlist : [];
    }

    /**
     * Add user to waitlist
     */
    public static function add_to_waitlist($product_id, $event_date, $user_id, $event_end_date = '') {
        $waitlist = self::get_product_waitlist($product_id);
        $user = get_userdata($user_id);
        if (!$user) return false;

        foreach ($waitlist as $entry) {
            if ((int)($entry['user_id'] ?? 0) === $user_id && ($entry['event_date'] ?? '') === $event_date) {
                return false;
            }
        }

        $waitlist[] = [
            'user_id'        => $user_id,
            'name'           => $user->display_name,
            'email'          => $user->user_email,
            'event_date'     => $event_date,
            'event_end_date' => $event_end_date,
            'product_title'  => self::product_title($product_id),
            'date_added'     => current_time('mysql'),
            'sent_count'     => 0,
            'error_count'    => 0,
        ];

        return update_option("tbc_wc_waitlist_{$product_id}", $waitlist);
    }

    /**
     * Remove user from waitlist
     */
    public static function remove_from_waitlist($product_id, $event_date, $user_id) {
        $waitlist = self::get_product_waitlist($product_id);
        $updated = array_filter($waitlist, function($entry) use ($user_id, $event_date) {
            return !((int)($entry['user_id'] ?? 0) === $user_id && ($entry['event_date'] ?? '') === $event_date);
        });
        return update_option("tbc_wc_waitlist_{$product_id}", array_values($updated));
    }

    /**
     * Check if user is on waitlist
     */
    public static function is_user_on_waitlist($product_id, $event_date, $user_id = null) {
        if (!$user_id) $user_id = get_current_user_id();
        if (!$user_id) return false;

        $waitlist = self::get_product_waitlist($product_id);
        foreach ($waitlist as $entry) {
            if ((int)($entry['user_id'] ?? 0) === $user_id && ($entry['event_date'] ?? '') === $event_date) {
                return true;
            }
        }
        return false;
    }

    /**
     * ==========================================================================
     * FRONTEND ACTIONS
     * ==========================================================================
     */

    /**
     * Process waitlist actions
     */
    public static function process_waitlist_actions() {
        if (!isset($_GET['tbc_wc_waitlist_action']) || !isset($_GET['_wpnonce'])) return;
        if (!wp_verify_nonce($_GET['_wpnonce'], 'tbc_wc_waitlist')) return;

        $action = sanitize_text_field($_GET['tbc_wc_waitlist_action']);
        $product_id = absint($_GET['product_id'] ?? 0);
        $event_date = sanitize_text_field($_GET['event_date'] ?? '');
        $user_id = get_current_user_id();

        if (!$product_id || !$event_date || !$user_id) return;

        $event_end_date = self::get_end_date($product_id, $event_date);

        if ($action === 'join') {
            self::add_to_waitlist($product_id, $event_date, $user_id, $event_end_date);
        } elseif ($action === 'leave') {
            self::remove_from_waitlist($product_id, $event_date, $user_id);
        }

        wp_redirect(tbc_wc_get_event_url($product_id, $event_date));
        exit;
    }

    /**
     * Display waitlist button
     */
    public static function display_waitlist_button($product = null, $event_date = '') {
        if (!$product) {
            global $product;
        }
        $product_id = is_numeric($product) ? $product : null;
        if (!$product_id) $product_id = $product->get_id();
        if (!tbc_wc_is_event_product($product_id)) return;

        $event_date = $event_date ?: sanitize_text_field($_GET['selected_date'] ?? '');
        if (empty($event_date)) return;

        if ($event_date < current_time('Y-m-d')) return;

        if (self::is_user_on_waitlist($product_id, $event_date)) {
            $leave_url = wp_nonce_url(add_query_arg([
                'tbc_wc_waitlist_action' => 'leave',
                'product_id' => $product_id,
                'event_date' => $event_date,
            ], tbc_wc_get_event_url($product_id, $event_date)), 'tbc_wc_waitlist');

            echo '<div class="bp-feedback success tbc-wc-waitlist-notification"><span class="bp-icon" aria-hidden="true"></span>';
            echo '<p>You are on the waitlist for this event.</p>';
            echo '<p><a href="' . esc_url($leave_url) . '" class="tbc-wc-btn-leave-waitlist">Leave Waitlist</a></p></div>';
        } else {
            if (is_user_logged_in()) {
                $join_url = wp_nonce_url(add_query_arg([
                    'tbc_wc_waitlist_action' => 'join',
                    'product_id' => $product_id,
                    'event_date' => $event_date,
                ], tbc_wc_get_event_url($product_id, $event_date)), 'tbc_wc_waitlist');

                echo '<div class="bp-feedback info tbc-wc-waitlist-notification"><span class="bp-icon" aria-hidden="true"></span>';
                echo '<p>Stay updated on availability.</p>';
                echo '<p><a href="' . esc_url($join_url) . '" class="tbc-wc-btn-join-waitlist">Join Waitlist</a></p></div>';
            } else {
                echo '<div class="bp-feedback info tbc-wc-waitlist-notification"><span class="bp-icon" aria-hidden="true"></span>';
                echo '<p>Stay updated on availability. <a href="' . esc_url(wp_login_url(get_permalink($product_id))) . '">Log in to join the waitlist</a>.</p></div>';
            }
        }
    }

    /**
     * Waitlist shortcode for user-facing "My Waitlists"
     */
    public static function waitlist_shortcode($atts) {
        if (!is_user_logged_in()) return '<p>Please log in to view your waitlist.</p>';

        global $wpdb;
        $user_id = get_current_user_id();
        $today = current_time('Y-m-d');

        $rows = $wpdb->get_results("SELECT option_name, option_value FROM {$wpdb->options} WHERE option_name LIKE 'tbc_wc_waitlist_%'");

        $items = [];
        foreach ($rows as $row) {
            if (!preg_match('/tbc_wc_waitlist_(\d+)$/', $row->option_name, $m)) continue;
            $pid = (int)$m[1];
            $list = maybe_unserialize($row->option_value);
            if (!is_array($list)) continue;

            foreach ($list as $e) {
                if ((int)($e['user_id'] ?? 0) !== $user_id) continue;
                $start = $e['event_date'] ?? '';
                if (!$start || $start < $today) continue;

                $end = self::get_end_date($pid, $start, $e['event_end_date'] ?? '');
                $title = $e['product_title'] ?? self::product_title($pid);

                $items[] = [
                    'pid'   => $pid,
                    'title' => $title,
                    'start' => $start,
                    'end'   => $end,
                    'added' => $e['date_added'] ?? '',
                ];
            }
        }

        if (empty($items)) return '<p>You are not currently on any waitlists.</p>';

        usort($items, fn($a,$b) => strtotime($a['start']) <=> strtotime($b['start']));

        $html = '<div class="tbc-wc-waitlist"><h3>My Waitlists</h3><ul class="tbc-wc-waitlist-items">';
        foreach ($items as $it) {
            $range = tbc_wc_get_formatted_time($it['start'], $it['end'], []);
            $url   = tbc_wc_get_event_url($it['pid'], $it['start']);
            $html .= '<li class="tbc-wc-waitlist-item">';
            $html .= '<strong><a href="' . esc_url($url) . '">' . esc_html($it['title']) . '</a></strong><br>';
            $html .= 'Event Date: ' . esc_html($range) . '<br>';
            if (!empty($it['added'])) {
                $html .= '<small>Added on: ' . date_i18n(get_option('date_format'), strtotime($it['added'])) . '</small>';
            }
            $html .= '</li>';
        }
        $html .= '</ul></div>';

        return $html;
    }

    /**
     * ==========================================================================
     * ADMIN AJAX
     * ==========================================================================
     */

    /**
     * Send waitlist notification
     */
    public static function send_waitlist_notification() {
        check_ajax_referer('tbc_wc_waitlist_admin', 'nonce');

        $pid     = absint($_POST['product_id'] ?? 0);
        $date    = sanitize_text_field($_POST['event_date'] ?? '');
        $uids    = array_map('absint', (array)($_POST['user_ids'] ?? []));
        $subject = sanitize_text_field($_POST['subject'] ?? '');
        $content = sanitize_textarea_field($_POST['content'] ?? '');

        if (!$pid || empty($uids) || !$subject || !$content) {
            wp_send_json_error('Missing required parameters'); return;
        }

        $w = self::get_product_waitlist($pid);
        $sent = 0; $updates = [];

        foreach ($w as &$e) {
            $uid   = (int)($e['user_id'] ?? 0);
            $start = $e['event_date'] ?? '';
            if (!$uid || !$start) continue;

            if (!in_array($uid, $uids, true)) continue;
            if (!empty($date) && $start !== $date) continue;

            $end = self::get_end_date($pid, $start, $e['event_end_date'] ?? '');
            $title = self::product_title($pid);

            $range = tbc_wc_get_formatted_time($start, $end, []);
            $url   = tbc_wc_get_event_url($pid, $start);

            $mail_subject = str_replace(['{product_title}'], [$title], $subject);
            $mail_body    = str_replace(
                ['{product_title}', '{event_date}', '{event_url}'],
                [$title, $range, $url],
                $content
            );

            $headers = [
                'Content-Type: text/plain; charset=UTF-8',
                'From: ' . get_bloginfo('name') . ' <' . get_option('admin_email') . '>',
                'Reply-To: ' . get_option('admin_email'),
            ];

            $ok = wp_mail($e['email'], $mail_subject, $mail_body, $headers);
            $e['last_attempt'] = current_time('Y-m-d');
            if ($ok) { $e['sent_count'] = (int)($e['sent_count'] ?? 0) + 1; $sent++; }
            else     { $e['error_count'] = (int)($e['error_count'] ?? 0) + 1; }

            $updates[] = [
                'user_id'     => $uid,
                'event_date'  => $start,
                'status_text' => self::format_email_status($e),
            ];
        }

        update_option("tbc_wc_waitlist_{$pid}", $w);

        wp_send_json_success([
            'message'        => sprintf('Notification sent to %d users', $sent),
            'count'          => $sent,
            'status_updates' => $updates,
        ]);
    }

    /**
     * Remove user from waitlist via AJAX
     */
    public static function ajax_remove_from_waitlist() {
        check_ajax_referer('tbc_wc_waitlist_admin', 'nonce');
        $pid  = absint($_POST['product_id'] ?? 0);
        $date = sanitize_text_field($_POST['event_date'] ?? '');
        $uid  = absint($_POST['user_id'] ?? 0);
        if (!$pid || !$date || !$uid) { wp_send_json_error('Missing required parameters'); return; }
        $ok = self::remove_from_waitlist($pid, $date, $uid);
        $ok ? wp_send_json_success(['message' => 'User removed from waitlist']) : wp_send_json_error('Failed to remove user from waitlist');
    }
}

TBC_WC_Waitlist::init();