jQuery(document).ready(function($) {
    var $tabs = $('.donor-wall-tab');
    var $grid = $('.donor-grid');
    var donorsData = window.donorsData || {};

    function displayDonors(key) {
        var donorList = donorsData[key] || [];
        $grid.empty();

        if (donorList.length === 0) {
            $grid.html('<p class="no-donors-message">No donors for this period.</p>');
            return;
        }

        donorList.forEach(function(donor) {
            var profileLink = donor.profile_link || '';
            
            // Determine badge type
            var badgeHtml = '';
            if (donor.is_subscription || donor.is_renewal) {
                badgeHtml = $('<div>', {
                    class: 'recurring-badge',
                    text: 'Recurring Donor'
                });
            } else {
                badgeHtml = $('<div>', {
                    class: 'onetime-badge',
                    text: 'One-Time Gift'
                });
            }
            
            var donorDetailsHtml = $('<div>', {
                class: 'donor-box',
                html: $('<div>', {
                    class: 'donor-data',
                    html: [
                        $('<div>', {
                            class: 'donor-avatar',
                            html: donor.avatar
                        }),
                        $('<div>', {
                            class: 'donor-info',
                            html: [
                                badgeHtml,
                                $('<div>', {
                                    class: 'donor-name',
                                    html: profileLink ? 
                                        $('<a>', {
                                            href: profileLink,
                                            text: donor.name
                                        }) : 
                                        donor.name
                                }),
                                $('<div>', {
                                    class: 'donation-date',
                                    text: donor.donation_date
                                })
                            ]
                        })
                    ]
                })
            });
            
            $grid.append(donorDetailsHtml);
        });
    }

    $tabs.on('click', function() {
        var $this = $(this);
        $tabs.removeClass('active');
        $this.addClass('active');
        displayDonors($this.data('key'));
    });

    // Display first tab's content on load
    if ($tabs.length > 0) {
        $tabs.first().trigger('click');
    }
});