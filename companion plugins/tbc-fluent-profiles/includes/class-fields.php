<?php
/**
 * Fields Class
 * Manages custom field definitions: CRUD, type registry, sanitization.
 *
 * Field definitions are stored in wp_options key 'tbc_fp_fields'.
 * Field values are stored in wp_usermeta with prefix '_tbc_fp_{field_key}'.
 *
 * @package TBC_Fluent_Profiles
 */

namespace TBCFluentProfiles;

defined('ABSPATH') || exit;

class Fields {

    const OPTION_KEY = 'tbc_fp_fields';

    /**
     * Supported field types and their configuration
     */
    private static $type_registry = [
        'text' => [
            'label'       => 'Text',
            'input_type'  => 'text',
            'signup_type' => 'text',
            'has_options'  => false,
        ],
        'phone' => [
            'label'       => 'Phone',
            'input_type'  => 'tel',
            'signup_type' => 'text',
            'has_options'  => false,
        ],
        'number' => [
            'label'       => 'Number',
            'input_type'  => 'number',
            'signup_type' => 'text',
            'has_options'  => false,
        ],
        'date' => [
            'label'       => 'Date',
            'input_type'  => 'date',
            'signup_type' => 'text',
            'has_options'  => false,
        ],
        'textarea' => [
            'label'       => 'Textarea',
            'input_type'  => 'textarea',
            'signup_type' => 'textarea',
            'has_options'  => false,
        ],
        'select' => [
            'label'       => 'Select',
            'input_type'  => 'select',
            'signup_type' => 'select',
            'has_options'  => true,
        ],
        'radio' => [
            'label'       => 'Radio',
            'input_type'  => 'radio',
            'signup_type' => 'select',
            'has_options'  => true,
        ],
        'checkbox' => [
            'label'       => 'Checkbox',
            'input_type'  => 'checkbox',
            'signup_type' => 'checkbox',
            'has_options'  => true,
        ],
        'multiselect' => [
            'label'       => 'Multi-Select',
            'input_type'  => 'multiselect',
            'signup_type' => 'multiselect',
            'has_options'  => true,
        ],
        'gender' => [
            'label'       => 'Gender',
            'input_type'  => 'select',
            'signup_type' => 'select',
            'has_options'  => true,
            'fixed_options' => ['Male', 'Female', 'Non-Binary', 'Other', 'Prefer not to say'],
        ],
        'url' => [
            'label'       => 'URL',
            'input_type'  => 'url',
            'signup_type' => 'text',
            'has_options'  => false,
        ],
    ];

    /**
     * Get all field definitions, ordered by 'order' key.
     *
     * @return array Keyed by field key.
     */
    public function get_fields() {
        $fields = get_option(self::OPTION_KEY, []);

        if (!is_array($fields)) {
            return [];
        }

        uasort($fields, function ($a, $b) {
            return ($a['order'] ?? 999) - ($b['order'] ?? 999);
        });

        return $fields;
    }

    /**
     * Get a single field definition.
     *
     * @param string $key
     * @return array|null
     */
    public function get_field($key) {
        $fields = $this->get_fields();
        return $fields[$key] ?? null;
    }

    /**
     * Get fields filtered for a context.
     *
     * @param string $context 'signup' or 'profile'
     * @return array
     */
    public function get_fields_for($context) {
        $fields = $this->get_fields();

        return array_filter($fields, function ($field) use ($context) {
            if ($context === 'signup') {
                return !empty($field['show_on_signup']);
            }
            if ($context === 'profile') {
                return !empty($field['show_in_profile']);
            }
            return true;
        });
    }

    /**
     * Save all field definitions.
     *
     * @param array $fields
     * @return bool
     */
    public function save_fields($fields) {
        return update_option(self::OPTION_KEY, $fields);
    }

    /**
     * Add or update a single field definition.
     *
     * @param string $key
     * @param array  $field_data
     * @return bool
     */
    public function save_field($key, $field_data) {
        $fields = $this->get_fields();
        $field_data['key'] = $key;
        $fields[$key] = $field_data;
        return $this->save_fields($fields);
    }

    /**
     * Delete a field definition (does NOT delete user meta values).
     *
     * @param string $key
     * @return bool
     */
    public function delete_field($key) {
        $fields = $this->get_fields();
        if (!isset($fields[$key])) {
            return false;
        }
        unset($fields[$key]);
        return $this->save_fields($fields);
    }

    /**
     * Get the wp_usermeta key for a field.
     *
     * @param string $field_key
     * @return string
     */
    public static function meta_key($field_key) {
        return TBC_FP_META_PREFIX . $field_key;
    }

