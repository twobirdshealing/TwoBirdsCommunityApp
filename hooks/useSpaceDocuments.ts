// =============================================================================
// USE SPACE DOCUMENTS — fetches /documents?space_id=X (Fluent Community Pro)
// =============================================================================
// PRO-only endpoint. When Pro isn't installed the route returns 404 and we
// quietly resolve to an empty list — the SpaceMenu only surfaces the Documents
// item when permissions.can_view_documents is true, so this is just a safety
// net for older sites or routing edge cases.
// =============================================================================

import { useAppQuery, WIDGET_STALE_TIME } from '@/hooks/useAppQuery';
import { documentsApi, unwrapDocuments, type SpaceDocument } from '@/services/api/documents';

interface UseSpaceDocumentsResult {
  documents: SpaceDocument[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useSpaceDocuments(
  spaceId: number | null | undefined,
  enabled: boolean = true,
): UseSpaceDocumentsResult {
  const { data, isLoading, isRefreshing, error, refresh } = useAppQuery({
    cacheKey: `tbc_space_documents_${spaceId ?? 0}`,
    enabled: enabled && !!spaceId,
    staleTime: WIDGET_STALE_TIME,
    fetcher: async () => {
      if (!spaceId) return [] as SpaceDocument[];
      const response = await documentsApi.getSpaceDocuments(spaceId);
      if (!response.success) {
        const status = response.error.data?.status;
        // Pro not installed → 404; non-member access → 403. Treat as empty.
        if (status === 404 || status === 403) return [] as SpaceDocument[];
        throw new Error(response.error.message || 'Failed to load documents');
      }
      return unwrapDocuments(response.data);
    },
  });

  return {
    documents: data ?? [],
    isLoading,
    isRefreshing,
    error,
    refresh,
  };
}
