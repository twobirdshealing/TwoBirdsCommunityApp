// =============================================================================
// NOTIFICATION TYPES - Shared types and config for notification settings screen
// =============================================================================
// The notification list is server-driven — the app renders whatever the
// push settings API returns. This file only holds shared TypeScript types
// and display config constants.
// =============================================================================

import { PushPreference } from '@/services/api/push';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface CategoryPreferences {
  [category: string]: PushPreference[];
}

export type ChannelType = 'push' | 'email';

export interface ChannelInfo {
  type: ChannelType;
  id: string;
  label: string;
  enabled: boolean;
}

export interface UnifiedItem {
  key: string;
  label: string;
  description: string;
  channels: ChannelInfo[];
  note?: string;
}

export interface UnifiedSection {
  category: string;
  title: string;
  items: UnifiedItem[];
}

export type SpacePrefValue = '' | 'admin_only_posts' | 'all_member_posts';

// Frequency options for DM emails (matches Fluent Community web UI)
export const FREQUENCY_OPTIONS: { value: string; label: string }[] = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'disabled', label: 'Off' },
];

// Space email pref options
export const SPACE_PREF_OPTIONS: { value: SpacePrefValue; label: string }[] = [
  { value: '', label: 'Off' },
  { value: 'admin_only_posts', label: 'Admin Posts' },
  { value: 'all_member_posts', label: 'All Posts' },
];
