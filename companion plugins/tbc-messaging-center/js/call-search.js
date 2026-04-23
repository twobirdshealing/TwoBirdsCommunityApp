jQuery(document).ready(function($) {
    // Guard: Skip if element doesn't exist (lazy-loaded tabs)
    // Main initialization for Message Center is handled by message-center.js
    if ($('#tbc-mc-user-search').length === 0) {
        return;
    }

    let timeout;

    $("#tbc-mc-user-search").autocomplete({
        source: function(request, response) {
            clearTimeout(timeout); // Clear any previously set timeout

            // Immediately show 'Searching...' in the dropdown
            response([{ label: 'Searching...', value: '' }]);

            timeout = setTimeout(() => {
                $.ajax({
                    url: ajaxurl,
                    dataType: "json",
                    method: "POST",
                    data: {
                        term: request.term,
                        action: "tbc_mc_search_users",
                        nonce: tbcMC.nonce
                    },
                    success: function(data) {
                        if (data.length === 0) {
                            response([{ label: 'No results', value: '' }]);
                        } else {
                            response(data);
                        }
                    },
                    error: function() {
                        response([{ label: 'Error occurred', value: '' }]);
                    }
                });
            }, 300); // Delay for 300ms
        },
        select: function(event, ui) {
            // Do not proceed if the user selects 'Searching...'
            if (ui.item.value === '') {
                event.preventDefault();
                return;
            }

            $("#tbc-mc-call-button").prop('disabled', false).data('user-id', ui.item.id); // Enable the call button and store user ID after selection
        },
        minLength: 1
    });

    $("#tbc-mc-call-button").click(function() {
        var userId = $(this).data('user-id');
        var $button = $(this);
        var originalText = $button.text();
        
        // Show loading state
        $button.prop('disabled', true).text('Getting number...');
        
        $.post(ajaxurl, {
            action: 'tbc_mc_get_phone',
            nonce: tbcMC.nonce,
            user_id: userId
        }, function(response) {
            // Restore button
            $button.prop('disabled', false).text(originalText);
            
            if (response.success && response.data && response.data.data && response.data.data.phone) {
                initiateTwilioCall(response.data.data.phone);
            } else {
                smsFeedback('#call-center-feedback', 'error', 'Error retrieving user phone number.');
            }
        }).fail(function() {
            $button.prop('disabled', false).text(originalText);
            smsFeedback('#call-center-feedback', 'error', 'Error retrieving user phone number.');
        });
    });

    function initiateTwilioCall(destinationPhone) {
        var $button = $("#tbc-mc-call-button");
        var originalText = $button.text();
        
        // Show loading state
        $button.prop('disabled', true).text('Calling...');
        
        $.post(ajaxurl, {
            action: 'tbc_mc_initiate_call',
            nonce: tbcMC.nonce,
            destination_number: destinationPhone
        }, function(response) {
            // Restore button
            $button.prop('disabled', false).text(originalText);
            
            if (response.success) {
                smsFeedback('#call-center-feedback', 'success', response.data.message || 'Call initiated successfully');
            } else {
                smsFeedback('#call-center-feedback', 'error', response.data.message || 'Error initiating call');
            }
        }).fail(function() {
            $button.prop('disabled', false).text(originalText);
            smsFeedback('#call-center-feedback', 'error', 'An error occurred while initiating the call.');
        });
    }
});