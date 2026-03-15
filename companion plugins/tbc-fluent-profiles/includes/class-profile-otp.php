<?php
/**
 * ProfileOtp Class
 * Requires OTP verification when a user changes their phone number in the FC portal.
 * Verify/resend handled by the universal REST OTP API (class-otp-api.php).
 *
 * Intercepts:
 *   1. wp_ajax_tbc_fp_save_fields (tbc-fluent-profiles direct AJAX) at priority 1
 *   2. fluent_community/update_profile_data filter at priority 5
 *
 * @package TBC_Fluent_Profiles
 */

declare(strict_types=1);

namespace TBCFluentProfiles;

defined('ABSPATH') || exit;

class ProfileOtp {

    private Twilio $twilio;

    public function __construct(Twilio $twilio) {
        $this->twilio = $twilio;
    }

    /**
     * Intercept tbc-fluent-profiles direct AJAX save.
     * Hooked at priority 1 on wp_ajax_tbc_fp_save_fields.
     */
    public function intercept_profile_save(): void {
        if (!Helpers::get_option('enable_profile_verification', false)) {
            return;
        }

        $user_id = get_current_user_id();
        if (!$user_id) {
            return;
        }

        // Check if a verified session is present — let save through
        // phpcs:ignore WordPress.Security.NonceVerification.Missing
        $session_key = isset($_POST['tbc_fp_session_key'])
            ? sanitize_text_field(wp_unslash($_POST['tbc_fp_session_key']))
            : '';
        if (empty($session_key)) {
            $session_key = isset($_SERVER['HTTP_X_TBC_FP_SESSION'])
                ? sanitize_text_field(wp_unslash($_SERVER['HTTP_X_TBC_FP_SESSION']))
                : '';
        }

        if (!empty($session_key) && Helpers::is_verified($session_key)) {
            Helpers::log("Profile OTP verified, allowing save for user #{$user_id}");
            Helpers::delete_session($session_key);
            return;
        }

        // Detect phone change from POST data (tbc_fp_save_fields AJAX path)
        $phone_change = $this->detect_phone_change_from_post($user_id);
        if (!$phone_change) {
            return; // No phone change, let save through
        }

        $new_phone = $phone_change['formatted'];

        // Validate
        if (Helpers::is_duplicate($new_phone, $user_id)) {
            wp_send_json_error([
                'message' => __('This phone number is already registered to another user.', 'tbc-fluent-profiles'),
            ]);
        }

        if (Helpers::is_blocked($new_phone)) {
            wp_send_json_error([
                'message' => __('This phone number cannot be used.', 'tbc-fluent-profiles'),
            ]);
        }

        // Send OTP
        $result = $this->twilio->start_verification($new_phone);
        if (!$result['success']) {
            Helpers::log("Failed to send profile OTP: {$result['message']}", 'error');
            wp_send_json_error(['message' => $result['message']]);
        }

        $clean_phone = $result['data']['phone'] ?? $new_phone;
        $session_key = Helpers::generate_session_key('tbc_fp_profile_');

        Helpers::store_session($session_key, [
            'verified'     => false,
            'phone_number' => $clean_phone,
            'user_id'      => $user_id,
            'context'      => 'profile_update',
        ]);

        Helpers::log("Profile OTP sent to {$clean_phone} for user #{$user_id}");

        wp_send_json_error([
            'otp_required' => true,
            'session_key'  => $session_key,
            'phone_masked' => Helpers::mask_phone($clean_phone),
        ]);
        // die() via wp_send_json_error — tbc-fluent-profiles handler never runs
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
        $raw = $data['tbc_fp_session_key'] ?? null;
        $session_key = is_string($raw) ? sanitize_text_field($raw) : '';
        if (empty($session_key)) {
            $session_key = isset($_SERVER['HTTP_X_TBC_FP_SESSION'])
                ? sanitize_text_field(wp_unslash($_SERVER['HTTP_X_TBC_FP_SESSION']))
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
                'message' => __('This phone number is already registered to another user.', 'tbc-fluent-profiles'),
            ], 422);
        }

        // Validate blocked
        if (Helpers::is_blocked($new_phone)) {
            wp_send_json_error([
                'message' => __('This phone number cannot be used.', 'tbc-fluent-profiles'),
            ], 422);
        }

        // Send OTP
        $result = $this->twilio->start_verification($new_phone);
        if (!$result['success']) {
            Helpers::log("Failed to send profile OTP: {$result['message']}", 'error');
            wp_send_json_error(['message' => $result['message']], 422);
        }

        $clean_phone = $result['data']['phone'] ?? $new_phone;
        $session_key = Helpers::generate_session_key('tbc_fp_profile_');

        Helpers::store_session($session_key, [
            'verified'     => false,
            'phone_number' => $clean_phone,
            'user_id'      => $user_id,
            'context'      => 'profile_update',
        ]);

        Helpers::log("Profile OTP sent to {$clean_phone} for user #{$user_id}");

        // Interrupt FC's save — 422 so FC's error path clears loading state naturally
        wp_send_json_error([
            'message'        => __('Phone verification required.', 'tbc-fluent-profiles'),
            'otp_required'   => true,
            'session_key'    => $session_key,
            'phone_masked'   => Helpers::mask_phone($clean_phone),
            'voice_fallback' => (bool) Helpers::get_option('enable_voice_fallback', false),
        ], 422);
    }

    /**
     * Detect phone change from the fluent_community/update_profile_data filter's $data.
     *
     * @return array{raw: string, formatted: string}|null Null if no change.
     */
    private function detect_phone_change_from_data(int $user_id, array $data): ?array {
        $meta_key  = Helpers::get_phone_meta_key();
        $field_key = $meta_key;
        if (str_starts_with($meta_key, '_tbc_fp_')) {
            $field_key = substr($meta_key, 8);
        }

        $new_phone = '';
        if (!empty($data['custom_fields'][$field_key])) {
            $new_phone = sanitize_text_field($data['custom_fields'][$field_key]);
        }

        if (empty($new_phone) && !empty($data[$field_key])) {
            $new_phone = sanitize_text_field($data[$field_key]);
        }

        if (empty($new_phone)) {
            return null;
        }

        return $this->compare_phone($user_id, $new_phone, $meta_key);
    }

    /**
     * Detect phone change from $_POST (for tbc_fp_save_fields AJAX path).
     *
     * @return array{raw: string, formatted: string}|null Null if no change.
     */
    private function detect_phone_change_from_post(int $user_id): ?array {
        $meta_key  = Helpers::get_phone_meta_key();
        $field_key = $meta_key;
        if (str_starts_with($meta_key, '_tbc_fp_')) {
            $field_key = substr($meta_key, 8);
        }

        $new_phone = '';

        // phpcs:ignore WordPress.Security.NonceVerification.Missing
        if (!empty($_POST[$field_key])) {
            $new_phone = sanitize_text_field(wp_unslash($_POST[$field_key]));
        }
        // phpcs:ignore WordPress.Security.NonceVerification.Missing
        if (empty($new_phone) && !empty($_POST['custom_fields'][$field_key])) {
            $new_phone = sanitize_text_field(wp_unslash($_POST['custom_fields'][$field_key]));
        }

        if (empty($new_phone)) {
            return null;
        }

        return $this->compare_phone($user_id, $new_phone, $meta_key);
    }

    /**
     * Compare a new phone value against the stored one.
     *
     * @return array{raw: string, formatted: string}|null Null if no change.
     */
    private function compare_phone(int $user_id, string $new_phone, string $meta_key): ?array {
        $current_phone = (string) get_user_meta($user_id, $meta_key, true);

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
