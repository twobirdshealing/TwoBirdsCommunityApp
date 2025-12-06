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
      twitter?: string;
      youtube?: string;
      linkedin?: string;
      fb?: string;
      instagram?: string;
    };
    badge_slug?: string[];
  };
  
  // Badge info if assigned
  badge?: Badge | null;
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
  
  // Permissions
  can_change_username?: boolean;
  can_change_email?: boolean;
  canViewUserSpaces?: boolean;
  
  // Navigation items
  profile_navs?: ProfileNav[];
  profile_nav_actions?: any[];
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
  icon?: string;
  color?: string;
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
