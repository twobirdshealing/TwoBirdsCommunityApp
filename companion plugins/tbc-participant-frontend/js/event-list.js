/**
 * Event List JavaScript
 * 
 * @package TBC_Participant_Frontend
 * @since 3.0.0
 */
(function($) {
    'use strict';

    function tbcPFShowProducts(status, baseUrl) {
        $('#tbc-pf-product-list').html('<div class="tbc-pf-loading">Loading events...</div>');
        
        $.ajax({
            url: tbcPFAjax.ajaxurl,
            type: 'POST',
            data: {
                action: 'tbc_pf_get_products_by_status',
                status: status,
                base_url: baseUrl
            },
            success: function(response) {
                $('#tbc-pf-product-list').html(response);
                tbcPFAttachYearFilterHandler();
            },
            error: function() {
                $('#tbc-pf-product-list').html('<p>Error loading events. Please try again.</p>');
            }
        });
    }
    
    function tbcPFFilterByYear(year) {
        if (year === 'all') {
            $('.tbc-pf-event-row').show();
        } else {
            $('.tbc-pf-event-row').hide();
            $('.tbc-pf-event-row.year-' + year).show();
        }
    }
    
    function tbcPFAttachYearFilterHandler() {
        $('#tbc-pf-year-filter').off('change').on('change', function() {
            tbcPFFilterByYear($(this).val());
        });
    }

    $(document).ready(function() {
        var baseUrl = window.location.href;
        
        $('.tbc-pf-tab-link').on('click', function() {
            $('.tbc-pf-tab-link').removeClass('active');
            $(this).addClass('active');
            tbcPFShowProducts($(this).data('status'), baseUrl);
        });
        
        tbcPFShowProducts('current', baseUrl);
    });
})(jQuery);