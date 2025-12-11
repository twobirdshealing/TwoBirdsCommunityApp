// =============================================================================
// PROFILES API - Profile-related API calls
// =============================================================================

import { ENDPOINTS } from '@/constants/config';
import { Feed, Profile } from '@/types';
import { get, post } from './client';

// -----------------------------------------------------------------------------
// Get Profile by Username
// -----------------------------------------------------------------------------

export async function getProfile(username: string) {
  return get<{ profile: Profile }>(ENDPOINTS.PROFILE(username));
}

// -----------------------------------------------------------------------------
// Get User's Feeds/Posts
// -----------------------------------------------------------------------------

export async function getUserFeeds(username: string, page: number = 1, perPage: number = 20) {
  return get<{ feeds: { data: Feed[]; has_more: boolean } }>(
    ENDPOINTS.FEEDS,
    { user_id: username, page, per_page: perPage }
  );
}

// -----------------------------------------------------------------------------
// Get User's Spaces
// -----------------------------------------------------------------------------

export async function getUserSpaces(username: string) {
  return get<{ spaces: any[] }>(`${ENDPOINTS.PROFILE(username)}/spaces`);
}

// -----------------------------------------------------------------------------
// Get User's Comments
// Endpoint: GET /profile/{username}/comments?page=N&per_page=N
// Response: { comments: { data: [...], total: N, ... }, xprofile: {...} }
// -----------------------------------------------------------------------------

export async function getUserComments(username: string, page: number = 1, perPage: number = 10) {
  return get<any>(
    `${ENDPOINTS.PROFILE(username)}/comments`,
    { page, per_page: perPage }
  );
}

// -----------------------------------------------------------------------------
// Follow User
// -----------------------------------------------------------------------------

export async function followUser(username: string) {
  return post<{ message: string }>(`${ENDPOINTS.PROFILE(username)}/follow`);
}

// -----------------------------------------------------------------------------
// Unfollow User
// -----------------------------------------------------------------------------

export async function unfollowUser(username: string) {
  return post<{ message: string }>(`${ENDPOINTS.PROFILE(username)}/unfollow`);
}

// -----------------------------------------------------------------------------
// Get Followers
// -----------------------------------------------------------------------------

export async function getFollowers(username: string, page: number = 1) {
  return get<{ followers: any[] }>(`${ENDPOINTS.PROFILE(username)}/followers`, { page });
}

// -----------------------------------------------------------------------------
// Get Following
// -----------------------------------------------------------------------------

export async function getFollowing(username: string, page: number = 1) {
  return get<{ followings: any[] }>(`${ENDPOINTS.PROFILE(username)}/followings`, { page });
}

// -----------------------------------------------------------------------------
// Export as object for convenience (THIS IS WHAT WAS MISSING!)
// -----------------------------------------------------------------------------

export const profilesApi = {
  getProfile,
  getUserFeeds,
  getUserSpaces,
  getUserComments,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
};

export default profilesApi;