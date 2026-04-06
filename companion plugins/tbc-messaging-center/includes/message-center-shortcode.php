<?php
/**
 * Message Center Shortcode - Chat UI
 * Two-panel layout with conversation list and message thread
 */

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get avatar HTML and initials for a user
 *
 * @param int $user_id WordPress user ID
 * @param int $size Avatar size in pixels (default 48)
 * @return array Contains 'html', 'initials', 'class'
 */
function tbc_mc_get_avatar_data($user_id, $size = 48) {
    static $cache = [];
    $cache_key = $user_id . '_' . $size;
    if (isset($cache[$cache_key])) {
        return $cache[$cache_key];
    }

    $avatar_html = '';
    $initials = '?';
    $avatar_class = 'tbc-mc-guest';

    if ($user_id) {
        $first_name = get_user_meta($user_id, 'first_name', true);
        $last_name = get_user_meta($user_id, 'last_name', true);
        $initials = strtoupper(substr($first_name, 0, 1) . substr($last_name, 0, 1)) ?: '?';
        $avatar_class = '';

        if (class_exists('FluentCommunity\App\Models\XProfile')) {
            try {
                $xp = \FluentCommunity\App\Models\XProfile::find($user_id);
                if ($xp && !empty($xp->avatar)) {
                    $avatar_html = '<img src="' . esc_url($xp->avatar) . '" class="avatar" width="' . $size . '" height="' . $size . '" />';
                }
            } catch (\Exception $e) {
                // fallback below
            }
        }
        if (empty($avatar_html)) {
            $avatar_url = get_avatar_url($user_id, ['size' => $size]);
            if ($avatar_url) {
                $avatar_html = '<img src="' . esc_url($avatar_url) . '" class="avatar" width="' . $size . '" height="' . $size . '" />';
            }
        }
    }

    $result = [
        'html' => $avatar_html,
        'initials' => $initials,
        'class' => $avatar_class
    ];
    $cache[$cache_key] = $result;
    return $result;
}

// ============================================================================
// MAIN SHORTCODE
// ============================================================================

