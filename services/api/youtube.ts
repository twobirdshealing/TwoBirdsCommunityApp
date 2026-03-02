// =============================================================================
// YOUTUBE API SERVICE - Fetch videos and playlists via YouTube Data API v3
// =============================================================================
// Public endpoints (no auth needed) — server proxies YouTube Data API v3
// and caches results in WordPress transients.
// =============================================================================

import { TBC_CA_URL } from '@/constants/config';
import type {
  YouTubeVideo,
  YouTubeLatestResponse,
  YouTubePlaylistsResponse,
  YouTubePlaylistVideosResponse,
} from '@/types/youtube';

// Re-export types for convenience
export type { YouTubeVideo, YouTubeLatestResponse, YouTubePlaylistsResponse, YouTubePlaylistVideosResponse };

// -----------------------------------------------------------------------------
// API
// -----------------------------------------------------------------------------

/**
 * GET /youtube/latest - Fetch latest videos from channel uploads
 */
export async function getLatestVideos(limit: number = 1): Promise<YouTubeLatestResponse | null> {
  try {
    const response = await fetch(`${TBC_CA_URL}/youtube/latest?limit=${limit}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return null;

    const data: YouTubeLatestResponse = await response.json();
    return data.success ? data : null;
  } catch (error) {
    if (__DEV__) console.error('[YouTube API]', error);
    return null;
  }
}

/**
 * GET /youtube/playlists - Fetch all channel playlists
 */
export async function getPlaylists(): Promise<YouTubePlaylistsResponse | null> {
  try {
    const response = await fetch(`${TBC_CA_URL}/youtube/playlists`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return null;

    const data: YouTubePlaylistsResponse = await response.json();
    return data.success ? data : null;
  } catch (error) {
    if (__DEV__) console.error('[YouTube API]', error);
    return null;
  }
}

/**
 * GET /youtube/playlists/{id}/videos - Fetch videos in a specific playlist
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
      `${TBC_CA_URL}/youtube/playlists/${playlistId}/videos?${params}`,
      { headers: { 'Accept': 'application/json' } },
    );

    if (!response.ok) return null;

    const data: YouTubePlaylistVideosResponse = await response.json();
    return data.success ? data : null;
  } catch (error) {
    if (__DEV__) console.error('[YouTube API]', error);
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
};

export default youtubeApi;
