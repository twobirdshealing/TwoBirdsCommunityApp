/**
 * TBC WooCommerce Calendar - Waitlist Frontend
 * 
 * @package TBC_WC_Calendar
 */
jQuery(document).ready(function($) {
    // Confirmation for leaving waitlist
    $('.tbc-wc-btn-leave-waitlist').on('click', function(e) {
        if (!confirm('Are you sure you want to leave this waitlist?')) {
            e.preventDefault();
            return false;
        }
        return true;
    });
    
    // Add smooth transitions to waitlist notification
    $('.tbc-wc-waitlist-notification').hide().fadeIn(300);
    
});