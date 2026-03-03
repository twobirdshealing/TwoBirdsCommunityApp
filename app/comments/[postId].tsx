// =============================================================================
// COMMENTS SCREEN - Route for the comments panel
// =============================================================================
// Renders CommentSheet as a full stack screen (not a native Modal/Dialog).
// =============================================================================

import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CommentSheet } from '@/components/feed/CommentSheet';

export default function CommentsScreen() {
  const { postId, feedSlug } = useLocalSearchParams<{
    postId: string;
    feedSlug?: string;
  }>();
  const router = useRouter();

  return (
    <CommentSheet
      postId={postId ? Number(postId) : null}
      feedSlug={feedSlug}
      onClose={() => router.back()}
    />
  );
}
