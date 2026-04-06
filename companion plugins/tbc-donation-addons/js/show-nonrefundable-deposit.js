jQuery(document).ready(function($) {
    var $enableDeposit = $('#_enable_non_refundable_deposit');
    var $nonRefundableDeposit = $('#_non_refundable_deposit').closest('p');
    var $cancellationPolicy = $('#_cancellation_policy').closest('p');

    function toggleFields(isChecked) {
        $nonRefundableDeposit.toggle(isChecked);
        $cancellationPolicy.toggle(isChecked);
    }

    toggleFields($enableDeposit.is(':checked'));

    $enableDeposit.change(function() {
        toggleFields($(this).is(':checked'));
    });
});