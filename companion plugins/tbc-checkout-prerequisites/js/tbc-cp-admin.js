(function($) {
    'use strict';

    function escHtml(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    const TBC_CP_Admin = {
        init() {
            this.initSortable();
            this.bindEvents();
            this.populateSelects();
        },

        bindEvents() {
            $('#tbc-cp-add-step').on('click', () => this.openModal());
            $('#tbc-cp-save-steps').on('click', () => this.saveStepsOrder());
            
            $(document).on('click', '.tbc-cp-edit-step', (e) => this.editStep(e));
            $(document).on('click', '.tbc-cp-delete-step', (e) => this.deleteStep(e));
            $(document).on('click', '.tbc-cp-modal-close', () => this.closeModal());
            $(document).on('click', '.tbc-cp-save-step', () => this.validateAndSave());
            
            $('#tbc-cp-step-type').on('change', (e) => this.handleTypeChange(e));
            $('#tbc-cp-form-id').on('change', (e) => this.populateFormFields(e));
            $('#tbc-cp-expires').on('change', (e) => this.toggleExpiryDays(e));
            $('#tbc-cp-approval-required').on('change', (e) => this.toggleApprovalStatuses(e));

            $('#tbc-cp-step-form').on('submit', (e) => {
                e.preventDefault();
                this.validateAndSave();
            });
        },

        initSortable() {
            $('#tbc-cp-steps-list').sortable({
                handle: '.tbc-cp-step-drag',
                placeholder: 'tbc-cp-step-placeholder',
                update: () => this.saveStepsOrder()
            });
        },

        populateSelects() {
            const $courseSelect = $('#tbc-cp-course-id');
            $courseSelect.empty().append('<option value="">Select Course</option>');
            
            if (tbc_cp_admin.courses) {
                tbc_cp_admin.courses.forEach(course => {
                    $courseSelect.append($('<option>', { value: course.id, text: course.title }));
                });
            }

            const $formSelect = $('#tbc-cp-form-id');
            $formSelect.empty().append('<option value="">Select Form</option>');

            if (tbc_cp_admin.forms) {
                tbc_cp_admin.forms.forEach(form => {
                    $formSelect.append($('<option>', { value: form.id, text: form.title }));
                });
            }
        },

        handleTypeChange(e) {
            const type = $(e.target).val();
            
            $('.tbc-cp-course-field, .tbc-cp-form-field, .tbc-cp-form-options').hide();
            $('#tbc-cp-course-id, #tbc-cp-form-id').prop('required', false);
            
            if (type === 'course') {
                $('.tbc-cp-course-field').show();
                $('#tbc-cp-course-id').prop('required', true);
            } else if (type === 'form') {
                $('.tbc-cp-form-field, .tbc-cp-form-options').show();
                $('#tbc-cp-form-id').prop('required', true);
            }
        },

        populateFormFields(e) {
            const formId = parseInt($(e.target).val(), 10);
            const $select = $('#tbc-cp-consult-notes-field');
            $select.empty().append('<option value="">None (no consultation notes)</option>');

            if (!formId || !tbc_cp_admin.forms) return;

            const form = tbc_cp_admin.forms.find(f => f.id === formId);
            if (form && form.fields) {
                form.fields.forEach(field => {
                    $select.append($('<option>', {
                        value: field.id,
                        text: field.label + ' (ID: ' + field.id + ')'
                    }));
                });
            }
        },

        toggleExpiryDays(e) {
            const isChecked = $(e.target).is(':checked');
            $('.tbc-cp-expiry-days').toggle(isChecked);
            $('#tbc-cp-expiry-days').prop('required', isChecked);
        },

        toggleApprovalStatuses(e) {
            const isChecked = $(e.target).is(':checked');
            $('.tbc-cp-approval-statuses').toggle(isChecked);
        },

        validateAndSave() {
            const form = $('#tbc-cp-step-form')[0];
            const visibleRequired = [...form.elements].filter(el => 
                !el.checkValidity() && $(el).is(':visible') && $(el).prop('required')
            );
            
            if (visibleRequired.length > 0) {
                form.reportValidity();
                return;
            }

            const type = $('#tbc-cp-step-type').val();
            
            if (type === 'form' && !$('#tbc-cp-form-id').val()) {
                this.showNotice('Please select a form', 'error');
                return;
            }
            
            if (type === 'course' && !$('#tbc-cp-course-id').val()) {
                this.showNotice('Please select a course', 'error');
                return;
            }

            this.saveStep();
        },

        saveStep() {
            const formData = {
                id: $('#tbc-cp-step-id').val() || `step-${Date.now()}`,
                type: $('#tbc-cp-step-type').val(),
                title: $('#tbc-cp-step-title').val(),
                description: $('#tbc-cp-step-desc').val(),
                categories: $('#tbc-cp-step-cats').val() || []
            };

            if (formData.type === 'course') {
                formData.course_id = parseInt($('#tbc-cp-course-id').val(), 10);
            } else if (formData.type === 'form') {
                formData.form_id = parseInt($('#tbc-cp-form-id').val(), 10);
                formData.consult_notes_field_id = parseInt($('#tbc-cp-consult-notes-field').val(), 10) || null;
                formData.expires = $('#tbc-cp-expires').is(':checked');
                if (formData.expires) {
                    formData.expiry_days = parseInt($('#tbc-cp-expiry-days').val(), 10);
                }
                formData.track_field_changes = $('#tbc-cp-track-changes').is(':checked');
                formData.approval_required = $('#tbc-cp-approval-required').is(':checked');
                if (formData.approval_required) {
                    formData.completed_statuses = [];
                    $('input[name="completed_statuses[]"]:checked').each(function() {
                        formData.completed_statuses.push(parseInt($(this).val(), 10));
                    });
                }
                formData.phone_screening_enabled = $('#tbc-cp-phone-screening').is(':checked');
                formData.spirit_pharmacist_enabled = $('#tbc-cp-spirit-pharmacist').is(':checked');
            }

            const steps = [...(tbc_cp_admin.steps || [])];
            const existingIndex = steps.findIndex(s => s.id === formData.id);
            
            if (existingIndex > -1) {
                steps[existingIndex] = formData;
            } else {
                steps.push(formData);
            }
            
            tbc_cp_admin.steps = steps;

            this.updateStepsList(formData);
            this.closeModal();
            this.saveStepsOrder();
        },

        openModal(stepData = null) {
            const $modal = $('#tbc-cp-modal');
            const form = $('#tbc-cp-step-form')[0];
            form.reset();

            $('#tbc-cp-step-cats').val([]);
            $('.tbc-cp-course-field, .tbc-cp-form-field, .tbc-cp-form-options').hide();
            $('.tbc-cp-expiry-days').hide();
            $('.tbc-cp-approval-statuses').hide();
            $('input[name="completed_statuses[]"]').prop('checked', false);

            if (stepData) {
                $('#tbc-cp-step-id').val(stepData.id);
                $('#tbc-cp-step-type').val(stepData.type).trigger('change');
                $('#tbc-cp-step-title').val(stepData.title);
                $('#tbc-cp-step-desc').val(stepData.description);
                
                if (stepData.categories?.length) {
                    $('#tbc-cp-step-cats').val(stepData.categories);
                }

                if (stepData.type === 'course') {
                    $('#tbc-cp-course-id').val(stepData.course_id);
                } else if (stepData.type === 'form') {
                    $('#tbc-cp-form-id').val(stepData.form_id).trigger('change');
                    if (stepData.consult_notes_field_id) {
                        // Set after a tick so populateFormFields finishes first
                        setTimeout(() => $('#tbc-cp-consult-notes-field').val(stepData.consult_notes_field_id), 0);
                    }
                    $('#tbc-cp-expires').prop('checked', stepData.expires).trigger('change');
                    if (stepData.expires) {
                        $('#tbc-cp-expiry-days').val(stepData.expiry_days);
                    }
                    $('#tbc-cp-track-changes').prop('checked', !!stepData.track_field_changes);
                    $('#tbc-cp-approval-required').prop('checked', !!stepData.approval_required).trigger('change');
                    if (stepData.completed_statuses) {
                        stepData.completed_statuses.forEach(s => {
                            $(`input[name="completed_statuses[]"][value="${s}"]`).prop('checked', true);
                        });
                    }
                    $('#tbc-cp-phone-screening').prop('checked', !!stepData.phone_screening_enabled);
                    $('#tbc-cp-spirit-pharmacist').prop('checked', !!stepData.spirit_pharmacist_enabled);
                }
            } else {
                $('#tbc-cp-step-id').val('');
            }

            $modal.show();
        },

        closeModal() {
            $('#tbc-cp-modal').hide();
        },

        editStep(e) {
            const stepId = $(e.target).data('step-id');
            const stepData = this.getStepData(stepId);
            if (stepData) {
                this.openModal(stepData);
            }
        },

        deleteStep(e) {
            if (!confirm('Are you sure you want to delete this step?')) {
                return;
            }
            
            const stepId = $(e.target).data('step-id');
            $(e.target).closest('.tbc-cp-step-item').remove();
            
            tbc_cp_admin.steps = tbc_cp_admin.steps.filter(s => s.id !== stepId);
            this.saveStepsOrder();
        },

        updateStepsList(stepData) {
            const $existing = $(`[data-step-id="${stepData.id}"]`);
            const stepHtml = this.generateStepHtml(stepData);

            if ($existing.length) {
                $existing.replaceWith(stepHtml);
            } else {
                $('.tbc-cp-no-steps').remove();
                $('#tbc-cp-steps-list').append(stepHtml);
            }
        },

        generateStepHtml(step) {
            const categoryNames = step.categories?.length 
                ? step.categories.map(catId => {
                    const cat = tbc_cp_admin.categories.find(c => c.id === parseInt(catId));
                    return cat ? cat.name : '';
                }).filter(Boolean).join(', ')
                : 'All Categories';

            const safeTitle = escHtml(step.title);
            const safeDesc = escHtml(step.description || '');
            const safeId = escHtml(step.id);
            const safeCats = escHtml(categoryNames);
            const safeType = escHtml(step.type.charAt(0).toUpperCase() + step.type.slice(1));
            const safeRefId = step.type === 'course' ? step.course_id : step.form_id;

            let metaHtml = `
                <span class="tbc-cp-meta-type">${safeType}</span>
                <span class="tbc-cp-meta-id">${step.type === 'course' ? 'Course' : 'Form'} ID: ${safeRefId}</span>
                <span class="tbc-cp-meta-cats">Categories: ${safeCats}</span>
            `;

            if (step.type === 'form') {
                if (step.expires) {
                    metaHtml += `<span class="tbc-cp-meta-expiry">Expires after ${parseInt(step.expiry_days, 10)} days</span>`;
                }
                if (step.approval_required) {
                    metaHtml += '<span class="tbc-cp-meta-approval">Requires Approval</span>';
                }
                if (step.track_field_changes) {
                    metaHtml += '<span class="tbc-cp-meta-track">Tracks Changes</span>';
                }
                if (step.consult_notes_field_id) {
                    metaHtml += '<span class="tbc-cp-meta-notes">Consult Notes</span>';
                }
                if (step.phone_screening_enabled) {
                    metaHtml += '<span class="tbc-cp-meta-phone">Phone Screening</span>';
                }
                if (step.spirit_pharmacist_enabled) {
                    metaHtml += '<span class="tbc-cp-meta-pharmacist">Spirit Pharmacist</span>';
                }
            }

            return `
                <div class="tbc-cp-step-item" data-step-id="${safeId}">
                    <div class="tbc-cp-step-drag dashicons dashicons-menu"></div>
                    <div class="tbc-cp-step-content">
                        <h3>${safeTitle}</h3>
                        <p>${safeDesc}</p>
                        <div class="tbc-cp-step-meta">${metaHtml}</div>
                    </div>
                    <div class="tbc-cp-step-actions">
                        <button type="button" class="button tbc-cp-edit-step" data-step-id="${safeId}">Edit</button>
                        <button type="button" class="button tbc-cp-delete-step" data-step-id="${safeId}">Delete</button>
                    </div>
                </div>
            `;
        },

        getStepData(stepId) {
            return tbc_cp_admin.steps.find(s => s.id === stepId) || null;
        },

        saveStepsOrder() {
            const steps = [];
            
            $('.tbc-cp-step-item').each((index, el) => {
                const stepId = $(el).data('step-id');
                const stepData = this.getStepData(stepId);
                
                if (stepData) {
                    stepData.order = index + 1;
                    steps.push(stepData);
                }
            });

            $.ajax({
                url: tbc_cp_admin.ajaxurl,
                type: 'POST',
                data: {
                    action: 'tbc_cp_save_steps',
                    nonce: tbc_cp_admin.nonce,
                    steps: JSON.stringify(steps)
                },
                success: (response) => {
                    if (response.success) {
                        this.showNotice('Steps saved successfully', 'success');
                        tbc_cp_admin.steps = steps;
                    } else {
                        this.showNotice('Error saving steps: ' + (response.data || 'Unknown error'), 'error');
                    }
                },
                error: () => {
                    this.showNotice('Failed to save steps. Please try again.', 'error');
                }
            });
        },

        showNotice(message, type) {
            $('.tbc-cp-admin-notice').remove();

            const wpType = type === 'error' ? 'notice-error' : 'notice-success';
            const $notice = $(`
                <div class="notice ${wpType} is-dismissible tbc-cp-admin-notice">
                    <p>${escHtml(message)}</p>
                    <button type="button" class="notice-dismiss">
                        <span class="screen-reader-text">Dismiss this notice.</span>
                    </button>
                </div>
            `);

            $('.tbc-cp-settings-page > h1').after($notice);
            $notice.find('.notice-dismiss').on('click', () => $notice.fadeOut(200, () => $notice.remove()));

            setTimeout(() => $notice.fadeOut(300, () => $notice.remove()), 4000);
        }
    };

    $(document).ready(() => TBC_CP_Admin.init());

})(jQuery);