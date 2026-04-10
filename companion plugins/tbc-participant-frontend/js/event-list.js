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
                tbcPFAttachSettingsHandlers();
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

    function tbcPFAttachSettingsHandlers() {
        var $form = $('.tbc-pf-settings-form');
        if (!$form.length) {
            return;
        }

        var $select = $('#tbc-pf-event-categories');
        if ($select.length && $.fn.select2) {
            $select.select2({
                placeholder: 'Choose one or more categories…',
                width: '100%',
                closeOnSelect: false
            });
        }

        $('#tbc-pf-save-settings').off('click').on('click', function() {
            var $btn = $(this);
            var $status = $('#tbc-pf-settings-status');
            var ids = $select.val() || [];

            $btn.prop('disabled', true);
            $status.removeClass('is-success is-error').text('Saving…');

            $.ajax({
                url: tbcPFAjax.ajaxurl,
                type: 'POST',
                data: {
                    action: 'tbc_pf_save_event_settings',
                    nonce: $form.data('nonce'),
                    category_ids: ids
                },
                success: function(resp) {
                    $btn.prop('disabled', false);
                    if (resp && resp.success) {
                        $status.addClass('is-success').text('Saved ✓');
                        $('.tbc-pf-settings-summary').html(
                            'Currently matching <strong>' + (ids.length ? '…refreshing' : '0') + '</strong> products.'
                        );
                        // Reload the settings tab to refresh the product count
                        setTimeout(function() {
                            tbcPFShowProducts('settings', window.location.href);
                        }, 600);
                    } else {
                        var msg = (resp && resp.data && resp.data.message) ? resp.data.message : 'Save failed.';
                        $status.addClass('is-error').text(msg);
                    }
                },
                error: function() {
                    $btn.prop('disabled', false);
                    $status.addClass('is-error').text('Save failed. Please try again.');
                }
            });
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