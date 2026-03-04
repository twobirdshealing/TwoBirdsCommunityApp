// =============================================================================
// GIPHY API - Search and browse GIFs via Fluent Community proxy
// =============================================================================
// Uses the existing FC Pro endpoint: GET /giphy?q={search}&offset={offset}
// Returns trending when q is empty, search results otherwise.
// GIFs are external CDN URLs — no upload needed.
// =============================================================================

import { get } from './client';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface GiphyImage {
  url: string;
  width: string;
  height: string;
}

export interface GiphyGif {
  images: {
    preview_gif: GiphyImage;
    downsized_medium: GiphyImage;
  };
}

export interface GiphySearchResponse {
  gifs: GiphyGif[];
}

// -----------------------------------------------------------------------------
// Search / Trending GIFs
// -----------------------------------------------------------------------------

export async function searchGifs(query: string = '', offset: number = 0) {
  const params: Record<string, any> = { offset };
  if (query.trim()) {
    params.q = query.trim();
  }
  return get<GiphySearchResponse>('/giphy', params);
}

// -----------------------------------------------------------------------------
// Export as object
// -----------------------------------------------------------------------------

export const giphyApi = {
  searchGifs,
};

export default giphyApi;
