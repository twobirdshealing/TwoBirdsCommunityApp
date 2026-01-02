// =============================================================================
// MEDIA API - Media upload service
// =============================================================================
// Handles file uploads to Fluent Community
// Uses FormData for multipart/form-data uploads
// Uses JWT Bearer token authentication
// =============================================================================

import { API_URL } from '@/constants/config';
import { getAuthToken } from '@/services/auth';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface MediaItem {
  media_id: number;
  url: string;
  type: 'image' | 'video' | 'file';
  width?: number;
  height?: number;
  mime_type?: string;
  file_name?: string;
}

export interface MediaUploadResponse {
  success: boolean;
  data?: {
    media_id: number;
    url: string;
    type: string;
    width?: number;
    height?: number;
    mime_type?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface MediaPreviewMeta {
  image: string;
  provider: 'uploader';
  type: 'image';
  width?: number;
  height?: number;
}

// -----------------------------------------------------------------------------
// Upload Media
// -----------------------------------------------------------------------------

/**
 * Upload a file to Fluent Community
 * @param uri - Local file URI (from image picker)
 * @param type - MIME type (e.g., 'image/jpeg')
 * @param fileName - Original file name
 * @param objectSource - Context: 'feed', 'comment', 'profile', etc.
 */
export async function uploadMedia(
  uri: string,
  type: string,
  fileName: string,
  objectSource: string = 'feed'
): Promise<MediaUploadResponse> {
  try {
    const authToken = await getAuthToken();

    if (!authToken) {
      return {
        success: false,
        error: {
          code: 'unauthorized',
          message: 'Not authenticated',
        },
      };
    }

    // Create FormData
    const formData = new FormData();

    // Append file - React Native format
    formData.append('file', {
      uri,
      type,
      name: fileName,
    } as any);

    // Add context
    formData.append('object_source', objectSource);

    console.log('[Media] Uploading:', fileName, type);

    const response = await fetch(`${API_URL}/feeds/media-upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        // NOTE: Don't set Content-Type - fetch sets it with boundary for FormData
      },
      body: formData,
    });

    const data = await response.json();
    console.log('[Media] Response:', data);

    if (!response.ok) {
      return {
        success: false,
        error: {
          code: data?.code || 'upload_failed',
          message: data?.message || 'Upload failed',
        },
      };
    }

    // API returns { media: { url, width, height, type, media_key } }
    const media = data.media || data;

    return {
      success: true,
      data: {
        media_id: media.media_key || media.media_id || media.id || Date.now(),
        url: media.url,
        type: media.type?.startsWith('image') ? 'image' : media.type || 'image',
        width: media.width,
        height: media.height,
        mime_type: media.type,
      },
    };
  } catch (error) {
    console.error('[Media] Upload error:', error);
    return {
      success: false,
      error: {
        code: 'network_error',
        message: error instanceof Error ? error.message : 'Upload failed',
      },
    };
  }
}

// -----------------------------------------------------------------------------
// Build Meta Objects for API
// -----------------------------------------------------------------------------

/**
 * Build meta.media_items array for feed/comment creation
 */
export function buildMediaItems(uploads: MediaItem[]): any[] {
  return uploads.map(item => ({
    media_id: item.media_id,
    url: item.url,
    type: item.type,
    width: item.width,
    height: item.height,
  }));
}

/**
 * Build meta.media_preview object for feed/comment creation
 * Uses first image as preview
 */
export function buildMediaPreview(uploads: MediaItem[]): MediaPreviewMeta | null {
  const firstImage = uploads.find(u => u.type === 'image');

  if (!firstImage) return null;

  return {
    image: firstImage.url,
    provider: 'uploader',
    type: 'image',
    width: firstImage.width,
    height: firstImage.height,
  };
}

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const mediaApi = {
  uploadMedia,
  buildMediaItems,
  buildMediaPreview,
};

export default mediaApi;