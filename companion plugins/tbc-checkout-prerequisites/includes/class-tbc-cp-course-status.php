<?php
/**
 * Course status and rendering for Checkout Prerequisites
 * Uses Fluent Community course system (fcom_spaces / fcom_posts)
 */

use FluentCommunity\Modules\Course\Services\CourseHelper;
use FluentCommunity\Modules\Course\Model\Course;
use FluentCommunity\Modules\Course\Model\CourseLesson;
use FluentCommunity\Modules\Course\Model\CourseTopic;

class TBC_CP_Course_Status {

    private int $user_id;
    private int $course_id;

    public function __construct(int $user_id, int $course_id) {
        $this->user_id = $user_id;
        $this->course_id = $course_id;

        // Auto-enroll user if not already enrolled
        if (self::is_fluent_community_active() && !CourseHelper::isEnrolled($course_id, $user_id)) {
            $course = Course::find($course_id);
            if ($course) {
                CourseHelper::enrollCourse($course, $user_id, 'self');
            }
        }
    }

    public static function is_fluent_community_active(): bool {
        return defined('FLUENT_COMMUNITY_PLUGIN_VERSION')
            && class_exists('FluentCommunity\Modules\Course\Services\CourseHelper');
    }

    public function get_course_status(): ?array {
        if (!self::is_fluent_community_active()) {
            return null;
        }

        $course = Course::find($this->course_id);
        if (!$course) {
            return null;
        }

        $total_ids = CourseHelper::getCoursePublishedLessonIds($this->course_id);
        $completed_ids = CourseHelper::getCompletedLessonIds($this->course_id, $this->user_id);
        $total = count($total_ids);
        $completed = count($completed_ids);
        $percentage = $total > 0 ? round(($completed / $total) * 100) : 0;

        return [
            'completed' => $percentage >= 100,
            'percentage' => $percentage,
            'completed_steps' => $completed,
            'total_steps' => $total,
            'title' => $course->title,
        ];
    }

