// =============================================================================
// BOOK CLUB LIST - Browse available audiobooks
// =============================================================================

import React, { useCallback } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useCachedData } from '@/hooks/useCachedData';
import { LoadingSpinner, ErrorMessage, EmptyState } from '@/components/common';
import { PageHeader } from '@/components/navigation';
import { BookCard } from '@/components/bookclub';
import { spacing } from '@/constants/layout';
import bookclubApi from '@/services/api/bookclub';
import type { BookSummary } from '@/types/bookclub';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function BookClubListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();
  const { data: booksData, isLoading: loading, isRefreshing: refreshing, error: fetchError, refresh } = useCachedData<BookSummary[]>({
    cacheKey: 'tbc_bookclub_list',
    fetcher: async () => {
      const response = await bookclubApi.getBooks();
      if (!response.success) throw new Error('Failed to load books');
      return response.data.books;
    },
  });
  const books = booksData || [];
  const error = fetchError?.message || null;

  const renderItem = useCallback(
    ({ item }: { item: BookSummary }) => (
      <BookCard
        book={item}
        onPress={() => router.push({ pathname: '/bookclub/[id]', params: { id: String(item.id) } })}
      />
    ),
    [router]
  );

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <EmptyState
        icon="book-outline"
        title="No Books"
        message="Check back soon for new audiobooks."
      />
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
        <PageHeader title="Book Club" leftAction="back" onLeftPress={() => router.back()} />

        {error && !loading ? (
          <ErrorMessage message={error} onRetry={refresh} />
        ) : loading && books.length === 0 ? (
          <LoadingSpinner />
        ) : (
          <FlashList
            data={books}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: spacing.sm + insets.bottom, paddingHorizontal: spacing.md }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
                tintColor={themeColors.primary}
                colors={[themeColors.primary]}
              />
            }
            ListEmptyComponent={renderEmpty}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  listContent: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});
