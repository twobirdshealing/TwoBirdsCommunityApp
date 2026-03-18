<?php
/**
 * ProfileOtp Class
 * Requires OTP verification when a user changes their phone number.
 * Verify/resend handled by the universal REST OTP API (class-otp-api.php).
 *
 * Intercepts fluent_community/update_profile_data filter at priority 5.
 * Phone numbers are stored in FC native custom_fields JSON.
 *
 * @package TBC_Registration
 */

declare(strict_types=1);

namespace TBCRegistration;

defined('ABSPATH') || exit;

class ProfileOtp {

    private Twilio $twilio;

    public function __construct(Twilio $twilio) {
        $this->twilio = $twilio;
    }

    /**
     * Filter hook on fluent_community/update_profile_data.
     *
     * When a phone change is detected without a verified OTP session, we interrupt
     * FC's save by sending a JSON error response and exiting.
     *
     * @param array<string, mixed> $update_data Data FC will save.
     * @param array<string, mixed> $data        Raw request data (includes custom_fields).
     * @param object               $xprofile    XProfile model.
     * @return array<string, mixed>
     */
    public function filter_profile_update(array $update_data, array $data, $xprofile): array {
        if (!Helpers::get_option('enable_profile_verification', false)) {
            return $update_data;
        }

        $user_id = $xprofile->user_id ?? 0;
        if (!$user_id) {
            return $update_data;
        }

        // If a verified session is attached, allow save through
        $raw = $data['tbc_reg_session_key'] ?? null;
        $session_key = is_string($raw) ? sanitize_text_field($raw) : '';
        if (empty($session_key)) {
            $session_key = isset($_SERVER['HTTP_X_TBC_REG_SESSION'])
                ? sanitize_text_field(wp_unslash($_SERVER['HTTP_X_TBC_REG_SESSION']))
                : '';
        }
        if (!empty($session_key) && Helpers::is_verified($session_key)) {
            Helpers::log("Profile OTP verified session found, allowing save for user #{$user_id}");
            Helpers::delete_session($session_key);
            return $update_data;
        }

        // Detect phone change from the filter's $data (not $_POST)
        $phone_change = $this->detect_phone_change_from_data((int) $user_id, $data);
        if (!$phone_change) {
            return $update_data; // No phone change, let save through
        }

        $new_phone = $phone_change['formatted'];

        // Validate duplicate
        if (Helpers::is_duplicate($new_phone, (int) $user_id)) {
            wp_send_json_error([
                'message' => __('This phone number is already registered to another user.', 'tbc-registration'),
            ], 422);
        }

        // Validate blocked
        if (Helpers::is_blocked($new_phone)) {
            wp_send_json_error([
                'message' => __('This phone number cannot be used.', 'tbc-registration'),
            ], 422);
        }

        // Send OTP
        $result = $this->twilio->start_verification($new_phone);
        if (!$result['success']) {
            Helpers::log("Failed to send profile OTP: {$result['message']}", 'error');
            wp_send_json_error(['message' => $result['message']], 422);
        }

        $clean_phone = $result['data']['phone'] ?? $new_phone;
        $session_key = Helpers::generate_session_key('tbc_reg_profile_');

        Helpers::store_session($session_key, [
            'verified'     => false,
            'phone_number' => $clean_phone,
            'user_id'      => $user_id,
            'context'      => 'profile_update',
        ]);

        Helpers::log("Profile OTP sent to {$clean_phone} for user #{$user_id}");

        // Interrupt FC's save — 422 so FC's error path clears loading state naturally
        wp_send_json_error([
            'message'        => __('Phone verification required.', 'tbc-registration'),
            'otp_required'   => true,
            'session_key'    => $session_key,
            'phone_masked'   => Helpers::mask_phone($clean_phone),
            'voice_fallback' => (bool) Helpers::get_option('enable_voice_fallback', false),
        ], 422);
    }

    /**
     * Detect phone change from the fluent_community/update_profile_data filter's $data.
     * Looks for the phone slug in FC native custom_fields format.
     *
     * @return array{raw: string, formatted: string}|null Null if no change.
     */
    private function detect_phone_change_from_data(int $user_id, array $data): ?array {
        $phone_slug = Helpers::get_phone_slug();

        $new_phone = '';
        if (!empty($data['custom_fields'][$phone_slug])) {
            $new_phone = sanitize_text_field($data['custom_fields'][$phone_slug]);
        }

        if (empty($new_phone)) {
            return null;
        }

        return $this->compare_phone($user_id, $new_phone);
    }

    /**
     * Compare a new phone value against the stored one in FC native JSON.
     *
     * @return array{raw: string, formatted: string}|null Null if no change.
     */
    private function compare_phone(int $user_id, string $new_phone): ?array {
        $current_phone = Helpers::get_phone_value($user_id);

        $formatted_new     = Helpers::format_phone($new_phone, true);
        $formatted_current = Helpers::format_phone($current_phone, true);

        if ($formatted_new === $formatted_current) {
            return null;
        }

        if (empty($formatted_new)) {
            return null; // Removing phone — allow
        }

        Helpers::log("Profile OTP: phone changed for user #{$user_id}");
        return [
            'raw'       => $new_phone,
            'formatted' => $formatted_new,
        ];
    }
}
