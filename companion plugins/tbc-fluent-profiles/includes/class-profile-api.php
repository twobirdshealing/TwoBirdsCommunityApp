<?php
/**
 * Profile API Class
 * Hooks into FluentCommunity's profile API to inject custom field data
 * into GET responses and handle custom field saves on POST updates.
 *
 * @package TBC_Fluent_Profiles
 */

namespace TBCFluentProfiles;

defined('ABSPATH') || exit;

class ProfileApi {

    private $fields;
    private $visibility;

    public function __construct(Fields $fields, Visibility $visibility) {
        $this->fields = $fields;
        $this->visibility = $visibility;
    }

    /**
     * Inject custom field data into profile API GET response.
     *
     * Hooks into: fluent_community/profile_view_data
     * ProfileController::getProfile() applies this filter.
     *
     * @param array  $profileData The profile data array.
     * @param object $xprofile    The XProfile model instance.
     * @return array Modified profile data.
     */
    public function inject_profile_data($profileData, $xprofile) {
        $viewerId = get_current_user_id();
        $profileUserId = $xprofile->user_id;

        $profileFields = $this->fields->get_fields_for('profile');

        // Apply visibility filtering
        $visibleFields = $this->visibility->filter_visible_fields(
            $profileFields,
            $profileUserId,
            $viewerId
        );

        $customFieldData = [];
        foreach ($visibleFields as $key => $field) {
            $value = $this->fields->get_user_value($profileUserId, $key);
            $customFieldData[$key] = [
                'value'      => $value,
                'label'      => $field['label'],
                'type'       => $field['type'],
                'visibility' => $this->visibility->get_effective_visibility($field, $profileUserId),
            ];
        }

        $profileData['custom_fields'] = $customFieldData;

        // Include full field configs for the edit form (owner/admin only)
        $isOwn = ($viewerId && $viewerId == $profileUserId);
        $isAdmin = $this->visibility->is_admin($viewerId);

        if ($isOwn || $isAdmin) {
            // For the edit form, include ALL profile fields (not just visible ones)
            $allProfileFields = $this->fields->get_fields_for('profile');
            $editConfigs = [];
            foreach ($allProfileFields as $key => $field) {
                $editConfigs[$key] = [
                    'label'               => $field['label'],
                    'type'                => $field['type'],
                    'placeholder'         => $field['placeholder'] ?? '',
                    'instructions'        => $field['instructions'] ?? '',
                    'required'            => !empty($field['required']),
                    'options'             => Fields::get_field_options($field),
                    'visibility'          => $this->visibility->get_effective_visibility($field, $profileUserId),
                    'allow_user_override' => !empty($field['allow_user_override']),
                ];
            }
            $profileData['custom_field_configs'] = $editConfigs;
        }

        return $profileData;
    }

    /**
     * Handle saving custom field data when a profile is updated.
     *
     * Hooks into: fluent_community/update_profile_data
     * Reads custom_fields from the request body or X-TBC-FP-Fields header.
     *
     * @param array  $updateData The data FC will save to xprofile.
     * @param array  $data       The raw request data.
     * @param object $xProfile   The XProfile model instance.
     * @return array $updateData unchanged.
     */
    public function handle_profile_update($updateData, $data, $xProfile) {
        $customFieldValues = $data['custom_fields'] ?? [];

        // Fallback: read from custom header (XHR interception pattern)
        if (empty($customFieldValues)) {
            $headerValue = isset($_SERVER['HTTP_X_TBC_FP_FIELDS']) ? $_SERVER['HTTP_X_TBC_FP_FIELDS'] : '';
            if ($headerValue) {
                $customFieldValues = json_decode(wp_unslash($headerValue), true);
            }
        }

        if (empty($customFieldValues) || !is_array($customFieldValues)) {
            return $updateData;
        }

        // Verify the current user can edit this profile
        $currentUserId = get_current_user_id();
        $isOwn = ($xProfile->user_id == $currentUserId);
        $isAdmin = $this->visibility->is_admin($currentUserId);

        if (!$isOwn && !$isAdmin) {
            return $updateData;
        }

        $profileFields = $this->fields->get_fields_for('profile');

        foreach ($profileFields as $key => $field) {
            if (isset($customFieldValues[$key])) {
                $this->fields->save_user_value(
                    $xProfile->user_id,
                    $key,
                    $customFieldValues[$key],
                    $field
                );
            }

            // Handle visibility override if allowed
            if (!empty($field['allow_user_override']) && isset($customFieldValues[$key . '_visibility'])) {
                $this->visibility->save_user_visibility(
                    $xProfile->user_id,
                    $key,
                    sanitize_text_field($customFieldValues[$key . '_visibility'])
                );
            }
        }

        return $updateData;
    }

    /**
     * AJAX handler for saving custom fields from the frontend edit form.
     * Called via admin-ajax.php?action=tbc_fp_save_fields
     */
    public function ajax_save_fields() {
        if (!check_ajax_referer('tbc_fp_nonce', '_nonce', false)) {
            wp_send_json_error(['message' => 'Invalid nonce.'], 403);
        }

        $currentUserId = get_current_user_id();
        if (!$currentUserId) {
            wp_send_json_error(['message' => 'Not logged in.'], 401);
        }

        $targetUserId = isset($_POST['user_id']) ? absint($_POST['user_id']) : $currentUserId;

        $isOwn = ($targetUserId === $currentUserId);
        $isAdmin = $this->visibility->is_admin($currentUserId);

        if (!$isOwn && !$isAdmin) {
            wp_send_json_error(['message' => 'Permission denied.'], 403);
        }

        $profileFields = $this->fields->get_fields_for('profile');

        $saved = [];
        foreach ($profileFields as $key => $field) {
            if (isset($_POST[$key])) {
                $value = wp_unslash($_POST[$key]); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Sanitized in save_user_value().
                $this->fields->save_user_value($targetUserId, $key, $value, $field);
                $saved[$key] = $this->fields->get_user_value($targetUserId, $key);
            }
        }

        /**
         * Fires after custom profile fields have been saved via AJAX.
         *
         * @param int   $targetUserId The user whose fields were saved.
         * @param array $saved        The saved field values (key => sanitized value).
         */
        do_action('tbc_fp_after_ajax_save', $targetUserId, $saved);

        wp_send_json_success(['saved' => $saved]);
    }
}
