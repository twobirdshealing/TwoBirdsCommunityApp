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
