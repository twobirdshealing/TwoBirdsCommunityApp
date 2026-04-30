// =============================================================================
// MIME UTILITIES — small helpers for MIME-type-driven UI choices
// =============================================================================

import { Ionicons } from '@expo/vector-icons';

// -----------------------------------------------------------------------------
// Pick an Ionicons glyph for a given MIME type
// -----------------------------------------------------------------------------
// Used by the documents UI (sheet preview, composer attachment row) to render
// a sensible icon next to each file row when no thumbnail is available.
// -----------------------------------------------------------------------------

export function iconForMime(type?: string): keyof typeof Ionicons.glyphMap {
  if (!type) return 'document-outline';
  if (type.startsWith('image/')) return 'image-outline';
  if (type.startsWith('video/')) return 'videocam-outline';
  if (type.startsWith('audio/')) return 'musical-notes-outline';
  if (type.includes('pdf')) return 'document-text-outline';
  if (type.includes('zip') || type.includes('compressed')) return 'archive-outline';
  if (type.includes('sheet') || type.includes('excel') || type.includes('csv')) return 'grid-outline';
  return 'document-outline';
}
