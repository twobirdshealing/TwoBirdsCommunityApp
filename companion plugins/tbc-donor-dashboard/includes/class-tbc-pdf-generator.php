<?php
/**
 * PDF Generator Class
 *
 * @package TwoBirdsChurch
 */

require_once TBC_DD_PLUGIN_DIR . 'lib/tcpdf/tcpdf.php';

class TBC_PDF_Generator extends TCPDF {

    /**
     * Header for PDF
     */
    public function Header() {
        $page_width = $this->getPageWidth();
        $logo_path = TBC_DD_PLUGIN_DIR . 'assets/images/church-logo.png';
        
        // Logo centered at top
        if (file_exists($logo_path)) {
            $logo_width = 30;
            $logo_x = ($page_width - $logo_width) / 2;
            $this->Image($logo_path, $logo_x, 8, $logo_width);
        }

        // Full header info on first page only
        if ($this->getPage() == 1) {
            $this->SetY(25);
            $this->add_church_and_donor_info();
        } else {
            $this->SetY(20);
            $this->SetFont('helvetica', 'B', 10);
            $this->Cell(0, 5, 'Two Birds Church - Donation Report', 0, 1, 'C');
            $this->SetY(30);
        }
    }

    /**
     * Footer for PDF
     */
    public function Footer() {
        $this->SetY(-15);
        $this->SetFont('helvetica', 'I', 8);
        $this->Cell(0, 10, 'Page ' . $this->getAliasNumPage() . '/' . $this->getAliasNbPages(), 0, false, 'C');
    }

    /**
     * Generate yearly donation report
     */
    public function generate_yearly_report($donation_data, $year) {
        $pdf = new self(PDF_PAGE_ORIENTATION, PDF_UNIT, PDF_PAGE_FORMAT, true, 'UTF-8', false);

        $pdf->SetCreator(PDF_CREATOR);
        $pdf->SetAuthor('Two Birds Church');
        $pdf->SetTitle("Donation Report {$year}");
        $pdf->SetDefaultMonospacedFont(PDF_FONT_MONOSPACED);
        $pdf->SetMargins(PDF_MARGIN_LEFT, 45, PDF_MARGIN_RIGHT);
        $pdf->SetHeaderMargin(5);
        $pdf->SetFooterMargin(PDF_MARGIN_FOOTER);
        $pdf->SetAutoPageBreak(true, PDF_MARGIN_BOTTOM);
        $pdf->AddPage();

        $pdf->SetY(45);
        
        // Year heading
        $pdf->SetFont('helvetica', 'B', 12);
        $pdf->Write(0, "Donation Year: {$year}", '', 0, 'L', true, 0, false, false, 0);
        $pdf->Ln(5);
        
        // Add sections
        $deductible_data = isset($donation_data['deductible']) ? $donation_data['deductible'] : array();
        $this->add_deductible_section($pdf, $deductible_data);
        
        $non_deductible_data = isset($donation_data['non_deductible']) ? $donation_data['non_deductible'] : array();
        if (!empty($non_deductible_data['donations'])) {
            $this->add_non_deductible_section($pdf, $non_deductible_data);
        }
        
        $this->add_tax_statement($pdf);
        $this->add_total_line($pdf, $deductible_data, $year);

        return $this->save_pdf_file($pdf, $year);
    }

    /**
     * Add church and donor info (first page only)
     */
    private function add_church_and_donor_info() {
        $page_width = $this->getPageWidth();
        $usable_width = $page_width - PDF_MARGIN_LEFT - PDF_MARGIN_RIGHT;
        $col_width = $usable_width * 0.3;
        $start_y = $this->GetY();

        $this->SetFont('helvetica', 'B', 10);
        
        // Church info (left)
        $this->MultiCell(
            $col_width, 4,
            "Two Birds Church\nEIN: 83-3097936\n2493 CR 427\nAnna, TX 75409",
            0, 'L', false, 0, PDF_MARGIN_LEFT, $start_y
        );

        // Donor info (right)
        $donor_info = $this->get_donor_info();
        $right_col_x = $page_width - PDF_MARGIN_RIGHT - $col_width + 15;
        $this->MultiCell($col_width, 4, $donor_info, 0, 'L', false, 1, $right_col_x, $start_y);
        $this->Ln(8);
    }

