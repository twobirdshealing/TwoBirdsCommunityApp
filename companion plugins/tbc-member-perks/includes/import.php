<?php
if (!defined('ABSPATH')) {
    exit;
}

class WMP_ImportSubscribers {
    private $table_name;

    public function __construct() {
        global $wpdb;
        $this->table_name = $wpdb->prefix . 'imported_subscribers';
        add_action('admin_menu', array($this, 'add_import_menu'));
    }

    public function add_import_menu() {
        add_submenu_page(
            'member-perks-dashboard',
            'Import Subscribers',
            'Import',
            'manage_options',
            'import-subscribers',
            array($this, 'display_import_page')
        );
    }

    public function display_import_page() {
        if (!current_user_can('manage_options')) {
            wp_die(__('You do not have sufficient permissions to access this page.'));
        }

        if (isset($_POST['submit']) && check_admin_referer('wmp_add_subscriber')) {
            $this->handle_form_submission();
        }

        $subscribers = $this->get_subscribers();
        ?>
        <div class="wrap">
            <h1>Import External Subscriptions</h1>
            <form method="post" action="">
                <?php wp_nonce_field('wmp_add_subscriber'); ?>
                <table class="form-table" id="subscribers_table">
                    <thead>
                        <tr>
                            <th>User ID</th>
                            <th>First Name</th>
                            <th>Last Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Start Date</th>
                            <th>Subscription Amount</th>
                            <th>Renewal Count</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($subscribers as $index => $subscriber) : ?>
                            <tr>
                                <td><input type="number" name="subscribers[<?php echo $index; ?>][user_id]" value="<?php echo esc_attr($subscriber['user_id']); ?>" class="small-input" /></td>
                                <td><input type="text" name="subscribers[<?php echo $index; ?>][first_name]" value="<?php echo esc_attr($subscriber['first_name']); ?>" class="regular-text" required /></td>
                                <td><input type="text" name="subscribers[<?php echo $index; ?>][last_name]" value="<?php echo esc_attr($subscriber['last_name']); ?>" class="regular-text" required /></td>
                                <td><input type="email" name="subscribers[<?php echo $index; ?>][email]" value="<?php echo esc_attr($subscriber['email']); ?>" class="large-input" required /></td>
                                <td><input type="text" name="subscribers[<?php echo $index; ?>][phone]" value="<?php echo esc_attr($subscriber['phone']); ?>" class="medium-input" /></td>
                                <td><input type="date" name="subscribers[<?php echo $index; ?>][start_date]" value="<?php echo esc_attr($subscriber['start_date']); ?>" class="medium-input" required /></td>
                                <td><input type="text" name="subscribers[<?php echo $index; ?>][subscription_amount]" value="<?php echo esc_attr($subscriber['subscription_amount']); ?>" class="medium-input" required /></td>
                                <td><input type="number" name="subscribers[<?php echo $index; ?>][renewal_count]" value="<?php echo esc_attr($subscriber['renewal_count']); ?>" class="small-input" min="0" required /></td>
                                <td><button type="button" class="button subscriber_remove">Remove</button></td>
                            </tr>
                        <?php endforeach; ?>
                        <tr>
                            <td colspan="8">
                                <button type="button" id="add_subscriber" class="button" onclick="addSubscriberRow();">Add Subscriber</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <p class="submit">
                    <input type="submit" name="submit" class="button button-primary" value="Save Changes">
                </p>
            </form>
        </div>
        <?php
    }

    private function get_subscribers() {
        global $wpdb;
        return $wpdb->get_results(
            "SELECT * FROM {$this->table_name} ORDER BY ID DESC",
            ARRAY_A
        );
    }

    private function handle_form_submission() {
        global $wpdb;
        
        // Clear existing data
        $wpdb->query("TRUNCATE TABLE {$this->table_name}");

        if (!isset($_POST['subscribers']) || !is_array($_POST['subscribers'])) {
            return;
        }

        foreach ($_POST['subscribers'] as $subscriber) {
            if (empty($subscriber['first_name']) || empty($subscriber['last_name']) || empty($subscriber['email'])) {
                continue;
            }

            $wpdb->insert(
                $this->table_name,
                array(
                    'user_id' => intval($subscriber['user_id']) ?: null,
                    'first_name' => sanitize_text_field($subscriber['first_name']),
                    'last_name' => sanitize_text_field($subscriber['last_name']),
                    'email' => sanitize_email($subscriber['email']),
                    'phone' => sanitize_text_field($subscriber['phone']),
                    'start_date' => sanitize_text_field($subscriber['start_date']),
                    'subscription_amount' => floatval($subscriber['subscription_amount']),
                    'renewal_count' => intval($subscriber['renewal_count'])
                ),
                array('%d', '%s', '%s', '%s', '%s', '%s', '%f', '%d')
            );
        }
        
        wp_safe_redirect(admin_url('admin.php?page=import-subscribers&updated=1'));
        exit;
    }
}

new WMP_ImportSubscribers();