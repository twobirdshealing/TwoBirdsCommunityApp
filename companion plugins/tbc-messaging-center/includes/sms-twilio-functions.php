<?php
/**
 * Twilio SMS Integration Functions
 * Handles Twilio client initialization and SMS/MMS sending
 */

use Twilio\Rest\Client;

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Twilio credentials — configured via Settings tab in Message Center
define('TWILIO_SID', get_option('tbc_mc_twilio_sid', ''));
define('TWILIO_TOKEN', get_option('tbc_mc_twilio_token', ''));
define('TWILIO_MESSAGING_SERVICE_SID', get_option('tbc_mc_twilio_messaging_service_sid', ''));

/**
 * Initialize and return Twilio client (singleton)
 *
 * @return Client Twilio REST client instance
 */
function tbc_mc_get_twilio_client() {
    static $client = null;

    if ($client === null) {
        $client = new Client(TWILIO_SID, TWILIO_TOKEN);
    }

    return $client;
}

/**
 * Send SMS/MMS messages to recipients via Twilio
 * No longer handles batching - Action Scheduler handles queuing/batching
 *
 * @param string $message Message content (supports {name} merge tag)
 * @param array $recipients Array of ['phone' => '+1...', 'name' => 'Name']
 * @param string $mediaUrl Optional media URL for MMS
 * @param bool $send_as_mms Force send as MMS
 * @return array Array of feedback messages with type and message
 */
function tbc_mc_send_sms_batch($message, $recipients, $mediaUrl = '', $send_as_mms = false) {
    $feedbacks = [];

    if (empty(trim($message))) {
        return [['type' => 'error', 'message' => 'You must type a message to send.']];
    }

    if (empty($recipients)) {
        return [['type' => 'error', 'message' => 'Please provide at least one valid phone number to send the message to!']];
    }

    $client = tbc_mc_get_twilio_client();

    foreach ($recipients as $recipient) {
        $phone = tbc_mc_format_phone($recipient['phone']);
        $name = $recipient['name'];

        // Validate phone number after formatting
        if (empty($phone) || !preg_match('/^\+\d{10,15}$/', $phone)) {
            $feedbacks[] = ['type' => 'error', 'message' => "Invalid phone number provided: {$recipient['phone']}"];
            continue;
        }

        // Replace merge tags with recipient name
        $personalized_message = str_replace('{name}', $name, $message);

        try {
            $message_data = [
                'body'                => $personalized_message,
                'messagingServiceSid' => TWILIO_MESSAGING_SERVICE_SID,
                'to'                  => $phone,
            ];

            // Include media URL if provided
            // Handle multiple media URLs (comma-separated string to array)
            if (!empty($mediaUrl)) {
                $mediaUrls = array_map('trim', explode(',', $mediaUrl));
                // Twilio supports up to 10 media attachments
                $mediaUrls = array_slice($mediaUrls, 0, 10);
                $message_data['mediaUrl'] = $mediaUrls;
            }

            // Include 'SendAsMms' parameter if send_as_mms is true
            if ($send_as_mms) {
                $message_data['SendAsMms'] = true;
            }

            $twilioMessage = $client->messages->create($phone, $message_data);

            if ($twilioMessage->sid) {
                $feedbacks[] = ['type' => 'success', 'message' => "Message sent successfully to $name ($phone)"];
            } else {
                $feedbacks[] = ['type' => 'error', 'message' => "Failed to send to $name ($phone)"];
            }
        } catch (Exception $e) {
            error_log("TBC Messaging Center: Error sending to $phone - " . $e->getMessage());
            $feedbacks[] = ['type' => 'error', 'message' => "Error sending to $name ($phone): " . $e->getMessage()];
        }
    }

    return $feedbacks;
}