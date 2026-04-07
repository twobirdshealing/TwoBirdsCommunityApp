document.addEventListener('DOMContentLoaded', function() {
    initializeTabs();
    initializeDateRanges();
    initializeDateRangeForm();
    setActiveTabFromUrl();
    setActiveDateRangeFromUrl();
});

function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tbc-tabs .tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const targetTab = this.getAttribute('data-tab');

            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            this.classList.add('active');
            const target = document.getElementById(targetTab + '-content');
            if (target) target.classList.add('active');

            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('tab', targetTab);
            window.history.pushState({}, '', currentUrl);
        });
    });
}

function initializeDateRanges() {
    const rangeButtons = document.querySelectorAll('.quick-range-btn');
    const dateRangePanel = document.querySelector('.date-range-panel');

    if (dateRangePanel) {
        dateRangePanel.classList.remove('visible');
    }

    rangeButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();

            rangeButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');

            if (this.classList.contains('custom')) {
                if (dateRangePanel) dateRangePanel.classList.add('visible');
                return;
            }

            if (dateRangePanel) dateRangePanel.classList.remove('visible');

            const fromDate = this.getAttribute('data-from');
            const toDate = this.getAttribute('data-to');

            if (fromDate && toDate) {
                updateDateRange(fromDate, toDate);
            }
        });
    });
}

function initializeDateRangeForm() {
    const form = document.querySelector('.date-range-form');
    if (!form) return;

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const fromDate = document.getElementById('from_date').value;
        const toDate = document.getElementById('to_date').value;
        if (fromDate && toDate) {
            updateDateRange(fromDate, toDate);
        }
    });
}

function updateDateRange(fromDate, toDate) {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('from_date', fromDate);
    currentUrl.searchParams.set('to_date', toDate);
    window.location.href = currentUrl.toString();
}

function setActiveTabFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const activeTab = params.get('tab') || 'dashboard';
    const tabButton = document.querySelector(`.tab-button[data-tab="${activeTab}"]`);
    if (tabButton) tabButton.click();
}

function setActiveDateRangeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const dateRangePanel = document.querySelector('.date-range-panel');
    let fromDate = params.get('from_date');
    let toDate = params.get('to_date');

    if (!fromDate || !toDate) {
        const activeButton = document.querySelector('.quick-range-btn.active') ||
                             document.querySelector('.quick-range-btn');
        if (activeButton) {
            fromDate = activeButton.getAttribute('data-from');
            toDate = activeButton.getAttribute('data-to');
        }
    }

    if (dateRangePanel) {
        dateRangePanel.classList.remove('visible');
    }

    if (fromDate && toDate) {
        const rangeButtons = document.querySelectorAll('.quick-range-btn');
        let matchFound = false;

        rangeButtons.forEach(button => {
            if (button.getAttribute('data-from') === fromDate && button.getAttribute('data-to') === toDate) {
                button.classList.add('active');
                matchFound = true;
            } else {
                button.classList.remove('active');
            }
        });

        const fromInput = document.getElementById('from_date');
        const toInput = document.getElementById('to_date');
        if (fromInput) fromInput.value = fromDate;
        if (toInput) toInput.value = toDate;

        if (!matchFound) {
            const customButton = document.querySelector('.quick-range-btn.custom');
            if (customButton) customButton.classList.add('active');
        }
    }
}
