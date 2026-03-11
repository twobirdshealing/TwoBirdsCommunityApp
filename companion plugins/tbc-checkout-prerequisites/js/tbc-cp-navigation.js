(function($) {
    'use strict';

    const TBC_CP_Navigation = {
        init() {
            this.bindEvents();
            this.validateCurrentStep();
            this.updateConnectionLine();
            this.initTooltips();
        },

        bindEvents() {
            $(document).on('click', '.tbc-cp-nav .tbc-cp-nav-btn', (e) => this.handleNavClick(e));
            $(document).on('click', '.tbc-cp-indicator', (e) => this.handleStepClick(e));
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
                
                let tooltip = '';
                if (isCompleted) {
                    tooltip = `✓ ${stepTitle} - Click to review`;
                } else if (isCurrent) {
                    tooltip = `Current: ${stepTitle} - Complete to continue`;
                } else {
                    tooltip = `${stepTitle} - Complete previous steps to unlock`;
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
                if (this.isStepCompleted(currentNum)) {
                    if (currentNum === totalSteps - 1) {
                        if (this.allPreviousCompleted(totalSteps)) {
                            $nextBtn.show()
                                .text('Proceed to Donation →')
                                .addClass('tbc-cp-nav-donate');
                        } else {
                            $nextBtn.hide();
                        }
                    } else {
                        $nextBtn.show()
                            .text('Next Step →')
                            .removeClass('tbc-cp-nav-donate');
                    }
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

        handleNavClick(e) {
            e.preventDefault();

            const $btn = $(e.currentTarget);
            
            if ($btn.hasClass('tbc-cp-nav-loading')) {
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
            
            const $clicked = $(e.currentTarget);
            const stepNum = parseInt($clicked.data('step'));
            const totalSteps = $('.tbc-cp-indicator').length;
            const isCompleted = $clicked.hasClass('completed');
            const isCurrent = $clicked.hasClass('current');

            if (isCompleted || isCurrent) {
                this.navigateToStep(stepNum);
                return;
            }

            if (stepNum === totalSteps) {
                if (!this.allStepsCompleted()) {
                    this.showCheckoutError();
                    return;
                }
            } else {
                if (!this.allPreviousCompleted(stepNum)) {
                    this.showStepRequirement(stepNum);
                    return;
                }
            }

            this.navigateToStep(stepNum);
        },

        navigateToStep(stepNum) {
            if (stepNum < 1) return;
            
            $('body').addClass('tbc-cp-navigating');
            
            setTimeout(() => {
                window.location.href = this.getStepUrl(stepNum);
            }, 150);
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

        allPreviousCompleted(stepNum) {
            for (let i = 1; i < stepNum; i++) {
                if (!this.isStepCompleted(i)) {
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