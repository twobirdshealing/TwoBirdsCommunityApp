// =============================================================================
// DEEP LINK MAPPER - Maps web URLs to Expo Router app routes
// =============================================================================
// Central utility used by both the URL listener (_layout.tsx) and
// in-app link interception (HtmlContent.tsx).
// =============================================================================

import { SITE_URL } from '@/constants/config';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type AppRoute = {
  pathname: string;
  params?: Record<string, string>;
} | null;

// -----------------------------------------------------------------------------
// Main mapper
// -----------------------------------------------------------------------------

/**
 * Map a web URL to an app route. Returns null if URL doesn't match any app route.
 *
 * @param url      Full URL (e.g. https://staging.twobirdschurch.com/spaces/general)
 * @param portalSlug  Fluent Community portal slug (empty string when portal is at root)
 */
export function mapUrlToRoute(url: string, portalSlug: string): AppRoute {
  // Extract the path portion, stripping the site URL prefix
  const path = extractPath(url);
  if (!path) return null;

  // Strip the portal slug prefix to get the community-relative path
  // When portalSlug is empty, portal is at root — all paths are community paths
  const communityPath = stripPortalPrefix(path, portalSlug);
  if (communityPath === null) return null;

  // Match against known route patterns
  return matchRoute(communityPath);
}

// -----------------------------------------------------------------------------
// Path extraction
// -----------------------------------------------------------------------------

/**
 * Extract path from URL, stripping the site URL origin.
 * Handles both full URLs and relative paths.
 */
function extractPath(url: string): string | null {
  try {
    // Handle custom scheme URLs (twobirdscommunity://)
    if (url.startsWith('twobirdscommunity://')) {
      const pathPart = url.replace('twobirdscommunity://', '');
      return '/' + pathPart;
    }

    // Full https URL — strip the origin
    if (url.startsWith('http')) {
      const parsed = new URL(url);
      const siteOrigin = new URL(SITE_URL).origin;

      // Only handle URLs from our domain
      if (parsed.origin !== siteOrigin) return null;

      return parsed.pathname;
    }

    // Relative path
    if (url.startsWith('/')) return url;

    return null;
  } catch {
    return null;
  }
}

/**
 * Strip the portal slug prefix from a path.
 * Returns the remaining path segments, or null if path doesn't start with the portal slug.
 *
 * When portalSlug is empty (portal at root), all paths are community paths.
 *
 * Examples:
 *   '/spaces/general'           with slug ''          → '/spaces/general' (root portal)
 *   '/community/spaces/general' with slug 'community' → '/spaces/general'
 *   '/portal/u/john'            with slug 'community' → '/u/john' (also matches 'portal')
 *   '/about-us'                 with slug 'community' → null (not a community path)
 */
function stripPortalPrefix(path: string, portalSlug: string): string | null {
  // Normalize: remove trailing slash, ensure leading slash
  const normalized = '/' + path.replace(/^\/+|\/+$/g, '');

  // Portal at root — all paths are community paths (no prefix to strip)
  if (!portalSlug) {
    return normalized || '/';
  }

  // Try current portal slug
  const slugPrefix = `/${portalSlug}`;
  if (normalized === slugPrefix || normalized.startsWith(slugPrefix + '/')) {
    const rest = normalized.slice(slugPrefix.length);
    return rest || '/';
  }

  // Also try default 'portal' as fallback (if slug is different)
  if (portalSlug !== 'portal') {
    const defaultPrefix = '/portal';
    if (normalized === defaultPrefix || normalized.startsWith(defaultPrefix + '/')) {
      const rest = normalized.slice(defaultPrefix.length);
      return rest || '/';
    }
  }

  return null;
}

// -----------------------------------------------------------------------------
// Route matching
// -----------------------------------------------------------------------------

/**
 * Match a community-relative path to an app route.
 *
 * @param path Community-relative path (e.g. '/spaces/general', '/u/john', '/courses/intro')
 */
function matchRoute(path: string): AppRoute {
  // Normalize: remove trailing slash
  const p = path.replace(/\/+$/, '') || '/';
  const segments = p.split('/').filter(Boolean);

  // Root: /{slug}/ → home feed
  if (segments.length === 0 || p === '/') {
    return { pathname: '/(tabs)' };
  }

  const first = segments[0];

  // Spaces
  if (first === 'spaces') {
    if (segments.length === 1) {
      // /spaces → spaces tab
      return { pathname: '/(tabs)/spaces' };
    }
    if (segments.length === 2) {
      // /spaces/{spaceSlug} → space detail
      return { pathname: '/space/[slug]', params: { slug: segments[1] } };
    }
    if (segments.length === 3) {
      // /spaces/{spaceSlug}/{postSlug}~{postId} → single post
      const postId = extractPostId(segments[2]);
      if (postId) {
        return { pathname: '/feed/[id]', params: { id: postId } };
      }
      // No ID found — fall through to space
      return { pathname: '/space/[slug]', params: { slug: segments[1] } };
    }
  }

  // Profiles: /u/{username}
  if (first === 'u' && segments.length >= 2) {
    return { pathname: '/profile/[username]', params: { username: segments[1] } };
  }

  // Courses
  if (first === 'courses') {
    if (segments.length === 1) {
      return { pathname: '/courses/index' };
    }
    // /courses/{courseSlug}/lessons/{lessonSlug}
    if (segments.length === 4 && segments[2] === 'lessons') {
      return {
        pathname: '/courses/[slug]/lesson/[lessonSlug]',
        params: { slug: segments[1], lessonSlug: segments[3] },
      };
    }
    // /courses/{courseSlug}
    if (segments.length === 2) {
      return { pathname: '/courses/[slug]', params: { slug: segments[1] } };
    }
  }

  // Notifications
  if (first === 'notifications' && segments.length === 1) {
    return { pathname: '/notifications' };
  }

  // Leaderboard — no app equivalent, go home
  if (first === 'leaderboard') {
    return { pathname: '/(tabs)' };
  }

  // No match
  return null;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Extract the numeric post ID from a Fluent Community post slug.
 * Fluent uses the pattern: 'my-post-title~123' where 123 is the feed ID.
 */
function extractPostId(segment: string): string | null {
  const tildeIndex = segment.lastIndexOf('~');
  if (tildeIndex === -1) return null;

  const id = segment.slice(tildeIndex + 1);
  // Verify it's numeric
  if (/^\d+$/.test(id)) return id;

  return null;
}
