// =============================================================================
// BLOG COMMENTS SCREEN - Route for blog post comments
// =============================================================================
// Renders BlogCommentSheet as a full stack screen (not a native Modal/Dialog).
// =============================================================================

import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BlogCommentSheet } from '@/modules/blog/components/BlogCommentSheet';

export default function BlogCommentsScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const router = useRouter();

  return (
    <BlogCommentSheet
      postId={postId ? Number(postId) : null}
      onClose={() => router.back()}
    />
  );
}
