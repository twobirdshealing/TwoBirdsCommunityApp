// =============================================================================
// SPACES API - All space/group-related API calls
// =============================================================================

import { ENDPOINTS } from '@/constants/config';
import { JoinSpaceResponse, SpaceDetailResponse, SpaceGroupsResponse, SpacesResponse } from '@/types';
import { get, post } from './client';

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

// FIXED: Don't add default pagination - let API return all spaces
export async function getSpaces(options: GetSpacesOptions = {}) {
  const params: Record<string, any> = {};
  
  // Only add params if explicitly provided
  if (options.page !== undefined) params.page = options.page;
  if (options.per_page !== undefined) params.per_page = options.per_page;
  if (options.type) params.type = options.type;
  if (options.privacy) params.privacy = options.privacy;
  if (options.status) params.status = options.status;
  if (options.parent_id) params.parent_id = options.parent_id;
  if (options.search) params.search = options.search;
  if (options.orderby) params.orderby = options.orderby;
  if (options.order) params.order = options.order;
  
  return get<SpacesResponse>(ENDPOINTS.SPACES, params);
}

export async function getSpaceBySlug(slug: string) {
  return get<SpaceDetailResponse>(ENDPOINTS.SPACE_BY_SLUG(slug));
}

export async function getSpaceById(id: number) {
  return get<SpaceDetailResponse>(ENDPOINTS.SPACE_BY_ID(id));
}

export async function getSpaceGroups(options: { with_spaces?: boolean; include_empty?: boolean } = {}) {
  const params = {
    with_spaces: options.with_spaces !== false,
    ...(options.include_empty && { include_empty: options.include_empty }),
  };
  
  return get<SpaceGroupsResponse>(`${ENDPOINTS.SPACES}/space_groups`, params);
}

export async function discoverSpaces(options: { search?: string; page?: number; per_page?: number } = {}) {
  const params: Record<string, any> = {};
  if (options.page !== undefined) params.page = options.page;
  if (options.per_page !== undefined) params.per_page = options.per_page;
  if (options.search) params.search = options.search;
  
  return get<SpacesResponse>(`${ENDPOINTS.SPACES}/discover`, params);
}

export async function joinSpace(spaceSlug: string) {
  return post<JoinSpaceResponse>(`${ENDPOINTS.SPACES}/${spaceSlug}/join`);
}

export async function leaveSpace(spaceSlug: string) {
  return post<{ message: string }>(`${ENDPOINTS.SPACES}/${spaceSlug}/leave`);
}

export async function getSpaceMembers(
  spaceSlug: string, 
  options: { page?: number; per_page?: number; role?: string; status?: string; search?: string } = {}
) {
  const params: Record<string, any> = {};
  if (options.page !== undefined) params.page = options.page;
  if (options.per_page !== undefined) params.per_page = options.per_page;
  if (options.role) params.role = options.role;
  if (options.status) params.status = options.status;
  if (options.search) params.search = options.search;
  
  return get<any>(`${ENDPOINTS.SPACES}/${spaceSlug}/members`, params);
}

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