function tbc_mc_message_center_shortcode() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'tbc_mc_messages';

    // Get filter counts
    $total_conversations = $wpdb->get_var("SELECT COUNT(DISTINCT sender_number) FROM $table_name");
    $unread_conversations = $wpdb->get_var("SELECT COUNT(DISTINCT sender_number) FROM $table_name WHERE is_read = 0");
    $starred_conversations = $wpdb->get_var("SELECT COUNT(DISTINCT sender_number) FROM $table_name WHERE marked = 1");

    // Get conversations for initial load
    $conversations = $wpdb->get_results("
        SELECT sender_number,
               MAX(date_created) as recent_date,
               SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread_count,
               SUM(CASE WHEN marked = 1 THEN 1 ELSE 0 END) as starred_count,
               (SELECT content FROM $table_name m2 WHERE m2.sender_number = m1.sender_number ORDER BY date_created DESC LIMIT 1) as last_message,
               (SELECT type FROM $table_name m2 WHERE m2.sender_number = m1.sender_number ORDER BY date_created DESC LIMIT 1) as last_type
        FROM $table_name m1
        GROUP BY sender_number
        ORDER BY recent_date DESC
        LIMIT 50
    ");

    ob_start();
    ?>
    <div class="tbc-mc-container">
        <!-- Tab Navigation -->
        <div class="tbc-mc-tabs">
            <div class="tbc-mc-tab active" data-tab="inbox">Inbox</div>
            <div class="tbc-mc-tab" data-tab="send">Send SMS</div>
            <div class="tbc-mc-tab" data-tab="scheduled">Scheduled</div>
            <div class="tbc-mc-tab" data-tab="call">Call</div>
            <?php if (current_user_can('manage_options')) : ?>
            <div class="tbc-mc-tab" data-tab="settings">Settings</div>
            <?php endif; ?>
        </div>

        <!-- Tab Content: Inbox -->
        <div class="tbc-mc-tab-content" data-content="inbox">
            <!-- Header with Search + Bulk Actions -->
            <div class="tbc-mc-header">
            <div class="tbc-mc-search-wrapper">
                <input type="text" class="tbc-mc-search" placeholder="Search messages..." />
                <div class="tbc-mc-search-filter">
                    <button class="tbc-mc-search-filter-btn">All ▼</button>
                    <div class="tbc-mc-search-filter-dropdown">
                        <div class="tbc-mc-search-filter-option active" data-direction="all">All Messages</div>
                        <div class="tbc-mc-search-filter-option" data-direction="received">Received Only</div>
                        <div class="tbc-mc-search-filter-option" data-direction="sent">Sent Only</div>
                    </div>
                </div>
            </div>
            <div class="tbc-mc-bulk-actions">
                <button class="tbc-mc-mark-all-read" data-filter="all">Mark All Read</button>
                <button class="tbc-mc-bulk-delete" disabled>🗑️ Delete</button>
                <button class="tbc-mc-bulk-star" disabled>⭐ Star</button>
            </div>
        </div>

        <!-- Two-Panel Layout -->
        <div class="tbc-mc-panels">
            <!-- Left: Conversation List -->
            <div class="tbc-mc-conversation-list">
                <div class="tbc-mc-filters">
                    <button class="tbc-mc-filter-btn active" data-filter="all">
                        All <span class="tbc-mc-filter-count">(<?php echo $total_conversations; ?>)</span>
                    </button>
                    <button class="tbc-mc-filter-btn" data-filter="unread">
                        Unread <span class="tbc-mc-filter-count">(<?php echo $unread_conversations; ?>)</span>
                    </button>
                    <button class="tbc-mc-filter-btn" data-filter="starred">
                        Starred <span class="tbc-mc-filter-count">(<?php echo $starred_conversations; ?>)</span>
                    </button>
                </div>
                <div class="tbc-mc-conversations">
                    <?php
                    if (empty($conversations)) {
                        echo '<div class="tbc-mc-empty-state"><p>No messages yet</p></div>';
                    } else {
                        foreach ($conversations as $conversation) {
                            echo tbc_mc_render_conversation_item($conversation);
                        }
                    }
                    ?>
                </div>
            </div>

            <!-- Right: Message Thread -->
            <div class="tbc-mc-thread-panel empty">
                <div class="tbc-mc-empty-state">
                    <span class="bb-icon bb-icon-comment-activity"></span>
                    <p>Select a conversation to view messages</p>
                </div>
            </div>
        </div>

            <!-- Slide-over Reply Panel -->
            <div class="tbc-mc-reply-panel">
                <div class="tbc-mc-reply-panel-header">
                    <button class="tbc-mc-close-reply">&times;</button>
                    <span class="tbc-mc-reply-panel-title">Reply</span>
                </div>
                <div class="tbc-mc-reply-panel-content">
                    <!-- SMS form will be loaded here via AJAX -->
                </div>
            </div>
            <div class="tbc-mc-overlay"></div>
        </div><!-- End Inbox Tab -->

        <!-- Tab Content: Send SMS (lazy loaded) -->
        <div class="tbc-mc-tab-content hidden" data-content="send">
            <div class="tbc-mc-loading">Loading Send SMS...</div>
        </div>

        <!-- Tab Content: Scheduled (lazy loaded) -->
        <div class="tbc-mc-tab-content hidden" data-content="scheduled">
            <div class="tbc-mc-loading">Loading Scheduled Messages...</div>
        </div>

        <!-- Tab Content: Call (lazy loaded) -->
        <div class="tbc-mc-tab-content hidden" data-content="call">
            <div class="tbc-mc-loading">Loading Call Center...</div>
        </div>

        <?php if (current_user_can('manage_options')) : ?>
        <!-- Tab Content: Settings (lazy loaded) -->
        <div class="tbc-mc-tab-content hidden" data-content="settings">
            <div class="tbc-mc-loading">Loading Settings...</div>
        </div>
        <?php endif; ?>
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode('tbc_mc_message_center', 'tbc_mc_message_center_shortcode');

// ============================================================================
// RENDER HELPERS
// ============================================================================

/**
 * Render a single conversation item for the list
 */
function tbc_mc_render_conversation_item($conversation) {
    $sender_number = $conversation->sender_number;
    $formatted_sender_number = tbc_mc_format_phone($sender_number);

    // Get sender info
    $sender_id = tbc_mc_get_user_by_phone($formatted_sender_number);
    $sender_name = 'Unknown';

    if ($sender_id) {
        $first_name = get_user_meta($sender_id, 'first_name', true);
        $last_name = get_user_meta($sender_id, 'last_name', true);
        $sender_name = trim("$first_name $last_name") ?: 'Unknown';
    }

    // Get avatar using helper
    $avatar_data = tbc_mc_get_avatar_data($sender_id, 48);
    $avatar_html = $avatar_data['html'];
    $initials = $avatar_data['initials'];
    $avatar_class = $avatar_data['class'];

    // Format time
    $time_ago = human_time_diff(strtotime($conversation->recent_date), current_time('timestamp'));

    // Preview text
    $preview = $conversation->last_type === 'voicemail' ? '🎤 Voicemail' : wp_trim_words($conversation->last_message, 8, '...');

    // Unread and starred status
    $unread_class = ($conversation->unread_count > 0) ? ' unread' : '';
    $is_starred = isset($conversation->starred_count) && $conversation->starred_count > 0;

    $html = "<div class='tbc-mc-conversation-item{$unread_class}'
                  data-phone='" . esc_attr($sender_number) . "'
                  data-name='" . esc_attr($sender_name) . "'
                  data-user-id='" . esc_attr($sender_id ?: 0) . "'>";

    $html .= "<input type='checkbox' class='tbc-mc-select' />";

    // Avatar with Fluent Community image or initials fallback
    $html .= "<div class='tbc-mc-avatar {$avatar_class}'>";
    if (!empty($avatar_html)) {
        $html .= $avatar_html;
    } else {
        $html .= "<span class='tbc-mc-initials'>" . esc_html($initials) . "</span>";
    }
    $html .= "</div>";

    $html .= "<div class='tbc-mc-conversation-info'>";
    $html .= "<span class='tbc-mc-contact-name'>" . esc_html($sender_name);
    if ($is_starred) {
        $html .= " <span class='tbc-mc-starred-indicator'>⭐</span>";
    }
    $html .= "</span>";
    $html .= "<span class='tbc-mc-preview'>" . esc_html($preview) . "</span>";
    $html .= "</div>";

    $html .= "<span class='tbc-mc-time'>" . esc_html($time_ago) . "</span>";

    if ($conversation->unread_count > 0) {
        $html .= "<span class='tbc-mc-unread-dot'></span>";
    }

    $html .= "</div>";

    return $html;
}

/**
 * Render a chat bubble for a single message
 */
function tbc_mc_render_chat_bubble($message) {
    $is_sent = ($message->is_reply && $message->type === 'sms');
    $direction_class = $is_sent ? 'tbc-mc-sent' : 'tbc-mc-received';
    $type_class = ($message->type === 'voicemail') ? ' tbc-mc-voicemail' : '';
    $is_starred = ($message->marked == 1);
    $starred_class = $is_starred ? ' tbc-mc-starred' : '';

    $formatted_time = date("g:i A", strtotime($message->date_created));
    $formatted_date = date("M j", strtotime($message->date_created));

    $star_btn_class = $is_starred ? 'starred' : '';

    // Get avatar for bubble using helper
    if ($is_sent) {
        // Sent messages: use admin user (ID 1) avatar
        $avatar_data = tbc_mc_get_avatar_data(1, 28);
    } else {
        // Received messages: use sender's avatar
        $formatted_phone = tbc_mc_format_phone($message->sender_number);
        $sender_id = tbc_mc_get_user_by_phone($formatted_phone);
        $avatar_data = tbc_mc_get_avatar_data($sender_id, 28);
    }
    $avatar_html = $avatar_data['html'];
    $initials = $avatar_data['initials'];

    // Build bubble avatar
    $bubble_avatar = "<div class='tbc-mc-bubble-avatar'>";
    if (!empty($avatar_html)) {
        $bubble_avatar .= $avatar_html;
    } else {
        $bubble_avatar .= "<span class='tbc-mc-bubble-initials'>{$initials}</span>";
    }
    $bubble_avatar .= "</div>";

    $html = "<div class='tbc-mc-bubble-row {$direction_class}'>";
    $html .= $bubble_avatar;
    $html .= "<div class='tbc-mc-bubble {$direction_class}{$type_class}{$starred_class}' data-message-id='" . esc_attr($message->id) . "'>";

    if ($message->type === 'voicemail') {
        // Voicemail with audio player
        $html .= "<audio controls><source src='" . esc_url($message->media_url) . "' type='audio/mpeg'></audio>";
        if (!empty($message->content)) {
            $html .= "<p class='tbc-mc-transcription'>" . esc_html($message->content) . "</p>";
        }
    } else {
        // SMS content
        $html .= "<div class='tbc-mc-bubble-content'>" . esc_html($message->content) . "</div>";

        // Media attachments
        if (!empty($message->media_url)) {
            $media_urls = explode(',', $message->media_url);
            $html .= "<div class='tbc-mc-bubble-media'>";
            foreach ($media_urls as $media_url) {
                $media_url = trim($media_url);
                if (preg_match('/\.(jpeg|jpg|png|gif|webp)$/i', $media_url)) {
                    $html .= "<img src='" . esc_url($media_url) . "' alt='Attachment' onclick='window.open(this.src)' />";
                }
            }
            $html .= "</div>";
        }
    }

    // Footer with timestamp, star, note, and delete
    $has_note = !empty($message->notes);
    $note_btn_class = $has_note ? 'has-note' : '';

    $html .= "<div class='tbc-mc-bubble-footer'>";
    $html .= "<span class='tbc-mc-bubble-time'>{$formatted_date} {$formatted_time}</span>";
    $html .= "<div class='tbc-mc-bubble-actions-footer'>";
    $html .= "<span class='tbc-mc-bubble-star tbc-mc-star-btn {$star_btn_class}' title='Star'>★</span>";
    $html .= "<span class='tbc-mc-bubble-note tbc-mc-note-btn {$note_btn_class}' title='Add Note'>📝</span>";
    $html .= "<span class='tbc-mc-bubble-delete tbc-mc-delete-btn' title='Delete'>×</span>";
    $html .= "</div>";
    $html .= "</div>";

    // Display note if exists
    if ($has_note) {
        $html .= "<div class='tbc-mc-bubble-note-display'>" . esc_html($message->notes) . "</div>";
    }

    $html .= "</div>"; // Close bubble
    $html .= "</div>"; // Close bubble-row

    return $html;
}

/**
 * Render the thread panel content (header + messages + reply bar)
 */
function tbc_mc_render_thread_panel($phone, $messages) {
    $formatted_phone = tbc_mc_format_phone($phone);
    $sender_id = tbc_mc_get_user_by_phone($formatted_phone);

    $sender_name = 'Unknown';
    $profile_url = '#';

    if ($sender_id) {
        $first_name = get_user_meta($sender_id, 'first_name', true);
        $last_name = get_user_meta($sender_id, 'last_name', true);
        $sender_name = trim("$first_name $last_name") ?: 'Unknown';

        if (class_exists('FluentCommunity\App\Models\XProfile')) {
            try {
                $xp = \FluentCommunity\App\Models\XProfile::find($sender_id);
                if ($xp) {
                    $profile_url = $xp->permalink;
                }
            } catch (\Exception $e) {
                // keep default '#'
            }
        }
    }

    // Get avatar using helper
    $avatar_data = tbc_mc_get_avatar_data($sender_id, 40);
    $avatar_html = $avatar_data['html'];
    $initials = $avatar_data['initials'];
    $avatar_class = $avatar_data['class'];

    ob_start();
    ?>
    <div class="tbc-mc-thread-header">
        <button class="tbc-mc-back-btn">← Back</button>
        <div class="tbc-mc-thread-avatar <?php echo esc_attr($avatar_class); ?>">
            <?php if (!empty($avatar_html)) : ?>
                <?php echo $avatar_html; ?>
            <?php else : ?>
                <span class="tbc-mc-initials"><?php echo esc_html($initials); ?></span>
            <?php endif; ?>
        </div>
        <div class="tbc-mc-thread-info">
            <a href="<?php echo esc_url($profile_url); ?>" class="tbc-mc-thread-name"><?php echo esc_html($sender_name); ?></a>
            <span class="tbc-mc-thread-phone"><?php echo esc_html($formatted_phone); ?></span>
        </div>
    </div>

    <div class="tbc-mc-messages">
        <?php
        // Group messages by date and render
        $current_date = '';
        $messages_reversed = array_reverse($messages); // Show oldest first

        foreach ($messages_reversed as $message) {
            $msg_date = date('Y-m-d', strtotime($message->date_created));

            if ($msg_date !== $current_date) {
                $current_date = $msg_date;
                $display_date = date('F j, Y', strtotime($message->date_created));
                echo "<div class='tbc-mc-date-separator'><span>{$display_date}</span></div>";
            }

            echo tbc_mc_render_chat_bubble($message);
        }
        ?>
    </div>

    <div class="tbc-mc-reply-bar">
        <button class="tbc-mc-reply-btn" data-phone="<?php echo esc_attr($phone); ?>" data-name="<?php echo esc_attr($sender_name); ?>">Reply</button>
        <button class="tbc-mc-call-btn" data-phone="<?php echo esc_attr($phone); ?>">Call</button>
    </div>
    <?php
    return ob_get_clean();
}

// ============================================================================
// AJAX HANDLERS - NEW
// ============================================================================

/**
 * Load thread messages for a conversation
 */
function tbc_mc_get_thread_handler() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    global $wpdb;
    $table_name = $wpdb->prefix . 'tbc_mc_messages';

    $phone = sanitize_text_field($_POST['phone']);

    $messages = $wpdb->get_results($wpdb->prepare("
        SELECT * FROM $table_name
        WHERE sender_number = %s
        ORDER BY date_created DESC
        LIMIT 100
    ", $phone));

    if (empty($messages)) {
        wp_send_json_error(['message' => 'No messages found']);
        return;
    }

    // Mark as read
    $wpdb->update($table_name, ['is_read' => 1], ['sender_number' => $phone, 'is_read' => 0]);

    $html = tbc_mc_render_thread_panel($phone, $messages);

    wp_send_json_success(['html' => $html]);
}
add_action('wp_ajax_tbc_mc_get_thread', 'tbc_mc_get_thread_handler');

/**
 * Search messages
 */
function tbc_mc_search_handler() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    global $wpdb;
    $table_name = $wpdb->prefix . 'tbc_mc_messages';

    $query = sanitize_text_field($_POST['query']);
    $filter = sanitize_text_field($_POST['filter'] ?? 'all');
    $direction = sanitize_text_field($_POST['direction'] ?? 'all');

    if (strlen($query) < 2) {
        wp_send_json_error(['message' => 'Query too short']);
        return;
    }

    $filter_where = '';
    if ($filter === 'unread') {
        $filter_where = 'AND is_read = 0';
    } elseif ($filter === 'starred') {
        $filter_where = 'AND marked = 1';
    }

    // Direction filter (received = not reply, sent = is reply)
    $direction_where = '';
    if ($direction === 'received') {
        $direction_where = 'AND (is_reply = 0 OR is_reply IS NULL)';
    } elseif ($direction === 'sent') {
        $direction_where = 'AND is_reply = 1';
    }

    // Search in content
    $conversations = $wpdb->get_results($wpdb->prepare("
        SELECT sender_number,
               MAX(date_created) as recent_date,
               SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread_count,
               SUM(CASE WHEN marked = 1 THEN 1 ELSE 0 END) as starred_count,
               (SELECT content FROM $table_name m2 WHERE m2.sender_number = m1.sender_number ORDER BY date_created DESC LIMIT 1) as last_message,
               (SELECT type FROM $table_name m2 WHERE m2.sender_number = m1.sender_number ORDER BY date_created DESC LIMIT 1) as last_type
        FROM $table_name m1
        WHERE content LIKE %s $filter_where $direction_where
        GROUP BY sender_number
        ORDER BY recent_date DESC
        LIMIT 30
    ", '%' . $wpdb->esc_like($query) . '%'));

    $html = '';
    foreach ($conversations as $conversation) {
        $html .= tbc_mc_render_conversation_item($conversation);
    }

    if (empty($html)) {
        $html = '<div class="tbc-mc-empty-state"><p>No results found</p></div>';
    }

    wp_send_json_success(['html' => $html]);
}
add_action('wp_ajax_tbc_mc_search', 'tbc_mc_search_handler');

/**
 * Mark all messages as read
 */
function tbc_mc_mark_all_read_handler() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    global $wpdb;
    $table_name = $wpdb->prefix . 'tbc_mc_messages';

    $filter = sanitize_text_field($_POST['filter'] ?? 'all');

    if ($filter === 'starred') {
        $updated = $wpdb->update($table_name, ['is_read' => 1], ['marked' => 1, 'is_read' => 0]);
    } else {
        $updated = $wpdb->update($table_name, ['is_read' => 1], ['is_read' => 0]);
    }

    // Get new counts
    $unread_count = $wpdb->get_var("SELECT COUNT(DISTINCT sender_number) FROM $table_name WHERE is_read = 0");

    tbc_mc_ajax_feedback('success', 'All messages marked as read', ['unread_count' => $unread_count]);
}
add_action('wp_ajax_tbc_mc_mark_all_read', 'tbc_mc_mark_all_read_handler');

/**
 * Bulk actions (delete, star, read)
 */
function tbc_mc_bulk_action_handler() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => 'Insufficient permissions']);
    }

    global $wpdb;
    $table_name = $wpdb->prefix . 'tbc_mc_messages';

    $action = sanitize_text_field($_POST['bulk_action']);
    $phones = array_map('sanitize_text_field', $_POST['phones'] ?? []);

    if (empty($phones)) {
        tbc_mc_ajax_feedback('error', 'No conversations selected');
        return;
    }

    $placeholders = implode(',', array_fill(0, count($phones), '%s'));

    switch ($action) {
        case 'delete':
            $wpdb->query($wpdb->prepare(
                "DELETE FROM $table_name WHERE sender_number IN ($placeholders)",
                ...$phones
            ));
            tbc_mc_ajax_feedback('success', count($phones) . ' conversation(s) deleted');
            break;

        case 'star':
            // Check if already all starred - toggle behavior
            $starred_count = $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM $table_name WHERE sender_number IN ($placeholders) AND marked = 1",
                ...$phones
            ));
            $total_count = $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM $table_name WHERE sender_number IN ($placeholders)",
                ...$phones
            ));

            $new_value = ($starred_count == $total_count && $total_count > 0) ? 0 : 1;
            $action_word = $new_value ? 'starred' : 'unstarred';

            $wpdb->query($wpdb->prepare(
                "UPDATE $table_name SET marked = $new_value WHERE sender_number IN ($placeholders)",
                ...$phones
            ));
            tbc_mc_ajax_feedback('success', count($phones) . " conversation(s) $action_word");
            break;

        case 'read':
            $wpdb->query($wpdb->prepare(
                "UPDATE $table_name SET is_read = 1 WHERE sender_number IN ($placeholders)",
                ...$phones
            ));
            tbc_mc_ajax_feedback('success', count($phones) . ' conversation(s) marked as read');
            break;

        default:
            tbc_mc_ajax_feedback('error', 'Unknown action');
    }
}
add_action('wp_ajax_tbc_mc_bulk_action', 'tbc_mc_bulk_action_handler');