    /**
     * Add tax-deductible donations section
     */
    private function add_deductible_section($pdf, $deductible_data) {
        $pdf->SetFont('helvetica', 'B', 12);
        $pdf->Write(0, 'Tax-Deductible Donations', '', 0, 'L', true, 0, false, false, 0);
        $pdf->Ln(3);

        $this->add_deductible_table($pdf, $deductible_data);
        
        // Subtotal
        if (!empty($deductible_data['summary']['raw_total_amount'])) {
            $total_formatted = '$' . number_format($deductible_data['summary']['raw_total_amount'], 2);
            $pdf->SetFont('helvetica', 'B', 12);
            $pdf->Write(0, "Subtotal (Tax-Deductible): {$total_formatted}", '', 0, 'L', true, 0, false, false, 0);
            $pdf->Ln(8);
        }
    }

    /**
     * Add non-deductible donations section
     */
    private function add_non_deductible_section($pdf, $non_deductible_data) {
        $pdf->SetFont('helvetica', 'B', 12);
        $pdf->Write(0, 'Non-Deductible Contributions (For Reference Only)', '', 0, 'L', true, 0, false, false, 0);
        $pdf->Ln(3);

        $this->add_non_deductible_table($pdf, $non_deductible_data);
        
        $pdf->SetFont('helvetica', 'I', 10);
        $pdf->Write(0, 'These contributions are not tax-deductible, as they were payments for church events, ceremonies, or services. Any "Extra Donation" fees from these orders are listed separately in the tax-deductible section above.', '', 0, 'L', true, 0, false, false, 0);
        $pdf->Ln(8);
    }

    /**
     * Add deductible donations table (4 columns with description)
     */
    private function add_deductible_table($pdf, $donations) {
        $donation_items = isset($donations['donations']) ? $donations['donations'] : array();
        
        if (empty($donation_items)) {
            $pdf->SetFont('helvetica', 'I', 10);
            $pdf->Write(0, 'No items in this category for the selected year.', '', 0, 'L', true, 0, false, false, 0);
            $pdf->Ln(5);
            return;
        }

        $page_width = $pdf->getPageWidth();
        $usable_width = $page_width - PDF_MARGIN_LEFT - PDF_MARGIN_RIGHT;
        
        $date_width = $usable_width * 0.2;
        $order_width = $usable_width * 0.25;
        $desc_width = $usable_width * 0.3;
        $amount_width = $usable_width * 0.25;

        // Headers
        $pdf->SetFont('helvetica', 'B', 10);
        $pdf->Cell($date_width, 7, 'Date', 1, 0, 'C');
        $pdf->Cell($order_width, 7, 'Order ID', 1, 0, 'C');
        $pdf->Cell($desc_width, 7, 'Description', 1, 0, 'C');
        $pdf->Cell($amount_width, 7, 'Amount', 1, 1, 'C');

        // Data
        $pdf->SetFont('helvetica', '', 10);
        foreach ($donation_items as $donation) {
            $date = $donation['date'] ?? '';
            $order_id = $donation['order_id'] ?? '';
            $description = $donation['description'] ?? '';
            $raw_amount = floatval($donation['raw_amount'] ?? 0);

            $truncated_desc = strlen($description) > 25 ? substr($description, 0, 22) . '...' : $description;
            
            $pdf->Cell($date_width, 7, $date, 1, 0, 'C');
            $pdf->Cell($order_width, 7, (string)$order_id, 1, 0, 'C');
            $pdf->Cell($desc_width, 7, $truncated_desc, 1, 0, 'L');
            $pdf->Cell($amount_width, 7, '$' . number_format($raw_amount, 2), 1, 1, 'C');
        }
        $pdf->Ln(5);
    }

    /**
     * Add non-deductible donations table (3 columns, no description)
     */
    private function add_non_deductible_table($pdf, $donations) {
        $donation_items = isset($donations['donations']) ? $donations['donations'] : array();
        
        if (empty($donation_items)) {
            $pdf->SetFont('helvetica', 'I', 10);
            $pdf->Write(0, 'No items in this category for the selected year.', '', 0, 'L', true, 0, false, false, 0);
            $pdf->Ln(5);
            return;
        }

        $page_width = $pdf->getPageWidth();
        $usable_width = $page_width - PDF_MARGIN_LEFT - PDF_MARGIN_RIGHT;
        
        $date_width = $usable_width * 0.25;
        $order_width = $usable_width * 0.375;
        $amount_width = $usable_width * 0.375;

        // Headers
        $pdf->SetFont('helvetica', 'B', 10);
        $pdf->Cell($date_width, 7, 'Date', 1, 0, 'C');
        $pdf->Cell($order_width, 7, 'Order ID', 1, 0, 'C');
        $pdf->Cell($amount_width, 7, 'Amount', 1, 1, 'C');

        // Data
        $pdf->SetFont('helvetica', '', 10);
        foreach ($donation_items as $donation) {
            $date = $donation['date'] ?? '';
            $order_id = $donation['order_id'] ?? '';
            $raw_amount = floatval($donation['raw_amount'] ?? 0);
            
            $pdf->Cell($date_width, 7, $date, 1, 0, 'C');
            $pdf->Cell($order_width, 7, (string)$order_id, 1, 0, 'C');
            $pdf->Cell($amount_width, 7, '$' . number_format($raw_amount, 2), 1, 1, 'C');
        }
        $pdf->Ln(5);
    }

