/**
 * TBC WooCommerce Calendar - Main Admin Settings
 * 
 * Combines management for:
 * - Date and time fields
 * - RSVP settings
 * - Progress bar settings
 * 
 * @package TBC_WC_Calendar
 */
jQuery(document).ready(function($) {
    //==========================================================================
    // 1. DATE/TIME FIELD MANAGEMENT
    //==========================================================================
    
    // Initialize datepickers
    $('.tbc-wc-date-picker').datepicker({
        dateFormat: "yy-mm-dd",
        changeMonth: true,
        changeYear: true
    });

    // Time input validation
    function validateTime(input) {
        var timeValue = input.val();
        var timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
        
        if (timeValue !== '' && !timePattern.test(timeValue)) {
            alert('Please enter a valid time in HH:MM format.');
            input.val('');
        }
    }

    // Time input validation handlers
    $('#_tbc_wc_start_time, #_tbc_wc_end_time').on('change', function() {
        validateTime($(this));
    });

    // Single Day Event Handler
    $('#_tbc_wc_single_day_event').on('change', function() {
        if ($(this).is(':checked')) {
            $('#tbc-wc-end-date-time-pair').hide();
            $('.tbc-wc-start-date-time').addClass('tbc-wc-single-day');
            $('#_tbc_wc_end_date').val($('#_tbc_wc_start_date').val());
            // Move end time to start row
            $('#tbc-wc-end-date-time-pair .tbc-wc-time-field').appendTo('.tbc-wc-start-date-time');
        } else {
            $('#tbc-wc-end-date-time-pair').show();
            $('.tbc-wc-start-date-time').removeClass('tbc-wc-single-day');
            // Move end time back
            $('.tbc-wc-start-date-time .tbc-wc-time-field:last-child').appendTo('#tbc-wc-end-date-time-pair');
        }
    }).trigger('change');

    // Update end date when start date changes in single day mode
    $('#_tbc_wc_start_date').on('change', function() {
        if ($('#_tbc_wc_single_day_event').is(':checked')) {
            $('#_tbc_wc_end_date').val($(this).val());
        }
    });

    //==========================================================================
    // 2. RSVP SETTINGS MANAGEMENT
    //==========================================================================
    
    // Toggle RSVP fields visibility based on checkbox
    $('#_tbc_wc_rsvp_enabled').on('change', function(e) {
        if ($(this).is(':checked')) {
            $('p.tbc-wc-rsvp-field-wrap')
                .removeClass('tbc-wc-hide-if-rsvp-disabled')
                .addClass('tbc-wc-rsvp-show');
        } else {
            $('p.tbc-wc-rsvp-field-wrap')
                .removeClass('tbc-wc-rsvp-show')
                .addClass('tbc-wc-hide-if-rsvp-disabled');
        }
        // Also trigger deadline type change to show/hide appropriate fields
        $('#_tbc_wc_rsvp_deadline_type').trigger('change');
    });

    // Toggle deadline date/rule fields based on deadline type
    $('#_tbc_wc_rsvp_deadline_type').on('change', function() {
        var $dateWrap = $('p.tbc-wc-rsvp-field-wrap.tbc-wc-deadline-date-field');
        var $ruleWrap = $('p.tbc-wc-rsvp-field-wrap.tbc-wc-deadline-rule-field');
        
        // First check if RSVP is enabled
        if ($('#_tbc_wc_rsvp_enabled').is(':checked')) {
            // Only toggle visibility if RSVP is enabled
            if ($(this).val() === 'date') {
                $dateWrap.removeClass('tbc-wc-hide-if-rsvp-disabled').addClass('tbc-wc-rsvp-show');
                $ruleWrap.removeClass('tbc-wc-rsvp-show').addClass('tbc-wc-hide-if-rsvp-disabled');
            } else {
                $ruleWrap.removeClass('tbc-wc-hide-if-rsvp-disabled').addClass('tbc-wc-rsvp-show');
                $dateWrap.removeClass('tbc-wc-rsvp-show').addClass('tbc-wc-hide-if-rsvp-disabled');
            }
        } else {
            // If RSVP is disabled, make sure both fields are hidden
            $dateWrap.removeClass('tbc-wc-rsvp-show').addClass('tbc-wc-hide-if-rsvp-disabled');
            $ruleWrap.removeClass('tbc-wc-rsvp-show').addClass('tbc-wc-hide-if-rsvp-disabled');
        }
    });

    // Initialize RSVP settings visibility on page load
    $('#_tbc_wc_rsvp_enabled').trigger('change');
    $('#_tbc_wc_rsvp_deadline_type').trigger('change');
    
    //==========================================================================
    // 3. PROGRESS BAR SETTINGS MANAGEMENT
    //==========================================================================
    
    // Toggle donation goal settings visibility based on checkbox
    $(document).on('change', '#tbc_wc_show_progress_bar', function(e) {
        if ($(this).is(':checked')) {
            $('p.tbc-wc-dgp-input-wrap').removeClass('tbc-wc-dgp-hide');
            $('p.tbc-wc-dgp-input-wrap').addClass('tbc-wc-dgp-show');
        } 
        else {
            $('p.tbc-wc-dgp-input-wrap').removeClass('tbc-wc-dgp-show');
            $('p.tbc-wc-dgp-input-wrap').addClass('tbc-wc-dgp-hide');
        }
    });
    
    // Toggle subscriber timeframe visibility based on goal type
    $(document).on('change', '#tbc_wc_goal_type', function() {
        if ($(this).val() === 'subscribers') {
            $('.tbc-wc-subscriber-timeframe').removeClass('tbc-wc-dgp-hide').addClass('tbc-wc-dgp-show');
        } else {
            $('.tbc-wc-subscriber-timeframe').removeClass('tbc-wc-dgp-show').addClass('tbc-wc-dgp-hide');
        }
    }).trigger('change');
    
    // Initialize progress bar settings visibility on page load
    $('#tbc_wc_show_progress_bar').trigger('change');
});