// =============================================================================
// USER TYPES - TypeScript definitions for user-related data
// =============================================================================
// These types match the Fluent Community API response structure.
// Having proper types helps catch errors and enables autocomplete in Cursor.
// =============================================================================

// -----------------------------------------------------------------------------
// XProfile - The user profile object included in feeds, comments, etc.
// -----------------------------------------------------------------------------

export interface XProfile {
  user_id: number;
  username: string;
  display_name: string;
  avatar: string | null;
  short_description: string | null;
  total_points: number;
  is_verified: number;  // 0 or 1
  status: 'active' | 'suspended' | 'banned';
  created_at: string;
  
  // Extended metadata
  meta?: {
    website?: string;
    cover_photo?: string;
    bio?: string;
    social_links?: Record<string, string>;
    badge_slug?: string[];
  };

  // Badge info if assigned
  badge?: Badge | null;
}

// -----------------------------------------------------------------------------
// Custom Profile Fields — FC Native (custom_field_groups)
// -----------------------------------------------------------------------------

/** A single field within a custom_field_groups group */
export interface NativeCustomField {
  slug: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'radio' | 'url' | 'multiselect';
  placeholder: string;
  options: string[];
  is_required: boolean;
  is_enabled: boolean;
  privacy: 'public' | 'logged_in' | 'private' | 'internal';
  group: string;
  value?: string | string[];
}

/** A group of custom fields returned by FC Pro */
export interface CustomFieldGroup {
  slug: string;
  label: string;
  edit_description?: string;
  is_system?: boolean;
  fields: NativeCustomField[];
}

// Legacy types (kept for backwards compatibility with old API responses)
export interface CustomFieldValue {
  value: string;
  label: string;
  type: string;
  visibility: string;
}

export interface CustomFieldConfig {
  label: string;
  type: string;
  placeholder: string;
  instructions: string;
  required: boolean;
  options: string[];
  visibility: string;
  allow_user_override: boolean;
}

// -----------------------------------------------------------------------------
// Full Profile - What you get from /profile/{username}
// -----------------------------------------------------------------------------

export interface Profile extends XProfile {
  first_name?: string;
  last_name?: string;
  email?: string;
  cover_photo?: string;
  
  // Extended stats
  compilation_score?: number;
  followers_count?: number;
  followings_count?: number;
  last_activity?: string;

  // Follow status (injected by FollowHandler): level > 0 = current user follows this profile
  follow?: number;

  // Block status (injected by BlockHandler): true if current user has blocked this profile
  is_blocked_by_you?: boolean;
  
  // Privacy (FC 2.2.01+): true when profile_page_visibility restricts access
  is_restricted?: boolean;

  // Permissions
  can_change_username?: boolean;
  can_change_email?: boolean;
  canViewUserSpaces?: boolean;
  
  // Navigation items
  profile_navs?: ProfileNav[];
  profile_nav_actions?: unknown[];

  // Top-level social links (profile endpoint returns these at root, not in meta)
  social_links?: Record<string, string>;

  // Website at top level (profile endpoint)
  website?: string;

  // Badge slugs (top-level on profile endpoint, vs meta.badge_slug on xprofile)
  badge_slugs?: string[];

  // FC native custom profile fields (2.3.0+)
  custom_field_groups?: CustomFieldGroup[];

  // Legacy custom profile fields (pre-3.0 tbc-registration — kept for backwards compat)
  custom_fields?: Record<string, CustomFieldValue>;
  custom_field_configs?: Record<string, CustomFieldConfig>;
}

// -----------------------------------------------------------------------------
// Profile Navigation Tab
// -----------------------------------------------------------------------------

export interface ProfileNav {
  slug: string;
  title: string;
  url: string;
  route?: {
    name: string;
  };
}

// -----------------------------------------------------------------------------
// Badge
// -----------------------------------------------------------------------------

export interface Badge {
  slug: string;
  title: string;
  color?: string;
  background_color?: string;
  show_label?: string;
  config?: {
    shape_svg?: string;
    emoji?: string;
    logo?: string;
  };
}

// -----------------------------------------------------------------------------
// Profile Comment - What you get from /profile/{username}/comments
// -----------------------------------------------------------------------------

export interface ProfileComment {
  id: number;
  user_id: string | number;
  post_id: string | number;
  parent_id: number | null;
  reactions_count: string | number;
  message: string;
  message_rendered: string;
  meta: Record<string, any>;
  type: string;
  content_type: string;
  status: string;
  is_sticky: number;
  created_at: string;
  updated_at: string;
  post: {
    id: number;
    title: string | null;
    message: string;
    type: string;
    space_id: string | number;
    slug: string;
    created_at: string;
    permalink: string;
    space?: { id: number; title: string; slug: string; type: string };
  };
}

// -----------------------------------------------------------------------------
// Auth User - Shared between auth service and AuthContext
// -----------------------------------------------------------------------------

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  avatar?: string;
  isVerified?: number;
  status?: string;
}
