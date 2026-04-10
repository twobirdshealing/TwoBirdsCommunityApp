// =============================================================================
// EMAIL PREFS API SERVICE - Fluent Community email notification preferences
// =============================================================================
// Uses the shared API client (Fluent Community v2 endpoints).
// GET returns current user prefs + space groups.
// POST is a FULL REPLACEMENT — must send ALL prefs, not just changed ones.
// =============================================================================

import { get, post } from './client';
import { createLogger } from '@/utils/logger';

const log = createLogger('EmailPrefsAPI');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface EmailUserGlobals {
  com_my_post_mail: 'yes' | 'no';
  reply_my_com_mail: 'yes' | 'no';
  mention_mail: 'yes' | 'no';
  digest_mail: 'yes' | 'no';
  message_email_frequency: 'default' | 'disabled' | 'hourly' | 'daily' | 'weekly';
  [key: string]: string; // Allow dynamic key lookup from server-driven email_key
}

export interface EmailSpaceItem {
  id: number;
  title: string;
  slug: string;
  logo: string | null;
  icon?: string;
  pref: '' | 'admin_only_posts' | 'all_member_posts';
}

export interface EmailSpaceGroup {
  id: number | string;
  title: string;
  spaces: EmailSpaceItem[];
}

export interface EmailPrefsResponse {
  user_globals: EmailUserGlobals;
  spaceGroups: EmailSpaceGroup[];
  space_prefs: Record<string, '' | 'admin_only_posts' | 'all_member_posts'>;
  digestEmailDay: string;
  default_messaging_email_frequency: string;
}

export interface EmailPrefsPayload {
  user_globals: EmailUserGlobals;
  space_prefs: Record<string, '' | 'admin_only_posts' | 'all_member_posts'>;
}

export interface EmailPrefsSaveResponse {
  prefs: Record<string, any>;
  message: string;
}

// -----------------------------------------------------------------------------
// API Functions
// -----------------------------------------------------------------------------

/**
 * GET /profile/{username}/notification-preferences
 * Returns email notification preferences for the user.
 */
export async function getEmailPrefs(username: string) {
  return get<EmailPrefsResponse>(`/profile/${username}/notification-preferences`);
}

/**
 * POST /profile/{username}/notification-preferences
 * Saves email notification preferences. This is a FULL REPLACEMENT —
 * all user_globals and space_prefs must be included or they'll be reset.
 */
export async function updateEmailPrefs(username: string, payload: EmailPrefsPayload) {
  log.debug('updateEmailPrefs:', { username });
  return post<EmailPrefsSaveResponse>(
    `/profile/${username}/notification-preferences`,
    payload
  );
}

// -----------------------------------------------------------------------------
// Export as object for consistency with other API services
// -----------------------------------------------------------------------------

export const emailPrefsApi = {
  getEmailPrefs,
  updateEmailPrefs,
};

export default emailPrefsApi;
