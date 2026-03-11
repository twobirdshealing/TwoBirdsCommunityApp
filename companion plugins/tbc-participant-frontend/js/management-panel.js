/**
 * Management Panel JavaScript
 * 
 * @package TBC_Participant_Frontend
 * @since 3.0.0
 */
jQuery(document).ready(function($) {
    'use strict';
    
    $('#tbc-pf-toggle-management-panel').on('click', function() {
        $('.tbc-pf-management-panel-content').slideToggle(300);
        $(this).text($(this).text() === 'Show' ? 'Hide' : 'Show');
    });
    
    $('.tbc-pf-tab-btn').on('click', function() {
        var tabName = $(this).data('tab');

        $('.tbc-pf-tab-btn').removeClass('active');
        $(this).addClass('active');

        $('.tbc-pf-tab-content').removeClass('active');
        $('#tbc-pf-tab-' + tabName).addClass('active');
    });

    // SMS Opt-Out Override toggle
    $(document).on('change', '#tbc_pf_override_opt_out', function() {
        if ($(this).is(':checked')) {
            $('.tbc-pf-opted-out-checkbox').prop('disabled', false);
            $('.tbc-pf-sms-opted-out').addClass('tbc-pf-override-active');
        } else {
            $('.tbc-pf-opted-out-checkbox')
                .prop('disabled', true)
                .prop('checked', false);
            $('.tbc-pf-sms-opted-out').removeClass('tbc-pf-override-active');
        }
    });

    // Clean up opted-out checkboxes after Check/Uncheck All when override is OFF
    $(document).on('change', '#check_all', function() {
        if (!$('#tbc_pf_override_opt_out').is(':checked')) {
            setTimeout(function() {
                $('.tbc-pf-opted-out-checkbox').prop('checked', false);
            }, 0);
        }
    });
});