<?php
/**
 * Twilio Call Integration Functions
 * Handles voice call initiation via Twilio
 */

use Twilio\Rest\Client;

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Initiate a voice call via Twilio
 * Connects personal phone to destination number through Twilio
 *
 * @param string $destination_number Number to call
 * @param string $personal_phone_number User's phone number that will receive the call first
 * @return array Response with type (success/error) and message
 */
function tbc_mc_initiate_call($destination_number, $personal_phone_number) {

    error_log("TBC Messaging Center: Initiating call - Destination: " . $destination_number . ", Personal: " . $personal_phone_number);

    // Format both numbers to E.164
    $formatted_destination = tbc_mc_format_phone($destination_number);
    $formatted_personal = tbc_mc_format_phone($personal_phone_number);

    // Validate E.164 format
    if (!preg_match("/^\+\d{10,15}$/", $formatted_destination)) {
        return array(
            'type' => 'error',
            'message' => 'Invalid destination phone number format.'
        );
    }

    if (!preg_match("/^\+\d{10,15}$/", $formatted_personal)) {
        return array(
            'type' => 'error',
            'message' => 'Invalid personal phone number format.'
        );
    }

    // Twilio credentials — configured via Settings tab in Message Center
    $sid = get_option('tbc_mc_twilio_sid', '');
    $token = get_option('tbc_mc_twilio_token', '');
    $twilio_number = get_option('tbc_mc_twilio_number', '');

    // TwiML URL that handles call routing
    $encoded_destination_number = urlencode($formatted_destination);
    $twiml_url = 'https://handler.twilio.com/twiml/EH07fb3b5a6165af01d52024c2e829fce7?destination_number=' . $encoded_destination_number;

    // Initialize Twilio client
    $client = new Client($sid, $token);

    try {
        $call = $client->calls->create(
            $formatted_personal,
            $twilio_number,
            ['url' => $twiml_url]
        );
        
        error_log("TBC Messaging Center: Call initiated successfully - SID: " . $call->sid);
        
        return array(
            'type' => 'success',
            'message' => 'Call initiated successfully!'
        );
    } catch (Exception $e) {
        error_log("TBC Messaging Center: Call initiation failed - " . $e->getMessage());
        
        return array(
            'type' => 'error',
            'message' => 'Error initiating call: ' . $e->getMessage()
        );
    }
}