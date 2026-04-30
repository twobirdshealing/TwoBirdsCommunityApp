// =============================================================================
// SPACE DOCUMENTS API — Document Library (Fluent Community Pro)
// =============================================================================
// Endpoint: GET /wp-json/fluent-community/v2/documents?space_id={id}
// PRO-only — endpoint returns 404 when Pro isn't installed. The hook layer
// catches that and renders an empty state without surfacing a toast.
// =============================================================================

import { ENDPOINTS } from '@/constants/config';
import type { ActivityXProfile } from '@/types/activity';
import { get, request } from './client';
import { createLogger } from '@/utils/logger';

const log = createLogger('DocumentsAPI');

// -----------------------------------------------------------------------------
// One uploaded file inside a document post
// -----------------------------------------------------------------------------

export interface SpaceDocumentFile {
  id: number;
  title: string;
  media_key?: string;
  url: string;
  type?: string;            // mime type, e.g. "application/pdf"
  size?: number | string;
}

// -----------------------------------------------------------------------------
// One "document" — a Fluent post that bundles 1+ files in meta.document_lists.
// -----------------------------------------------------------------------------

export interface SpaceDocument {
  id: number;
  content_type?: string;
  post_content?: string;    // optional caption/description
  user_id: number;
  created_at: string;
  meta?: {
    document_lists?: SpaceDocumentFile[];
  };
  xprofile?: ActivityXProfile;
}

export interface SpaceDocumentsResponse {
  documents: SpaceDocument[] | { data: SpaceDocument[]; current_page?: number; last_page?: number };
}

// -----------------------------------------------------------------------------
// Get documents for a single space
// -----------------------------------------------------------------------------

export async function getSpaceDocuments(spaceId: number, page: number = 1) {
  return get<SpaceDocumentsResponse>(ENDPOINTS.DOCUMENTS, {
    space_id: spaceId,
    page,
  });
}

// -----------------------------------------------------------------------------
// Helper — normalize array vs paginated response into a flat list
// -----------------------------------------------------------------------------

export function unwrapDocuments(response: SpaceDocumentsResponse): SpaceDocument[] {
  const raw = response.documents;
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.data)) return raw.data;
  return [];
}

// -----------------------------------------------------------------------------
// Upload a document file to a space (FC Pro endpoint)
// -----------------------------------------------------------------------------
// POST /documents/upload — multipart with `space_id` + `file`. Server creates a
// row in fcom_media_archive with object_source='space_document' and is_active=0
// until a post referencing it is published.
//
// Response shape: { file: { id, url, media_key, title, type } }. We normalize
// it into the existing SpaceDocumentFile shape so callers can drop it straight
// into post.meta.document_lists.
// -----------------------------------------------------------------------------

export interface DocumentUploadResponse {
  success: boolean;
  data?: SpaceDocumentFile;
  error?: { code: string; message: string };
}

interface RawDocumentUpload {
  file: {
    id: number;
    url: string;
    media_key?: string;
    title?: string;
    type?: string;
  };
}

export async function uploadDocument(
  uri: string,
  mimeType: string,
  fileName: string,
  spaceId: number
): Promise<DocumentUploadResponse> {
  const formData = new FormData();

  // React Native FormData file shape
  formData.append('file', {
    uri,
    type: mimeType,
    name: fileName,
  } as any);

  formData.append('space_id', String(spaceId));

  log.debug('Uploading document:', { fileName, mimeType, spaceId });

  const result = await request<RawDocumentUpload>(`${ENDPOINTS.DOCUMENTS}/upload`, {
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

  const file = result.data.file;
  return {
    success: true,
    data: {
      id: file.id,
      url: file.url,
      media_key: file.media_key,
      title: file.title || fileName,
      type: file.type || mimeType,
    },
  };
}

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const documentsApi = {
  getSpaceDocuments,
  uploadDocument,
  unwrapDocuments,
};

export default documentsApi;
