// =============================================================================
// PROFILES API - Profile-related API calls
// =============================================================================

import { ENDPOINTS } from '@/constants/config';
import { Feed } from '@/types/feed';
import { Profile, ProfileComment, XProfile } from '@/types/user';
import { Space } from '@/types/space';
import { get, post, put } from './client';

// -----------------------------------------------------------------------------
// Get Profile by Username
// -----------------------------------------------------------------------------

export async function getProfile(username: string) {
  return get<{ profile: Profile }>(ENDPOINTS.PROFILE(username));
}

// -----------------------------------------------------------------------------
// Get User's Feeds/Posts
// -----------------------------------------------------------------------------

export async function getUserFeeds(userId: number, page: number = 1, perPage: number = 20) {
  return get<{ feeds: { data: Feed[]; has_more: boolean; total: number } }>(
    ENDPOINTS.FEEDS,
    { user_id: userId, page, per_page: perPage }
  );
}

// -----------------------------------------------------------------------------
// Get User's Spaces
// -----------------------------------------------------------------------------

export async function getUserSpaces(username: string) {
  return get<{ spaces: Space[] }>(`${ENDPOINTS.PROFILE(username)}/spaces`);
}

// -----------------------------------------------------------------------------
// Get User's Comments
// -----------------------------------------------------------------------------

export async function getUserComments(username: string, page: number = 1, perPage: number = 20) {
  return get<{ comments: { data: ProfileComment[]; current_page: number; last_page: number; total: number } }>(
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

export async function getFollowers(username: string, page: number = 1, perPage: number = 20) {
  return get<{ followers: { data: { follower: XProfile & { follow?: string | null } }[]; next_page_url: string | null } }>(
    `${ENDPOINTS.PROFILE(username)}/followers`, { page, per_page: perPage }
  );
}

// -----------------------------------------------------------------------------
// Get Following
// -----------------------------------------------------------------------------

export async function getFollowing(username: string, page: number = 1, perPage: number = 20) {
  return get<{ followings: { data: { followed: XProfile & { follow?: string | null } }[]; next_page_url: string | null } }>(
    `${ENDPOINTS.PROFILE(username)}/followings`, { page, per_page: perPage }
  );
}

// -----------------------------------------------------------------------------
// Update Profile
// -----------------------------------------------------------------------------

export async function updateProfile(username: string, data: {
  user_id?: number;
  first_name?: string;
  last_name?: string;
  short_description?: string;
  website?: string;
  email?: string;
  username?: string;
  social_links?: Record<string, string>;
  custom_fields?: Record<string, any>;
  tbc_fp_session_key?: string;
  is_verified?: number;
  badge_slugs?: string[];
  status?: string;
}) {
  return post<{ profile: Profile }>(ENDPOINTS.PROFILE(username), { data });
}

// -----------------------------------------------------------------------------
// Patch Profile Media (avatar / cover photo via native PUT)
// -----------------------------------------------------------------------------

export async function patchProfileMedia(username: string, data: {
  avatar?: string;
  cover_photo?: string;
}) {
  return put<{ message: string }>(ENDPOINTS.PROFILE(username), { data });
}

// -----------------------------------------------------------------------------
// Block User
// -----------------------------------------------------------------------------

export async function blockUser(username: string) {
  return post<{ follow: { status: string } | null; xprofile: XProfile }>(
    `${ENDPOINTS.PROFILE(username)}/block`
  );
}

// -----------------------------------------------------------------------------
// Unblock User
// -----------------------------------------------------------------------------

export async function unblockUser(username: string) {
  return post<{ message: string }>(
    `${ENDPOINTS.PROFILE(username)}/unblock`
  );
}

// -----------------------------------------------------------------------------
// Export as object for convenience
// -----------------------------------------------------------------------------

export const profilesApi = {
  getProfile,
  updateProfile,
  patchProfileMedia,
  getUserFeeds,
  getUserSpaces,
  getUserComments,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  blockUser,
  unblockUser,
};

export default profilesApi;
