jQuery(document).ready(function($) {
    // Perk Levels Management
    function updateIndices() {
        $('#wmp_levels_table tbody tr').each(function(index) {
            $(this).find('input, select').each(function() {
                var name = $(this).attr('name');
                if (name) {
                    name = name.replace(/\[\d+\]/, '[' + index + ']');
                    $(this).attr('name', name);
                }
            });
        });
    }

    $('#wmp_add_level').click(function() {
        var lastRow = $('#wmp_levels_table tbody tr:last');
        var newRow = lastRow.clone();
        newRow.find('input').val('');
        newRow.find('input, select').each(function() {
            var name = $(this).attr('name');
            if (name) {
                var newIndex = $('#wmp_levels_table tbody tr').length;
                name = name.replace(/\[\d+\]/, '[' + newIndex + ']');
                $(this).attr('name', name);
            }
        });
        newRow.find('.wmp_remove_level').show();
        $('#wmp_levels_table tbody').append(newRow);
        updateIndices();
    });

    $(document).on('click', '.wmp_remove_level', function() {
        $(this).closest('tr').remove();
        updateIndices();
    });

    // Subscriber Import Management
    window.addSubscriberRow = function() {
        var table = document.getElementById("subscribers_table").getElementsByTagName('tbody')[0];
        var newRow = table.insertRow(-1);
        var rowIndex = table.rows.length - 1;
        
        var cells = [
            '<input type="number" name="subscribers[new' + rowIndex + '][user_id]" value="" class="small-input" />',
            '<input type="text" name="subscribers[new' + rowIndex + '][first_name]" value="" class="regular-text" required />',
            '<input type="text" name="subscribers[new' + rowIndex + '][last_name]" value="" class="regular-text" required />',
            '<input type="email" name="subscribers[new' + rowIndex + '][email]" value="" class="large-input" required />',
            '<input type="text" name="subscribers[new' + rowIndex + '][phone]" value="" class="medium-input" />',
            '<input type="date" name="subscribers[new' + rowIndex + '][start_date]" value="" class="medium-input" required />',
            '<input type="text" name="subscribers[new' + rowIndex + '][subscription_amount]" value="" class="medium-input" required />',
            '<input type="number" name="subscribers[new' + rowIndex + '][renewal_count]" value="0" class="small-input" min="0" required />',
            '<button type="button" class="button subscriber_remove">Remove</button>'
        ];

        cells.forEach(function(cellContent, index) {
            var cell = newRow.insertCell(index);
            cell.innerHTML = cellContent;
        });
    };

    $(document).on('click', '.subscriber_remove', function() {
        $(this).closest('tr').remove();
    });

    // Role Update AJAX - Use event delegation for dynamically generated dropdowns
    $(document).on('change', '.role-dropdown', function() {
        var userId = $(this).data('user-id');
        var newRole = $(this).val();
        var nonce = $(this).data('nonce');
        var $dropdown = $(this);
        
        // Store original value for rollback
        if (!$dropdown.data('original-value')) {
            $dropdown.data('original-value', $dropdown.val());
        }
        
        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'update_user_role',
                user_id: userId,
                new_role: newRole,
                nonce: nonce
            },
            success: function(response) {
                if (response.success) {
                    alert('Role updated successfully');
                    $dropdown.data('original-value', newRole);
                } else {
                    alert('Failed to update role: ' + (response.data || 'Unknown error'));
                    $dropdown.val($dropdown.data('original-value'));
                }
            },
            error: function() {
                alert('Error updating role');
                $dropdown.val($dropdown.data('original-value'));
            }
        });
    });
});