/**
 * Get conversations by filter
 */
function tbc_mc_get_conversations_handler() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    global $wpdb;
    $table_name = $wpdb->prefix . 'tbc_mc_messages';

    $filter = sanitize_text_field($_POST['filter'] ?? 'all');

    $filter_where = '';
    if ($filter === 'unread') {
        $filter_where = 'WHERE is_read = 0';
    } elseif ($filter === 'starred') {
        $filter_where = 'WHERE marked = 1';
    }

    $conversations = $wpdb->get_results("
        SELECT sender_number,
               MAX(date_created) as recent_date,
               SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread_count,
               SUM(CASE WHEN marked = 1 THEN 1 ELSE 0 END) as starred_count,
               (SELECT content FROM $table_name m2 WHERE m2.sender_number = m1.sender_number ORDER BY date_created DESC LIMIT 1) as last_message,
               (SELECT type FROM $table_name m2 WHERE m2.sender_number = m1.sender_number ORDER BY date_created DESC LIMIT 1) as last_type
        FROM $table_name m1
        $filter_where
        GROUP BY sender_number
        ORDER BY recent_date DESC
        LIMIT 50
    ");

    $html = '';
    foreach ($conversations as $conversation) {
        $html .= tbc_mc_render_conversation_item($conversation);
    }

    if (empty($html)) {
        $html = '<div class="tbc-mc-empty-state"><p>No conversations</p></div>';
    }

    // Get counts
    $total = $wpdb->get_var("SELECT COUNT(DISTINCT sender_number) FROM $table_name");
    $unread = $wpdb->get_var("SELECT COUNT(DISTINCT sender_number) FROM $table_name WHERE is_read = 0");
    $starred = $wpdb->get_var("SELECT COUNT(DISTINCT sender_number) FROM $table_name WHERE marked = 1");

    wp_send_json_success([
        'html' => $html,
        'counts' => [
            'total' => $total,
            'unread' => $unread,
            'starred' => $starred
        ]
    ]);
}
add_action('wp_ajax_tbc_mc_get_conversations', 'tbc_mc_get_conversations_handler');

