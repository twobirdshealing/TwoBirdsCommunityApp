// =============================================================================
// GIF TYPES - Shared type for GIF attachment state
// =============================================================================

export interface GifAttachment {
  image: string;      // downsized_medium URL (used for post submission)
  width: number;
  height: number;
  previewUrl: string; // preview_gif URL (used for thumbnail display)
}
