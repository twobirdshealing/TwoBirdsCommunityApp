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
    /**
     * The raw error payload from the server, preserved for endpoint-specific
     * deserialization. Use a type guard before reading shaped fields from it.
     */
    raw?: unknown;
  };
}
