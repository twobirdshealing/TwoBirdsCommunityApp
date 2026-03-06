// =============================================================================
// BATCH API - Combine multiple REST requests into a single HTTP call
// =============================================================================
// Sends an array of REST paths to POST /tbc-ca/v1/batch.
// The server dispatches each internally and returns all responses at once.
// =============================================================================

import { TBC_CA_URL } from '@/constants/config';
import { request, ApiResponse } from './client';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface BatchRequest {
  /** REST route path, e.g. "/fluent-community/v2/notifications/unread" */
  path: string;
  /** HTTP method (default: GET) */
  method?: 'GET' | 'POST';
  /** Body for POST requests */
  body?: Record<string, unknown>;
}

export interface BatchResponseItem {
  path: string;
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

interface BatchPayload {
  responses: BatchResponseItem[];
}

// -----------------------------------------------------------------------------
// API
// -----------------------------------------------------------------------------

/**
 * Send multiple REST requests in a single HTTP call.
 * Returns an array of individual responses (one per request, in order).
 */
export async function batchRequest(
  requests: BatchRequest[],
): Promise<BatchResponseItem[]> {
  const response = await request<BatchPayload>('/batch', {
    method: 'POST',
    body: { requests },
    baseUrl: TBC_CA_URL,
  });

  if (!response.success) {
    throw new Error(response.error?.message || 'Batch request failed');
  }

  return response.data.responses;
}

/**
 * Find a specific response in the batch results by path prefix.
 * Returns the body if status is 2xx, or null otherwise.
 */
export function findBatchResponse<T>(
  responses: BatchResponseItem[],
  pathPrefix: string,
): T | null {
  const item = responses.find((r) => r.path.startsWith(pathPrefix));
  if (!item || item.status < 200 || item.status >= 300) return null;
  return item.body as T;
}
