// =============================================================================
// SPACE THREADS API - Community-space chat join / leave / members
// =============================================================================
// Community-space threads are the chats inside a Space. They live alongside
// DMs and group threads in the inbox. The plugin already supports them
// server-side; this module just wraps the three endpoints the app needs.
// =============================================================================

import { ENDPOINTS } from '@/constants/config';
import type { GroupMember } from '@/types/message';
import { get, post } from './client';
import { createLogger } from '@/utils/logger';

const log = createLogger('SpaceThreadsAPI');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface SpaceThreadMembersResponse {
  members: {
    data: GroupMember[];
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
    from: number | null;
    to: number | null;
  };
}

// -----------------------------------------------------------------------------
// Endpoint paths — derived from the existing CHAT_THREADS prefix.
// (No new entries needed in config-core.ts; these are sub-paths.)
// -----------------------------------------------------------------------------

const join = (threadId: number) => `${ENDPOINTS.CHAT_THREADS}/join/${threadId}`;
const leave = (threadId: number) => `${ENDPOINTS.CHAT_THREADS}/leave/${threadId}`;
const members = (threadId: number) => `${ENDPOINTS.CHAT_THREADS}/${threadId}/members`;

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/** Join a community-space thread the user has access to. */
export async function joinSpaceThread(threadId: number) {
  log.debug('joinSpaceThread', { threadId });
  return post(join(threadId), {});
}

/** Leave a community-space thread (moves it into left_community_threads). */
export async function leaveSpaceThread(threadId: number) {
  log.debug('leaveSpaceThread', { threadId });
  return post(leave(threadId), {});
}

/** Paginated members listing for a community-space thread. */
export async function getSpaceThreadMembers(threadId: number, page?: number) {
  return get<SpaceThreadMembersResponse>(
    members(threadId),
    page ? { page } : undefined
  );
}

export const spaceThreadsApi = {
  joinSpaceThread,
  leaveSpaceThread,
  getSpaceThreadMembers,
};

export default spaceThreadsApi;
