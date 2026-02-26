// =============================================================================
// YOUTUBE UTILITIES - Shared helpers for YouTube video detection
// =============================================================================

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const p of patterns) {
    const match = url.match(p);
    if (match) return match[1];
  }
  return null;
}

