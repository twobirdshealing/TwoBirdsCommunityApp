// =============================================================================
// ACCOUNT API - Account deactivation & deletion
// =============================================================================
// Endpoints are on the TBC-CA plugin (/tbc-ca/v1/account/*)
// JWT auth + silent refresh handled automatically by client.ts.
// =============================================================================

import { TBC_CA_URL } from '@/constants/config';
import { request, type ApiResponse } from './client';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface AccountResponse {
  success: boolean;
  message: string;
}

// -----------------------------------------------------------------------------
// API Functions
// -----------------------------------------------------------------------------

/**
 * Deactivate the current user's profile (soft, reversible via web portal).
 */
export async function deactivateAccount(): Promise<ApiResponse<AccountResponse>> {
  return request<AccountResponse>('/account/deactivate', {
    method: 'POST',
    baseUrl: TBC_CA_URL,
  }) as Promise<ApiResponse<AccountResponse>>;
}

/**
 * Permanently delete the current user's account and all data.
 * Requires explicit "DELETE" confirmation string.
 */
export async function deleteAccount(): Promise<ApiResponse<AccountResponse>> {
  return request<AccountResponse>('/account/delete', {
    method: 'DELETE',
    body: { confirm: 'DELETE' },
    baseUrl: TBC_CA_URL,
  }) as Promise<ApiResponse<AccountResponse>>;
}
