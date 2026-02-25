// =============================================================================
// COURSE TYPES - TypeScript definitions for Fluent Community LMS
// =============================================================================
// Based on Fluent Community Courses API (v2)
// =============================================================================

// -----------------------------------------------------------------------------
// Course - A course in the LMS
// -----------------------------------------------------------------------------

export interface Course {
  id: number;
  created_by: string;
  parent_id: number | string | null;
  title: string;
  slug: string;
  logo: string | null;
  cover_photo: string | null;
  description: string;
  type: 'course';
  privacy: 'public' | 'private' | 'secret';
  status: 'published' | 'draft' | 'archived';
  serial: string;
  settings: CourseSettings;
  created_at: string;
  updated_at: string;

  // Enrollment & progress (from list + detail endpoints)
  isEnrolled: boolean;
  progress?: number; // 0-100, only present when enrolled
  sectionsCount: number;
  lessonsCount: number;
  studentsCount: number; // 0 if hide_members_count=yes

  // Detail endpoint only
  creator?: CourseInstructor;
  lockscreen_config?: CourseLockscreenConfig;
}

// -----------------------------------------------------------------------------
// Course Settings
// -----------------------------------------------------------------------------

export interface CourseSettings {
  course_type: 'self_paced' | 'scheduled' | 'structured';
  course_layout: 'classic' | 'modern';
  course_details?: string; // markdown
  course_details_rendered?: string; // HTML (detail endpoint only)
  hide_members_count: 'yes' | 'no';
  hide_instructor_view?: 'yes' | 'no';
  show_instructor_students_count?: 'yes' | 'no';
  disable_comments: 'yes' | 'no';
  show_paywalls?: 'yes' | 'no';
  public_lesson_view?: 'yes' | 'no';
  emoji?: string;
  shape_svg?: string;
  links?: Array<{ title: string; url: string }>;

  // Inherited from BaseSpace settings
  restricted_post_only?: string;
  custom_lock_screen?: 'yes' | 'no' | 'redirect';
  can_request_join?: string;
  layout_style?: string;
  show_sidebar?: string;
  og_image?: string;
  topic_required?: string;
  members_page_status?: string;
  ld_source_id?: number;
  onboard_redirect_url?: string;
}

// -----------------------------------------------------------------------------
// Course Instructor
// -----------------------------------------------------------------------------

export interface CourseInstructor {
  id: string | number;
  user_id: number;
  username: string;
  display_name: string;
  avatar?: string;
  short_description?: string;
  short_description_rendered?: string;
  total_courses?: number;
  total_students?: number; // only if show_instructor_students_count=yes
  is_verified?: number;
  permalink?: string;
}

// -----------------------------------------------------------------------------
// Course Section
// -----------------------------------------------------------------------------

export interface CourseSection {
  id: number;
  title: string;
  slug: string;
  type: 'section';
  created_at: string | { date: string; timezone_type: number; timezone: string };
  is_locked: boolean;
  unlock_date: string;
  lessons: CourseLesson[];
}

// -----------------------------------------------------------------------------
// Course Lesson
// -----------------------------------------------------------------------------

export interface CourseLesson {
  id: number;
  title: string;
  slug: string;
  content: string; // HTML — empty if lazy_load or locked
  course_id: string | number;
  section_id: string | number;
  created_at: string;
  content_type: 'text' | 'quiz';
  featured_image: string | null;
  meta: CourseLessonMeta;
  comments_count: number;
  is_locked: boolean;
  unclock_date: string | null; // API typo — kept as-is
  can_view: boolean;
  inline_css: string;
  lazy_load: boolean;
  access_message?: string; // HTML — shown when can_view=false
}

// -----------------------------------------------------------------------------
// Lesson Meta
// -----------------------------------------------------------------------------

export interface CourseLessonMeta {
  media?: {
    type: string;
    url: string;
    content_type?: string;
    html?: string;
    provider?: string;
    title?: string;
    author_name?: string;
    image?: string;
  };
  enable_comments?: 'yes' | 'no';
  enable_media?: 'yes' | 'no';
  video_length?: number;
  document_lists?: Array<{ id: number; url: string; media_key?: string; title?: string; type?: string }>;
  document_ids?: number[];
  featured_image_id?: number;
  free_preview_lesson?: 'yes' | 'no';
  quiz_questions?: any[]; // Phase 2
  enable_passing_score?: 'yes' | 'no';
  enforce_passing_score?: 'yes' | 'no';
  hide_result?: 'yes' | 'no';
  passing_score?: number;
}

// -----------------------------------------------------------------------------
// Course Track (progress tracking)
// -----------------------------------------------------------------------------

export interface CourseTrack {
  completed_lessons: (string | number)[]; // API returns strings
  isEnrolled: boolean;
  progress: number; // 0-100
}

// -----------------------------------------------------------------------------
// Lockscreen Config (private courses, not enrolled)
// -----------------------------------------------------------------------------

export interface CourseLockscreenConfig {
  showCustom: boolean;
  showPaywalls: boolean;
  canSendRequest: boolean;
  lockScreen: string | null;
  redirect_url: string;
}

// -----------------------------------------------------------------------------
// API Response Types
// -----------------------------------------------------------------------------

// Response from GET /courses/
export interface CoursesListResponse {
  courses: {
    data: Course[];
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    from: number | null;
    to: number | null;
    next_page_url: string | null;
    prev_page_url: string | null;
  };
  course_categories: CourseCategory[];
}

// Response from GET /courses/{slug}/by-slug
export interface CourseDetailResponse {
  course: Course;
  sections: CourseSection[];
  track: CourseTrack;
}

// Response from POST /courses/{id}/enroll
export interface CourseEnrollResponse {
  message: string;
  track: CourseTrack;
}

// Response from PUT /courses/{id}/lessons/{id}/completion
export interface LessonCompletionResponse {
  message: string;
  track: CourseTrack;
  is_completed: boolean; // true if entire course is now 100%
}

// Response from GET /courses/{slug}/lessons/{slug}/by-slug
export interface LessonDetailResponse {
  lesson: CourseLesson;
}

// -----------------------------------------------------------------------------
// Course Category (for topic filtering)
// -----------------------------------------------------------------------------

export interface CourseCategory {
  id: number;
  title: string;
  slug: string;
}
