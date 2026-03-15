/**
 * TBC WooCommerce Calendar - Dashboard Frontend
 * Handles perks toggle, category filtering, and view switching
 * 
 * @package TBC_WC_Calendar
 */
jQuery(function($){

  // ============================================================================
  // CATEGORY FILTER
  // ============================================================================
  
  $('#tbc-wc-category-select').on('change', function() {
    const category = $('option:selected', this).data('category');
    
    // List view items
    const $listItems = $('.tbc-wc-event-item');
    const $months = $('.tbc-wc-month-section');
    
    // Month view events
    const $monthEvents = $('.tbc-wc-day-event');

    // Hide all items
    $listItems.hide();
    $monthEvents.hide();
    $months.show();
    $('.tbc-wc-empty-month-message').remove();

    if (category === 'all') {
      // Show everything
      $listItems.show();
      $monthEvents.show();
    } else {
      // Filter list view
      const $matchList = $('.tbc-wc-event-item.tbc-wc-category-' + category).show();
      
      // Filter month view
      const $matchMonth = $('.tbc-wc-day-event.tbc-wc-category-' + category).show();
      
      if ($matchList.length === 0 && $matchMonth.length === 0) {
        $months.hide();
        $('<div class="tbc-wc-empty-month-message"><p>There are no events available for this category.</p></div>')
          .insertBefore('.tbc-wc-calendar, .tbc-wc-month-calendar-container');
      } else {
        $months.each(function(){
          if ($(this).find('.tbc-wc-event-item:visible').length === 0) $(this).hide();
        });
        
        // Hide days with no visible events in month view
        $('.tbc-wc-month-grid-day').each(function() {
          const $day = $(this);
          const visibleEvents = $day.find('.tbc-wc-day-event:visible').length;
          if (visibleEvents === 0 && $day.hasClass('tbc-wc-has-events')) {
            $day.find('.tbc-wc-day-events').hide();
          } else {
            $day.find('.tbc-wc-day-events').show();
          }
        });
      }
    }
  });

  if ($('.tbc-wc-event-item').length > 0 || $('.tbc-wc-day-event').length > 0) {
    $('#tbc-wc-category-select').trigger('change');
  }

  // ============================================================================
  // VIEW SWITCHER (Button Group)
  // ============================================================================

  $('.tbc-wc-view-btn').on('click', function() {
    const view = $(this).data('view');
    const currentUrl = new URL(window.location.href);

    // Update active state visually
    $('.tbc-wc-view-btn').removeClass('tbc-wc-view-active');
    $(this).addClass('tbc-wc-view-active');

    if (view === 'month') {
      currentUrl.searchParams.set('calendar_view', 'month');
    } else {
      currentUrl.searchParams.delete('calendar_view');
    }

    window.location.href = currentUrl.toString();
  });

});