/**
 * Get reply form HTML
 */
function tbc_mc_get_reply_form_handler() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    $phone = sanitize_text_field($_POST['phone']);
    $name = sanitize_text_field($_POST['name']);

    $formatted_phone = tbc_mc_format_phone($phone);

    $contact_list_html = "
        <input type='hidden' name='sender_number' value='" . esc_attr($phone) . "' />
        <div class='tbc-mc-contact-info'>
            <span class='tbc-mc-contact-name'>" . esc_html($name) . "</span> -
            <span class='tbc-mc-contact-number'>" . esc_html($formatted_phone) . "</span>
        </div>";

    $html = tbc_mc_render_sms_form('send_reply_action', 'send_reply_nonce', $contact_list_html);

    wp_send_json_success(['html' => $html]);
}
add_action('wp_ajax_tbc_mc_get_reply_form', 'tbc_mc_get_reply_form_handler');

// ============================================================================
// AJAX HANDLERS - MESSAGE ACTIONS
// ============================================================================

function tbc_mc_toggle_marking_handler() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    global $wpdb;
    $table_name = $wpdb->prefix . 'tbc_mc_messages';

    $message_id = intval($_POST['message_id']);
    $current_marked = $wpdb->get_var($wpdb->prepare("SELECT marked FROM $table_name WHERE id = %d", $message_id));

    $new_marked = $current_marked ? 0 : 1;
    $updated = $wpdb->update($table_name, array('marked' => $new_marked), array('id' => $message_id));

    if ($updated !== false) {
        wp_send_json_success(['marked' => $new_marked]);
    } else {
        wp_send_json_error(['message' => 'Failed to update message marking']);
    }
}
add_action('wp_ajax_tbc_mc_toggle_marking', 'tbc_mc_toggle_marking_handler');

function tbc_mc_save_notes_handler() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    global $wpdb;
    $table_name = $wpdb->prefix . 'tbc_mc_messages';

    $message_id = intval($_POST['message_id']);
    $notes = sanitize_textarea_field($_POST['notes']);

    $updated = $wpdb->update($table_name, array('notes' => $notes), array('id' => $message_id));

    if ($updated !== false) {
        wp_send_json_success(['notes' => $notes, 'message_id' => $message_id]);
    } else {
        wp_send_json_error(['message' => 'Failed to save notes']);
    }
}
add_action('wp_ajax_tbc_mc_save_notes', 'tbc_mc_save_notes_handler');

function tbc_mc_delete_message_handler() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => 'Insufficient permissions']);
    }

    global $wpdb;
    $table_name = $wpdb->prefix . 'tbc_mc_messages';

    $message_id = intval($_POST['message_id']);
    $deleted = $wpdb->delete($table_name, array('id' => $message_id));

    if($deleted) {
        tbc_mc_ajax_feedback('success', 'Message deleted successfully');
    } else {
        tbc_mc_ajax_feedback('error', 'Error deleting message');
    }
}
add_action('wp_ajax_tbc_mc_delete_message', 'tbc_mc_delete_message_handler');

function tbc_mc_callback_handler() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    $caller_number = sanitize_text_field($_POST['caller_number']);
    $current_user_id = get_current_user_id();
    $personal_phone_number = tbc_mc_get_phone_from_profile($current_user_id);

    $response = tbc_mc_initiate_call($caller_number, $personal_phone_number);

    if ($response['type'] === 'success') {
        tbc_mc_ajax_feedback('success', $response['message']);
    } else {
        tbc_mc_ajax_feedback('error', $response['message']);
    }
}
add_action('wp_ajax_tbc_mc_callback', 'tbc_mc_callback_handler');

// ============================================================================
// TAB CONTENT LOADER
// ============================================================================

/**
 * Load tab content via AJAX for lazy loading
 */
function tbc_mc_load_tab_content_handler() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => 'Insufficient permissions']);
    }

    $tab = sanitize_text_field($_POST['tab']);
    $html = '';

    switch ($tab) {
        case 'send':
            $html = tbc_mc_render_send_tab_content();
            break;
        case 'scheduled':
            $html = tbc_mc_render_scheduled_tab_content();
            break;
        case 'call':
            $html = tbc_mc_render_call_tab_content();
            break;
        case 'settings':
            $html = tbc_mc_render_settings_tab_content();
            break;
        default:
            wp_send_json_error(['message' => 'Invalid tab']);
    }

    wp_send_json_success(['html' => $html]);
}
add_action('wp_ajax_tbc_mc_load_tab_content', 'tbc_mc_load_tab_content_handler');

/**
 * Render Send SMS tab content - Two-panel layout like Inbox
 */
