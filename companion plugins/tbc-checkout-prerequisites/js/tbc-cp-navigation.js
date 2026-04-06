(function($) {
    'use strict';

    const TBC_CP_Navigation = {
        _navigating: false,

        init() {
            this.bindEvents();
            this.validateCurrentStep();
            this.initTooltips();

            const currentStep = parseInt($('.tbc-cp-indicator.current').data('step')) || 1;
            history.replaceState({ step: currentStep }, '', this.getStepUrl(currentStep));
        },

        bindEvents() {
            $(document).on('click', '.tbc-cp-nav .tbc-cp-nav-btn', (e) => this.handleNavClick(e));
            $(document).on('click', '.tbc-cp-indicator', (e) => this.handleStepClick(e));

            $(window).on('popstate', (e) => {
                const state = e.originalEvent.state;
                if (state && state.step) {
                    const $target = $(`.tbc-cp-indicator[data-step="${state.step}"]`);
                    if ($target.hasClass('tbc-cp-form-step') || $target.hasClass('tbc-cp-checkout-step')) {
                        window.location.href = this.getStepUrl(state.step);
                        return;
                    }
                    this.loadStep(state.step, false);
                }
            });

            // Restore interactivity if page is loaded from bfcache
            $(window).on('pageshow', (e) => {
                if (e.originalEvent.persisted) {
                    $('body').removeClass('tbc-cp-navigating');
                    this._navigating = false;
                }
            });
        },

        updateConnectionLine() {
            const $indicators = $('.tbc-cp-indicator');
            const completedSteps = $('.tbc-cp-indicator.completed').length;
            const totalSteps = $indicators.length;

            if (totalSteps > 1) {
                const maxSegments = totalSteps - 1;
                const filledSegments = Math.max(0, completedSteps - 1);
                const progress = Math.min(100, (filledSegments / maxSegments) * 100);

                document.documentElement.style.setProperty('--tbc-cp-connection-progress', progress + '%');
            }
        },

        initTooltips() {
            $('.tbc-cp-indicator').each(function() {
                const $indicator = $(this);
                const isCompleted = $indicator.hasClass('completed');
                const isCurrent = $indicator.hasClass('current');
                const stepTitle = $indicator.find('.tbc-cp-indicator-title').text();

                const isSubmitted = $indicator.hasClass('submitted');
                let tooltip = '';
                if (isCompleted) {
                    tooltip = `✓ ${stepTitle} - Click to review`;
                } else if (isSubmitted) {
                    tooltip = `${stepTitle} - Submitted, awaiting review`;
                } else if (isCurrent) {
                    tooltip = `Current: ${stepTitle} - Complete to continue`;
                } else {
                    tooltip = `${stepTitle} - Submit previous steps to unlock`;
                }

                $indicator.attr('title', tooltip);
            });
        },

        validateCurrentStep() {
            const $current = $('.tbc-cp-indicator.current');
            if (!$current.length) return;

            const currentNum = parseInt($current.data('step'));
            const totalSteps = $('.tbc-cp-indicator').length;

            const $nav = $('.tbc-cp-nav');
            const $prevBtn = $nav.find('.tbc-cp-nav-prev');
            const $nextBtn = $nav.find('.tbc-cp-nav-next');

            if (currentNum > 1) {
                $prevBtn.show();
            } else {
                $prevBtn.hide();
            }

            if (currentNum < totalSteps) {
                const nextIsCheckout = (currentNum + 1) === totalSteps &&
                    $(`.tbc-cp-indicator[data-step="${currentNum + 1}"]`).hasClass('tbc-cp-checkout-step');

                if (nextIsCheckout) {
                    if (this.allStepsCompleted()) {
                        $nextBtn.show()
                            .text('Proceed to Donation →')
                            .addClass('tbc-cp-nav-donate');
                    } else {
                        $nextBtn.hide();
                    }
                } else if (this.isStepSubmitted(currentNum)) {
                    $nextBtn.show()
                        .text('Next Step →')
                        .removeClass('tbc-cp-nav-donate');
                } else {
                    $nextBtn.hide();
                }
            } else {
                $nextBtn.hide();
            }

            this.updateConnectionLine();
        },

        isStepCompleted(stepNum) {
            return $(`.tbc-cp-indicator[data-step="${stepNum}"]`).hasClass('completed');
        },

        isStepSubmitted(stepNum) {
            const $step = $(`.tbc-cp-indicator[data-step="${stepNum}"]`);
            return $step.hasClass('completed') || $step.hasClass('submitted');
        },

        handleNavClick(e) {
            e.preventDefault();

            const $btn = $(e.currentTarget);

            if (this._navigating || $btn.hasClass('tbc-cp-nav-loading')) {
                return;
            }

            const $current = $('.tbc-cp-indicator.current');
            const currentNum = parseInt($current.data('step'));

            const nextNum = $btn.hasClass('tbc-cp-nav-prev')
                ? currentNum - 1
                : currentNum + 1;

            $btn.addClass('tbc-cp-nav-loading')
                .append('<span class="tbc-cp-nav-spinner"></span>');
            this.navigateToStep(nextNum);
        },

        handleStepClick(e) {
            e.preventDefault();

            if (this._navigating) {
                return;
            }

            const $clicked = $(e.currentTarget);
            const stepNum = parseInt($clicked.data('step'));
            const totalSteps = $('.tbc-cp-indicator').length;
            const isCurrent = $clicked.hasClass('current');
            const isCheckout = $clicked.hasClass('tbc-cp-checkout-step');

            if (isCurrent) {
                return;
            }

            if (this.isStepSubmitted(stepNum)) {
                this.navigateToStep(stepNum);
                return;
            }

            if (isCheckout) {
                if (!this.allStepsCompleted()) {
                    this.showCheckoutError();
                    return;
                }
            } else {
                if (!this.allPreviousSubmitted(stepNum)) {
                    this.showStepRequirement(stepNum);
                    return;
                }
            }

            this.navigateToStep(stepNum);
        },

        navigateToStep(stepNum) {
            if (stepNum < 1 || this._navigating) return;

            const $target = $(`.tbc-cp-indicator[data-step="${stepNum}"]`);

            // Full page reload for form and checkout steps — their JS (Gravity Forms / WooCommerce)
            // must be enqueued by WordPress and is not available via AJAX
            if ($target.hasClass('tbc-cp-form-step') || $target.hasClass('tbc-cp-checkout-step')) {
                this._navigating = true;
                $('body').addClass('tbc-cp-navigating');
                window.location.href = this.getStepUrl(stepNum);
                return;
            }

            this.loadStep(stepNum, true);
        },

        loadStep(stepNum, pushState) {
            this._navigating = true;
            const $body = $('.tbc-cp-body');

            // Lock current height so card doesn't jump during load
            $body.css('min-height', $body.outerHeight() + 'px')
                 .addClass('tbc-cp-loading');

            TBC_CP_Utils.ajax('load_step', { step: stepNum }, {
                success: (response) => {
                    if (!response.success) {
                        window.location.href = this.getStepUrl(stepNum);
                        return;
                    }

                    const data = response.data;

                    $body.html(data.body);
                    $('.tbc-cp-progress').replaceWith(data.progress);
                    $('.tbc-cp-nav').replaceWith(data.nav);
                    $('.tbc-cp-step-count').text(data.step_count_label);

                    if (pushState) {
                        history.pushState({ step: stepNum }, '', this.getStepUrl(stepNum));
                    }

                    this.updateConnectionLine();
                    this.initTooltips();

                    const $checkout = $('.tbc-cp-checkout');
                    if ($checkout.length) {
                        $('html, body').animate({
                            scrollTop: $checkout.offset().top - 20
                        }, 300);
                    }
                },
                error: () => {
                    window.location.href = this.getStepUrl(stepNum);
                },
                complete: () => {
                    $body.removeClass('tbc-cp-loading')
                         .css('min-height', '');
                    this._navigating = false;
                    $('.tbc-cp-nav-btn').removeClass('tbc-cp-nav-loading')
                        .find('.tbc-cp-nav-spinner').remove();
                }
            });
        },

        showStepRequirement(targetStep = null) {
            const message = targetStep
                ? `Please complete the previous steps before proceeding to step ${targetStep}.`
                : 'Please complete this step before continuing.';

            this.showNotice(message, 'warning');
        },

        showCheckoutError() {
            const totalSteps = $('.tbc-cp-indicator').length;
            const incomplete = [];

            for (let i = 1; i < totalSteps; i++) {
                if (!this.isStepCompleted(i)) {
                    const title = $(`.tbc-cp-indicator[data-step="${i}"] .tbc-cp-indicator-title`).text();
                    incomplete.push(`Step ${i}: ${title}`);
                }
            }

            if (incomplete.length === 0) {
                this.showNotice('All steps appear complete. Please refresh and try again.', 'info');
            } else {
                this.showNotice('Please complete the following steps:\n' + incomplete.join('\n'), 'error');
            }
        },

        showNotice(message, type = 'info') {
            TBC_CP_Utils.showNotice(message, type);
        },

        allPreviousSubmitted(stepNum) {
            for (let i = 1; i < stepNum; i++) {
                if (!this.isStepSubmitted(i)) {
                    return false;
                }
            }
            return true;
        },

        allStepsCompleted() {
            const totalSteps = $('.tbc-cp-indicator').length;
            for (let i = 1; i < totalSteps; i++) {
                if (!this.isStepCompleted(i)) {
                    return false;
                }
            }
            return true;
        },

        getStepUrl(stepNum) {
            const url = new URL(window.location.href);
            url.searchParams.set('step', stepNum);
            return url.toString();
        }
    };

    $(document).ready(() => TBC_CP_Navigation.init());

})(jQuery);
