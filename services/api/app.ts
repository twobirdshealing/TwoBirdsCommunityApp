// =============================================================================
// APP API SERVICE - TBC Community App specific endpoints
// =============================================================================
// Web session creation for WebView authentication
// JWT auth + silent refresh handled automatically by client.ts.
// =============================================================================

import { TBC_CA_URL } from '@/constants/config';
import { request } from './client';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface WebSessionResponse {
  success: boolean;
  url: string;
  expires_in: number;
}

// -----------------------------------------------------------------------------
// Create Web Session
// -----------------------------------------------------------------------------

/**
 * Create a one-time login URL for WebView
 * The URL will automatically log the user in when opened
 *
 * @param redirectUrl - Where to redirect after login
 */
export async function createWebSession(redirectUrl: string): Promise<WebSessionResponse> {
  const result = await request<WebSessionResponse>('/create-web-session', {
    method: 'POST',
    body: { redirect_url: redirectUrl },
    baseUrl: TBC_CA_URL,
  });

  if (!result.success) {
    throw new Error(result.error.message || 'Failed to create web session');
  }

  return result.data;
}

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const appApi = {
  createWebSession,
};

export default appApi;
