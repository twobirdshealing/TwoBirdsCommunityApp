(function($) {
    'use strict';

    const TBC_CP_Courses = {
        _completing: false,

        init() {
            this.bindEvents();
        },

        bindEvents() {
            $(document).on('click', '.tbc-cp-load-lesson', (e) => this.handleContentClick(e));
            $(document).on('click', '.tbc-cp-mark-complete', (e) => this.handleMarkComplete(e));
            $(document).on('click', '.tbc-cp-return-course', (e) => this.handleReturnToCourse(e));
        },

        handleContentClick(e) {
            e.preventDefault();

            const $el = $(e.currentTarget);
            const courseId = $el.data('course-id') || $el.closest('.tbc-cp-course-content').data('course-id');

            this.loadContent($el.data('lesson-id'), courseId);
        },

        handleReturnToCourse(e) {
            e.preventDefault();

            const $btn = $(e.currentTarget);
            const courseId = $btn.data('course-id') ||
                $btn.closest('.tbc-cp-course-wrap').find('[data-course-id]').data('course-id');

            if (!courseId) {
                return;
            }

            this.loadCourseContent(courseId);
        },

        handleMarkComplete(e) {
            e.preventDefault();

            if (this._completing) return;
            this._completing = true;

            const $btn = $(e.currentTarget);
            const contentId = $btn.data('id');
            const courseId = $btn.data('course-id');

            $btn.prop('disabled', true)
                .addClass('tbc-cp-loading')
                .html('<span class="tbc-cp-btn-icon tbc-cp-icon-loading"></span> Processing...');

            this.ajax('mark_complete', {
                content_id: contentId,
                course_id: courseId
            }, (response) => {
                this._completing = false;
                if (response.success) {
                    if (response.data.course_complete) {
                        this.showNotice('Course completed! Great job! 🎉', 'success');
                        setTimeout(() => window.location.reload(), 1500);
                    } else {
                        this.loadCourseContent(courseId);
                    }
                }
            }, () => {
                this._completing = false;
                $btn.prop('disabled', false)
                    .removeClass('tbc-cp-loading')
                    .html('<span class="tbc-cp-btn-icon"><ion-icon name="checkmark-outline"></ion-icon></span> Mark Complete');
                this.showNotice('Failed to mark as complete. Please try again.', 'error');
            });
        },

        loadContent(contentId, courseId) {
            this.showLoading();

            this.ajax('load_lesson', {
                content_id: contentId,
                course_id: courseId
            }, (response) => {
                if (response.success) {
                    this.updateContent(response.data.content);
                }
            }, () => {
                this.showNotice('Failed to load content. Please try again.', 'error');
            });
        },

        loadCourseContent(courseId) {
            this.showLoading();

            this.ajax('load_course', {
                course_id: courseId
            }, (response) => {
                if (response.success) {
                    this.updateContent(response.data.content);
                } else {
                    this.showNotice('Error loading course content.', 'error');
                }
            }, () => {
                this.showNotice('Failed to load course content. Please try again.', 'error');
            });
        },

        updateContent(content) {
            $('.tbc-cp-body .tbc-cp-course-wrap').fadeOut(300, function() {
                $(this).remove();
                $('.tbc-cp-body')
                    .append(content)
                    .find('.tbc-cp-course-wrap')
                    .hide()
                    .fadeIn(300);
            });
        },

        showLoading() {
            $('.tbc-cp-body').addClass('tbc-cp-loading');
        },

        showNotice(message, type = 'info') {
            TBC_CP_Utils.showNotice(message, type);
        },

        ajax(actionType, data, successCallback, errorCallback) {
            TBC_CP_Utils.ajax(actionType, data, {
                success: successCallback || function() {},
                error: errorCallback || function() {},
                complete: () => $('.tbc-cp-body').removeClass('tbc-cp-loading')
            });
        }
    };

    $(document).ready(() => TBC_CP_Courses.init());

})(jQuery);