function tbc_mc_render_send_tab_content() {
    ob_start();
    ?>
    <div class="tbc-mc-send-tab">
        <!-- Two-Panel Layout -->
        <div class="tbc-mc-send-panels">
            <!-- Left: Contact Type List -->
            <div class="tbc-mc-send-list">
                <div class="tbc-mc-send-list-header">
                    <h3>Contact Lists</h3>
                </div>
                <div class="tbc-mc-send-types">
                    <div class="tbc-mc-send-type-item" data-type="church_sms">
                        <div class="tbc-mc-send-type-icon">👥</div>
                        <div class="tbc-mc-send-type-info">
                            <span class="tbc-mc-send-type-title">Main Church SMS</span>
                            <span class="tbc-mc-send-type-desc">Members, volunteers, subscribers</span>
                        </div>
                    </div>
                    <div class="tbc-mc-send-type-item" data-type="ceremony">
                        <div class="tbc-mc-send-type-icon">🎭</div>
                        <div class="tbc-mc-send-type-info">
                            <span class="tbc-mc-send-type-title">Ceremony Participants</span>
                            <span class="tbc-mc-send-type-desc">Past ceremony attendees by date</span>
                        </div>
                    </div>
                    <div class="tbc-mc-send-type-item" data-type="product">
                        <div class="tbc-mc-send-type-icon">🛒</div>
                        <div class="tbc-mc-send-type-info">
                            <span class="tbc-mc-send-type-title">All Users of a Product</span>
                            <span class="tbc-mc-send-type-desc">Everyone who purchased a product</span>
                        </div>
                    </div>
                    <div class="tbc-mc-send-type-item" data-type="space">
                        <div class="tbc-mc-send-type-icon">🏘️</div>
                        <div class="tbc-mc-send-type-info">
                            <span class="tbc-mc-send-type-title">All Users of a Space</span>
                            <span class="tbc-mc-send-type-desc">Fluent Community space members</span>
                        </div>
                    </div>
                    <div class="tbc-mc-send-type-item" data-type="manual">
                        <div class="tbc-mc-send-type-icon">📱</div>
                        <div class="tbc-mc-send-type-info">
                            <span class="tbc-mc-send-type-title">Individual Numbers</span>
                            <span class="tbc-mc-send-type-desc">Enter phone numbers manually</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right: Contact Details Panel -->
            <div class="tbc-mc-send-detail-panel empty">
                <div class="tbc-mc-empty-state">
                    <span style="font-size: 48px; margin-bottom: 16px;">📨</span>
                    <p>Select a contact list to view recipients</p>
                </div>
            </div>
        </div>

        <!-- Slide-over Compose Panel -->
        <div class="tbc-mc-compose-slide">
            <div class="tbc-mc-compose-slide-header">
                <button class="tbc-mc-close-compose">&times;</button>
                <span class="tbc-mc-compose-slide-title">Compose Message</span>
                <span class="tbc-mc-compose-recipient-count"></span>
            </div>
            <div class="tbc-mc-compose-slide-content">
                <div class="tbc-mc-compose-contact-list"></div>
                <?php echo tbc_mc_render_sms_form('call_center_action', 'call_center_nonce', ''); ?>
            </div>
        </div>
        <div class="tbc-mc-compose-overlay"></div>
    </div>
    <?php
    return ob_get_clean();
}

/**
 * Render the contact detail panel content based on type
 */
function tbc_mc_render_send_detail_content($type) {
    ob_start();

    switch ($type) {
        case 'church_sms':
            ?>
            <div class="tbc-mc-send-detail-header">
                <button class="tbc-mc-send-back-btn">← Back</button>
                <div class="tbc-mc-send-detail-title-wrap">
                    <h3>Main Church SMS</h3>
                    <p>Select one or more groups to message</p>
                </div>
            </div>
            <div class="tbc-mc-send-detail-content">
                <!-- Role Filter Section -->
                <div class="tbc-mc-role-filter-section">
                    <label><strong>Filter Roles (optional):</strong></label>
                    <select id="tbc-mc-role-filter-multiselect" name="visible_roles[]" multiple size="3" class="tbc-mc-multiselect">
                        <!-- Populated via JavaScript -->
                    </select>
                    <p class="tbc-mc-help-text">Hold Ctrl/Cmd to select multiple. Leave empty to show all roles.</p>
                </div>

                <!-- Dynamic role cards container -->
                <div id="tbc-mc-role-groups" class="tbc-mc-role-groups">
                    <div class="tbc-mc-loading">Loading roles...</div>
                </div>
            </div>
            <div class="tbc-mc-send-detail-actions">
                <div class="tbc-mc-selected-summary">
                    <span class="tbc-mc-selected-count">0 recipients selected</span>
                </div>
                <button class="tbc-mc-btn tbc-mc-btn-primary tbc-mc-open-compose" disabled>
                    Compose Message
                </button>
            </div>
            <?php
            break;

        case 'ceremony':
            ?>
            <div class="tbc-mc-send-detail-header">
                <button class="tbc-mc-send-back-btn">← Back</button>
                <div class="tbc-mc-send-detail-title-wrap">
                    <h3>Ceremony Participants</h3>
                    <p>Select by product and date</p>
                </div>
            </div>
            <div class="tbc-mc-send-detail-content">
                <div class="tbc-mc-category-filter-section">
                    <label><strong>Filter by Category (optional):</strong></label>
                    <select id="tbc-mc-category-multiselect" name="included_categories[]" multiple size="3" class="tbc-mc-multiselect">
                    </select>
                    <p class="tbc-mc-help-text">Hold Ctrl/Cmd to select multiple. Leave empty for all.</p>
                </div>
                <div id="tbc-mc-ceremony-products" class="tbc-mc-hierarchy-list">
                    <div class="tbc-mc-loading">Loading products...</div>
                </div>
            </div>
            <div class="tbc-mc-send-detail-actions">
                <div class="tbc-mc-selected-summary">
                    <span class="tbc-mc-selected-count">0 recipients selected</span>
                </div>
                <button class="tbc-mc-btn tbc-mc-btn-primary tbc-mc-open-compose" disabled>
                    Compose Message
                </button>
            </div>
            <?php
            break;

        case 'product':
            ?>
            <div class="tbc-mc-send-detail-header">
                <button class="tbc-mc-send-back-btn">← Back</button>
                <div class="tbc-mc-send-detail-title-wrap">
                    <h3>All Users of a Product</h3>
                    <p>Message everyone who purchased a specific product</p>
                </div>
            </div>
            <div class="tbc-mc-send-detail-content">
                <div class="tbc-mc-category-filter-section">
                    <label><strong>Filter by Category (optional):</strong></label>
                    <select id="tbc-mc-product-category-filter" name="product_categories[]" multiple size="3" class="tbc-mc-multiselect">
                    </select>
                    <p class="tbc-mc-help-text">Hold Ctrl/Cmd to select multiple. Leave empty for all products.</p>
                </div>
                <div id="tbc-mc-all-products" class="tbc-mc-hierarchy-list">
                    <div class="tbc-mc-loading">Loading products...</div>
                </div>
            </div>
            <div class="tbc-mc-send-detail-actions">
                <div class="tbc-mc-selected-summary">
                    <span class="tbc-mc-selected-count">0 recipients selected</span>
                </div>
                <button class="tbc-mc-btn tbc-mc-btn-primary tbc-mc-open-compose" disabled>
                    Compose Message
                </button>
            </div>
            <?php
            break;

        case 'space':
            ?>
            <div class="tbc-mc-send-detail-header">
                <button class="tbc-mc-send-back-btn">← Back</button>
                <div class="tbc-mc-send-detail-title-wrap">
                    <h3>All Users of a Space</h3>
                    <p>Message members of a Fluent Community space</p>
                </div>
            </div>
            <div class="tbc-mc-send-detail-content">
                <div class="tbc-mc-space-search-section">
                    <label><strong>Search Spaces:</strong></label>
                    <input type="text" id="tbc-mc-space-search" class="tbc-mc-space-search-input"
                           placeholder="Type to filter spaces...">
                </div>

                <div class="tbc-mc-space-opt-in-section">
                    <label>
                        <input type="checkbox" id="tbc-mc-space-sms-opt-in" class="tbc-mc-sms-opt-in-check">
                        <strong>SMS Opt In</strong>
                        <span class="tbc-mc-help-text-inline">Only show users who haven't opted out of SMS</span>
                    </label>
                </div>

                <div id="tbc-mc-space-list" class="tbc-mc-hierarchy-list">
                    <div class="tbc-mc-loading">Loading spaces...</div>
                </div>
            </div>
            <div class="tbc-mc-send-detail-actions">
                <div class="tbc-mc-selected-summary">
                    <span class="tbc-mc-selected-count">0 recipients selected</span>
                </div>
                <button class="tbc-mc-btn tbc-mc-btn-primary tbc-mc-open-compose" disabled>
                    Compose Message
                </button>
            </div>
            <?php
            break;

        case 'manual':
            ?>
            <div class="tbc-mc-send-detail-header">
                <button class="tbc-mc-send-back-btn">← Back</button>
                <div class="tbc-mc-send-detail-title-wrap">
                    <h3>Individual Numbers</h3>
                    <p>Enter phone numbers manually</p>
                </div>
            </div>
            <div class="tbc-mc-send-detail-content">
                <div class="tbc-mc-manual-input-section">
                    <label><strong>Enter phone numbers:</strong></label>
                    <textarea id="tbc-mc-manual-numbers" class="tbc-mc-manual-textarea" placeholder="Enter phone numbers, one per line or comma-separated...&#10;&#10;Examples:&#10;+1 (903) 456-7890&#10;9034567890&#10;+19034567890"></textarea>
                    <button class="tbc-mc-btn tbc-mc-btn-outline tbc-mc-parse-numbers-btn">Parse Numbers</button>
                </div>
                <div id="tbc-mc-parsed-results" class="tbc-mc-parsed-numbers-section" style="display: none;">
                    <h4>Valid Numbers:</h4>
                    <div class="tbc-mc-valid-numbers-list"></div>
                    <div class="tbc-mc-invalid-numbers-alert" style="display: none;">
                        <h4>Invalid Numbers:</h4>
                        <div class="tbc-mc-invalid-numbers-list"></div>
                    </div>
                </div>
            </div>
            <div class="tbc-mc-send-detail-actions">
                <div class="tbc-mc-selected-summary">
                    <span class="tbc-mc-selected-count">0 recipients selected</span>
                </div>
                <button class="tbc-mc-btn tbc-mc-btn-primary tbc-mc-open-compose" disabled>
                    Compose Message
                </button>
            </div>
            <?php
            break;
    }

    return ob_get_clean();
}

