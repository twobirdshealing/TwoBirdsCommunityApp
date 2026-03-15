// =============================================================================
// MODERATION API - Content reporting
// =============================================================================
// Uses Fluent Community Pro's built-in moderation endpoint.
// Server handles duplicate prevention, moderator protection, notifications.
// =============================================================================

import { ENDPOINTS } from '@/constants/config';
import { post } from './client';
import { createLogger } from '@/utils/logger';

const log = createLogger('ModerationAPI');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ReportPostData {
  content_type: 'post';
  reason: string;
  explanation?: string;
  post_id: number;
  user_id: number;
}

export interface ReportCommentData {
  content_type: 'comment';
  reason: string;
  explanation?: string;
  post_id: number;
  parent_id: number;
  user_id: number;
}

export type ReportData = ReportPostData | ReportCommentData;

export interface ReportResponse {
  message: string;
  report: Record<string, unknown>;
  content: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Submit Report
// -----------------------------------------------------------------------------

export async function submitReport(data: ReportData) {
  log('Submitting report:', data.content_type, 'post_id:', data.post_id);
  return post<ReportResponse>(ENDPOINTS.MODERATION_REPORT, data);
}
