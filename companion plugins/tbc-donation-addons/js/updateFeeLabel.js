/**
 * updateFeeLabel.js - Simplified
 * Updates the donation fee label (3.5%) when price/quantity changes
 */
(function($) {
    $(function() {
        var $container = $('.recover-donor-fees-container');
        if (!$container.length) return;

        var pct = parseFloat($container.data('percent')) || 0.035;
        var deposit = parseFloat($container.data('deposit')) || 0;
        var basePrice = parseFloat($container.data('base-price')) || 0;
        var productType = $container.data('product-type') || '';
        var $feeSpan = $container.find('.donation-fee-amount');
        
        var currentPrice = (productType === 'simple') ? basePrice : 0;

        function getPrice() {
            // NYP input takes priority
            var $nyp = $('input.nyp-input, input[name="nyp"]');
            if ($nyp.length && $nyp.val()) {
                var nypVal = parseFloat($nyp.val());
                if (nypVal > 0) return nypVal;
            }
            
            // Use current variation price or simple base price
            return currentPrice || 0;
        }

        function updateFeeLabel() {
            var price = getPrice();
            var qty = parseInt($('input.qty').val() || '1', 10);
            
            if (price <= 0) {
                $feeSpan.text('$0.00');
                return;
            }
            
            var fee = (price + deposit) * pct * qty;
            $feeSpan.text('$' + fee.toFixed(2));
        }

        // Variable products: listen for variation changes
        if (productType === 'variable') {
            $('form.variations_form').on('found_variation', function(e, variation) {
                currentPrice = parseFloat(variation.display_price) || 0;
                updateFeeLabel();
            }).on('hide_variation', function() {
                currentPrice = 0;
                updateFeeLabel();
            });
        }

        // Listen for input changes
        $(document).on('input change', 'input.nyp-input, input[name="nyp"], input.qty', updateFeeLabel);

        // Initial update
        updateFeeLabel();
    });
})(jQuery);