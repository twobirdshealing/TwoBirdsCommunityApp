<?php
/**
 * Main Donor Dashboard Class
 *
 * @package TwoBirdsChurch
 */

class TBC_Donor_Dashboard {
    /**
     * Instance of the PDF generator
     */
    private $pdf_generator;

    /**
     * Instance of the donation data handler
     */
    private $donation_data;

    /**
     * Initialize the class
     */
    public function init() {
        $this->pdf_generator = new TBC_PDF_Generator();
        $this->donation_data = new TBC_Donation_Data();

        add_shortcode('donor_dashboard', array($this, 'render_donor_dashboard'));
        add_action('wp_ajax_generate_yearly_report', array($this, 'generate_yearly_report'));
    }

    /**
     * Render the donor dashboard
     */
    public function render_donor_dashboard($atts) {
        if (!is_user_logged_in()) {
            return '<p class="donor-dashboard-error">' . 
                   esc_html__('Please log in to view your Donor Dashboard.', 'tbc-donor-dashboard') . 
                   '</p>';
        }

        $current_user = wp_get_current_user();
        $available_years = $this->donation_data->get_donor_years($current_user->ID);
        $current_year = date('Y');

        $lifetime_donations = wc_price(wc_get_customer_total_spent($current_user->ID));
        $order_count = wc_get_customer_order_count($current_user->ID);
        $average_donation = $order_count > 0 ? 
            wc_price(wc_get_customer_total_spent($current_user->ID) / $order_count) : 
            null;
        $last_order = wc_get_customer_last_order($current_user->ID);
        $last_donation = $last_order ? 
            esc_html(wc_format_datetime($last_order->get_date_created())) : 
            null;

        ob_start();
        ?>
        <div class="donor-dashboard-container">
            <h2 class="welcome-message">
                <?php echo esc_html(sprintf(
                    __('Welcome to your Donor Dashboard, %s!', 'tbc-donor-dashboard'),
                    $current_user->display_name
                )); ?>
            </h2>

            <div class="donation-summary">
                <ul>
                    <li>
                        <strong><?php esc_html_e('Lifetime donations:', 'tbc-donor-dashboard'); ?></strong>
                        <span><?php echo $lifetime_donations; ?></span>
                    </li>
                    <?php if ($average_donation): ?>
                        <li>
                            <strong><?php esc_html_e('Average donation:', 'tbc-donor-dashboard'); ?></strong>
                            <span><?php echo $average_donation; ?></span>
                        </li>
                    <?php endif; ?>
                    <?php if ($last_donation): ?>
                        <li>
                            <strong><?php esc_html_e('Last donation:', 'tbc-donor-dashboard'); ?></strong>
                            <span><?php echo $last_donation; ?></span>
                        </li>
                    <?php endif; ?>
                    <li class="yearly-report-item">
                        <strong><?php esc_html_e('Yearly Report:', 'tbc-donor-dashboard'); ?></strong>
                        <span class="report-controls">
                            <select id="donation-year" class="donation-year-select">
                                <?php foreach ($available_years as $year): ?>
                                    <option value="<?php echo esc_attr($year); ?>"
                                            <?php selected($year, $current_year); ?>>
                                        <?php echo esc_html($year); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                            <button id="generate-report" class="button button-primary">
                                <?php esc_html_e('Download', 'tbc-donor-dashboard'); ?>
                            </button>
                        </span>
                    </li>
                </ul>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * AJAX handler for generating yearly report
     */
    public function generate_yearly_report() {
        if (!check_ajax_referer('tbc-donor-dashboard-nonce', 'nonce', false)) {
            wp_send_json_error('Invalid nonce');
            return;
        }

        if (!is_user_logged_in()) {
            wp_send_json_error('User not logged in');
            return;
        }

        $year = isset($_POST['year']) ? intval($_POST['year']) : date('Y');
        $user_id = get_current_user_id();

        try {
            $donation_data = $this->donation_data->get_yearly_donations($user_id, $year);
            
            // Check if there are any donations (deductible or non-deductible)
            $has_deductible = !empty($donation_data['deductible']['donations']);
            $has_non_deductible = !empty($donation_data['non_deductible']['donations']);
            
            if (!$has_deductible && !$has_non_deductible) {
                wp_send_json_error('No donations found for the selected year');
                return;
            }

            $pdf_file = $this->pdf_generator->generate_yearly_report($donation_data, $year);
            
            wp_send_json_success(array(
                'pdf_url' => $pdf_file['url'],
                'filename' => $pdf_file['filename']
            ));

        } catch (Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }
}