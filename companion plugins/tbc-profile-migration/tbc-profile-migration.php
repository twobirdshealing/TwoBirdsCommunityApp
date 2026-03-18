<?php
/**
 * Plugin Name: TBC Profile Migration
 * Description: One-time migration tool: creates FC 2.3.0 native custom profile fields and migrates data from tbc-registration (wp_usermeta) to fcom_xprofile.custom_fields JSON.
 * Version: 1.0.0
 * Author: Two Birds Code
 *
 * USAGE: Activate, go to Tools → TBC Profile Migration, run dry-run then migrate. Deactivate & delete when done.
 */

defined('ABSPATH') || exit;

class TBC_Profile_Migration {

    /**
     * Field mapping: our old field key => FC native slug
     * Old meta keys are _tbc_fp_{key}, new slugs are as shown.
     */
    private const FIELD_MAP = [
        'phone'      => '_phone',
        'pronouns'   => '_pronouns',
        'sms_opt_in' => '_sms-opt-in',
        'state'      => '_state',
        'gender'     => '_gender',
        'city'       => '_city',
        'birthdate'  => '_birthdate',
    ];

    /**
     * Value transformations: old_value => new_value
     * Only needed for fields where stored values changed.
     * This will be populated after we confirm existing values.
     */
    private const VALUE_MAP = [
        'sms_opt_in' => [
            // Map old values to new values if needed
            // 'Yes'     => 'Yes, TXT',
            // 'No'      => 'No, TXT',
            // If values already match, leave this empty
        ],
        'gender' => [
            // If old values need mapping, add here
            // 'Male' => 'Male',  // no change needed
        ],
    ];

    /**
     * FC native field definitions to create on production.
     * This is the config that will be written to fcom_meta.
     */
    private static function get_field_config(): array {
        return [
            'is_enabled' => 'yes',
            'groups' => [
                [
                    'slug'             => '_additional_info',
                    'label'            => 'Additional Information',
                    'edit_description' => 'Fill in additional information about yourself.',
                    'is_system'        => true,
                ],
            ],
            'fields' => [
                [
                    'slug'           => '_phone',
                    'label'          => 'Phone',
                    'type'           => 'text',  // NOT number — phone numbers aren't floats
                    'placeholder'    => '',
                    'options'        => [],
                    'is_required'    => true,
                    'is_enabled'     => true,
                    'privacy'        => 'private',
                    'group'          => '_additional_info',
                    'show_on_signup' => true,
                ],
                [
                    'slug'           => '_pronouns',
                    'label'          => 'Pronouns',
                    'type'           => 'text',
                    'placeholder'    => 'if you prefer let us know',
                    'options'        => [],
                    'is_required'    => false,
                    'is_enabled'     => true,
                    'privacy'        => 'public',
                    'group'          => '_additional_info',
                    'show_on_signup' => true,
                ],
                [
                    'slug'           => '_sms-opt-in',
                    'label'          => 'SMS Opt in',
                    'type'           => 'radio',
                    'placeholder'    => "Select Yes to receive all Two\u{202F}Birds\u{202F}Church text messages\u{2014}including weekly event updates, sacred ceremonies, and important notifications. Select No to opt out of all texts.",
                    'options'        => ['Yes, TXT', 'No, TXT'],
                    'is_required'    => true,
                    'is_enabled'     => true,
                    'privacy'        => 'private',
                    'group'          => '_additional_info',
                    'show_on_signup' => true,
                ],
                [
                    'slug'           => '_state',
                    'label'          => 'State',
                    'type'           => 'text',
                    'placeholder'    => 'Where are you coming from',
                    'options'        => [],
                    'is_required'    => true,
                    'is_enabled'     => true,
                    'privacy'        => 'private',
                    'group'          => '_additional_info',
                    'show_on_signup' => true,
                ],
                [
                    'slug'           => '_gender',
                    'label'          => 'Gender',
                    'type'           => 'select',
                    'placeholder'    => '',
                    'options'        => ['Male', 'Female', 'Non-Binary', 'Other', 'Prefer not to say'],
                    'is_required'    => true,
                    'is_enabled'     => true,
                    'privacy'        => 'public',
                    'group'          => '_additional_info',
                    'show_on_signup' => true,
                ],
                [
                    'slug'           => '_city',
                    'label'          => 'City',
                    'type'           => 'text',
                    'placeholder'    => '',
                    'options'        => [],
                    'is_required'    => true,
                    'is_enabled'     => true,
                    'privacy'        => 'public',
                    'group'          => '_additional_info',
                    'show_on_signup' => true,
                ],
                [
                    'slug'           => '_birthdate',
                    'label'          => 'Birthdate',
                    'type'           => 'date',
                    'placeholder'    => '',
                    'options'        => [],
                    'is_required'    => true,
                    'is_enabled'     => true,
                    'privacy'        => 'public',
                    'group'          => '_additional_info',
                    'show_on_signup' => true,
                ],
            ],
        ];
    }

