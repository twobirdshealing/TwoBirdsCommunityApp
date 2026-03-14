// =============================================================================
// BOOK CLUB - TypeScript interfaces for audiobook player
// =============================================================================

/** Book in list view (from GET /tbc-bc/v1/books) */
export interface BookSummary {
  id: number;
  title: string;
  author: string;
  description: string;
  cover_image: string | null;
  chapter_count: number;
  is_current: boolean;
  display_order: number;
  /** Server-calculated next upcoming meeting (only on current book) */
  next_meeting?: {
    date: string;
    time: string;
    chapters: string;
    formatted_date: string;
    meeting_link: string;
  } | null;
}

/** Chapter within a book */
export interface BookChapter {
  label: string;   // e.g. "Chapter 1"
  title: string;   // e.g. "The Beginning"
  time: number;    // seconds offset into audio
}

/** User's bookmark */
export interface BookBookmark {
  id: number;
  timestamp: number;  // seconds (float)
  title: string;
  created_at: string;
}

/** Meeting schedule entry */
export interface MeetingSchedule {
  date: string;
  time: string;
  chapters: string;  // e.g. "1-3" or "10"
}

/** Moderator profile (from moderator_data on book detail) */
export interface BookModerator {
  user_id: number;
  display_name: string;
  username: string;
  avatar: string | null;
  is_verified: number;
}

/** Full book detail (from GET /tbc-bc/v1/books/{id}) */
export interface BookDetail {
  id: number;
  title: string;
  author: string;
  description: string;
  cover_image: string | null;
  single_audio_url: string | null;
  chapters: BookChapter[];
  is_current: boolean;
  bookmarks: BookBookmark[];
  schedule_data?: MeetingSchedule[];
  meeting_link?: string;
  meeting_id?: string | null;
  meeting_passcode?: string | null;
  moderator?: BookModerator | null;
}

/** API response wrappers */
export interface BooksListResponse {
  success: boolean;
  books: BookSummary[];
}

export interface BookDetailResponse {
  success: boolean;
  book: BookDetail;
}

export interface CreateBookmarkResponse {
  success: boolean;
  bookmark: BookBookmark;
}

export interface DeleteBookmarkResponse {
  success: boolean;
}
