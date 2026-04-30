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
  description_rendered?: string | null;
  type: SpaceType;
  privacy: 'public' | 'private' | 'secret';
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

  // User's relationship (from discover endpoint)
  space_pivot?: {
    id: number;
    space_id: string;
    user_id: string;
    status: 'active' | 'pending' | 'banned';
    role: 'member' | 'moderator' | 'admin';
    meta: unknown[];
    created_at: string;
    updated_at: string | null;
  } | null;
  
  // Creator info (from detail endpoint)
  creator?: {
    id: number;
    username: string;
    display_name: string;
  };

  // Detail endpoint only — not present in list responses.
  // Computed by FluentCommunity's FeedsHelper based on space settings + user role.
  // Index signature kept open because FC may add new permission keys over time.
  permissions?: {
    can_view_documents?: boolean;
    can_upload_documents?: boolean;
    [key: string]: boolean | undefined;
  };
  membership?: {
    ID: number;
    display_name: string;
    pivot: {
      space_id: string;
      user_id: string;
      role: 'member' | 'moderator' | 'admin';
      status: 'active' | 'pending';
      created_at: string;
    };
  };
  topics?: Record<string, unknown>[];
  header_links?: { title: string; route: { name: string } }[];

  // Group chat thread ID — present when the space has chat enabled
  // (settings.group_chat_support === 'yes' AND the chat thread was created).
  // Used to deep-link from the space gear menu's "Chat" item to /messages/space/{id}.
  chat_thread_id?: number | null;

  // Lock screen config — returned for non-members of private spaces
  lockscreen_config?: LockScreenConfig | null;
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
  links?: Record<string, unknown>[];
  topic_required?: 'yes' | 'no';
  hide_members_count?: 'yes' | 'no';
  members_page_status?: 'public' | 'private' | 'members_only';
  show_paywalls?: 'yes' | 'no';
  document_library?: 'yes' | 'no';
  document_access?: 'members_only' | 'public';
  document_upload?: 'members_only' | 'admin_only';
  group_chat_support?: 'yes' | 'no';
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
// Lock Screen Config — returned for non-members of private spaces
// -----------------------------------------------------------------------------

export interface LockScreenConfig {
  showCustom: boolean;
  showPaywalls: boolean;
  canSendRequest: boolean;
  lockScreen: LockScreenBlock[] | null;
  redirect_url: string;
  is_pending?: boolean;
}

export interface LockScreenBlock {
  hidden: boolean;
  type: 'image' | 'block' | 'lesson';
  label: string;
  name: string;
  // type: 'image' fields (Banner / Call to Action)
  heading?: string;
  heading_color?: string;
  description?: string;
  text_color?: string;
  button_text?: string;
  button_link?: string;
  button_color?: string;
  button_text_color?: string;
  background_image?: string;
  overlay_color?: string;
  new_tab?: 'yes' | 'no';
  // type: 'block' fields (Description)
  content?: string;
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
  space: Space;
}

// Response from GET /spaces/space_groups
export interface SpaceGroupsResponse {
  groups: SpaceGroup[];
  orphaned_spaces: Space[];
}

// Lightweight group info from GET /spaces/space_groups?options_only=1
export interface SpaceGroupOption {
  id: number;
  title: string;
}

export interface SpaceGroupOptionsResponse {
  groups: SpaceGroupOption[];
}

// Response from GET /spaces/discover (paginated)
export interface DiscoverSpacesResponse {
  spaces: {
    current_page: number;
    data: Space[];
    total: number;
    per_page: number;
    last_page: number;
  };
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

// Response from GET /members and GET /spaces/{slug}/members (paginated list)
export interface MembersListResponse {
  members: {
    data: SpaceMember[];
    current_page?: number;
    per_page?: number;
    total?: number;
    next_page_url?: string | null;
  };
  current_user_follows?: Record<number, number>;
  meta?: {
    total?: number;
  };
}
