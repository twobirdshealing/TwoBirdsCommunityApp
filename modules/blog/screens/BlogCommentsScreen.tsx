// =============================================================================
// BLOG COMMENTS SCREEN - Route for blog post comments
// =============================================================================
// Renders BlogCommentSheet as a full stack screen (not a native Modal/Dialog).
// =============================================================================

import React from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { BlogCommentSheet } from '@/modules/blog/components/BlogCommentSheet';

export default function BlogCommentsScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', headerShown: false }} />
      <BlogCommentSheet
        postId={postId ? Number(postId) : null}
        onClose={() => router.back()}
      />
    </>
  );
}
