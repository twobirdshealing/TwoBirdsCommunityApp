<?php
/**
 * Incoming Message Handler - Unified for SMS and Voicemail
 */

// Register REST Endpoints
add_action('rest_api_init', function () {
    // SMS endpoint
    register_rest_route('tbc-mc/v1', '/incoming-sms', array(
        'methods' => 'POST',
        'callback' => 'tbc_mc_handle_incoming_sms',
        'permission_callback' => '__return_true'
    ));
    
    // Voicemail endpoint
    register_rest_route('tbc-mc/v1', '/store-transcription', array(
        'methods' => 'POST',
        'callback' => 'tbc_mc_store_transcription',
        'permission_callback' => '__return_true'
    ));
});

// Handle Incoming SMS
function tbc_mc_handle_incoming_sms(WP_REST_Request $request) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'tbc_mc_messages';

    $body = json_decode($request->get_body(), true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        return new WP_REST_Response(['error' => 'Invalid JSON'], 400);
    }

    $message_body = $body['Body'] ?? '';
    $from_number = $body['From'] ?? null;
    $num_media = intval($body['NumMedia'] ?? 0);
    
    if (empty($from_number)) {
        return new WP_REST_Response(['error' => 'No From number'], 400);
    }
    
    $formatted_from_number = tbc_mc_format_phone($from_number);

    // Collect media URLs
    $media_urls = [];
    for ($i = 0; $i < $num_media; $i++) {
        if (!empty($body["MediaUrl{$i}"])) {
            $media_urls[] = $body["MediaUrl{$i}"];
        }
    }

    // Process opt-out keyword
    if (stripos($message_body, 'notxt') !== false) {
        tbc_mc_handle_optout($formatted_from_number);
    }

    // Insert SMS into database
    $inserted = $wpdb->insert($table_name, [
        'type'           => 'sms',
        'sender_number'  => $formatted_from_number,
        'content'        => $message_body,
        'date_created'   => current_time('mysql'),
        'media_url'      => implode(',', $media_urls),
        'notes'          => '',
        'marked'         => 0,
        'is_read'        => 0,
        'is_reply'       => 0
    ]);

    if ($inserted) {
        $sms_id = $wpdb->insert_id;
        
        if (class_exists('TBC_MC_Notification')) {
            TBC_MC_Notification::instance()->sendMessageNotification($sms_id, [1, 168]);
        }
        
        return new WP_REST_Response(['success' => true, 'id' => $sms_id], 200);
    }
    
    error_log('[TBC-MC] Failed to insert SMS: ' . $wpdb->last_error);
    return new WP_REST_Response(['error' => 'Database insert failed'], 500);
}

// Handle Incoming Voicemail
function tbc_mc_store_transcription(WP_REST_Request $request) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'tbc_mc_messages';
    
    $recording_url = $request->get_param('RecordingUrl');
    $transcription = $request->get_param('TranscriptionText') ?? 'No transcription available.';
    $caller_number = $request->get_param('From');

    $inserted = $wpdb->insert($table_name, [
        'type'           => 'voicemail',
        'sender_number'  => tbc_mc_format_phone($caller_number),
        'content'        => $transcription,
        'date_created'   => current_time('mysql'),
        'media_url'      => $recording_url,
        'notes'          => '',
        'marked'         => 0,
        'is_read'        => 0,
        'is_reply'       => 0
    ]);

    if ($inserted) {
        $voicemail_id = $wpdb->insert_id;
        
        if (class_exists('TBC_MC_Notification')) {
            TBC_MC_Notification::instance()->sendMessageNotification($voicemail_id, [1, 168]);
        }
        
        return new WP_REST_Response(['success' => true, 'id' => $voicemail_id], 200);
    }
    
    error_log('[TBC-MC] Failed to insert voicemail: ' . $wpdb->last_error);
    return new WP_REST_Response(['error' => 'Database insert failed'], 500);
}

// Handle NOTXT opt-out keyword
function tbc_mc_handle_optout($phone_number) {
    $user_id = tbc_mc_get_user_by_phone($phone_number);

    if (!$user_id) {
        return false;
    }

    // Update FC native custom_fields opt-in value and swap roles
    $sms_slug     = get_option('tbc_mc_sms_optin_field_slug', '');
    $optout_value = get_option('tbc_mc_sms_optout_value', 'No, TXT');

    if ($sms_slug && $optout_value && class_exists('FluentCommunity\App\Models\XProfile')) {
        try {
            $xp = \FluentCommunity\App\Models\XProfile::where('user_id', $user_id)->first();
            if ($xp) {
                $custom = $xp->custom_fields;
                if (is_array($custom)) {
                    $custom[$sms_slug] = $optout_value;
                    $xp->custom_fields = $custom;
                    $xp->save();
                }
            }
        } catch (\Exception $e) {
            // log and continue to role swap
            error_log('[TBC-MC] Failed to update opt-out custom field: ' . $e->getMessage());
        }
    }

    // Swap roles (source of truth for opt-in/out filtering)
    $user = new WP_User($user_id);
    $user->add_role('sms_out');
    $user->remove_role('sms_in');

    return true;
}