    public function __construct() {
        add_action('admin_menu', [$this, 'add_menu']);
        add_action('admin_post_tbc_migration_dry_run', [$this, 'handle_dry_run']);
        add_action('admin_post_tbc_migration_execute', [$this, 'handle_execute']);
        add_action('admin_post_tbc_migration_create_fields', [$this, 'handle_create_fields']);
        add_action('admin_post_tbc_migration_cleanup_usermeta', [$this, 'handle_cleanup_usermeta']);
        add_action('admin_post_tbc_migration_cleanup_fields', [$this, 'handle_cleanup_fields']);
        add_action('admin_post_tbc_migration_cleanup_settings', [$this, 'handle_cleanup_settings']);
    }

    public function add_menu(): void {
        add_management_page(
            'TBC Profile Migration',
            'TBC Profile Migration',
            'manage_options',
            'tbc-profile-migration',
            [$this, 'render_page']
        );
    }

    /**
     * Check if FC 2.3.0+ is active and has the required classes.
     */
    private function fc_available(): bool {
        return class_exists('FluentCommunity\App\Models\Meta')
            && class_exists('FluentCommunity\App\Models\XProfile');
    }

    /**
     * Check if native custom fields are already configured.
     */
    private function fields_exist(): bool {
        if (!$this->fc_available()) return false;

        $meta = \FluentCommunity\App\Models\Meta::where('object_type', 'option')
            ->where('meta_key', 'custom_profile_fields')
            ->first();

        if (!$meta) return false;

        $config = maybe_unserialize($meta->value);
        return !empty($config['fields']);
    }

    /**
     * Check if the feature flag is enabled.
     */
    private function feature_enabled(): bool {
        if (!$this->fc_available()) return false;

        $meta = \FluentCommunity\App\Models\Meta::where('object_type', 'option')
            ->where('meta_key', 'fluent_community_features')
            ->first();

        if (!$meta) return false;

        $features = maybe_unserialize($meta->value);
        return ($features['custom_profile_fields'] ?? 'no') === 'yes';
    }

    /**
     * Get all users who have any _tbc_fp_* meta values.
     */
    private function get_users_with_data(): array {
        global $wpdb;

        $like = '_tbc_fp_%';
        $user_ids = $wpdb->get_col($wpdb->prepare(
            "SELECT DISTINCT user_id FROM {$wpdb->usermeta} WHERE meta_key LIKE %s",
            $like
        ));

        return array_map('intval', $user_ids);
    }

