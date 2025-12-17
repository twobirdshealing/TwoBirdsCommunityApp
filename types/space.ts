// =============================================================================
// SPACE TYPES - TypeScript definitions for space/group data
// =============================================================================
// Based on Fluent Community Spaces API documentation
// Updated to include 'secret' privacy level
// =============================================================================

import { XProfile } from './user';

// -----------------------------------------------------------------------------
// Space - A group/channel in the community
// -----------------------------------------------------------------------------

export interface Space {
  id: number;
  created_by: string | number;
  parent_id: number | string | null;
  title: string;
  slug: string;
  logo: string | null;
  cover_photo: string | null;
  description: string | null;
  type: SpaceType;
  privacy: 'public' | 'private' | 'secret';  // ✅ UPDATED: Added 'secret'
  status: 'published' | 'draft' | 'archived';
  serial: string | number;
  settings: SpaceSettings;
  created_at: string;
  updated_at: string;
  
  // Stats (from detail endpoint or profile endpoint)
  members_count?: number;
  posts_count?: number;
  
  // Current user's relationship to this space (from detail endpoint)
  is_member?: boolean;
  role?: 'member' | 'moderator' | 'admin';
  
  // User's relationship (from profile endpoint)
  pivot?: {
    user_id: string;
    space_id: string;
    role: 'member' | 'moderator' | 'admin';
    status: 'active' | 'pending' | 'banned';
    created_at: string;
  };
  
  // Creator info (from detail endpoint)
  creator?: {
    id: number;
    username: string;
    display_name: string;
  };
}

// -----------------------------------------------------------------------------
// Space Type
// -----------------------------------------------------------------------------

export type SpaceType =
  | 'community'      // Regular community space
  | 'discussion'     // Discussion group
  | 'announcement';  // Announcement channel

// -----------------------------------------------------------------------------
// Space Settings
// -----------------------------------------------------------------------------

export interface SpaceSettings {
  restricted_post_only?: 'yes' | 'no';
  emoji?: string;
  shape_svg?: string;
  custom_lock_screen?: 'yes' | 'no';
  can_request_join?: 'yes' | 'no';
  layout_style?: 'timeline' | 'grid';
  show_sidebar?: 'yes' | 'no';
  og_image?: string;
  links?: any[];
  topic_required?: 'yes' | 'no';
  hide_members_count?: 'yes' | 'no';
  members_page_status?: 'public' | 'private' | 'members_only';
  show_paywalls?: 'yes' | 'no';
  document_library?: 'yes' | 'no';
  document_access?: 'members_only' | 'public';
  document_upload?: 'members_only' | 'admin_only';
  disable_post_sort_by?: 'yes' | 'no';
  default_post_sort_by?: string;
  onboard_redirect_url?: string;
  
  // Additional settings for functionality
  allow_posts?: boolean;
  require_approval?: boolean;
  post_permissions?: string[];
  allow_comments?: boolean;
  allow_reactions?: boolean;
}

// -----------------------------------------------------------------------------
// Space Group - Organizes spaces into categories
// -----------------------------------------------------------------------------

export interface SpaceGroup {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  serial: number;
  settings: {
    is_collapsible?: boolean;
    default_collapsed?: boolean;
  };
  spaces_count: number;
  created_at: string;
  updated_at: string;
  
  // Spaces in this group (when fetched with with_spaces=true)
  spaces?: Space[];
}

// -----------------------------------------------------------------------------
// Space Member
// -----------------------------------------------------------------------------

export interface SpaceMember {
  id: number;
  space_id: number;
  user_id: number;
  role: 'member' | 'moderator' | 'admin';
  status: 'active' | 'pending' | 'banned';
  joined_at: string;
  updated_at: string;
  xprofile: XProfile;
}

// -----------------------------------------------------------------------------
// API Response Types
// -----------------------------------------------------------------------------

// Response from GET /spaces
export interface SpacesResponse {
  spaces: Space[];
}

// Response from GET /spaces/{slug}/by-slug
export interface SpaceDetailResponse {
  data: Space;
}

// Response from GET /spaces/space_groups
export interface SpaceGroupsResponse {
  groups: SpaceGroup[];
  orphaned_spaces: Space[];
}

// Response from POST /spaces/{slug}/join
export interface JoinSpaceResponse {
  message: string;
  data: {
    space_id: number;
    user_id: number;
    role: string;
    joined_at?: string;
    status?: 'pending';
  };
}

// Response from GET /spaces/{slug}/members
export interface SpaceMembersResponse {
  data: SpaceMember[];
  meta: {
    total: number;
    per_page: number;
    current_page: number;
    total_pages: number;
  };
}
