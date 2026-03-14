// =============================================================================
// BOOK CLUB API SERVICE - Audiobook player data and bookmarks
// =============================================================================
// All endpoints require JWT auth. Uses TBC_BC_URL base.
// Reads from the same tables as the web Book Club plugin.
// =============================================================================

import { SITE_URL } from '@/constants/config';
import { request } from '@/services/api/client';
import type {
  BooksListResponse,
  BookDetailResponse,
  CreateBookmarkResponse,
  DeleteBookmarkResponse,
} from '@/modules/bookclub/types/bookclub';

/** Book Club plugin REST API base */
const API_BASE = `${SITE_URL}/wp-json/tbc-bc/v1`;

// -----------------------------------------------------------------------------
// API
// -----------------------------------------------------------------------------

/** GET /books — List all books (lightweight, no audio URLs) */
export async function getBooks() {
  return request<BooksListResponse>('/books', { baseUrl: API_BASE });
}

/** GET /books/{id} — Full book detail with chapters, bookmarks, meeting info */
export async function getBook(id: number) {
  return request<BookDetailResponse>(`/books/${id}`, { baseUrl: API_BASE });
}

/** POST /books/{id}/bookmarks — Create bookmark at playback position */
export async function createBookmark(bookId: number, timestamp: number, title: string = '') {
  return request<CreateBookmarkResponse>(`/books/${bookId}/bookmarks`, {
    baseUrl: API_BASE,
    method: 'POST',
    body: { timestamp, title },
  });
}

/** DELETE /books/{id}/bookmarks/{bookmarkId} — Delete user's own bookmark */
export async function deleteBookmark(bookId: number, bookmarkId: number) {
  return request<DeleteBookmarkResponse>(`/books/${bookId}/bookmarks/${bookmarkId}`, {
    baseUrl: API_BASE,
    method: 'DELETE',
  });
}

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const bookclubApi = {
  getBooks,
  getBook,
  createBookmark,
  deleteBookmark,
};

export default bookclubApi;
