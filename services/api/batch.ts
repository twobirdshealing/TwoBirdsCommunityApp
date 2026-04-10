// =============================================================================
// BATCH API - Combine multiple REST requests into a single HTTP call
// =============================================================================
// Sends an array of REST paths to POST /tbc-ca/v1/batch.
// The server dispatches each internally and returns all responses at once.
// =============================================================================

import { TBC_CA_URL } from '@/constants/config';
import { request, ApiResponse } from './client';
import { createLogger } from '@/utils/logger';

const log = createLogger('BatchAPI');

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
  log.debug('batch request', { count: requests.length, paths: requests.map(r => r.path) });
  const response = await request<BatchPayload>('/batch', {
    method: 'POST',
    body: { requests },
    baseUrl: TBC_CA_URL,
  });

  if (!response.success) {
    log.error(response.error?.message, 'batch failed');
    throw new Error(response.error?.message || 'Batch request failed');
  }

  const failures = response.data.responses.filter(r => r.status >= 400);
  if (failures.length) {
    log.warn('partial batch failure', {
      count: failures.length,
      failures: failures.map(f => `${f.path} (${f.status})`),
    });
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
