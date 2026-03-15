/**
 * TBC WooCommerce Calendar - ICS Subscription Frontend
 * 
 * @package TBC_WC_Calendar
 */
jQuery(function($){
  
  // ============================================================================
  // SCROLL-TRIGGERED ANIMATION
  // ============================================================================
  
  const subscribeContainer = $('.tbc-wc-calendar-subscription-container')[0];
  
  if (subscribeContainer) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Trigger big animation every time we scroll into view
          $('.tbc-wc-calendar-subscription-container').addClass('tbc-wc-just-scrolled-in');
          
          // Remove the class after animation completes
          setTimeout(() => {
            $('.tbc-wc-calendar-subscription-container').removeClass('tbc-wc-just-scrolled-in');
          }, 2000);
        }
      });
    }, {
      threshold: 0.5,
      rootMargin: '0px'
    });
    
    observer.observe(subscribeContainer);
  }
  
  // ============================================================================
  // CROSS-PLATFORM CALENDAR SUBSCRIPTION
  // Matches TEC's approach: plain <a> tag, no JS click interception.
  // Apple: keeps webcal:// href for native Calendar.app
  // Android + Desktop: href swapped to Google Calendar URL with target="_blank"
  // ============================================================================

  var ua      = navigator.userAgent || navigator.vendor || window.opera;
  var isIOS   = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  var isMac   = /Macintosh|Mac OS X/.test(ua);
  var isApple = isIOS || isMac;

  if (!isApple) {
    $('.tbc-wc-btn-subscribe-calendar').each(function() {
      var webcalUrl = $(this).data('webcal') || $(this).attr('href');
      $(this).attr('href', 'https://www.google.com/calendar/render?cid=' + encodeURIComponent(webcalUrl));
      $(this).attr('target', '_blank');
      $(this).attr('rel', 'noopener noreferrer nofollow noindex');
    });
  }
  
});