    /**
     * Get the type registry.
     *
     * @return array
     */
    public static function get_type_registry() {
        return self::$type_registry;
    }

    /**
     * Get type config for a specific type.
     *
     * @param string $type
     * @return array|null
     */
    public static function get_type_config($type) {
        return self::$type_registry[$type] ?? null;
    }

    /**
     * Get the options for a field (handles fixed_options like gender).
     *
     * @param array $field
     * @return array
     */
    public static function get_field_options($field) {
        $type_config = self::get_type_config($field['type'] ?? 'text');

        if (!empty($type_config['fixed_options'])) {
            return $type_config['fixed_options'];
        }

        return $field['options'] ?? [];
    }

    /**
     * Sanitize a field value based on its type.
     *
     * @param mixed  $value
     * @param array  $field
     * @return mixed Sanitized value.
     */
    public static function sanitize_value($value, $field) {
        $type = $field['type'] ?? 'text';

        switch ($type) {
            case 'url':
                return esc_url_raw($value);

            case 'number':
                return is_numeric($value) ? $value : '';

            case 'date':
                // Validate YYYY-MM-DD format
                if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
                    return sanitize_text_field($value);
                }
                return '';

            case 'textarea':
                return sanitize_textarea_field($value);

            case 'checkbox':
            case 'multiselect':
                // Multi-value: expect array or JSON string
                if (is_string($value)) {
                    $decoded = json_decode($value, true);
                    if (is_array($decoded)) {
                        $value = $decoded;
                    } else {
                        $value = [$value];
                    }
                }
                if (!is_array($value)) {
                    return '[]';
                }
                $value = array_map('sanitize_text_field', $value);
                return wp_json_encode(array_values($value));

            case 'select':
            case 'radio':
            case 'gender':
                $sanitized = sanitize_text_field($value);
                // Validate against allowed options
                $options = self::get_field_options($field);
                if (!empty($options) && !in_array($sanitized, $options, true)) {
                    return '';
                }
                return $sanitized;

            case 'phone':
            case 'text':
            default:
                return sanitize_text_field($value);
        }
    }

    /**
     * Get a user's field value.
     *
     * @param int    $user_id
     * @param string $field_key
     * @return string
     */
    public function get_user_value($user_id, $field_key) {
        return get_user_meta($user_id, self::meta_key($field_key), true) ?: '';
    }

    /**
     * Save a user's field value.
     *
     * @param int    $user_id
     * @param string $field_key
     * @param mixed  $value
     * @param array  $field Field definition for sanitization.
     * @return bool
     */
    public function save_user_value($user_id, $field_key, $value, $field) {
        $sanitized = self::sanitize_value($value, $field);
        return update_user_meta($user_id, self::meta_key($field_key), $sanitized) !== false;
    }

    /**
     * Sanitize a field definition array (for admin save).
     *
     * @param array $field_data Raw field data from admin form.
     * @return array Sanitized field definition.
     */
    public static function sanitize_field_definition($field_data) {
        $sanitized = [
            'key'                 => sanitize_key($field_data['key'] ?? ''),
            'label'               => sanitize_text_field($field_data['label'] ?? ''),
            'type'                => sanitize_key($field_data['type'] ?? 'text'),
            'placeholder'         => sanitize_text_field($field_data['placeholder'] ?? ''),
            'instructions'        => sanitize_text_field($field_data['instructions'] ?? ''),
            'required'            => !empty($field_data['required']),
            'order'               => absint($field_data['order'] ?? 0),
            'visibility'          => in_array($field_data['visibility'] ?? 'admins', ['public', 'members', 'friends', 'admins'], true)
                                     ? $field_data['visibility'] : 'admins',
            'allow_user_override' => !empty($field_data['allow_user_override']),
            'show_on_signup'      => !empty($field_data['show_on_signup']),
            'show_in_profile'     => !empty($field_data['show_in_profile']),
            'options'             => [],
        ];

        // Validate type
        if (!isset(self::$type_registry[$sanitized['type']])) {
            $sanitized['type'] = 'text';
        }

        // Sanitize options for types that support them
        $type_config = self::get_type_config($sanitized['type']);
        if (!empty($type_config['has_options']) && empty($type_config['fixed_options'])) {
            $raw_options = $field_data['options'] ?? [];
            if (is_string($raw_options)) {
                // Accept newline-separated or JSON
                $decoded = json_decode($raw_options, true);
                $raw_options = is_array($decoded) ? $decoded : array_filter(array_map('trim', explode("\n", $raw_options)));
            }
            $sanitized['options'] = array_values(array_map('sanitize_text_field', (array) $raw_options));
        }

        return $sanitized;
    }
}
