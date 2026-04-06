jQuery(document).ready(function($) {
    // Use event delegation for lazy-loaded content compatibility
    $(document).on('change', '#tbc-mc-contact-type', function() {
        var type = $(this).val();
        var $contactListContainer = $('#tbc-mc-contact-list-container');
        var $categoryFilter = $('.tbc-mc-category-filter-container');
        
        if (type === 'Main Church SMS') {
            $categoryFilter.hide();
            generateAndDisplayRoles([
                'church_member',
                'community_member',
                'church_subscriber',
                'church_parent',
                'church_guest_leader',
                'church_volunteer',
                'church_participant',
                'ceremony_approved',
                'church_team'
            ]);
        } else if (type === 'customers') {
            $categoryFilter.show();
            loadProductCategories();
            $contactListContainer.empty();
        } else if (type === 'all_product_customers') {
            $categoryFilter.hide();
            fetchAndDisplayAllProducts();
        } else if (type === 'manual_numbers') {
            $categoryFilter.hide();
            displayManualNumbersInput();
        } else {
            $categoryFilter.hide();
            $contactListContainer.empty();
        }
    });

    function loadProductCategories() {
        $.post(ajaxurl, {
            action: 'tbc_mc_fetch_categories',
            nonce: tbcMC.nonce
        }, function(response) {
            if (response.success && response.data.data.categories) {
                var categories = response.data.data.categories;
                var html = '';
                
                categories.forEach(function(category) {
                    html += '<option value="' + category.slug + '">' + category.name + ' (' + category.count + ')</option>';
                });
                
                $('#tbc-mc-category-multiselect').html(html);
                
                var savedCategories = localStorage.getItem('tbc_mc_ceremony_categories');
                if (savedCategories) {
                    var categoriesArray = JSON.parse(savedCategories);
                    $('#tbc-mc-category-multiselect').val(categoriesArray);
                }
                
                $('#tbc-mc-category-multiselect').on('change', function() {
                    var selectedCategories = $(this).val() || [];
                    localStorage.setItem('tbc_mc_ceremony_categories', JSON.stringify(selectedCategories));
                    fetchAndDisplayProducts();
                });
                
                fetchAndDisplayProducts();
            }
        });
    }

    function displayManualNumbersInput() {
        var $contactListContainer = $('#tbc-mc-contact-list-container');
        
        var manualInputHtml = '<div class="tbc-mc-manual-numbers-container">' +
            '<h3>Enter Individual Numbers</h3>' +
            '<div class="tbc-mc-manual-numbers-input-container">' +
                '<textarea id="tbc-mc-manual-numbers" name="manual_numbers" placeholder="Enter phone numbers (one per line or comma-separated)"></textarea>' +
                '<p class="tooltip no-margin-top">Enter 10-digit phone numbers. For multiple numbers, separate them with commas or new lines.</p>' +
            '</div>' +
            '<div id="tbc-mc-parsed-numbers-container"></div>' +
            '<button type="button" id="tbc-mc-parse-numbers" class="button">Parse Numbers</button>' +
        '</div>';
        
        $contactListContainer.html(manualInputHtml);
        
        $('#tbc-mc-parse-numbers').on('click', function() {
            parseManualNumbers();
        });
    }

    function parseManualNumbers() {
        var numbersText = $('#tbc-mc-manual-numbers').val().trim();
        if (!numbersText) {
            $('#tbc-mc-parsed-numbers-container').html('<p class="error">Please enter at least one phone number.</p>');
            return;
        }
        
        var numbersList = numbersText.split(/[\n,]+/);
        var parsedNumbers = [];
        var invalidNumbers = [];
        
        numbersList.forEach(function(number) {
            var trimmedNumber = number.trim();
            if (trimmedNumber.length === 0) return;
            
            var normalizedPhone = window.PhoneUtils.normalize(trimmedNumber);
            
            if (normalizedPhone && /^\+\d{10,15}$/.test(normalizedPhone)) {
                parsedNumbers.push({
                    phone: normalizedPhone,
                    name: 'Contact'
                });
            } else {
                invalidNumbers.push(trimmedNumber);
            }
        });
        
        var parsedHtml = '';
        
        if (parsedNumbers.length > 0) {
            parsedHtml += '<div class="tbc-mc-parsed-numbers-list">';
            parsedHtml += '<h4>Valid Numbers:</h4>';
            parsedHtml += '<ul>';
            
            parsedNumbers.forEach(function(item) {
                parsedHtml += '<li>' +
                    '<input type="checkbox" name="users[]" value="' + item.phone + '" data-phone="' + item.phone + '" data-name="' + item.name + '" class="user-checkbox" checked> ' +
                    item.phone +
                '</li>';
            });
            
            parsedHtml += '</ul>';
            parsedHtml += '</div>';
        }
        
        if (invalidNumbers.length > 0) {
            parsedHtml += '<div class="tbc-mc-invalid-numbers">';
            parsedHtml += '<h4>Invalid Numbers:</h4>';
            parsedHtml += '<p>' + invalidNumbers.join(', ') + '</p>';
            parsedHtml += '<p class="tooltip">Please ensure numbers are valid phone numbers (10-11 digits).</p>';
            parsedHtml += '</div>';
        }
        
        $('#tbc-mc-parsed-numbers-container').html(parsedHtml);
    }

    // "All Users of a Product" - simple flat list (unchanged behavior)
    function fetchAndDisplayAllProducts() {
        $.ajax({
            url: ajaxurl,
            method: 'POST',
            data: {
                action: 'tbc_mc_fetch_products',
                nonce: tbcMC.nonce,
                simple_mode: 'true'
            },
            beforeSend: function() {
                $('#tbc-mc-contact-list-container').html('<p>Loading Products...</p>');
            },
            success: function(response) {
                if (response.success && response.data.data && response.data.data.products) {
                    var products = response.data.data.products;
                    
                    if (products.length === 0) {
                        $('#tbc-mc-contact-list-container').html('<p>No products found.</p>');
                        return;
                    }

                    var productsHtml = '<div class="tbc-mc-product-list">';
                    products.forEach(function(product) {
                        productsHtml += '<div class="tbc-mc-product-container">' +
                            '<span class="tbc-mc-expand-product-simple" data-product-id="' + product.id + '">' +
                                '<i class="bb-icon bb-icon-plus"></i> ' + product.name +
                            '</span>' +
                            '<div class="tbc-mc-customer-list" id="customers_for_product_' + product.id + '" style="display: none;"></div>' +
                        '</div>';
                    });
                    productsHtml += '</div>';

                    $('#tbc-mc-contact-list-container').html(productsHtml);
                    bindClickEventsToSimpleProducts();

                    if (response.data && response.data.html) {
                        $('#feedback').prepend(response.data.html);
                    }
                } else {
                    smsFeedback('#feedback', 'error', 'No products found or an error occurred.');
                }
            },
            error: function() {
                smsFeedback('#feedback', 'error', 'Error loading products. Please try again later.');
            }
        });
    }

    function bindClickEventsToSimpleProducts() {
        $('.tbc-mc-expand-product-simple').off('click').on('click', function() {
            var productId = $(this).data('product-id');
            var customerListDiv = $('#customers_for_product_' + productId);
            var icon = $(this).find('i');

            icon.addClass('tbc-mc-processing');

            if (customerListDiv.is(':visible')) {
                customerListDiv.find('.user-checkbox').prop('checked', false);
                customerListDiv.slideUp();
                icon.removeClass('bb-icon-minus tbc-mc-processing').addClass('bb-icon-plus');
            } else {
                fetchCustomersByProduct(productId, customerListDiv, function() {
                    customerListDiv.slideDown();
                    icon.removeClass('bb-icon-plus tbc-mc-processing').addClass('bb-icon-minus');
                });
            }
        });
    }

    // "Ceremony Participants" - Three-level hierarchy (Product -> Dates -> Users)
    function fetchAndDisplayProducts() {
        var selectedCategories = $('#tbc-mc-category-multiselect').val() || [];

        $.ajax({
            url: ajaxurl,
            method: 'POST',
            data: {
                action: 'tbc_mc_fetch_products',
                nonce: tbcMC.nonce,
                included_categories: selectedCategories
            },
            beforeSend: function() {
                $('#tbc-mc-contact-list-container').html('<p>Loading Products...</p>');
            },
            success: function(response) {
                if (response.success && response.data.data && response.data.data.products) {
                    var products = response.data.data.products;
                    
                    if (products.length === 0) {
                        $('#tbc-mc-contact-list-container').html('<p>No products with events in the next 3 months.</p>');
                        return;
                    }

                    var productsHtml = '<p class="tbc-mc-date-range-note">Showing events from 3 months ago to 3 months ahead</p>';
                    productsHtml += '<div class="tbc-mc-product-list">';
                    products.forEach(function(product) {
                        var dateLabel = product.date_count === 1 ? '1 date' : product.date_count + ' dates';
                        productsHtml += '<div class="tbc-mc-product-container">' +
                            '<span class="tbc-mc-expand-product" data-product-id="' + product.id + '">' +
                                '<i class="bb-icon bb-icon-plus"></i> ' + product.name +
                                ' <span class="tbc-mc-date-count">(' + dateLabel + ')</span>' +
                            '</span>' +
                            '<div class="tbc-mc-date-list" id="dates_for_product_' + product.id + '" style="display: none;"></div>' +
                        '</div>';
                    });
                    productsHtml += '</div>';

                    $('#tbc-mc-contact-list-container').html(productsHtml);
                    bindClickEventsToProducts();

                    if (response.data && response.data.html) {
                        $('#feedback').prepend(response.data.html);
                    }
                } else {
                    smsFeedback('#feedback', 'error', 'No products found or an error occurred.');
                }
            },
            error: function() {
                smsFeedback('#feedback', 'error', 'Error loading products. Please try again later.');
            }
        });
    }

    function bindClickEventsToProducts() {
        $('.tbc-mc-expand-product').off('click').on('click', function() {
            var productId = $(this).data('product-id');
            var dateListDiv = $('#dates_for_product_' + productId);
            var icon = $(this).find('i');

            icon.addClass('tbc-mc-processing');

            if (dateListDiv.is(':visible')) {
                // Collapse: uncheck all nested checkboxes
                dateListDiv.find('.user-checkbox').prop('checked', false);
                dateListDiv.slideUp();
                icon.removeClass('bb-icon-minus tbc-mc-processing').addClass('bb-icon-plus');
            } else {
                // Expand: load dates
                fetchDatesForProduct(productId, dateListDiv, function() {
                    dateListDiv.slideDown();
                    icon.removeClass('bb-icon-plus tbc-mc-processing').addClass('bb-icon-minus');
                });
            }
        });
    }

    function fetchDatesForProduct(productId, dateListDiv, callback) {
        $.ajax({
            url: ajaxurl,
            method: 'POST',
            data: {
                action: 'tbc_mc_fetch_dates_for_product',
                nonce: tbcMC.nonce,
                product_id: productId
            },
            success: function(response) {
                if (response.success && response.data.data && response.data.data.dates) {
                    var dates = response.data.data.dates;
                    var datesHtml = '';
                    
                    dates.forEach(function(dateItem) {
                        var safeId = dateItem.composite_id.replace('|', '_');
                        datesHtml += '<div class="tbc-mc-date-container">' +
                            '<span class="tbc-mc-expand-date" data-composite-id="' + dateItem.composite_id + '">' +
                                '<i class="bb-icon bb-icon-plus"></i> ' + dateItem.formatted +
                            '</span>' +
                            '<div class="tbc-mc-customer-list" id="customers_for_date_' + safeId + '" style="display: none;"></div>' +
                        '</div>';
                    });
                    
                    dateListDiv.html(datesHtml);
                    bindClickEventsToDates();
                    
                    if (typeof callback === 'function') callback();
                } else {
                    dateListDiv.html('<p class="tbc-mc-no-dates">No event dates found.</p>');
                    if (typeof callback === 'function') callback();
                }
            },
            error: function() {
                smsFeedback('#feedback', 'error', 'Error loading dates.');
                if (typeof callback === 'function') callback();
            }
        });
    }

    function bindClickEventsToDates() {
        $('.tbc-mc-expand-date').off('click').on('click', function() {
            var compositeId = $(this).data('composite-id');
            var safeId = compositeId.toString().replace('|', '_');
            var customerListDiv = $('#customers_for_date_' + safeId);
            var icon = $(this).find('i');

            icon.addClass('tbc-mc-processing');

            if (customerListDiv.is(':visible')) {
                customerListDiv.find('.user-checkbox').prop('checked', false);
                customerListDiv.slideUp();
                icon.removeClass('bb-icon-minus tbc-mc-processing').addClass('bb-icon-plus');
            } else {
                fetchCustomersByProduct(compositeId, customerListDiv, function() {
                    customerListDiv.slideDown();
                    icon.removeClass('bb-icon-plus tbc-mc-processing').addClass('bb-icon-minus');
                });
            }
        });
    }

    function fetchCustomersByProduct(compositeId, customerListDiv, callback) {
        $.ajax({
            url: ajaxurl,
            method: 'POST',
            data: {
                action: 'tbc_mc_fetch_customers',
                nonce: tbcMC.nonce,
                product_id: compositeId
            },
            success: function(response) {
                if (response.success && response.data.data && response.data.data.customerList) {
                    var customerList = response.data.data.customerList;
                    var safeId = compositeId.toString().replace('|', '_');
                    
                    var customerListHtml = '<ul>' +
                        '<li>' +
                            '<div class="tbc-mc-check-all-container">' +
                                '<input type="checkbox" class="role-checkbox" id="customer_all_' + safeId + '" value="all">' +
                                '<label for="customer_all_' + safeId + '"> Check/Uncheck All</label>' +
                            '</div>' +
                        '</li>';
                    
                    customerList.forEach(function(customer) {
                        if (customer.is_sms_out) {
                            customerListHtml += '<li style="padding-left: 20px; text-decoration: line-through;">' + customer.display_name + '</li>';
                        } else {
                            customerListHtml += '<li><input type="checkbox" name="customers[]" value="' + customer.phone + '" data-phone="' + customer.phone + '" data-name="' + customer.name + '" class="user-checkbox"> ' + customer.display_name + '</li>';
                        }
                    });
                    
                    customerListHtml += '</ul>';
                    customerListDiv.html(customerListHtml);

                    if (response.data && response.data.html) {
                        $('#feedback').prepend(response.data.html);
                    }

                    bindCheckAllFunctionality(safeId);

                    if (typeof callback === 'function') callback();
                } else {
                    customerListDiv.html('<p class="tbc-mc-no-customers">No customers found for this event.</p>');
                    if (typeof callback === 'function') callback();
                }
            },
            error: function() {
                smsFeedback('#feedback', 'error', 'Error loading customers. Please try again later.');
                if (typeof callback === 'function') callback();
            }
        });
    }

    function bindCheckAllFunctionality(safeId) {
        $('#customer_all_' + safeId).off('change').on('change', function() {
            var isChecked = $(this).is(':checked');
            var customerList = $(this).closest('ul');
            customerList.find('.user-checkbox').prop('checked', isChecked);
        });
    }

    function generateAndDisplayRoles(roles) {
        var roleDetails = {
            'community_member': { name: 'Community Members', description: 'All members of the community.' },
            'church_member': { name: 'Church Members', description: 'All members of the Church.' },
            'church_subscriber': { name: 'Church Subscriber', description: 'Subscribers of all levels.' },
            'church_parent': { name: 'Church Parent', description: 'Parents of our Little Birds.' },
            'church_volunteer': { name: 'Church Volunteer', description: 'Volunteers helping with church events.' },
            'church_participant': { name: 'Ceremony Participants', description: 'Past Participants of our Ceremonies.' },
            'church_team': { name: 'Church Team', description: 'Core Two Birds Team members.' },
            'ceremony_approved': { name: 'Medical Screenings', description: 'Members who have an approved Medical Screening' },
            'church_guest_leader': { name: 'Guest Service Leaders', description: 'Members who have led as a Guest Service leader' }
        };

        var rolesHtml = '<div class="tbc-mc-role-list">';
        roles.forEach(function(role) {
            var details = roleDetails[role] || { name: role, description: '' };
            rolesHtml += '<div class="tbc-mc-role-container">' +
                '<span class="tbc-mc-expand-role" data-role="' + role + '">' +
                    '<i class="bb-icon bb-icon-plus"></i> ' + details.name +
                '</span>' +
                '<span class="tbc-mc-role-description">' + details.description + '</span>' +
                '<div class="tbc-mc-user-list" id="users_for_' + role + '" style="display: none;"></div>' +
            '</div>';
        });
        rolesHtml += '</div>';
        
        $('#tbc-mc-contact-list-container').html(rolesHtml);
        bindClickEventsToRoles();
    }

    function bindClickEventsToRoles() {
        $('.tbc-mc-expand-role').off('click').on('click', function() {
            var role = $(this).data('role');
            var userListDiv = $('#users_for_' + role);
            var icon = $(this).find('i');

            icon.addClass('tbc-mc-processing');

            if (userListDiv.is(':visible')) {
                userListDiv.find('.user-checkbox').prop('checked', false);
                userListDiv.slideUp();
                icon.removeClass('bb-icon-minus tbc-mc-processing').addClass('bb-icon-plus');
            } else {
                fetchUsersByRole(role, userListDiv, function() {
                    userListDiv.slideDown();
                    icon.removeClass('bb-icon-plus tbc-mc-processing').addClass('bb-icon-minus');
                });
            }
        });
    }

    function fetchUsersByRole(role, userListDiv, callback) {
        $.ajax({
            url: ajaxurl,
            method: 'POST',
            data: { action: 'tbc_mc_fetch_by_role', nonce: tbcMC.nonce, role: role },
            success: function(response) {
                if (response.success && response.data.data && response.data.data.userList) {
                    var userList = response.data.data.userList;
                    var userListHtml = '<ul>' +
                        '<li>' +
                            '<div class="tbc-mc-check-all-container">' +
                                '<input type="checkbox" class="role-checkbox" id="role_all_' + role + '" value="all">' +
                                '<label for="role_all_' + role + '"> Check/Uncheck All</label>' +
                            '</div>' +
                        '</li>';
                    
                    userList.forEach(function(user) {
                        if (user.is_sms_out) {
                            userListHtml += '<li style="padding-left: 20px; text-decoration: line-through;">' + user.display_name + '</li>';
                        } else {
                            userListHtml += '<li><input type="checkbox" name="users[]" value="' + user.phone + '" data-phone="' + user.phone + '" data-name="' + user.name + '" class="user-checkbox"> ' + user.display_name + '</li>';
                        }
                    });
                    
                    userListHtml += '</ul>';
                    userListDiv.html(userListHtml);

                    if (response.data && response.data.html) {
                        $('#feedback').prepend(response.data.html);
                    }

                    if (typeof callback === 'function') callback();
                } else {
                    smsFeedback('#feedback', 'error', 'No users found or an error occurred.');
                    if (typeof callback === 'function') callback();
                }
            },
            error: function() {
                smsFeedback('#feedback', 'error', 'Error loading users. Please try again later.');
                if (typeof callback === 'function') callback();
            }
        });
    }

    $(document).on('change', '.role-checkbox', function() {
        var isChecked = $(this).is(':checked');
        $(this).closest('ul').find('.user-checkbox').prop('checked', isChecked);
    });

    $(document).on('submit', '.tbc-mc-sms-center-container form', function(event) {
        event.preventDefault();
        window.handleSMSFormSubmission($(this));
    });
});