    /**
     * Get a user's old field values from wp_usermeta.
     */
    private function get_old_values(int $user_id): array {
        global $wpdb;

        $like = '_tbc_fp_%';
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT meta_key, meta_value FROM {$wpdb->usermeta} WHERE user_id = %d AND meta_key LIKE %s",
            $user_id, $like
        ));

        $values = [];
        foreach ($rows as $row) {
            // Strip _tbc_fp_ prefix to get the field key
            $field_key = str_replace('_tbc_fp_', '', $row->meta_key);

            // Skip visibility override meta (ends with _visibility)
            if (str_ends_with($field_key, '_visibility')) continue;
            // Skip internal meta
            if ($field_key === 'registration_complete') continue;

            $values[$field_key] = $row->meta_value;
        }

        return $values;
    }

    /**
     * Transform old values to new format using VALUE_MAP.
     */
    private function transform_values(array $old_values): array {
        $new_values = [];

        foreach ($old_values as $field_key => $value) {
            if (!isset(self::FIELD_MAP[$field_key])) continue;

            $fc_slug = self::FIELD_MAP[$field_key];

            // Apply value transformation if defined
            if (isset(self::VALUE_MAP[$field_key]) && !empty(self::VALUE_MAP[$field_key])) {
                $value = self::VALUE_MAP[$field_key][$value] ?? $value;
            }

            // Skip empty values
            if ($value === '' || $value === null) continue;

            $new_values[$fc_slug] = $value;
        }

        return $new_values;
    }

    /**
     * Get a user's existing FC custom_fields from xprofile.
     */
    private function get_existing_fc_fields(int $user_id): array {
        $xprofile = \FluentCommunity\App\Models\XProfile::where('user_id', $user_id)->first();
        if (!$xprofile) return [];

        $existing = $xprofile->custom_fields;
        return is_array($existing) ? $existing : [];
    }

    /**
     * Write custom_fields to a user's xprofile.
     */
    private function save_fc_fields(int $user_id, array $fields): bool {
        $xprofile = \FluentCommunity\App\Models\XProfile::where('user_id', $user_id)->first();
        if (!$xprofile) return false;

        $xprofile->custom_fields = $fields;
        $xprofile->save();
        return true;
    }

    // ─── Admin Actions ───

    public function handle_create_fields(): void {
        check_admin_referer('tbc_migration_create_fields');

        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }

        if (!$this->fc_available()) {
            wp_redirect(add_query_arg(['page' => 'tbc-profile-migration', 'result' => 'fc_missing'], admin_url('tools.php')));
            exit;
        }

        $config = self::get_field_config();

        // Write field config to fcom_meta
        $existing = \FluentCommunity\App\Models\Meta::where('object_type', 'option')
            ->where('meta_key', 'custom_profile_fields')
            ->first();

        // Meta model auto-serializes via setValueAttribute — do NOT manually serialize
        if ($existing) {
            $existing->value = $config;
            $existing->save();
        } else {
            \FluentCommunity\App\Models\Meta::create([
                'object_type' => 'option',
                'object_id'   => 0,
                'meta_key'    => 'custom_profile_fields',
                'value'       => $config,
            ]);
        }

        // Enable the feature flag
        $features_meta = \FluentCommunity\App\Models\Meta::where('object_type', 'option')
            ->where('meta_key', 'fluent_community_features')
            ->first();

        if ($features_meta) {
            $features = $features_meta->value; // already unserialized by getValueAttribute
            $features['custom_profile_fields'] = 'yes';
            $features_meta->value = $features; // auto-serialized by setValueAttribute
            $features_meta->save();
        }

        // Ensure custom_fields column exists on xprofile table
        global $wpdb;
        $table = $wpdb->prefix . 'fcom_xprofile';
        $col = $wpdb->get_results("SHOW COLUMNS FROM {$table} LIKE 'custom_fields'");
        if (empty($col)) {
            $wpdb->query("ALTER TABLE {$table} ADD COLUMN custom_fields JSON NULL AFTER meta");
        }

        wp_redirect(add_query_arg(['page' => 'tbc-profile-migration', 'result' => 'fields_created'], admin_url('tools.php')));
        exit;
    }

    public function handle_dry_run(): void {
        check_admin_referer('tbc_migration_dry_run');

        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }

        $report = $this->build_migration_report();
        set_transient('tbc_migration_report', $report, 300);

        wp_redirect(add_query_arg(['page' => 'tbc-profile-migration', 'result' => 'dry_run'], admin_url('tools.php')));
        exit;
    }

    public function handle_execute(): void {
        check_admin_referer('tbc_migration_execute');

        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }

        if (!$this->fc_available()) {
            wp_redirect(add_query_arg(['page' => 'tbc-profile-migration', 'result' => 'fc_missing'], admin_url('tools.php')));
            exit;
        }

        $user_ids = $this->get_users_with_data();
        $migrated = 0;
        $skipped  = 0;
        $errors   = 0;
        $details  = [];

        foreach ($user_ids as $user_id) {
            $old_values = $this->get_old_values($user_id);
            $new_values = $this->transform_values($old_values);

            if (empty($new_values)) {
                $skipped++;
                continue;
            }

            // Merge with any existing FC custom fields (don't overwrite)
            $existing = $this->get_existing_fc_fields($user_id);
            $merged = array_merge($existing, $new_values);

            if ($this->save_fc_fields($user_id, $merged)) {
                $migrated++;
                $details[] = "User {$user_id}: migrated " . count($new_values) . " fields";
            } else {
                $errors++;
                $details[] = "User {$user_id}: ERROR — no xprofile row found";
            }
        }

        $result = [
            'migrated' => $migrated,
            'skipped'  => $skipped,
            'errors'   => $errors,
            'details'  => $details,
        ];

        set_transient('tbc_migration_result', $result, 300);
        wp_redirect(add_query_arg(['page' => 'tbc-profile-migration', 'result' => 'executed'], admin_url('tools.php')));
        exit;
    }

    /**
     * Step 4a: Remove all _tbc_fp_* values from wp_usermeta.
     */
    public function handle_cleanup_usermeta(): void {
        check_admin_referer('tbc_migration_cleanup_usermeta');
        if (!current_user_can('manage_options')) wp_die('Unauthorized');

        global $wpdb;

        // Count before deleting
        $count = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$wpdb->usermeta} WHERE meta_key LIKE '_tbc_fp_%'"
        );

        $wpdb->query("DELETE FROM {$wpdb->usermeta} WHERE meta_key LIKE '_tbc_fp_%'");

        set_transient('tbc_migration_cleanup', [
            'type'  => 'usermeta',
            'count' => $count,
        ], 60);

        wp_redirect(add_query_arg(['page' => 'tbc-profile-migration', 'result' => 'cleanup'], admin_url('tools.php')));
        exit;
    }

    /**
     * Step 4b: Remove old field definitions from wp_options (tbc_fp_fields).
     */
    public function handle_cleanup_fields(): void {
        check_admin_referer('tbc_migration_cleanup_fields');
        if (!current_user_can('manage_options')) wp_die('Unauthorized');

        $deleted = 0;
        if (get_option('tbc_fp_fields') !== false) {
            delete_option('tbc_fp_fields');
            $deleted++;
        }

        set_transient('tbc_migration_cleanup', [
            'type'  => 'fields',
            'count' => $deleted,
        ], 60);

        wp_redirect(add_query_arg(['page' => 'tbc-profile-migration', 'result' => 'cleanup'], admin_url('tools.php')));
        exit;
    }

    /**
     * Step 4c: Remove deprecated settings from wp_options.
     */
    public function handle_cleanup_settings(): void {
        check_admin_referer('tbc_migration_cleanup_settings');
        if (!current_user_can('manage_options')) wp_die('Unauthorized');

        // Old settings that are no longer used after migration to FC native
        $deprecated_options = [
            'tbc_fp_phone_meta_key',
            'tbc_fp_phone_meta_key_custom',
        ];

        $deleted = 0;
        foreach ($deprecated_options as $opt) {
            if (get_option($opt) !== false) {
                delete_option($opt);
                $deleted++;
            }
        }

        set_transient('tbc_migration_cleanup', [
            'type'  => 'settings',
            'count' => $deleted,
        ], 60);

        wp_redirect(add_query_arg(['page' => 'tbc-profile-migration', 'result' => 'cleanup'], admin_url('tools.php')));
        exit;
    }

    private function build_migration_report(): array {
        $user_ids = $this->get_users_with_data();
        $report = [
            'total_users' => count($user_ids),
            'users'       => [],
            'unmapped'    => [],
        ];

        // Show first 20 users as preview
        $preview_ids = array_slice($user_ids, 0, 20);

        foreach ($preview_ids as $user_id) {
            $user = get_userdata($user_id);
            $old_values = $this->get_old_values($user_id);
            $new_values = $this->transform_values($old_values);
            $existing_fc = $this->fc_available() ? $this->get_existing_fc_fields($user_id) : [];

            $report['users'][] = [
                'id'          => $user_id,
                'username'    => $user ? $user->user_login : '(deleted)',
                'old_values'  => $old_values,
                'new_values'  => $new_values,
                'existing_fc' => $existing_fc,
            ];

            // Track unmapped fields
            foreach ($old_values as $key => $val) {
                if (!isset(self::FIELD_MAP[$key]) && !in_array($key, $report['unmapped'])) {
                    $report['unmapped'][] = $key;
                }
            }
        }

        return $report;
    }

    // ─── Render ───

    public function render_page(): void {
        $result = $_GET['result'] ?? '';
        $fc_ok = $this->fc_available();
        $fields_ok = $this->fields_exist();
        $feature_ok = $this->feature_enabled();

        echo '<div class="wrap">';
        echo '<h1>TBC Profile Migration</h1>';
        echo '<p>One-time tool to migrate custom profile data from <code>tbc-registration</code> (wp_usermeta) to FluentCommunity 2.3.0 native custom fields (fcom_xprofile.custom_fields JSON).</p>';

        // Status checks
        echo '<h2>Status</h2>';
        echo '<table class="widefat" style="max-width:600px">';
        echo '<tr><td>FluentCommunity 2.3.0+</td><td>' . ($fc_ok ? '&#9989; Available' : '&#10060; Not found — install FC 2.3.0 first') . '</td></tr>';
        echo '<tr><td>Native custom fields configured</td><td>' . ($fields_ok ? '&#9989; Yes' : '&#9898; Not yet') . '</td></tr>';
        echo '<tr><td>Feature flag enabled</td><td>' . ($feature_ok ? '&#9989; Yes' : '&#9898; Not yet') . '</td></tr>';
        echo '</table>';

        // Step 1: Create fields
        echo '<h2>Step 1: Create Native Field Definitions</h2>';
        if ($fields_ok && $feature_ok) {
            echo '<p style="color:green">Fields already configured and enabled. You can skip this step or re-run to reset.</p>';
        } else {
            echo '<p>This will create the 7 custom profile fields in FC native format and enable the feature flag.</p>';
        }

        echo '<form method="post" action="' . admin_url('admin-post.php') . '">';
        wp_nonce_field('tbc_migration_create_fields');
        echo '<input type="hidden" name="action" value="tbc_migration_create_fields">';
        echo '<button type="submit" class="button button-secondary">' . ($fields_ok ? 'Re-create Fields' : 'Create Fields & Enable') . '</button>';
        echo '</form>';

        if ($result === 'fields_created') {
            echo '<div class="notice notice-success"><p>Fields created and feature enabled successfully!</p></div>';
        }

        // Step 2: Dry run
        echo '<h2>Step 2: Dry Run (Preview)</h2>';
        echo '<p>Preview what will be migrated without making changes.</p>';
        echo '<form method="post" action="' . admin_url('admin-post.php') . '">';
        wp_nonce_field('tbc_migration_dry_run');
        echo '<input type="hidden" name="action" value="tbc_migration_dry_run">';
        echo '<button type="submit" class="button button-secondary">Run Dry Run</button>';
        echo '</form>';

        if ($result === 'dry_run') {
            $report = get_transient('tbc_migration_report');
            if ($report) {
                echo '<div class="notice notice-info">';
                echo '<p><strong>Found ' . $report['total_users'] . ' users with tbc-registration data.</strong></p>';

                if (!empty($report['unmapped'])) {
                    echo '<p style="color:orange">&#9888; Unmapped field keys (will be skipped): <code>' . implode('</code>, <code>', $report['unmapped']) . '</code></p>';
                }

                echo '<h3>Preview (first 20 users)</h3>';
                echo '<table class="widefat striped"><thead><tr><th>ID</th><th>Username</th><th>Old Values (usermeta)</th><th>New Values (FC native)</th><th>Existing FC</th></tr></thead><tbody>';

                foreach ($report['users'] as $u) {
                    echo '<tr>';
                    echo '<td>' . esc_html($u['id']) . '</td>';
                    echo '<td>' . esc_html($u['username']) . '</td>';
                    echo '<td><pre style="font-size:11px;margin:0">' . esc_html(json_encode($u['old_values'], JSON_PRETTY_PRINT)) . '</pre></td>';
                    echo '<td><pre style="font-size:11px;margin:0">' . esc_html(json_encode($u['new_values'], JSON_PRETTY_PRINT)) . '</pre></td>';
                    echo '<td><pre style="font-size:11px;margin:0">' . esc_html(json_encode($u['existing_fc'], JSON_PRETTY_PRINT)) . '</pre></td>';
                    echo '</tr>';
                }

                echo '</tbody></table>';
                echo '</div>';
            }
        }

        // Step 3: Execute
        echo '<h2>Step 3: Execute Migration</h2>';
        if (!$fc_ok || !$fields_ok) {
            echo '<p style="color:red">Complete Steps 1 first.</p>';
        } else {
            echo '<p><strong>This will copy data from wp_usermeta into fcom_xprofile.custom_fields for all users.</strong> Original usermeta is NOT deleted (safe to re-run).</p>';
            echo '<form method="post" action="' . admin_url('admin-post.php') . '" onsubmit="return confirm(\'Migrate all user profile data to FC native custom fields?\');">';
            wp_nonce_field('tbc_migration_execute');
            echo '<input type="hidden" name="action" value="tbc_migration_execute">';
            echo '<button type="submit" class="button button-primary">Execute Migration</button>';
            echo '</form>';
        }

        if ($result === 'executed') {
            $res = get_transient('tbc_migration_result');
            if ($res) {
                echo '<div class="notice notice-success">';
                echo '<p><strong>Migration complete!</strong></p>';
                echo '<ul>';
                echo '<li>Migrated: ' . $res['migrated'] . ' users</li>';
                echo '<li>Skipped (no data): ' . $res['skipped'] . ' users</li>';
                echo '<li>Errors: ' . $res['errors'] . ' users</li>';
                echo '</ul>';

                if (!empty($res['details'])) {
                    echo '<details><summary>Show details</summary><pre style="font-size:11px">';
                    echo esc_html(implode("\n", $res['details']));
                    echo '</pre></details>';
                }

                echo '</div>';
            }
        }

        // Step 4: Cleanup
        echo '<h2>Step 4: Cleanup Old Data</h2>';
        echo '<p>After verifying the migration was successful, clean up the old data. Each button is independent — run them in any order.</p>';

        if ($result === 'cleanup') {
            $cleanup = get_transient('tbc_migration_cleanup');
            if ($cleanup) {
                $type_labels = [
                    'usermeta' => 'usermeta rows',
                    'fields'   => 'field definition option(s)',
                    'settings' => 'deprecated setting(s)',
                ];
                $label = $type_labels[$cleanup['type']] ?? 'items';
                echo '<div class="notice notice-success"><p>Cleaned up <strong>' . intval($cleanup['count']) . '</strong> ' . esc_html($label) . '.</p></div>';
            }
        }

        // Count old data for display
        global $wpdb;
        $usermeta_count = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->usermeta} WHERE meta_key LIKE '_tbc_fp_%'");
        $fields_exist = get_option('tbc_fp_fields', null) !== null;
        $old_phone_meta = get_option('tbc_fp_phone_meta_key', null) !== null;
        $old_phone_custom = get_option('tbc_fp_phone_meta_key_custom', null) !== null;
        $deprecated_count = (int) $old_phone_meta + (int) $old_phone_custom;

        echo '<table class="widefat" style="max-width:800px"><tbody>';

        // 4a: Usermeta
        echo '<tr><td style="width:50%">';
        echo '<strong>Old Profile Values</strong> (wp_usermeta <code>_tbc_fp_*</code>)<br>';
        echo '<span class="description">' . $usermeta_count . ' rows found</span>';
        echo '</td><td>';
        if ($usermeta_count > 0) {
            echo '<form method="post" action="' . admin_url('admin-post.php') . '" style="display:inline" onsubmit="return confirm(\'Delete ALL ' . $usermeta_count . ' _tbc_fp_* usermeta rows? This cannot be undone.\');">';
            wp_nonce_field('tbc_migration_cleanup_usermeta');
            echo '<input type="hidden" name="action" value="tbc_migration_cleanup_usermeta">';
            echo '<button type="submit" class="button" style="color:#d63638">Delete Old Usermeta</button>';
            echo '</form>';
        } else {
            echo '<span style="color:green">&#9989; Clean</span>';
        }
        echo '</td></tr>';

        // 4b: Field definitions
        echo '<tr><td>';
        echo '<strong>Old Field Definitions</strong> (wp_options <code>tbc_fp_fields</code>)<br>';
        echo '<span class="description">' . ($fields_exist ? 'Found' : 'Not found') . '</span>';
        echo '</td><td>';
        if ($fields_exist) {
            echo '<form method="post" action="' . admin_url('admin-post.php') . '" style="display:inline" onsubmit="return confirm(\'Delete the old tbc_fp_fields option?\');">';
            wp_nonce_field('tbc_migration_cleanup_fields');
            echo '<input type="hidden" name="action" value="tbc_migration_cleanup_fields">';
            echo '<button type="submit" class="button" style="color:#d63638">Delete Old Field Definitions</button>';
            echo '</form>';
        } else {
            echo '<span style="color:green">&#9989; Clean</span>';
        }
        echo '</td></tr>';

        // 4c: Deprecated settings
        echo '<tr><td>';
        echo '<strong>Deprecated Settings</strong> (old phone_meta_key options)<br>';
        echo '<span class="description">' . $deprecated_count . ' deprecated option(s) found</span>';
        echo '</td><td>';
        if ($deprecated_count > 0) {
            echo '<form method="post" action="' . admin_url('admin-post.php') . '" style="display:inline" onsubmit="return confirm(\'Delete deprecated settings?\');">';
            wp_nonce_field('tbc_migration_cleanup_settings');
            echo '<input type="hidden" name="action" value="tbc_migration_cleanup_settings">';
            echo '<button type="submit" class="button" style="color:#d63638">Delete Deprecated Settings</button>';
            echo '</form>';
        } else {
            echo '<span style="color:green">&#9989; Clean</span>';
        }
        echo '</td></tr>';

        echo '</tbody></table>';

        // Field mapping reference
        echo '<h2>Field Mapping Reference</h2>';
        echo '<table class="widefat" style="max-width:700px"><thead><tr><th>Old Key (usermeta)</th><th>FC Slug</th><th>FC Type</th></tr></thead><tbody>';
        $config = self::get_field_config();
        foreach (self::FIELD_MAP as $old_key => $fc_slug) {
            $fc_field = null;
            foreach ($config['fields'] as $f) {
                if ($f['slug'] === $fc_slug) { $fc_field = $f; break; }
            }
            echo '<tr>';
            echo '<td><code>_tbc_fp_' . esc_html($old_key) . '</code></td>';
            echo '<td><code>' . esc_html($fc_slug) . '</code></td>';
            echo '<td>' . esc_html($fc_field['type'] ?? '?') . '</td>';
            echo '</tr>';
        }
        echo '</tbody></table>';

        if ($result === 'fc_missing') {
            echo '<div class="notice notice-error"><p>FluentCommunity 2.3.0+ is not active. Install and activate it first.</p></div>';
        }

        echo '<hr><p><em>This plugin is a one-time tool. Deactivate and delete it when migration is complete.</em></p>';
        echo '</div>';
    }
}

new TBC_Profile_Migration();
