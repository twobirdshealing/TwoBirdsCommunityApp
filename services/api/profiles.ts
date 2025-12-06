// =============================================================================
// PROFILES API - All profile-related API calls
// =============================================================================
// This service handles fetching user profiles and member lists.
// =============================================================================

import { get, put } from './client';
import { ENDPOINTS, DEFAULT_PER_PAGE } from '@/constants/config';
import { Profile, Member } from '@/types';

// -----------------------------------------------------------------------------
// Get User Profile by Username
// -----------------------------------------------------------------------------

export async function getProfile(username: string) {
  return get<{ profile: Profile }>(ENDPOINTS.PROFILE(username));
}

// -----------------------------------------------------------------------------
// Get Current User's Profile
// -----------------------------------------------------------------------------

export async function getMyProfile() {
  return get<{ profile: Profile }>(ENDPOINTS.MY_PROFILE);
}

// -----------------------------------------------------------------------------
// Update Current User's Profile (Phase 3)
// -----------------------------------------------------------------------------

export interface UpdateProfileData {
  display_name?: string;
  first_name?: string;
  last_name?: string;
  bio?: string;
  location?: string;
  website?: string;
  social_links?: {
    twitter?: string;
    linkedin?: string;
    youtube?: string;
    fb?: string;
    instagram?: string;
  };
  avatar?: string;
  cover_photo?: string;
}

export async function updateProfile(data: UpdateProfileData) {
  return put<{ message: string; data: Profile }>(ENDPOINTS.MY_PROFILE, data);
}

// -----------------------------------------------------------------------------
// Get User's Feeds (posts by this user)
// -----------------------------------------------------------------------------

export async function getUserFeeds(username: string, options: { page?: number; per_page?: number } = {}) {
  const params = {
    username,
    page: options.page || 1,
    per_page: options.per_page || DEFAULT_PER_PAGE,
  };
  
  return get<any>(ENDPOINTS.FEEDS, params);
}

// -----------------------------------------------------------------------------
// Get User's Comments
// -----------------------------------------------------------------------------

export async function getUserComments(username: string, options: { page?: number; per_page?: number } = {}) {
  const params = {
    page: options.page || 1,
    per_page: options.per_page || DEFAULT_PER_PAGE,
  };
  
  return get<any>(`${ENDPOINTS.PROFILE(username)}/comments`, params);
}

// -----------------------------------------------------------------------------
// Get User's Spaces
// -----------------------------------------------------------------------------

export async function getUserSpaces(username: string) {
  return get<any>(`${ENDPOINTS.PROFILE(username)}/spaces`);
}

// -----------------------------------------------------------------------------
// Get All Members (Community Directory)
// -----------------------------------------------------------------------------

export interface GetMembersOptions {
  page?: number;
  per_page?: number;
  role?: string;
  status?: 'active' | 'suspended' | 'banned';
  orderby?: 'created_at' | 'display_name' | 'last_seen';
  order?: 'asc' | 'desc';
  space_id?: number;
  search?: string;
}

export async function getMembers(options: GetMembersOptions = {}) {
  const params = {
    page: options.page || 1,
    per_page: options.per_page || DEFAULT_PER_PAGE,
    ...(options.role && { role: options.role }),
    ...(options.status && { status: options.status }),
    ...(options.orderby && { orderby: options.orderby }),
    ...(options.order && { order: options.order }),
    ...(options.space_id && { space_id: options.space_id }),
    ...(options.search && { search: options.search }),
  };
  
  return get<{ members: { data: Member[]; total: number; per_page: number; current_page: number } }>(
    ENDPOINTS.MEMBERS, 
    params
  );
}

// -----------------------------------------------------------------------------
// Search Members
// -----------------------------------------------------------------------------

export async function searchMembers(query: string, options: { per_page?: number } = {}) {
  return getMembers({
    search: query,
    per_page: options.per_page || 10,
  });
}

// -----------------------------------------------------------------------------
// Get Active Members (online now)
// -----------------------------------------------------------------------------

export async function getActiveMembers(options: { per_page?: number; minutes?: number } = {}) {
  const params = {
    per_page: options.per_page || 10,
    ...(options.minutes && { minutes: options.minutes }),
  };
  
  return get<any>(`${ENDPOINTS.MEMBERS}/active`, params);
}

// -----------------------------------------------------------------------------
// Get New Members (recently joined)
// -----------------------------------------------------------------------------

export async function getNewMembers(options: { per_page?: number; days?: number } = {}) {
  const params = {
    per_page: options.per_page || 10,
    ...(options.days && { days: options.days }),
  };
  
  return get<any>(`${ENDPOINTS.MEMBERS}/new`, params);
}

// -----------------------------------------------------------------------------
// Export as object
// -----------------------------------------------------------------------------

export const profilesApi = {
  getProfile,
  getMyProfile,
  updateProfile,
  getUserFeeds,
  getUserComments,
  getUserSpaces,
  getMembers,
  searchMembers,
  getActiveMembers,
  getNewMembers,
};

export default profilesApi;
