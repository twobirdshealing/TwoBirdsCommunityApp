/**
 * TBC WooCommerce Calendar - Recurring Summary Admin
 * 
 * @package TBC_WC_Calendar
 */
jQuery(function($) {
    function generateRecurringSummary() {
        const type = $('#_tbc_wc_recurring_type').val();
        const frequency = $('#_tbc_wc_recurring_frequency').val();
        const count = $('#_tbc_wc_recurring_count').val();
        const endType = $('#_tbc_wc_recurring_end_type').val();
        const patternEndDate = $('#_tbc_wc_recurring_end_date').val();
        const endCount = $('#_tbc_wc_recurring_end_count').val();
        const startTime = $('#_tbc_wc_start_time').val();
        const endTime = $('#_tbc_wc_end_time').val();
        const startDate = $('#_tbc_wc_start_date').val();
        const singleDayEvent = $('#_tbc_wc_single_day_event').is(':checked');
        const endDate = $('#_tbc_wc_end_date').val();

        let summary = '';

        switch(type) {
            case 'single':
                if (singleDayEvent) {
                    summary = `A single event that begins at ${formatTime(startTime)} and ends at ${formatTime(endTime)} on ${formatDate(startDate)}`;
                } else {
                    summary = `A multi-day event that begins at ${formatTime(startTime)} on ${formatDate(startDate)} and ends at ${formatTime(endTime)} on ${formatDate(endDate)}`;
                }
                break;

            case 'individual':
                const dates = [];
                $('#tbc-wc-individual-dates-table tr').each(function() {
                    const start = $(this).find('input[name="_tbc_wc_individual_dates_start[]"]').val();
                    const end = $(this).find('input[name="_tbc_wc_individual_dates_end[]"]').val();
                    if (start && end) {
                        dates.push({ start, end });
                    }
                });
                
                if (dates.length === 1) {
                    if (dates[0].start === dates[0].end) {
                        summary = `A single day event that begins at ${formatTime(startTime)} and ends at ${formatTime(endTime)} on ${formatDate(dates[0].start)}`;
                    } else {
                        summary = `A multi-day event that begins at ${formatTime(startTime)} on ${formatDate(dates[0].start)} and ends at ${formatTime(endTime)} on ${formatDate(dates[0].end)}`;
                    }
                } else if (dates.length > 1) {
                    summary = `Multiple events scheduled on different dates from ${formatTime(startTime)} to ${formatTime(endTime)}`;
                }
                break;

            case 'interval':
                let frequencyText = '';
                switch(frequency) {
                    case 'daily':
                        frequencyText = count === '1' ? 'every day' : `every ${count} days`;
                        break;
                    case 'weekly':
                        const selectedDays = $('#_tbc_wc_recurring_weekly_days').val() || [];
                        frequencyText = count === '1' ? 
                            `every week on ${formatWeekDays(selectedDays)}` : 
                            `every ${count} weeks on ${formatWeekDays(selectedDays)}`;
                        break;
                    case 'monthly':
                        const monthlyType = $('#_tbc_wc_recurring_monthly_type').val();
                        if (monthlyType === 'day') {
                            const day = $('#_tbc_wc_recurring_monthly_day').val();
                            frequencyText = count === '1' ? 
                                `on day ${day} of every month` : 
                                `on day ${day} of every ${count} months`;
                        } else {
                            const week = $('#_tbc_wc_recurring_monthly_week').val();
                            const weekday = $('#_tbc_wc_recurring_monthly_weekday').val();
                            frequencyText = count === '1' ? 
                                `on the ${week} ${weekday} of every month` : 
                                `on the ${week} ${weekday} of every ${count} months`;
                        }
                        break;
                    case 'yearly':
                        const month = $('#_tbc_wc_recurring_yearly_month option:selected').text();
                        frequencyText = count === '1' ? 
                            `every year in ${month}` : 
                            `every ${count} years in ${month}`;
                        break;
                }

                let endText = '';
                switch(endType) {
                    case 'never':
                        endText = 'with no end date';
                        break;
                    case 'date':
                        endText = `until ${formatDate(patternEndDate)}`;
                        break;
                    case 'occurrences':
                        endText = `for ${endCount} occurrences`;
                        break;
                }

                summary = `An event ${frequencyText} that begins at ${formatTime(startTime)} and ends at ${formatTime(endTime)}, starting ${formatDate(startDate)} ${endText}`;
                break;
        }

        // Update summary display
        let summaryContainer = $('.tbc-wc-event-summary');
        if (summaryContainer.length === 0) {
            $('.tbc-wc-recurring-settings h4').after('<div class="tbc-wc-event-summary"></div>');
            summaryContainer = $('.tbc-wc-event-summary');
        }
        summaryContainer.html(summary);
    }

    function formatTime(time) {
        if (!time) return '';
        const [hours, minutes] = time.split(':');
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes}${period}`;
    }

    function formatDate(date) {
        if (!date) return '';
        const [year, month, day] = date.split('-').map(num => parseInt(num, 10));
        const d = new Date(year, month - 1, day);
        return d.toLocaleDateString('en-US', { 
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    
    function formatWeekDays(days) {
        if (!days.length) return '';
        return days.map(day => day.charAt(0).toUpperCase() + day.slice(1)).join(', ');
    }

    // Attach event handlers to all relevant form fields
    $('.tbc-wc-recurring-settings, .tbc-wc-date-time-group').on('change', 'select, input', generateRecurringSummary);
    
    // Initial summary generation
    generateRecurringSummary();
});