    /**
     * Add tax statement section
     */
    private function add_tax_statement($pdf) {
        $pdf->SetFont('helvetica', 'B', 12);
        $pdf->Write(0, 'Tax Statement:', '', 0, 'L', true, 0, false, false, 0);

        $pdf->SetFont('helvetica', '', 11);
        $pdf->Write(0, "No goods or services were provided in exchange for the tax-deductible donations, other than intangible religious benefits.\n\n", '', 0, 'L', true, 0, false, false, 0);

        $pdf->Write(0, "Two Birds Church is a registered 501(c)(3) nonprofit organization ", '', 0, 'L', false, 0, false, false, 0);
        $pdf->SetFont('helvetica', 'B', 11);
        $pdf->Write(0, "(EIN 83-3097936)", '', 0, 'L', true, 0, false, false, 0);

        $pdf->SetFont('helvetica', '', 11);
        $pdf->Ln(5);
        $pdf->Write(0, 'Thank you for your generous support of Two Birds Church. Your contributions help us create spaces for authentic connection, reflection, and community growth.', '', 0, 'L', true, 0, false, false, 0);
    }

    /**
     * Add total line
     */
    private function add_total_line($pdf, $deductible_data, $year) {
        $total = isset($deductible_data['summary']['raw_total_amount']) ? $deductible_data['summary']['raw_total_amount'] : 0;

        $pdf->Ln(10);
        $pdf->SetFont('helvetica', 'B', 14);
        $pdf->Write(0, "Total tax-deductible contributions for {$year}: $" . number_format($total, 2), '', 0, 'L', true, 0, false, false, 0);
    }

    /**
     * Get donor information
     */
    private function get_donor_info() {
        $current_user = wp_get_current_user();
        $billing_first_name = get_user_meta($current_user->ID, 'billing_first_name', true);
        $billing_last_name = get_user_meta($current_user->ID, 'billing_last_name', true);
        $line1 = get_user_meta($current_user->ID, 'billing_address_1', true);
        $line2 = get_user_meta($current_user->ID, 'billing_address_2', true);
        $city = get_user_meta($current_user->ID, 'billing_city', true);
        $state = get_user_meta($current_user->ID, 'billing_state', true);
        $postcode = get_user_meta($current_user->ID, 'billing_postcode', true);

        $donor_name = trim("{$billing_first_name} {$billing_last_name}");
        if (!$donor_name) {
            $donor_name = $current_user->display_name;
        }

        $addr_parts = array();
        if ($line1) $addr_parts[] = $line1;
        if ($line2) $addr_parts[] = $line2;
        
        $city_line = '';
        if ($city) $city_line .= $city;
        if ($state) $city_line .= ($city_line ? ', ' : '') . $state;
        if ($postcode) $city_line .= ' ' . $postcode;
        if ($city_line) $addr_parts[] = $city_line;

        return "Donor Information:\n" . $donor_name . "\n" . implode("\n", $addr_parts);
    }

    /**
     * Save PDF file
     */
    private function save_pdf_file($pdf, $year) {
        $filename = 'Donation_Report_' . $year . '_' . uniqid() . '.pdf';
        $upload_dir = wp_upload_dir();
        $pdf_dir = $upload_dir['basedir'] . '/donation-reports';

        if (!file_exists($pdf_dir)) {
            wp_mkdir_p($pdf_dir);
        }

        $pdf_path = $pdf_dir . '/' . $filename;
        $pdf->Output($pdf_path, 'F');

        return array(
            'url' => $upload_dir['baseurl'] . '/donation-reports/' . $filename,
            'filename' => $filename
        );
    }
}