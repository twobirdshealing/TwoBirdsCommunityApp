jQuery(document).ready(function($) {
    var extraFeePercentage = 0.035;

    function updateFeeAmount() {
        var price = parseFloat($('#nyp-1').val());
        return ($('#add_extra_fee').is(':checked') && price) ? (price * extraFeePercentage) : 0;
    }

    function updatePricesWithFee() {
        var price = parseFloat($('#nyp-1').val()) || 0;
        var fee = updateFeeAmount();
        var totalPrice = price + fee;

        $('.donation-frequency-container .price').text(price ? '$' + totalPrice.toFixed(2) : '');
    }

    function updatePriceLabels() {
        var extraAmount = parseFloat($('#give_extra_amount').val()) || 0;
        var basePrice = parseFloat($('#nyp-1').val()) || 0;
        var fee = updateFeeAmount();
        var oneTimePrice = basePrice + fee + extraAmount;
        var subscriptionPrice = basePrice * (1 + extraFeePercentage) + extraAmount;

        $('.donation-frequency-container .one-time-price').text('$' + oneTimePrice.toFixed(2));
        $('.donation-frequency-container .subscription-price').text('$' + subscriptionPrice.toFixed(2));
    }

    // Event Listeners
    $('#nyp-1, #add_extra_fee').on('change keyup', updatePricesWithFee);
    $('#give_extra_checkbox, #give_extra_amount').on('change keyup', updatePriceLabels);

    // Initial Updates
    updatePricesWithFee();
    updatePriceLabels();
});