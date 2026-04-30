// =============================================================================
// GROUPS API - Group thread management (Fluent Messaging 2.4.0+)
// =============================================================================
// All 8 endpoints under /chat/groups. Site-moderator + group-admin permissions
// are enforced server-side; the UI gates buttons but the server is authoritative.
// =============================================================================

import { ENDPOINTS } from '@/constants/config';
import type {
  AddGroupMembersRequest,
  CreateGroupRequest,
  CreateGroupResponse,
  GroupMembersResponse,
  GroupMutationResponse,
  SetGroupAdminRequest,
  UpdateGroupRequest,
} from '@/types/message';
import { get, post } from './client';
import { createLogger } from '@/utils/logger';

const log = createLogger('GroupsAPI');

// -----------------------------------------------------------------------------
// Create Group (site moderator only)
// -----------------------------------------------------------------------------

export async function createGroup(data: CreateGroupRequest) {
  log.debug('createGroup', { title: data.title, memberCount: data.member_ids.length });
  return post<CreateGroupResponse>(ENDPOINTS.CHAT_GROUPS, data);
}

// -----------------------------------------------------------------------------
// Update Group (group admin only) — title and/or icon
// -----------------------------------------------------------------------------

export async function updateGroup(threadId: number, data: UpdateGroupRequest) {
  log.debug('updateGroup', { threadId, fields: Object.keys(data) });
  return post<GroupMutationResponse>(ENDPOINTS.CHAT_GROUP_BY_ID(threadId), data);
}

// -----------------------------------------------------------------------------
// Delete Group (group admin only)
// -----------------------------------------------------------------------------

export async function deleteGroup(threadId: number) {
  log.debug('deleteGroup', { threadId });
  return post<GroupMutationResponse>(ENDPOINTS.CHAT_GROUP_DELETE(threadId), {});
}

// -----------------------------------------------------------------------------
// Leave Group (any active member)
// -----------------------------------------------------------------------------

export async function leaveGroup(threadId: number) {
  log.debug('leaveGroup', { threadId });
  return post<GroupMutationResponse>(ENDPOINTS.CHAT_GROUP_LEAVE(threadId), {});
}

// -----------------------------------------------------------------------------
// Get Group Members (any active member)
// -----------------------------------------------------------------------------

export async function getGroupMembers(threadId: number) {
  return get<GroupMembersResponse>(ENDPOINTS.CHAT_GROUP_MEMBERS(threadId));
}

// -----------------------------------------------------------------------------
// Add Group Members (group admin only)
// -----------------------------------------------------------------------------

export async function addGroupMembers(threadId: number, memberIds: number[]) {
  log.debug('addGroupMembers', { threadId, count: memberIds.length });
  const body: AddGroupMembersRequest = { member_ids: memberIds };
  return post<GroupMutationResponse>(ENDPOINTS.CHAT_GROUP_MEMBERS(threadId), body);
}

// -----------------------------------------------------------------------------
// Remove Group Member (group admin only — cannot self-remove; use leaveGroup)
// -----------------------------------------------------------------------------

export async function removeGroupMember(threadId: number, memberId: number) {
  log.debug('removeGroupMember', { threadId, memberId });
  return post<GroupMutationResponse>(
    ENDPOINTS.CHAT_GROUP_MEMBER_REMOVE(threadId, memberId),
    {}
  );
}

// -----------------------------------------------------------------------------
// Set Group Admin (group admin only) — promote (true) or demote (false)
// -----------------------------------------------------------------------------

export async function setGroupAdmin(threadId: number, memberId: number, isAdmin: boolean) {
  log.debug('setGroupAdmin', { threadId, memberId, isAdmin });
  const body: SetGroupAdminRequest = { is_admin: isAdmin };
  return post<GroupMutationResponse>(
    ENDPOINTS.CHAT_GROUP_MEMBER_ADMIN(threadId, memberId),
    body
  );
}

// -----------------------------------------------------------------------------
// Export as object
// -----------------------------------------------------------------------------

export const groupsApi = {
  createGroup,
  updateGroup,
  deleteGroup,
  leaveGroup,
  getGroupMembers,
  addGroupMembers,
  removeGroupMember,
  setGroupAdmin,
};

export default groupsApi;