/**
 * AJAX handler for loading send detail panel content
 */
function tbc_mc_get_send_detail_handler() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => 'Insufficient permissions']);
        return;
    }

    $type = sanitize_text_field($_POST['type'] ?? '');
    if (empty($type)) {
        wp_send_json_error(['message' => 'Missing type']);
        return;
    }

    $html = tbc_mc_render_send_detail_content($type);

    wp_send_json_success(['html' => $html]);
}
add_action('wp_ajax_tbc_mc_get_send_detail', 'tbc_mc_get_send_detail_handler');

/**
 * Render Scheduled Messages tab content - Two-panel layout like Inbox
 */
function tbc_mc_render_scheduled_tab_content() {
    if (!current_user_can('manage_options')) {
        return '<div class="tbc-mc-empty-state"><p>You do not have permission to view scheduled messages.</p></div>';
    }

    $scheduled_chunks = tbc_mc_get_scheduled_messages(200);
    $grouped_messages = tbc_mc_group_chunks($scheduled_chunks);

    // Count by status
    $pending_count = 0;
    $completed_count = 0;
    foreach ($grouped_messages as $group) {
        if (in_array($group['status'], ['pending', 'processing'])) {
            $pending_count++;
        } else {
            $completed_count++;
        }
    }

    ob_start();
    ?>
    <div class="tbc-mc-scheduled-tab">
        <!-- Two-Panel Layout -->
        <div class="tbc-mc-scheduled-panels">
            <!-- Left: Scheduled Message List -->
            <div class="tbc-mc-scheduled-list">
                <div class="tbc-mc-scheduled-header">
                    <div class="tbc-mc-scheduled-filters">
                        <button class="tbc-mc-scheduled-filter-btn active" data-filter="all">
                            All <span class="tbc-mc-filter-count">(<?php echo count($grouped_messages); ?>)</span>
                        </button>
                        <button class="tbc-mc-scheduled-filter-btn" data-filter="pending">
                            Pending <span class="tbc-mc-filter-count">(<?php echo $pending_count; ?>)</span>
                        </button>
                        <button class="tbc-mc-scheduled-filter-btn" data-filter="completed">
                            Completed <span class="tbc-mc-filter-count">(<?php echo $completed_count; ?>)</span>
                        </button>
                    </div>
                    <div class="tbc-mc-scheduled-bulk-actions">
                        <label class="tbc-mc-select-all-scheduled">
                            <input type="checkbox" class="tbc-mc-scheduled-select-all" />
                            <span>Select All</span>
                        </label>
                        <button class="tbc-mc-scheduled-bulk-delete" disabled>🗑️ Delete</button>
                    </div>
                </div>
                <div class="tbc-mc-scheduled-items">
                    <?php if (empty($grouped_messages)): ?>
                        <div class="tbc-mc-empty-state">
                            <p>No scheduled messages</p>
                        </div>
                    <?php else: ?>
                        <?php foreach ($grouped_messages as $parent_id => $group): ?>
                            <?php echo tbc_mc_render_scheduled_list_item($parent_id, $group); ?>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Right: Message Detail Panel -->
            <div class="tbc-mc-scheduled-detail-panel empty">
                <div class="tbc-mc-empty-state">
                    <span class="bb-icon bb-icon-clock" style="font-size: 48px; color: #ccc; margin-bottom: 16px;"></span>
                    <p>Select a scheduled message to view details</p>
                </div>
            </div>
        </div>
    </div>
    <?php
    return ob_get_clean();
}

/**
 * Render a compact list item for scheduled message (left panel)
 */
function tbc_mc_render_scheduled_list_item($parent_id, $group) {
    $display_title = esc_html($group['message_title'] ?: 'Untitled Message');
    $total_recipients = $group['total_recipients'];
    $status = $group['status'];
    $schedule_type = $group['schedule_type'];

    // Status class for filtering
    $status_filter = in_array($status, ['pending', 'processing']) ? 'pending' : 'completed';

    // Get time info
    $time_display = '';
    if ($group['created_date']) {
        $timezone = wp_timezone();
        $created_datetime = new DateTime($group['created_date'], $timezone);
        $time_display = human_time_diff(strtotime($group['created_date']), current_time('timestamp'));

        if ($status === 'completed' && !empty($group['processed_at'])) {
            $time_display = human_time_diff(strtotime($group['processed_at']), current_time('timestamp')) . ' ago';
        } elseif (in_array($status, ['pending', 'processing'])) {
            $time_display = 'Created ' . $time_display . ' ago';
        } else {
            $time_display .= ' ago';
        }
    }

    // Message preview (first 50 chars)
    $preview = wp_trim_words($group['message'], 8, '...');

    // Schedule type icon
    $type_icon = '';
    switch ($schedule_type) {
        case 'immediate':
            $type_icon = '⚡';
            break;
        case 'scheduled':
            $type_icon = '📅';
            break;
        case 'recurring':
            $type_icon = '🔄';
            break;
    }

    ob_start();
    ?>
    <div class="tbc-mc-scheduled-item <?php echo $status_filter === 'pending' ? 'is-pending' : 'is-completed'; ?>"
         data-parent-id="<?php echo esc_attr($parent_id); ?>"
         data-status="<?php echo esc_attr($status_filter); ?>">

        <input type="checkbox" class="tbc-mc-scheduled-select" />
        <div class="tbc-mc-scheduled-item-icon">
            <span class="tbc-mc-status-dot tbc-mc-status-<?php echo esc_attr($status); ?>"></span>
        </div>

        <div class="tbc-mc-scheduled-item-info">
            <div class="tbc-mc-scheduled-item-header">
                <span class="tbc-mc-scheduled-item-title"><?php echo $display_title; ?></span>
                <span class="tbc-mc-scheduled-item-time"><?php echo esc_html($time_display); ?></span>
            </div>
            <div class="tbc-mc-scheduled-item-meta">
                <span class="tbc-mc-scheduled-item-type"><?php echo $type_icon; ?> <?php echo esc_html(ucfirst($schedule_type)); ?></span>
                <span class="tbc-mc-scheduled-item-recipients"><?php echo esc_html($total_recipients); ?> recipients</span>
            </div>
            <div class="tbc-mc-scheduled-item-preview"><?php echo esc_html($preview); ?></div>
        </div>
    </div>
    <?php
    return ob_get_clean();
}

