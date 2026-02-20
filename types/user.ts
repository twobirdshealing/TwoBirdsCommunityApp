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
    social_links?: {
      instagram?: string;
      youtube?: string;
      fb?: string;
      blue_sky?: string;
      reddit?: string;
    };
    badge_slug?: string[];
  };
  
  // Badge info if assigned
  badge?: Badge | null;
}

// -----------------------------------------------------------------------------
// Custom Profile Fields (injected by tbc-fluent-profiles plugin)
// -----------------------------------------------------------------------------

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
  profile_nav_actions?: any[];

  // Top-level social links (profile endpoint returns these at root, not in meta)
  social_links?: {
    instagram?: string;
    youtube?: string;
    fb?: string;
    blue_sky?: string;
    reddit?: string;
  };

  // Website at top level (profile endpoint)
  website?: string;

  // Badge slugs (top-level on profile endpoint, vs meta.badge_slug on xprofile)
  badge_slugs?: string[];

  // Custom profile fields (injected by tbc-fluent-profiles plugin)
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
// Member - From the members list endpoint
// -----------------------------------------------------------------------------

export interface Member {
  user_id: number;
  username: string;
  display_name: string;
  avatar: string | null;
  short_description: string | null;
  total_points: number;
  is_verified: number;
  status: 'active' | 'suspended' | 'banned';
  created_at: string;
  last_activity?: string;
  meta?: XProfile['meta'];
  badge?: Badge | null;
}

// -----------------------------------------------------------------------------
// Space Member - Membership in a specific space
// -----------------------------------------------------------------------------

export interface SpaceMember {
  id: number;
  space_id: number;
  user_id: number;
  role: 'member' | 'moderator' | 'admin';
  status: 'active' | 'pending' | 'banned';
  joined_at: string;
  updated_at: string;
  xprofile?: XProfile;
}
