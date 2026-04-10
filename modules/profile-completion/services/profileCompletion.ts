// =============================================================================
// PROFILE COMPLETION API - Profile status and completion endpoints
// =============================================================================
// Moved from services/api/registration.ts into the profile-completion module.
// Uses authenticated requests via the JWT client.
// =============================================================================

import { TBC_CA_URL } from '@/constants/config';
import { request } from '@/services/api/client';
import { createLogger } from '@/utils/logger';

const log = createLogger('ProfileCompletionAPI');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ProfileExistingData {
  bio: string;
  website: string;
  social_links: Record<string, string>;
  avatar: string;
  cover_photo: string;
}

export interface ProfileStatusResponse {
  profile_complete: boolean;
  missing: string[];
  existing?: ProfileExistingData;
}

// -----------------------------------------------------------------------------
// API Functions
// -----------------------------------------------------------------------------

/**
 * GET /auth/register/status - Check if the user's profile is complete.
 * Used on login to decide whether to show the profile completion gate.
 */
export async function checkProfileComplete(): Promise<ProfileStatusResponse> {
  const result = await request<ProfileStatusResponse>('/auth/register/status', {
    method: 'GET',
    baseUrl: TBC_CA_URL,
  });

  if (result.success) {
    return result.data;
  }

  // Default to complete on error so we don't block users
  log.error(result.error, 'checkProfileComplete failed');
  return { profile_complete: true, missing: [] };
}

/**
 * POST /auth/register/complete - Mark the user's profile as complete.
 */
export async function completeRegistration(): Promise<boolean> {
  const result = await request<{ success: boolean }>('/auth/register/complete', {
    method: 'POST',
    baseUrl: TBC_CA_URL,
  });

  if (result.success) {
    return result.data.success;
  }

  log.error(result.error, 'completeRegistration failed');
  return false;
}
