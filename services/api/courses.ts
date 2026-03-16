// =============================================================================
// COURSES API - All course/LMS-related API calls
// =============================================================================
// Handles fetching courses, lessons, enrollment, and completion tracking.
// =============================================================================

import { DEFAULT_PER_PAGE, ENDPOINTS } from '@/constants/config';
import {
  CoursesListResponse,
  CourseDetailResponse,
  CourseEnrollResponse,
  LessonCompletionResponse,
  LessonDetailResponse,
  QuizAnswers,
  QuizSubmitResponse,
  QuizResultResponse,
} from '@/types/course';
import { get, post, put } from './client';

// -----------------------------------------------------------------------------
// Request Options
// -----------------------------------------------------------------------------

export interface GetCoursesOptions {
  page?: number;
  per_page?: number;
  search?: string;
  topic_slug?: string;
  type?: 'enrolled';
  sort_by?: 'alphabetical' | 'oldest' | 'latest';
  with_categories?: boolean;
}

// -----------------------------------------------------------------------------
// Get Courses (list)
// -----------------------------------------------------------------------------

export async function getCourses(options: GetCoursesOptions = {}) {
  const params: Record<string, any> = {
    page: options.page || 1,
    per_page: options.per_page || DEFAULT_PER_PAGE,
    ...(options.search && { search: options.search }),
    ...(options.topic_slug && { topic_slug: options.topic_slug }),
    ...(options.type && { type: options.type }),
    ...(options.sort_by && { sort_by: options.sort_by }),
    ...(options.with_categories && { with_categories: 1 }),
  };

  return get<CoursesListResponse>(ENDPOINTS.COURSES, params);
}

// -----------------------------------------------------------------------------
// Get Course by Slug (detail with sections + lessons)
// -----------------------------------------------------------------------------

export async function getCourseBySlug(slug: string, intendedLessonSlug?: string) {
  const params = intendedLessonSlug
    ? { intended_lesson_slug: intendedLessonSlug }
    : undefined;

  return get<CourseDetailResponse>(ENDPOINTS.COURSE_BY_SLUG(slug), params);
}

// -----------------------------------------------------------------------------
// Get Lesson by Slug
// -----------------------------------------------------------------------------

export async function getLessonBySlug(courseSlug: string, lessonSlug: string) {
  return get<LessonDetailResponse>(ENDPOINTS.COURSE_LESSON_BY_SLUG(courseSlug, lessonSlug));
}

// -----------------------------------------------------------------------------
// Enroll in Course
// -----------------------------------------------------------------------------

export async function enrollInCourse(courseId: number) {
  return post<CourseEnrollResponse>(ENDPOINTS.COURSE_ENROLL(courseId));
}

// -----------------------------------------------------------------------------
// Toggle Lesson Completion
// -----------------------------------------------------------------------------

export async function toggleLessonCompletion(
  courseId: number,
  lessonId: number,
  state: 'completed' | 'incomplete'
) {
  return put<LessonCompletionResponse>(
    ENDPOINTS.COURSE_LESSON_COMPLETION(courseId, lessonId),
    { state }
  );
}

// -----------------------------------------------------------------------------
// Submit Quiz
// -----------------------------------------------------------------------------

export async function submitQuiz(courseId: number, lessonId: number, answers: QuizAnswers) {
  return post<QuizSubmitResponse>(ENDPOINTS.COURSE_QUIZ_SUBMIT(courseId, lessonId), { answers });
}

// -----------------------------------------------------------------------------
// Get Quiz Result
// -----------------------------------------------------------------------------

export async function getQuizResult(courseId: number, lessonId: number) {
  return get<QuizResultResponse>(ENDPOINTS.COURSE_QUIZ_RESULT(courseId, lessonId));
}

// -----------------------------------------------------------------------------
// Request to Join Course (private courses)
// -----------------------------------------------------------------------------

export async function requestCourseAccess(courseId: number) {
  return post<{ message: string }>(ENDPOINTS.COURSE_JOIN(courseId));
}

// -----------------------------------------------------------------------------
// Export as object
// -----------------------------------------------------------------------------

export const coursesApi = {
  getCourses,
  getCourseBySlug,
  getLessonBySlug,
  enrollInCourse,
  toggleLessonCompletion,
  requestCourseAccess,
  submitQuiz,
  getQuizResult,
};

export default coursesApi;
