// =============================================================================
// MEMBERS API - Global community member directory
// =============================================================================

import { DEFAULT_PER_PAGE, ENDPOINTS } from '@/constants/config';
import { get } from './client';

// -----------------------------------------------------------------------------
// Request Options
// -----------------------------------------------------------------------------

export interface GetMembersOptions {
  page?: number;
  per_page?: number;
  sort_by?: 'created_at' | 'last_activity' | 'display_name';
  search?: string;
}

// -----------------------------------------------------------------------------
// Get Members (Global Directory)
// -----------------------------------------------------------------------------

export async function getMembers(options: GetMembersOptions = {}) {
  const params = {
    page: options.page || 1,
    per_page: options.per_page || DEFAULT_PER_PAGE,
    sort_by: options.sort_by || 'created_at',
    status: 'active',
    ...(options.search && { search: options.search }),
  };

  return get<any>(ENDPOINTS.MEMBERS, params);
}

// -----------------------------------------------------------------------------
// Export as object
// -----------------------------------------------------------------------------

export const membersApi = {
  getMembers,
};

export default membersApi;
