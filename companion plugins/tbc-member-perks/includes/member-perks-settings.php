<?php
if (!defined('ABSPATH')) {
    exit;
}

class WMP_Settings {
    private $table_name;

    public function __construct() {
        global $wpdb;
        $this->table_name = $wpdb->prefix . 'perk_levels';
        add_action('admin_init', array($this, 'handle_form_submission'));
    }

    private function get_perk_levels() {
        global $wpdb;
        return $wpdb->get_results(
            "SELECT * FROM {$this->table_name} ORDER BY min_amount ASC",
            ARRAY_A
        );
    }

    public function display_settings_page() {
        if (!current_user_can('manage_options')) {
            wp_die(__('You do not have sufficient permissions to access this page.'));
        }

        $levels = $this->get_perk_levels();
        $available_roles = get_editable_roles();

        if (empty($levels)) {
            $levels = array(
                array('name' => '', 'min_amount' => '', 'max_amount' => '', 'discount' => '', 'role' => '')
            );
        }

        ?>
        <div class="wrap">
            <h1>Member Perks Settings</h1>
            <?php if (isset($_GET['updated'])) : ?>
                <div class="notice notice-success is-dismissible">
                    <p>Settings saved successfully!</p>
                </div>
            <?php endif; ?>
            
            <form method="post" action="">
                <?php wp_nonce_field('wmp_levels_save', 'wmp_levels_nonce'); ?>
                <table class="form-table" id="wmp_levels_table">
                    <thead>
                        <tr>
                            <th>Level Name</th>
                            <th>Start Range (Renewals)</th>
                            <th>End Range (Renewals)</th>
                            <th>Discount %</th>
                            <th>Role</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($levels as $index => $level) : ?>
                            <tr>
                                <td>
                                    <input type="text" 
                                           name="levels[<?php echo $index; ?>][name]" 
                                           value="<?php echo esc_attr($level['name']); ?>" 
                                           class="regular-text" 
                                           placeholder="Level Name">
                                </td>
                                <td>
                                    <input type="number" 
                                           name="levels[<?php echo $index; ?>][min_amount]" 
                                           value="<?php echo intval($level['min_amount']); ?>" 
                                           min="0" 
                                           step="1" 
                                           class="small-text">
                                </td>
                                <td>
                                    <input type="number" 
                                           name="levels[<?php echo $index; ?>][max_amount]" 
                                           value="<?php echo intval($level['max_amount']); ?>" 
                                           min="0" 
                                           step="1" 
                                           class="small-text"
                                           placeholder="0 = unlimited">
                                </td>
                                <td>
                                    <input type="number" 
                                           name="levels[<?php echo $index; ?>][discount]" 
                                           value="<?php echo intval($level['discount']); ?>" 
                                           min="0" 
                                           max="100"
                                           step="1" 
                                           class="small-text">
                                </td>
                                <td>
                                    <select name="levels[<?php echo $index; ?>][role]" class="regular-text">
                                        <option value="">Select Role</option>
                                        <?php foreach ($available_roles as $role_id => $role_details) : ?>
                                            <option value="<?php echo esc_attr($role_id); ?>" 
                                                    <?php selected($level['role'], $role_id); ?>>
                                                <?php echo esc_html($role_details['name']); ?>
                                            </option>
                                        <?php endforeach; ?>
                                    </select>
                                </td>
                                <td>
                                    <?php if ($index > 0) : ?>
                                        <button type="button" class="button wmp_remove_level">Remove</button>
                                    <?php endif; ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
                
                <p>
                    <button type="button" id="wmp_add_level" class="button">Add Perk Level</button>
                </p>
                
                <p class="submit">
                    <input type="submit" name="wmp_save_levels" class="button button-primary" value="Save Changes">
                </p>
            </form>
            
            <div class="card" style="margin-top: 20px;">
                <h3>Level Configuration Guide</h3>
                <ul>
                    <li><strong>Start Range:</strong> Minimum number of renewals to qualify for this level</li>
                    <li><strong>End Range:</strong> Maximum number of renewals for this level (0 = unlimited)</li>
                    <li><strong>Discount:</strong> Percentage discount for this level (0-100)</li>
                    <li><strong>Role:</strong> WordPress role to assign for manual role management</li>
                </ul>
            </div>
        </div>
        <?php
    }

    public function handle_form_submission() {
        if (!isset($_POST['wmp_save_levels']) || 
            !check_admin_referer('wmp_levels_save', 'wmp_levels_nonce')) {
            return;
        }

        global $wpdb;

        // Clear existing levels
        $wpdb->query("TRUNCATE TABLE {$this->table_name}");

        if (!isset($_POST['levels']) || !is_array($_POST['levels'])) {
            return;
        }

        foreach ($_POST['levels'] as $level) {
            if (empty($level['name']) || !is_numeric($level['min_amount'])) {
                continue;
            }

            $data = array(
                'name' => sanitize_text_field($level['name']),
                'min_amount' => intval($level['min_amount']),
                'max_amount' => intval($level['max_amount']),
                'discount' => max(0, min(100, intval($level['discount']))),
                'role' => sanitize_text_field($level['role'])
            );

            $wpdb->insert(
                $this->table_name,
                $data,
                array('%s', '%d', '%d', '%d', '%s')
            );
        }

        wp_safe_redirect(admin_url('admin.php?page=member-perks-settings&updated=1'));
        exit;
    }
}

new WMP_Settings();