    public function render_course(): string {
        if (!self::is_fluent_community_active()) {
            return '<p>' . esc_html__('Unable to load course progress. Please ensure Fluent Community is active.', 'tbc-checkout-prerequisites') . '</p>';
        }

        $course = Course::find($this->course_id);
        if (!$course) {
            return '<p>' . esc_html__('Course not found.', 'tbc-checkout-prerequisites') . '</p>';
        }

        $status = $this->get_course_status();
        if (!$status) {
            return '<p>' . esc_html__('Unable to load course progress.', 'tbc-checkout-prerequisites') . '</p>';
        }

        $completed_ids = CourseHelper::getCompletedLessonIds($this->course_id, $this->user_id);

        // Get sections with their lessons
        $sections = CourseTopic::where('space_id', $this->course_id)
            ->where('status', 'published')
            ->orderBy('priority', 'ASC')
            ->get();

        // Get unsectioned lessons (no parent section)
        $unsectioned_lessons = CourseLesson::where('space_id', $this->course_id)
            ->where('status', 'published')
            ->where(function ($q) {
                $q->where('parent_id', 0)->orWhereNull('parent_id');
            })
            ->orderBy('priority', 'ASC')
            ->get();

        ob_start();
        ?>
        <div class="tbc-cp-course-wrap">
            <div class="tbc-cp-course-header">
                <div class="tbc-cp-course-progress">
                    <span class="tbc-cp-progress-text">
                        <?php echo esc_html(sprintf(
                            __('%d of %d steps completed', 'tbc-checkout-prerequisites'),
                            $status['completed_steps'],
                            $status['total_steps']
                        )); ?>
                    </span>
                    <div class="tbc-cp-progress-bar">
                        <span class="tbc-cp-progress-pct"><?php echo esc_html($status['percentage']); ?>%</span>
                        <div class="tbc-cp-progress-fill" style="width: <?php echo esc_attr($status['percentage']); ?>%"></div>
                    </div>
                </div>

                <div class="tbc-cp-course-content" data-course-id="<?php echo esc_attr($this->course_id); ?>">
                    <?php if ($sections->count() > 0 || $unsectioned_lessons->count() > 0) : ?>
                        <div class="tbc-cp-lesson-list">
                            <?php // Render unsectioned lessons first ?>
                            <?php foreach ($unsectioned_lessons as $lesson) : ?>
                                <?php echo $this->render_lesson_item($lesson, $completed_ids); ?>
                            <?php endforeach; ?>

                            <?php // Render sections with their lessons ?>
                            <?php foreach ($sections as $section) : ?>
                                <div class="tbc-cp-section-header">
                                    <?php echo esc_html($section->title); ?>
                                </div>
                                <?php
                                $section_lessons = $section->lessons()
                                    ->where('status', 'published')
                                    ->get();
                                ?>
                                <?php foreach ($section_lessons as $lesson) : ?>
                                    <?php echo $this->render_lesson_item($lesson, $completed_ids); ?>
                                <?php endforeach; ?>
                            <?php endforeach; ?>
                        </div>
                    <?php else : ?>
                        <p><?php esc_html_e('No lessons found in this course.', 'tbc-checkout-prerequisites'); ?></p>
                    <?php endif; ?>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    private function render_lesson_item(CourseLesson $lesson, array $completed_ids): string {
        $is_complete = in_array($lesson->id, $completed_ids);
        $class = $is_complete ? 'tbc-cp-lesson-item tbc-cp-load-lesson completed' : 'tbc-cp-lesson-item tbc-cp-load-lesson';

        ob_start();
        ?>
        <div class="<?php echo esc_attr($class); ?>" data-lesson-id="<?php echo esc_attr($lesson->id); ?>">
            <div class="tbc-cp-lesson-title">
                <span class="tbc-cp-lesson-text"><?php echo esc_html($lesson->title); ?></span>
            </div>
            <div class="tbc-cp-lesson-status">
                <?php if ($is_complete) : ?>
                    <span class="tbc-cp-status-done"></span>
                <?php else : ?>
                    <span class="tbc-cp-status-pending"></span>
                <?php endif; ?>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    public function render_lesson_content(int $lesson_id): string {
        if (!self::is_fluent_community_active()) {
            return '<p>' . esc_html__('Fluent Community is not active.', 'tbc-checkout-prerequisites') . '</p>';
        }

        $lesson = CourseLesson::find($lesson_id);
        if (!$lesson) {
            return '<p>' . esc_html__('Content not found.', 'tbc-checkout-prerequisites') . '</p>';
        }

        $completed_ids = CourseHelper::getCompletedLessonIds($this->course_id, $this->user_id);
        $is_complete = in_array($lesson_id, $completed_ids);

        $content = $lesson->message_rendered ?: apply_filters('the_content', $lesson->message);

        // Only show featured image if the body content doesn't already contain it
        $show_featured = !empty($lesson->featured_image)
            && strpos($content, $lesson->featured_image) === false;

        ob_start();
        ?>
        <div class="tbc-cp-course-wrap">
            <div class="tbc-cp-lesson-header">
                <h2><?php echo esc_html($lesson->title); ?></h2>
                <?php if ($show_featured) : ?>
                    <div class="tbc-cp-lesson-image">
                        <img src="<?php echo esc_url($lesson->featured_image); ?>" alt="<?php echo esc_attr($lesson->title); ?>">
                    </div>
                <?php endif; ?>
            </div>

            <div class="tbc-cp-lesson-body">
                <?php echo $content; ?>
            </div>

            <div class="tbc-cp-completion">
                <?php if (!$is_complete) : ?>
                    <button class="tbc-cp-mark-complete"
                            data-id="<?php echo esc_attr($lesson_id); ?>"
                            data-course-id="<?php echo esc_attr($this->course_id); ?>">
                        <span class="tbc-cp-btn-icon"></span>
                        <?php esc_html_e('Mark Complete', 'tbc-checkout-prerequisites'); ?>
                    </button>
                <?php else : ?>
                    <button class="tbc-cp-return-course" data-course-id="<?php echo esc_attr($this->course_id); ?>">
                        <span class="tbc-cp-btn-icon"></span>
                        <?php esc_html_e('Completed - Return to Course', 'tbc-checkout-prerequisites'); ?>
                    </button>
                <?php endif; ?>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    public function mark_content_complete(int $lesson_id): array {
        if (!self::is_fluent_community_active()) {
            return [
                'success' => false,
                'course_complete' => false,
                'message' => __('Fluent Community is not active', 'tbc-checkout-prerequisites')
            ];
        }

        $lesson = CourseLesson::find($lesson_id);
        if (!$lesson) {
            return [
                'success' => false,
                'course_complete' => false,
                'message' => __('Lesson not found', 'tbc-checkout-prerequisites')
            ];
        }

        CourseHelper::updateLessonCompletion($lesson, $this->user_id, 'completed');

        $progress = CourseHelper::getCourseProgress($this->course_id, $this->user_id);
        $course_complete = ($progress >= 100);

        if ($course_complete) {
            $course = Course::find($this->course_id);
            if ($course) {
                CourseHelper::completeCourse($course, $lesson, $this->user_id);
            }
        }

        return [
            'success' => true,
            'course_complete' => $course_complete
        ];
    }
}
