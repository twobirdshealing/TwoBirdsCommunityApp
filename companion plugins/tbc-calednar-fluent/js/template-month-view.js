/**
 * TBC WooCommerce Calendar - Month View Frontend
 * 
 * @package TBC_WC_Calendar
 */
jQuery(function($) {
    
    // ============================================================================
    // EVENT CLICK HANDLER - Show detail panel for any event click
    // ============================================================================
    
    // Prevent default and show details instead
    $(document).on('click', '.tbc-wc-day-event', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const $day = $(this).closest('.tbc-wc-month-grid-day');
        const date = $day.data('date');
        const $events = $day.find('.tbc-wc-day-event');
        
        // Show details panel for both mobile and desktop
        showDayDetails($day, date, $events);
        
        return false;
    });
    
    // Day click handler (for empty space in day cell)
    $('.tbc-wc-month-grid-day.tbc-wc-has-events').on('click', function(e) {
        // Only trigger if not clicking on an event
        if ($(e.target).closest('.tbc-wc-day-event').length) {
            return;
        }
        
        e.preventDefault();
        
        const $day = $(this);
        const date = $day.data('date');
        const $events = $day.find('.tbc-wc-day-event');
        
        // Show details panel
        showDayDetails($day, date, $events);
    });
    
    // ============================================================================
    // SHOW DAY DETAILS - MOBILE & DESKTOP
    // ============================================================================
    
    function showDayDetails($day, date, $events) {
        const $details = $('.tbc-wc-selected-day-details');
        const $content = $('.tbc-wc-details-content');
        
        // Format date
        const dateObj = new Date(date + 'T00:00:00');
        const formattedDate = dateObj.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        });
        
        // Update header
        $('.tbc-wc-details-date').text(formattedDate);
        
        // Clear previous content and create wrapper
        $content.empty();
        const $eventList = $('<div class="tbc-wc-calendar"><div class="tbc-wc-month-section"><ul class="tbc-wc-event-list"></ul></div></div>');
        const $listContainer = $eventList.find('.tbc-wc-event-list');
        
        // Add events - use pre-rendered HTML from PHP
        $events.each(function() {
            const $event = $(this);
            const eventHtml = $event.data('event-html');
            
            if (eventHtml) {
                // Wrap in list item for proper structure
                $listContainer.append('<li class="tbc-wc-event-item">' + eventHtml + '</li>');
            }
        });
        
        // Add the wrapped structure to content
        $content.append($eventList);
        
        // Show the details panel
        $details.slideDown(300);
        
        // Scroll to details panel
        $('html, body').animate({
            scrollTop: $details.offset().top - 20
        }, 400);
    }
    
    // ============================================================================
    // CLOSE DETAILS
    // ============================================================================
    
    $('.tbc-wc-close-details').on('click', function(e) {
        e.preventDefault();
        $('.tbc-wc-selected-day-details').slideUp(300);
    });
    
    // ============================================================================
    // CATEGORY FILTER INTEGRATION
    // ============================================================================
    
    $('#tbc-wc-category-select').on('change', function() {
        const category = $('option:selected', this).data('category');
        const $events = $('.tbc-wc-day-event');
        const $days = $('.tbc-wc-month-grid-day');
        
        // Reset all days
        $days.removeClass('tbc-wc-has-events');
        
        if (category === 'all') {
            $events.show();
        } else {
            $events.hide();
            $('.tbc-wc-day-event.tbc-wc-category-' + category).show();
        }
        
        // Update has-events class
        $days.each(function() {
            const $day = $(this);
            const visibleEvents = $day.find('.tbc-wc-day-event:visible').length;
            if (visibleEvents > 0) {
                $day.addClass('tbc-wc-has-events');
            }
        });
        
        // Hide details panel if open
        $('.tbc-wc-selected-day-details').slideUp(300);
    });
    
});