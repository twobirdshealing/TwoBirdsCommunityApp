// =============================================================================
// MEDIA API - Media upload service
// =============================================================================
// Handles file uploads to Fluent Community
// Uses FormData for multipart/form-data uploads
// JWT auth + silent refresh handled automatically by client.ts (rawBody mode).
// =============================================================================

import { request } from './client';
import { createLogger } from '@/utils/logger';

const log = createLogger('MediaAPI');

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

/** Raw API response from /feeds/media-upload */
interface MediaUploadApiData {
  media: {
    url: string;
    width?: number;
    height?: number;
    type: string;
    media_key?: number;
    media_id?: number;
    id?: number;
  };
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

  log('Uploading:', fileName, type);

  const result = await request<MediaUploadApiData>('/feeds/media-upload', {
    method: 'POST',
    body: formData,
    rawBody: true,
  });

  if (!result.success) {
    return {
      success: false,
      error: {
        code: result.error.code || 'upload_failed',
        message: result.error.message || 'Upload failed',
      },
    };
  }

  log('Response:', result.data);

  // API returns { media: { url, width, height, type, media_key } }
  const media = result.data.media || result.data;

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
}

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const mediaApi = {
  uploadMedia,
};

export default mediaApi;
