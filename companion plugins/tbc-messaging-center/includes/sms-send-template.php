<?php
function tbc_mc_render_sms_form($nonce_action, $nonce_name, $contact_list_html) {
    $unique_id = uniqid('form_');
    
    $templates = [
        '' => 'No template',
        'template1' => 'Pre-Ceremony Call',
        'template2' => 'Virtual Integration',
        'template3' => 'Ceremony Reminder (Day of)',
        'template4' => 'Book Club Tonight',
        'template5' => 'Sound Journey Tonight',
        'template6' => 'After Ceremony Reminder',
        'template7' => 'Community Dinner',
        'template8' => 'New Month, New Ceremonies',
        'template9' => 'Sapo Ceremony Reminder',
    ];

    $schedule_types = [
        'once' => 'Send Once (Future Date/Time)',
        'daily' => 'Daily at Specific Time',
        'weekly' => 'Weekly on Specific Day',
        'monthly_first' => 'Monthly on 1st',
        'monthly_fifteenth' => 'Monthly on 15th',
        'monthly_last' => 'Monthly on Last Day',
        'monthly_custom' => 'Monthly on Custom Day'
    ];

    return '
    <div class="tbc-mc-sms-form-container">
        <form action="" method="post" class="tbc-mc-sms-form">
            ' . wp_nonce_field($nonce_action, $nonce_name, true, false) . '

            <!-- Template Dropdown -->
            <div class="tbc-mc-template-dropdown-container">
                <h3 class="no-margin-bottom">' . esc_html__('Templates', 'twobirdschurch') . '</h3>
                <label for="template-select">' . esc_html__('Choose:', 'twobirdschurch') . '</label>
                <select name="templates" id="template-select" class="tbc-mc-template-select" onchange="loadTemplate(this)">
                    ' . array_reduce(array_keys($templates), function($options, $value) use ($templates) {
                        $options .= '<option value="' . esc_attr($value) . '">' . esc_html($templates[$value]) . '</option>';
                        return $options;
                    }, '') . '
                </select>
                <p class="tooltip no-margin-top no-margin-bottom">' . esc_html__('Select a template or choose "No template" to clear the message.', 'twobirdschurch') . '</p>
            </div>

            <!-- Message Textarea -->
            <h3 class="no-margin-bottom" style="padding-top: 20px;">' . esc_html__('Type Your Message', 'twobirdschurch') . '</h3>
            <textarea name="sms_message" class="tbc-mc-sms-message" placeholder="' . esc_attr__('Type your message...', 'twobirdschurch') . '"></textarea>

            <div class="tbc-mc-messagetips-container">
                <div class="tbc-mc-button-group">
                    <button class="tbc-mc-emoji-button" type="button">&#9786;</button>
                    <button class="tbc-mc-insert-name" type="button" onclick="insertNameTag(this)">{name}</button>
                </div>
                <div class="tbc-mc-emoji-picker-container" style="display: none;"></div>
                <div class="tbc-mc-count-container">
                    <span class="char-count"></span>
                    <span class="char-warning" style="color:red;"></span>
                </div>
            </div>

            <!-- Media Upload Section -->
            <div class="tbc-mc-media-section">
                <h3 class="no-margin-bottom">' . esc_html__('Add Media', 'twobirdschurch') . '</h3>
                <button type="button" class="tbc-mc-media-upload-button"><i class="bb-icon-file-plus"></i> ' . esc_html__('Upload Media', 'twobirdschurch') . '</button>
                <div class="tbc-mc-media-preview" style="display: none;">
                    <!-- Multiple media items will be inserted here by JS -->
                </div>
                <input type="hidden" name="upload_image" class="tbc-mc-media-url" value="" />
                <p class="tooltip no-margin-bottom">' . esc_html__('Attach up to 10 images (jpg, png, gif only — webp not supported by Twilio). Keep file sizes small for best results.', 'twobirdschurch') . '</p>
            </div>

            <!-- MMS Toggle -->
            <div class="tbc-mc-mms-toggle-container">
                <div class="tbc-mc-mms-toggle-header">
                    <h3 class="no-margin-bottom">' . esc_html__('Send as MMS', 'twobirdschurch') . '</h3>
                    <div class="tbc-mc-toggle-wrapper">
                        <input type="checkbox" name="send_as_mms" id="' . $unique_id . '_send_as_mms" class="tbc-mc-toggle-input"/>
                        <label for="' . $unique_id . '_send_as_mms" class="tbc-mc-toggle-container"></label>
                    </div>
                </div>
            </div>

            <!-- Log Toggle -->
            <div class="tbc-mc-log-toggle-container">
                <div class="tbc-mc-log-toggle-header">
                    <h3 class="no-margin-bottom">' . esc_html__('Show in Log', 'twobirdschurch') . '</h3>
                    <div class="tbc-mc-toggle-wrapper">
                        <input type="checkbox" name="include_in_log" id="' . $unique_id . '_include_in_log" class="tbc-mc-toggle-input"/>
                        <label for="' . $unique_id . '_include_in_log" class="tbc-mc-toggle-container"></label>
                    </div>
                </div>
            </div>

            <!-- Opt-Out Toggle -->
            <div class="tbc-mc-opt-out-container">
                <div class="tbc-mc-opt-out-header">
                    <h3 class="no-margin-bottom">' . esc_html__('SMS Opt Out', 'twobirdschurch') . '</h3>
                    <div class="tbc-mc-toggle-wrapper">
                        <input type="checkbox" name="include_opt_out" checked="checked" id="' . $unique_id . '_include_opt_out" class="tbc-mc-toggle-input"/>
                        <label for="' . $unique_id . '_include_opt_out" class="tbc-mc-toggle-container"></label>
                    </div>
                </div>
                <div class="tbc-mc-opt-out-message-container">
                    <button type="button" class="tbc-mc-lock-toggle bb-icon-lock-alt tbc-mc-locked" title="Click to unlock (Admin only)" data-admin="' . (current_user_can('manage_options') ? 'true' : 'false') . '"></button>
                    <textarea name="opt_out_message" class="tbc-mc-opt-out-message" readonly>' . esc_html(get_option('tbc_mc_opt_out_message', 'Reply NOTXT to stop receiving texts. Reply NOCHURCH to remove your account.')) . '</textarea>
                </div>
            </div>

            <!-- Send Timing Section -->
            <div class="tbc-mc-schedule-section">
                <h3>' . esc_html__('Send Timing', 'twobirdschurch') . '</h3>
                <div class="tbc-mc-send-timing-container">
                    <div class="tbc-mc-send-timing-options">
                        <label>
                            <input type="radio" name="send_timing" value="now" checked>
                            <i class="bb-icon-bell-plus"></i> ' . esc_html__('Send Now', 'twobirdschurch') . '
                        </label>
                        <label>
                            <input type="radio" name="send_timing" value="schedule">
                            <i class="bb-icon-clock"></i> ' . esc_html__('Schedule', 'twobirdschurch') . '
                        </label>
                    </div>
                </div>

                <!-- Schedule Options -->
                <div class="tbc-mc-schedule-options">
                    <h4><i class="bb-icon-calendar"></i> ' . esc_html__('Schedule Options', 'twobirdschurch') . '</h4>
                    
                    <!-- Message Title - Only for scheduled messages -->
                    <div class="tbc-mc-message-title-container">
                        <label for="' . $unique_id . '_message_title">' . esc_html__('Message Title (Optional):', 'twobirdschurch') . '</label>
                        <input type="text" name="message_title" id="' . $unique_id . '_message_title" placeholder="' . esc_attr__('e.g., Weekly Book Club Reminder', 'twobirdschurch') . '" maxlength="100">
                        <p class="tooltip no-margin-top">' . esc_html__('Give this message a readable name for the scheduler', 'twobirdschurch') . '</p>
                    </div>
                    
                    <div class="tbc-mc-schedule-type-container">
                        <label for="' . $unique_id . '_schedule_type">' . esc_html__('Schedule Type:', 'twobirdschurch') . '</label>
                        <select name="schedule_type" id="' . $unique_id . '_schedule_type">
                            <option value="">' . esc_html__('Select schedule type...', 'twobirdschurch') . '</option>
                            ' . array_reduce(array_keys($schedule_types), function($options, $value) use ($schedule_types) {
                                $options .= '<option value="' . esc_attr($value) . '">' . esc_html($schedule_types[$value]) . '</option>';
                                return $options;
                            }, '') . '
                        </select>
                    </div>

                    <!-- Send Once Options -->
                    <div class="tbc-mc-schedule-once-options">
                        <div class="tbc-mc-schedule-option-row">
                            <div class="tbc-mc-schedule-option-group">
                                <label for="' . $unique_id . '_schedule_date">' . esc_html__('Date:', 'twobirdschurch') . '</label>
                                <input type="date" name="schedule_date" id="' . $unique_id . '_schedule_date">
                            </div>
                            <div class="tbc-mc-schedule-option-group">
                                <label for="' . $unique_id . '_schedule_time">' . esc_html__('Time:', 'twobirdschurch') . '</label>
                                <input type="time" name="schedule_time" id="' . $unique_id . '_schedule_time">
                            </div>
                        </div>
                    </div>

                    <!-- Recurring Options -->
                    <div class="tbc-mc-schedule-recurring-options">
                        <div class="tbc-mc-schedule-option-row">
                            <div class="tbc-mc-schedule-option-group tbc-mc-time-selector">
                                <label for="' . $unique_id . '_recurring_time">' . esc_html__('Time:', 'twobirdschurch') . '</label>
                                <input type="time" name="schedule_time" id="' . $unique_id . '_recurring_time" value="09:00">
                            </div>
                            <div class="tbc-mc-schedule-option-group tbc-mc-day-selector" style="display: none;">
                                <label for="' . $unique_id . '_schedule_day">' . esc_html__('Day:', 'twobirdschurch') . '</label>
                                <select name="schedule_day" id="' . $unique_id . '_schedule_day">
                                    <!-- Options populated by JavaScript -->
                                </select>
                            </div>
                        </div>
                        <div class="tbc-mc-schedule-help-text">
                            <p class="tooltip">' . esc_html__('Recurring messages will be sent automatically according to the schedule. You can cancel them anytime from the Message Scheduler page.', 'twobirdschurch') . '</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Contact List Section -->
            <div class="tbc-mc-contact-section">
                <h3 class="no-margin-bottom">' . esc_html__('Contact List', 'twobirdschurch') . '</h3>
                ' . $contact_list_html . '
            </div>

            <div class="tbc-mc-sms-center-button-container">
                <button type="submit" name="send_sms" class="tbc-mc-sms-button" data-original-text="' . esc_attr__('Send', 'twobirdschurch') . '">
                    <i class="bb-icon-bell-plus"></i> ' . esc_html__('Send', 'twobirdschurch') . '
                </button>
            </div>
        </form>
    </div>';
}

/**
 * AJAX handler for saving global opt-out message
 * Admin-only functionality
 */
function tbc_mc_save_opt_out() {
    check_ajax_referer('tbc_mc_nonce', 'nonce');

    // Check admin permissions
    if (!current_user_can('manage_options')) {
        wp_send_json_error('Insufficient permissions');
        return;
    }
    
    $message = sanitize_textarea_field($_POST['message']);
    
    if (empty($message)) {
        wp_send_json_error('Message cannot be empty');
        return;
    }
    
    // Save to WordPress options
    $saved = update_option('tbc_mc_opt_out_message', $message);
    
    if ($saved) {
        wp_send_json_success('Opt-out message saved successfully');
    } else {
        wp_send_json_error('Failed to save message');
    }
}
add_action('wp_ajax_tbc_mc_save_opt_out', 'tbc_mc_save_opt_out');