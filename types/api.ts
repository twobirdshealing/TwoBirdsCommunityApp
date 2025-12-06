// =============================================================================
// API TYPES - Common TypeScript definitions for API interactions
// =============================================================================

// -----------------------------------------------------------------------------
// Generic API Error Response
// -----------------------------------------------------------------------------

export interface ApiError {
  code: string;
  message: string;
  data: {
    status: number;
    field?: string;
    allowed_values?: string[];
  };
}

// -----------------------------------------------------------------------------
// Pagination Meta
// -----------------------------------------------------------------------------

export interface PaginationMeta {
  total: number;
  per_page: number;
  current_page: number;
  total_pages: number;
  from?: number;
  to?: number;
  has_more?: boolean;
}

// -----------------------------------------------------------------------------
// Generic Paginated Response
// -----------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// -----------------------------------------------------------------------------
// Generic Success Response
// -----------------------------------------------------------------------------

export interface SuccessResponse<T = any> {
  message: string;
  data?: T;
}

// -----------------------------------------------------------------------------
// Request Options
// -----------------------------------------------------------------------------

export interface RequestOptions {
  page?: number;
  per_page?: number;
  orderby?: string;
  order?: 'asc' | 'desc';
  search?: string;
}

// Feed-specific options
export interface FeedRequestOptions extends RequestOptions {
  space?: string;
  user_id?: number;
  topic_slug?: string;
  order_by_type?: string;
  disable_sticky?: 'yes' | 'no';
}

// Comment-specific options
export interface CommentRequestOptions extends RequestOptions {
  parent_id?: number;
}

// Member-specific options
export interface MemberRequestOptions extends RequestOptions {
  role?: string;
  status?: string;
  space_id?: number;
}
