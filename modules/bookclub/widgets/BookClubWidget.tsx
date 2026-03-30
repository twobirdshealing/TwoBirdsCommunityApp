// =============================================================================
// BOOK CLUB WIDGET - Compact home screen entry point
// =============================================================================
// Only renders if the user is a member of the "Book Club" space.
// If the server includes next_meeting data, shows a meeting row with Join.
// Returns null entirely when not applicable (hides header too).
// =============================================================================

import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, sizing, shadows, typography } from '@/constants/layout';
import { withOpacity } from '@/constants/colors';
import { spacesApi } from '@/services/api/spaces';
import bookclubApi from '@/modules/bookclub/services/bookclubApi';
import { useAppQuery, WIDGET_STALE_TIME } from '@/hooks/useAppQuery';
import type { BookSummary } from '@/modules/bookclub/types/bookclub';
import { HomeWidget } from '@/components/home/HomeWidget';
import type { WidgetComponentProps } from '@/modules/_types';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

interface BookClubCacheData {
  isMember: boolean;
  book: BookSummary | null;
}

export function BookClubWidget({ refreshKey, title, icon, onSeeAll }: WidgetComponentProps) {
  const router = useRouter();
  const { colors: themeColors } = useTheme();

  const { data } = useAppQuery<BookClubCacheData>({
    cacheKey: 'tbc_widget_book_club',
    fetcher: async () => {
      try {
        const spaceResponse = await spacesApi.getSpaceBySlug('book-club');
        if (!spaceResponse.success || !spaceResponse.data.space.permissions?.is_member) {
          return { isMember: false, book: null };
        }

        const booksResponse = await bookclubApi.getBooks();
        if (!booksResponse.success) return { isMember: true, book: null };

        const books = booksResponse.data.books;
        const current = books.find((b) => b.is_current) ?? books[0] ?? null;
        return { isMember: true, book: current };
      } catch {
        return { isMember: false, book: null };
      }
    },
    refreshKey,
    refreshOnFocus: false,
    staleTime: WIDGET_STALE_TIME,
  });

  // Don't render anything (including header) if not a member or no books
  const book = data?.book;
  if (!data?.isMember || !book) return null;

  const nextMeeting = book.next_meeting;

  return (
    <HomeWidget title={title} icon={icon} onSeeAll={onSeeAll}>
      {/* Book Card */}
      <AnimatedPressable
        style={[styles.card, { backgroundColor: themeColors.surface }]}
        onPress={() => router.push({ pathname: '/bookclub/[id]', params: { id: String(book.id) } })}
      >
        {/* Cover */}
        {book.cover_image ? (
          <Image source={{ uri: book.cover_image }} style={styles.cover} contentFit="cover" transition={200} cachePolicy="memory-disk" />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder, { backgroundColor: withOpacity(themeColors.primary, 0.1) }]}>
            <Ionicons name="book-outline" size={24} color={themeColors.primary} />
          </View>
        )}

        {/* Info */}
        <View style={styles.info}>
          <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={1}>
            {book.title}
          </Text>
          <Text style={[styles.author, { color: themeColors.textSecondary }]} numberOfLines={1}>
            {book.author}
          </Text>
        </View>

        {/* Listen Button */}
        <View style={[styles.listenBtn, { backgroundColor: themeColors.primary }]}>
          <Ionicons name="headset-outline" size={18} color={themeColors.textInverse} />
          <Text style={[styles.listenText, { color: themeColors.textInverse }]}>Listen</Text>
        </View>
      </AnimatedPressable>

      {/* Next Meeting Row — only shown when server says there's an upcoming meeting */}
      {nextMeeting && (
        <View style={[styles.meetingRow, { backgroundColor: withOpacity(themeColors.primary, 0.06) }]}>
          <View style={styles.meetingInfo}>
            <Ionicons name="calendar-outline" size={16} color={themeColors.primary} />
            <Text style={[styles.meetingText, { color: themeColors.text }]} numberOfLines={1}>
              Next: {nextMeeting.formatted_date}
            </Text>
            {nextMeeting.chapters ? (
              <Text style={[styles.meetingChapters, { color: themeColors.textSecondary }]}>
                Ch. {nextMeeting.chapters}
              </Text>
            ) : null}
          </View>
          <Pressable
            style={[styles.joinBtn, { backgroundColor: themeColors.primary }]}
            onPress={() => Linking.openURL(nextMeeting.meeting_link)}
          >
            <Ionicons name="videocam" size={14} color={themeColors.textInverse} />
            <Text style={[styles.joinText, { color: themeColors.textInverse }]}>Join</Text>
          </Pressable>
        </View>
      )}
    </HomeWidget>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Book card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: sizing.borderRadius.md,
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    ...shadows.sm,
  },

  cover: {
    width: 48,
    height: 48,
    borderRadius: sizing.borderRadius.sm,
  },

  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  info: {
    flex: 1,
    gap: 2,
  },

  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },

  author: {
    fontSize: typography.size.sm,
  },

  listenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: sizing.borderRadius.full,
  },

  listenText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },

  // Next meeting row
  meetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: sizing.borderRadius.md,
  },

  meetingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },

  meetingText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },

  meetingChapters: {
    fontSize: typography.size.xs,
  },

  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: sizing.borderRadius.full,
    marginLeft: spacing.sm,
  },

  joinText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
});

export default BookClubWidget;
