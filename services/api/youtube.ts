// =============================================================================
// YOUTUBE API SERVICE - Fetch latest videos from YouTube channel
// =============================================================================
// Public endpoint (no auth needed) — returns cached videos from RSS feed
// =============================================================================

import { TBC_CA_URL } from '@/constants/config';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface YouTubeVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
}

export interface YouTubeLatestResponse {
  success: boolean;
  videos: YouTubeVideo[];
  cached: boolean;
}

// -----------------------------------------------------------------------------
// API
// -----------------------------------------------------------------------------

/**
 * GET /youtube/latest - Fetch latest videos from church YouTube channel
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

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

const youtubeApi = {
  getLatestVideos,
};

export default youtubeApi;
