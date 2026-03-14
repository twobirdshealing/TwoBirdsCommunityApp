// =============================================================================
// YOUTUBE TYPES
// =============================================================================

export interface YouTubeVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
}

export interface YouTubePlaylist {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  videoCount: number;
}

export interface YouTubeLatestResponse {
  success: boolean;
  videos: YouTubeVideo[];
  cached: boolean;
}

export interface YouTubePlaylistsResponse {
  success: boolean;
  playlists: YouTubePlaylist[];
  cached: boolean;
}

export interface YouTubePlaylistVideosResponse {
  success: boolean;
  videos: YouTubeVideo[];
  nextPageToken: string | null;
  totalResults: number;
  cached: boolean;
}
