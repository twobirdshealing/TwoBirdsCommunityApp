(function($) {
    'use strict';

    // DOM element selectors
    const selectors = {
        yearSelect: '#donation-year',
        generateButton: '#generate-report'
    };

    let isGenerating = false;
    let originalButtonText = '';

    /**
     * Initialize the donor dashboard functionality
     */
    function initDonorDashboard() {
        originalButtonText = $(selectors.generateButton).text();
        bindEvents();
        checkYearSelection();
    }

    /**
     * Bind event handlers
     */
    function bindEvents() {
        $(selectors.generateButton).on('click', handleGenerateReport);
        $(selectors.yearSelect).on('change', handleYearChange);
    }

    /**
     * Handle year selection change
     */
    function handleYearChange() {
        checkYearSelection();
    }

    /**
     * Check if a year is selected and enable/disable the generate button
     */
    function checkYearSelection() {
        const selectedYear = $(selectors.yearSelect).val();
        $(selectors.generateButton).prop('disabled', !selectedYear || isGenerating);
    }

    /**
     * Handle generate report button click
     */
    function handleGenerateReport(e) {
        e.preventDefault();

        if (isGenerating) {
            return;
        }

        const selectedYear = $(selectors.yearSelect).val();
        if (!selectedYear) {
            alert('Please select a year.');
            return;
        }

        generateReport(selectedYear);
    }

    /**
     * Generate the yearly report
     */
    function generateReport(year) {
        setGeneratingState(true);

        $.ajax({
            url: tbcDonorDashboard.ajaxurl,
            type: 'POST',
            data: {
                action: 'generate_yearly_report',
                year: year,
                nonce: tbcDonorDashboard.nonce
            },
            success: function(response) {
                if (response.success && response.data) {
                    downloadReport(response.data.pdf_url, response.data.filename);
                } else {
                    alert(response.data || tbcDonorDashboard.error_text);
                }
            },
            error: function(xhr, status, error) {
                alert(tbcDonorDashboard.error_text);
                console.error('Error generating report:', error);
            },
            complete: function() {
                setGeneratingState(false);
            }
        });
    }

    /**
     * Download the generated report
     */
    function downloadReport(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Set generating state and update UI
     */
    function setGeneratingState(generating) {
        isGenerating = generating;
        const $button = $(selectors.generateButton);
        
        if (generating) {
            $button.prop('disabled', true)
                   .html('<span class="button-spinner"></span> Generating');
        } else {
            $button.prop('disabled', false)
                   .text(originalButtonText);
        }
        
        $(selectors.yearSelect).prop('disabled', generating);
    }



    // Initialize on document ready
    $(document).ready(initDonorDashboard);

})(jQuery);