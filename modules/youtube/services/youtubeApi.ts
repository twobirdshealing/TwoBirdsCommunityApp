// =============================================================================
// YOUTUBE API SERVICE - Fetch videos and playlists via YouTube Data API v3
// =============================================================================
// Public endpoints (no auth needed) — server proxies YouTube Data API v3
// and caches results in WordPress transients.
// =============================================================================

import { SITE_URL } from '@/constants/config';
import { createLogger } from '@/utils/logger';

/** YouTube plugin base URL — derived from SITE_URL at import time */
const TBC_YT_URL = `${SITE_URL}/wp-json/tbc-yt/v1`;

const log = createLogger('YouTubeAPI');
import type {
  YouTubeVideo,
  YouTubeLatestResponse,
  YouTubePlaylistsResponse,
  YouTubePlaylistVideosResponse,
} from '../types/youtube';

// Re-export types for convenience
export type { YouTubeVideo, YouTubeLatestResponse, YouTubePlaylistsResponse, YouTubePlaylistVideosResponse };

// -----------------------------------------------------------------------------
// API
// -----------------------------------------------------------------------------

/**
 * GET /latest - Fetch latest videos from channel uploads
 */
export async function getLatestVideos(limit: number = 1): Promise<YouTubeLatestResponse | null> {
  try {
    const response = await fetch(`${TBC_YT_URL}/latest?limit=${limit}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return null;

    const data: YouTubeLatestResponse = await response.json();
    return data.success ? data : null;
  } catch (error) {
    log.error(error);
    return null;
  }
}

/**
 * GET /playlists - Fetch all channel playlists
 */
export async function getPlaylists(): Promise<YouTubePlaylistsResponse | null> {
  try {
    const response = await fetch(`${TBC_YT_URL}/playlists`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return null;

    const data: YouTubePlaylistsResponse = await response.json();
    return data.success ? data : null;
  } catch (error) {
    log.error(error);
    return null;
  }
}

/**
 * GET /playlists/{id}/videos - Fetch videos in a specific playlist
 */
export async function getPlaylistVideos(
  playlistId: string,
  limit: number = 10,
  pageToken?: string,
): Promise<YouTubePlaylistVideosResponse | null> {
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (pageToken) params.set('pageToken', pageToken);

    const response = await fetch(
      `${TBC_YT_URL}/playlists/${playlistId}/videos?${params}`,
      { headers: { 'Accept': 'application/json' } },
    );

    if (!response.ok) return null;

    const data: YouTubePlaylistVideosResponse = await response.json();
    return data.success ? data : null;
  } catch (error) {
    log.error(error);
    return null;
  }
}

/**
 * GET /config - Fetch module config (channel URL for Subscribe button)
 */
export async function getConfig(): Promise<{ channel_url: string } | null> {
  try {
    const response = await fetch(`${TBC_YT_URL}/config`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return null;

    return await response.json();
  } catch (error) {
    log.error(error);
    return null;
  }
}

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const youtubeApi = {
  getLatestVideos,
  getPlaylists,
  getPlaylistVideos,
  getConfig,
};

export default youtubeApi;