/**
 * Render scheduled message detail panel (right panel)
 */
function tbc_mc_render_scheduled_detail_panel($parent_id, $group) {
    $display_title = esc_html($group['message_title'] ?: 'Untitled Message');
    $total_recipients = $group['total_recipients'];
    $status = $group['status'];

    // Format dates
    $timezone = wp_timezone();
    $created_date_display = '';
    $schedule_label = '';
    $next_run_formatted = '';

    if ($group['created_date']) {
        $created_datetime = new DateTime($group['created_date'], $timezone);
        $created_date_display = $created_datetime->format('M j, Y \a\t g:i A');

        if ($status === 'completed' && !empty($group['processed_at'])) {
            $schedule_label = 'Sent on';
            $processed_datetime = new DateTime($group['processed_at'], $timezone);
            $next_run_formatted = $processed_datetime->format('M j, Y \a\t g:i A');
        } elseif ($group['schedule_type'] === 'recurring') {
            $schedule_label = 'Next Run';
            if (!empty($group['action_scheduler_id'])) {
                try {
                    $store = ActionScheduler::store();
                    $action = $store->fetch_action($group['action_scheduler_id']);
                    if ($action && method_exists($action, 'get_schedule')) {
                        $after_datetime = new DateTime('now', wp_timezone());
                        $next_datetime = $action->get_schedule()->get_next($after_datetime);
                        if ($next_datetime) {
                            $next_datetime->setTimezone(wp_timezone());
                            $next_run_formatted = $next_datetime->format('M j, Y \a\t g:i A');
                        }
                    }
                } catch (Exception $e) {
                    $next_run_formatted = 'Unknown';
                }
            }
        } elseif ($group['schedule_type'] === 'scheduled') {
            $schedule_label = 'Scheduled for';
            if (!empty($group['action_scheduler_id'])) {
                try {
                    $store = ActionScheduler::store();
                    $action = $store->fetch_action($group['action_scheduler_id']);
                    if ($action && method_exists($action, 'get_schedule')) {
                        $schedule_datetime = $action->get_schedule()->get_date();
                        if ($schedule_datetime) {
                            $schedule_datetime->setTimezone(wp_timezone());
                            $next_run_formatted = $schedule_datetime->format('M j, Y \a\t g:i A');
                        }
                    }
                } catch (Exception $e) {
                    $next_run_formatted = 'Unknown';
                }
            }
        } else {
            $schedule_label = 'Send Time';
            $next_run_formatted = $created_date_display;
        }
    }

    ob_start();
    ?>
    <div class="tbc-mc-scheduled-detail-header">
        <button class="tbc-mc-scheduled-back-btn">← Back</button>
        <div class="tbc-mc-scheduled-detail-title-wrap">
            <h3><?php echo $display_title; ?></h3>
            <div class="tbc-mc-scheduled-detail-badges">
                <span class="tbc-mc-badge tbc-mc-badge-<?php echo esc_attr($status); ?>">
                    <?php echo esc_html(ucfirst($status)); ?>
                </span>
                <span class="tbc-mc-badge tbc-mc-badge-<?php echo esc_attr($group['schedule_type']); ?>">
                    <?php echo esc_html(ucfirst($group['schedule_type'])); ?>
                </span>
            </div>
        </div>
    </div>

    <div class="tbc-mc-scheduled-detail-content">
        <!-- Message Preview -->
        <div class="tbc-mc-scheduled-detail-section">
            <h4>Message</h4>
            <div class="tbc-mc-scheduled-message-box">
                <?php echo nl2br(esc_html($group['message'])); ?>
            </div>
        </div>

        <!-- Quick Stats -->
        <div class="tbc-mc-scheduled-detail-stats">
            <div class="tbc-mc-scheduled-stat">
                <span class="tbc-mc-stat-value"><?php echo esc_html($total_recipients); ?></span>
                <span class="tbc-mc-stat-label">Recipients</span>
            </div>
            <div class="tbc-mc-scheduled-stat">
                <span class="tbc-mc-stat-value"><?php echo $group['send_as_mms'] ? 'MMS' : 'SMS'; ?></span>
                <span class="tbc-mc-stat-label">Type</span>
            </div>
            <div class="tbc-mc-scheduled-stat">
                <span class="tbc-mc-stat-value"><?php echo $group['include_opt_out'] ? 'Yes' : 'No'; ?></span>
                <span class="tbc-mc-stat-label">Opt-out</span>
            </div>
        </div>

        <!-- Dates -->
        <div class="tbc-mc-scheduled-detail-section">
            <h4>Schedule Information</h4>
            <div class="tbc-mc-scheduled-detail-dates">
                <div class="tbc-mc-date-row">
                    <span class="tbc-mc-date-label">Created</span>
                    <span class="tbc-mc-date-value"><?php echo esc_html($created_date_display); ?></span>
                </div>
                <?php if ($schedule_label && $next_run_formatted): ?>
                <div class="tbc-mc-date-row">
                    <span class="tbc-mc-date-label"><?php echo esc_html($schedule_label); ?></span>
                    <span class="tbc-mc-date-value"><?php echo esc_html($next_run_formatted); ?></span>
                </div>
                <?php endif; ?>
            </div>
        </div>

        <?php if (!empty($group['media_url'])): ?>
        <!-- Media -->
        <div class="tbc-mc-scheduled-detail-section">
            <h4>Attachments</h4>
            <div class="tbc-mc-scheduled-media">
                <?php
                $media_urls = array_map('trim', explode(',', $group['media_url']));
                foreach ($media_urls as $media_url):
                    if (preg_match('/\.(jpeg|jpg|png|gif|webp)$/i', $media_url)):
                ?>
                    <a href="<?php echo esc_url($media_url); ?>" target="_blank">
                        <img src="<?php echo esc_url($media_url); ?>" alt="Attachment" class="tbc-mc-scheduled-thumb"/>
                    </a>
                <?php else: ?>
                    <a href="<?php echo esc_url($media_url); ?>" target="_blank" class="tbc-mc-file-link">📎 View Attachment</a>
                <?php
                    endif;
                endforeach;
                ?>
            </div>
        </div>
        <?php endif; ?>
    </div>

    <!-- Action Bar -->
    <div class="tbc-mc-scheduled-detail-actions">
        <?php if (in_array($status, ['pending', 'processing'])): ?>
            <button class="tbc-mc-btn tbc-mc-btn-danger tbc-mc-cancel-all-btn" data-parent-id="<?php echo esc_attr($parent_id); ?>">
                Cancel Message
            </button>
        <?php else: ?>
            <button class="tbc-mc-btn tbc-mc-btn-secondary tbc-mc-delete-all-btn" data-parent-id="<?php echo esc_attr($parent_id); ?>">
                Delete from History
            </button>
        <?php endif; ?>
    </div>
    <?php
    return ob_get_clean();
}

/**
 * AJAX handler for loading scheduled message details
 */
function tbc_mc_get_scheduled_detail_handler() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => 'Insufficient permissions']);
        return;
    }

    $parent_id = sanitize_text_field($_POST['parent_id'] ?? '');
    if (empty($parent_id)) {
        wp_send_json_error(['message' => 'Missing parent ID']);
        return;
    }

    // Get the scheduled messages and find this one
    $scheduled_chunks = tbc_mc_get_scheduled_messages(200);
    $grouped_messages = tbc_mc_group_chunks($scheduled_chunks);

    if (!isset($grouped_messages[$parent_id])) {
        wp_send_json_error(['message' => 'Message not found']);
        return;
    }

    $html = tbc_mc_render_scheduled_detail_panel($parent_id, $grouped_messages[$parent_id]);

    wp_send_json_success(['html' => $html]);
}
add_action('wp_ajax_tbc_mc_get_scheduled_detail', 'tbc_mc_get_scheduled_detail_handler');

/**
 * Render Call Center tab content
 */
