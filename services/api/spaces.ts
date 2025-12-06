// =============================================================================
// SPACES API - All space/group-related API calls
// =============================================================================
// This service handles fetching and managing community spaces.
// =============================================================================

import { get, post, put, del } from './client';
import { ENDPOINTS, DEFAULT_PER_PAGE } from '@/constants/config';
import { Space, SpacesResponse, SpaceDetailResponse, SpaceGroupsResponse, JoinSpaceResponse } from '@/types';

// -----------------------------------------------------------------------------
// Request Options
// -----------------------------------------------------------------------------

export interface GetSpacesOptions {
  page?: number;
  per_page?: number;
  type?: string;
  privacy?: 'public' | 'private';
  status?: 'published' | 'draft' | 'archived';
  parent_id?: number;
  search?: string;
  orderby?: 'serial' | 'title' | 'created_at';
  order?: 'asc' | 'desc';
}

// -----------------------------------------------------------------------------
// Get All Spaces
// -----------------------------------------------------------------------------

export async function getSpaces(options: GetSpacesOptions = {}) {
  const params = {
    page: options.page || 1,
    per_page: options.per_page || DEFAULT_PER_PAGE,
    ...(options.type && { type: options.type }),
    ...(options.privacy && { privacy: options.privacy }),
    ...(options.status && { status: options.status }),
    ...(options.parent_id && { parent_id: options.parent_id }),
    ...(options.search && { search: options.search }),
    ...(options.orderby && { orderby: options.orderby }),
    ...(options.order && { order: options.order }),
  };
  
  return get<SpacesResponse>(ENDPOINTS.SPACES, params);
}

// -----------------------------------------------------------------------------
// Get Space by Slug
// -----------------------------------------------------------------------------

export async function getSpaceBySlug(slug: string) {
  return get<SpaceDetailResponse>(ENDPOINTS.SPACE_BY_SLUG(slug));
}

// -----------------------------------------------------------------------------
// Get Space by ID
// -----------------------------------------------------------------------------

export async function getSpaceById(id: number) {
  return get<SpaceDetailResponse>(ENDPOINTS.SPACE_BY_ID(id));
}

// -----------------------------------------------------------------------------
// Get Space Groups (with nested spaces)
// -----------------------------------------------------------------------------

export async function getSpaceGroups(options: { with_spaces?: boolean; include_empty?: boolean } = {}) {
  const params = {
    with_spaces: options.with_spaces !== false,  // Default true
    ...(options.include_empty && { include_empty: options.include_empty }),
  };
  
  return get<SpaceGroupsResponse>(`${ENDPOINTS.SPACES}/space_groups`, params);
}

// -----------------------------------------------------------------------------
// Discover Public Spaces
// -----------------------------------------------------------------------------

export async function discoverSpaces(options: { search?: string; page?: number; per_page?: number } = {}) {
  const params = {
    page: options.page || 1,
    per_page: options.per_page || DEFAULT_PER_PAGE,
    ...(options.search && { search: options.search }),
  };
  
  return get<SpacesResponse>(`${ENDPOINTS.SPACES}/discover`, params);
}

// -----------------------------------------------------------------------------
// Join a Space
// -----------------------------------------------------------------------------

export async function joinSpace(spaceSlug: string) {
  return post<JoinSpaceResponse>(`${ENDPOINTS.SPACES}/${spaceSlug}/join`);
}

// -----------------------------------------------------------------------------
// Leave a Space
// -----------------------------------------------------------------------------

export async function leaveSpace(spaceSlug: string) {
  return post<{ message: string }>(`${ENDPOINTS.SPACES}/${spaceSlug}/leave`);
}

// -----------------------------------------------------------------------------
// Get Space Members
// -----------------------------------------------------------------------------

export async function getSpaceMembers(
  spaceSlug: string, 
  options: { page?: number; per_page?: number; role?: string; status?: string; search?: string } = {}
) {
  const params = {
    page: options.page || 1,
    per_page: options.per_page || DEFAULT_PER_PAGE,
    ...(options.role && { role: options.role }),
    ...(options.status && { status: options.status }),
    ...(options.search && { search: options.search }),
  };
  
  return get<any>(`${ENDPOINTS.SPACES}/${spaceSlug}/members`, params);
}

// -----------------------------------------------------------------------------
// Export as object
// -----------------------------------------------------------------------------

export const spacesApi = {
  getSpaces,
  getSpaceBySlug,
  getSpaceById,
  getSpaceGroups,
  discoverSpaces,
  joinSpace,
  leaveSpace,
  getSpaceMembers,
};

export default spacesApi;
