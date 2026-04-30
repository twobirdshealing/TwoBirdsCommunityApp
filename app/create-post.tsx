import React, { useEffect } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CreatePostContent, ComposerSubmitData } from '@/components/composer/CreatePostContent';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useTheme } from '@/contexts/ThemeContext';
import { Feed } from '@/types/feed';
import { feedsApi } from '@/services/api/feeds';
import { cacheEvents, CACHE_EVENTS } from '@/utils/cacheEvents';
import { useAppQuery } from '@/hooks/useAppQuery';

export default function CreatePostScreen() {
  const { spaceSlug, spaceName, editId } = useLocalSearchParams<{
    spaceSlug?: string;
    spaceName?: string;
    editId?: string;
  }>();
  const router = useRouter();
  const { colors: themeColors } = useTheme();

  // Edit mode: fetch feed data by ID via TanStack Query (cached + persisted).
  // Re-entry to the same edit screen renders the form instantly from cache.
  const {
    data: editFeed,
    isLoading: loading,
    error: loadError,
  } = useAppQuery<Feed>({
    cacheKey: `tbc_feed_edit_${editId || 'none'}`,
    enabled: !!editId,
    fetcher: async () => {
      const res = await feedsApi.getFeedById(Number(editId));
      if (!res.success) {
        throw new Error(res.error?.message || 'Could not load post for editing');
      }
      if (!res.data?.feed) {
        throw new Error('Could not load post for editing');
      }
      return res.data.feed;
    },
  });

  // Bail out on load failure — same UX as before, but now actually catches
  // network errors (the previous .then-only chain swallowed them).
  useEffect(() => {
    if (!loadError) return;
    Alert.alert('Error', 'Could not load post for editing');
    router.back();
  }, [loadError, router]);

  // Submit handler
  const handleSubmit = async (data: ComposerSubmitData) => {
    if (editFeed) {
      const response = await feedsApi.updateFeed(editFeed.id, {
        message: data.message,
        title: data.title,
        content_type: data.content_type,
        media_images: data.media_images,
        meta: data.meta,
        survey: data.survey,
      });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update post');
      }
    } else {
      const response = await feedsApi.createFeed({
        message: data.message,
        title: data.title,
        space: data.space,
        content_type: data.content_type,
        media_images: data.media_images,
        media: data.media,
        meta: data.meta,
        survey: data.survey,
      });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to create post');
      }
    }
    cacheEvents.emit(CACHE_EVENTS.FEEDS);
  };

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: themeColors.surface }]}>
        <LoadingSpinner fullScreen={false} />
      </View>
    );
  }

  return (
    <CreatePostContent
      onClose={() => router.back()}
      onSubmit={handleSubmit}
      spaceSlug={editFeed?.space?.slug || spaceSlug}
      spaceName={editFeed?.space?.title || spaceName}
      editFeed={editFeed || undefined}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