function tbc_mc_render_call_tab_content() {
    ob_start();
    ?>
    <div class="tbc-mc-call-tab">
        <div class="tbc-mc-call-center-wrapper">
            <div class="tbc-mc-call-icon">
                <span class="bb-icon bb-icon-phone"></span>
            </div>
            <h3>Click to Call</h3>
            <p class="tbc-mc-call-description">
                Search for a member and initiate a phone call directly from the dashboard.
            </p>
            <div class="tbc-mc-call-center-container">
                <div class="tbc-mc-search-input-wrapper">
                    <input type="text" id="tbc-mc-user-search" placeholder="Search users by name or username..." />
                </div>
                <button id="tbc-mc-call-button" class="tbc-mc-btn tbc-mc-btn-call" disabled>
                    <span class="bb-icon bb-icon-phone"></span> Call
                </button>
                <div id="call-center-feedback"></div>
            </div>
            <div class="tbc-mc-call-help">
                <p>The call will connect your registered phone number with the selected user.</p>
            </div>
        </div>
    </div>
    <?php
    return ob_get_clean();
}

// ============================================================================
// SETTINGS TAB
// ============================================================================

/**
 * Render Settings tab content
 */
function tbc_mc_render_settings_tab_content() {
    if (!current_user_can('manage_options')) {
        return '<div class="tbc-mc-empty-state"><p>You do not have permission to view settings.</p></div>';
    }

    $sid = get_option('tbc_mc_twilio_sid', '');
    $token = get_option('tbc_mc_twilio_token', '');
    $messaging_sid = get_option('tbc_mc_twilio_messaging_service_sid', '');
    $phone = get_option('tbc_mc_twilio_number', '');

    // FC integration settings
    $phone_slug       = get_option('tbc_mc_phone_field_slug', '');
    $sms_optin_slug   = get_option('tbc_mc_sms_optin_field_slug', '');
    $sms_optout_value = get_option('tbc_mc_sms_optout_value', 'No, TXT');
    $fc_fields        = tbc_mc_get_fc_field_definitions();

    ob_start();
    ?>
    <div class="tbc-mc-settings">
        <div class="tbc-mc-settings-section">
            <h3>Fluent Community Integration</h3>
            <p class="tbc-mc-settings-desc">Map FC native custom profile fields for phone lookup and SMS opt-in/out.</p>

            <div class="tbc-mc-settings-form">
                <div class="tbc-mc-field">
                    <label for="tbc-mc-phone-field-slug">Phone Field</label>
                    <?php if (empty($fc_fields)) : ?>
                        <p style="color:#d63638; margin:4px 0;">No FC native custom fields found. Create fields in Fluent Community &rarr; Settings &rarr; Custom Profile Fields.</p>
                    <?php endif; ?>
                    <select id="tbc-mc-phone-field-slug">
                        <option value="" <?php selected($phone_slug, ''); ?>>&mdash; Select a field &mdash;</option>
                        <?php foreach ($fc_fields as $fd) :
                            $slug = $fd['slug'] ?? '';
                            $label = $fd['label'] ?? $slug;
                            if (empty($slug)) continue;
                        ?>
                            <option value="<?php echo esc_attr($slug); ?>" <?php selected($phone_slug, $slug); ?>>
                                <?php echo esc_html($label); ?> &mdash; <?php echo esc_html($slug); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                    <p class="tbc-mc-settings-desc">The FC custom field that stores phone numbers. Used for contact matching and reverse lookup.</p>
                </div>

                <div class="tbc-mc-field">
                    <label for="tbc-mc-sms-optin-slug">SMS Opt-In Field</label>
                    <select id="tbc-mc-sms-optin-slug">
                        <option value="" <?php selected($sms_optin_slug, ''); ?>>&mdash; Select a field &mdash;</option>
                        <?php foreach ($fc_fields as $fd) :
                            $slug = $fd['slug'] ?? '';
                            $label = $fd['label'] ?? $slug;
                            if (empty($slug)) continue;
                        ?>
                            <option value="<?php echo esc_attr($slug); ?>" <?php selected($sms_optin_slug, $slug); ?>>
                                <?php echo esc_html($label); ?> &mdash; <?php echo esc_html($slug); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                    <p class="tbc-mc-settings-desc">The FC custom field for SMS opt-in status. Updated when a user texts NOTXT.</p>
                </div>

                <div class="tbc-mc-field">
                    <label for="tbc-mc-sms-optout-value">SMS Opt-Out Value</label>
                    <input type="text" id="tbc-mc-sms-optout-value" value="<?php echo esc_attr($sms_optout_value); ?>" placeholder="No, TXT" />
                    <p class="tbc-mc-settings-desc">The value written to the opt-in field when a user texts NOTXT.</p>
                </div>
            </div>
        </div>

        <div class="tbc-mc-settings-section">
            <h3>Twilio Credentials</h3>
            <p class="tbc-mc-settings-desc">Configure your Twilio account for SMS and call functionality.</p>

            <div class="tbc-mc-settings-form">
                <div class="tbc-mc-field">
                    <label for="tbc-mc-twilio-sid">Account SID</label>
                    <input type="text" id="tbc-mc-twilio-sid" value="<?php echo esc_attr($sid); ?>" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
                </div>

                <div class="tbc-mc-field">
                    <label for="tbc-mc-twilio-token">Auth Token</label>
                    <input type="password" id="tbc-mc-twilio-token" value="<?php echo esc_attr($token); ?>" placeholder="Your Twilio auth token" />
                </div>

                <div class="tbc-mc-field">
                    <label for="tbc-mc-twilio-messaging-sid">Messaging Service SID</label>
                    <input type="text" id="tbc-mc-twilio-messaging-sid" value="<?php echo esc_attr($messaging_sid); ?>" placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
                </div>

                <div class="tbc-mc-field">
                    <label for="tbc-mc-twilio-number">Twilio Phone Number</label>
                    <input type="text" id="tbc-mc-twilio-number" value="<?php echo esc_attr($phone); ?>" placeholder="+12145551234" />
                </div>
            </div>
        </div>

    </div>
    <div class="tbc-mc-settings-actions" style="padding:16px 20px; border-top:1px solid var(--fcom-border-color, #e5e7eb);">
        <button id="tbc-mc-save-settings" class="tbc-mc-btn tbc-mc-btn-primary">Save Settings</button>
        <span id="tbc-mc-settings-feedback"></span>
    </div>
    <?php
    return ob_get_clean();
}

/**
 * AJAX handler to save settings
 */
function tbc_mc_save_settings_handler() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => 'Insufficient permissions']);
    }

    // Twilio credentials
    $sid = sanitize_text_field($_POST['twilio_sid'] ?? '');
    $token = sanitize_text_field($_POST['twilio_token'] ?? '');
    $messaging_sid = sanitize_text_field($_POST['twilio_messaging_sid'] ?? '');
    $phone = sanitize_text_field($_POST['twilio_number'] ?? '');

    update_option('tbc_mc_twilio_sid', $sid);
    update_option('tbc_mc_twilio_token', $token);
    update_option('tbc_mc_twilio_messaging_service_sid', $messaging_sid);
    update_option('tbc_mc_twilio_number', $phone);

    // FC integration
    $phone_slug       = sanitize_text_field($_POST['phone_field_slug'] ?? '');
    $sms_optin_slug   = sanitize_text_field($_POST['sms_optin_field_slug'] ?? '');
    $sms_optout_value = sanitize_text_field($_POST['sms_optout_value'] ?? 'No, TXT');

    update_option('tbc_mc_phone_field_slug', $phone_slug);
    update_option('tbc_mc_sms_optin_field_slug', $sms_optin_slug);
    update_option('tbc_mc_sms_optout_value', $sms_optout_value);

    wp_send_json_success(['message' => 'Settings saved successfully.']);
}
add_action('wp_ajax_tbc_mc_save_settings', 'tbc_mc_save_settings_handler');

