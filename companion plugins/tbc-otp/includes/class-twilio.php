<?php
/**
 * Twilio Class
 * Wrapper around Twilio Verify API v2 for sending and checking OTP codes.
 * Uses wp_remote_post() directly — no Twilio SDK required.
 *
 * @package TBC_OTP
 */

declare(strict_types=1);

namespace TBCOTP;

defined('ABSPATH') || exit;

class Twilio {

    private const API_BASE = 'https://verify.twilio.com/v2/Services/';

    private function get_service_sid(): string {
        return trim((string) Helpers::get_option('verify_service_sid', ''));
    }

    /**
     * @return array{sid: string, token: string}|null
     */
    private function get_credentials(): ?array {
        $sid   = trim((string) Helpers::get_option('twilio_sid', ''));
        $token = trim((string) Helpers::get_option('twilio_token', ''));

        if (empty($sid) || empty($token)) {
            return null;
        }

        return ['sid' => $sid, 'token' => $token];
    }

    /**
     * @return array{success: bool, message: string, data: array<string, mixed>}
     */
    public function start_verification(string $phone): array {
        return $this->start($phone, 'sms');
    }

    /**
     * @return array{success: bool, message: string, data: array<string, mixed>}
     */
    public function start_voice_verification(string $phone): array {
        return $this->start($phone, 'call');
    }

    /**
     * @return array{success: bool, message: string, data: array{valid: bool, status?: string}}
     */
    public function check_verification(string $phone, string $code): array {
        $creds       = $this->get_credentials();
        $service_sid = $this->get_service_sid();

        if (!$creds || empty($service_sid)) {
            return $this->error_response(__('Twilio Verify credentials not configured.', 'tbc-otp'), false);
        }

        $url = self::API_BASE . $service_sid . '/VerificationCheck';

        $response = wp_remote_post($url, [
            'headers' => [
                'Authorization' => 'Basic ' . base64_encode($creds['sid'] . ':' . $creds['token']),
            ],
            'body'    => [
                'To'   => $phone,
                'Code' => $code,
            ],
            'timeout' => 15,
        ]);

        if (is_wp_error($response)) {
            return $this->error_response(__('Unable to verify code. Please try again.', 'tbc-otp'), false);
        }

        $status_code = wp_remote_retrieve_response_code($response);
        $body        = json_decode(wp_remote_retrieve_body($response), true);

        if ($status_code >= 400 || !is_array($body)) {
            $msg = $body['message'] ?? __('Verification check failed.', 'tbc-otp');
            Helpers::log("Check verification failed ({$status_code}): {$msg}", 'error');
            return $this->error_response($msg, false);
        }

        $approved = ($body['status'] ?? '') === 'approved';

        return [
            'success' => true,
            'message' => $approved
                ? __('Verification successful.', 'tbc-otp')
                : __('Invalid verification code.', 'tbc-otp'),
            'data'    => [
                'valid'  => $approved,
                'status' => $body['status'] ?? '',
            ],
        ];
    }

    /**
     * @return array{success: bool, message: string, data: array<string, mixed>}
     */
    private function start(string $phone, string $channel): array {
        $creds       = $this->get_credentials();
        $service_sid = $this->get_service_sid();

        if (!$creds || empty($service_sid)) {
            return $this->error_response(__('Twilio Verify credentials not configured.', 'tbc-otp'));
        }

        $formatted = Helpers::format_phone($phone);
        if (empty($formatted)) {
            return $this->error_response(__('Please enter a valid phone number.', 'tbc-otp'));
        }

        $url = self::API_BASE . $service_sid . '/Verifications';

        $response = wp_remote_post($url, [
            'headers' => [
                'Authorization' => 'Basic ' . base64_encode($creds['sid'] . ':' . $creds['token']),
            ],
            'body'    => [
                'To'      => $formatted,
                'Channel' => $channel,
            ],
            'timeout' => 15,
        ]);

        if (is_wp_error($response)) {
            Helpers::log("Start {$channel} verification HTTP error: " . $response->get_error_message(), 'error');
            return $this->error_response(
                $channel === 'call'
                    ? __('Unable to initiate call. Please try again.', 'tbc-otp')
                    : __('Unable to send verification. Please try again.', 'tbc-otp')
            );
        }

        $status_code = wp_remote_retrieve_response_code($response);
        $body        = json_decode(wp_remote_retrieve_body($response), true);

        if ($status_code >= 400 || !is_array($body)) {
            $msg = $body['message'] ?? __('Failed to start verification.', 'tbc-otp');
            Helpers::log("Start {$channel} verification failed ({$status_code}): {$msg}", 'error');
            return $this->error_response($msg);
        }

        return [
            'success' => true,
            'message' => $channel === 'call'
                ? __('Voice call initiated successfully.', 'tbc-otp')
                : __('Verification code sent successfully.', 'tbc-otp'),
            'data'    => [
                'phone'            => $body['to'] ?? $formatted,
                'verification_sid' => $body['sid'] ?? '',
            ],
        ];
    }

    /**
     * @return array{success: bool, message: string, data: array<string, mixed>}
     */
    private function error_response(string $message, ?bool $valid = null): array {
        $data = [];
        if ($valid !== null) {
            $data['valid'] = $valid;
        }
        return [
            'success' => false,
            'message' => $message,
            'data'    => $data,
        ];
    }
}
