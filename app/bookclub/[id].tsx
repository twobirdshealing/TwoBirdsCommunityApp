// =============================================================================
// AUDIOBOOK PLAYER - Full-screen player for a book
// =============================================================================
// Shows cover art, chapter info, playback controls, and toolbar buttons
// for chapters, bookmarks, and schedule (all via bottom sheets).
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAudioPlayerContext, SPEED_OPTIONS } from '@/contexts/AudioPlayerContext';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { PageHeader } from '@/components/navigation/PageHeader';
import { BottomSheet, BottomSheetScrollView } from '@/components/common/BottomSheet';
import { stripHtmlPreserveBreaks } from '@/utils/htmlToText';
import { AudioControls } from '@/components/bookclub/AudioControls';
import { ChapterList } from '@/components/bookclub/ChapterList';
import { BookmarkList } from '@/components/bookclub/BookmarkList';
import { ScheduleSheet } from '@/components/bookclub/ScheduleSheet';
import { spacing, typography, sizing } from '@/constants/layout';
import { withOpacity } from '@/constants/colors';
import bookclubApi from '@/services/api/bookclub';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function AudiobookPlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();
  const {
    currentBook,
    loadBook,
    playbackRate,
    setSpeed,
  } = useAudioPlayerContext();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bottom sheet visibility
  const [chaptersVisible, setChaptersVisible] = useState(false);
  const [bookmarksVisible, setBookmarksVisible] = useState(false);
  const [scheduleVisible, setScheduleVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);

  // ---------------------------------------------------------------------------
  // Load book data if not already loaded
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const bookId = Number(id);
    if (!bookId) return;

    // Already loaded this book
    if (currentBook?.id === bookId) return;

    setLoading(true);
    setError(null);
    bookclubApi.getBook(bookId).then((response) => {
      if (response.success) {
        loadBook(response.data.book);
      } else {
        setError('Failed to load book');
      }
      setLoading(false);
    });
  }, [id, currentBook?.id, loadBook]);

  // ---------------------------------------------------------------------------
  // Speed picker
  // ---------------------------------------------------------------------------

  const cycleSpeed = useCallback(() => {
    const currentIndex = SPEED_OPTIONS.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
    setSpeed(SPEED_OPTIONS[nextIndex]);
  }, [playbackRate, setSpeed]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading || !currentBook) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
          <PageHeader title="Book Club" leftAction="back" onLeftPress={() => router.back()} />
          {error ? (
            <ErrorMessage message={error} onRetry={() => {
              setError(null);
              setLoading(true);
              bookclubApi.getBook(Number(id)).then((response) => {
                if (response.success) {
                  loadBook(response.data.book);
                } else {
                  setError('Failed to load book');
                }
                setLoading(false);
              });
            }} />
          ) : (
            <LoadingSpinner />
          )}
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
        <PageHeader
          title={currentBook.title}
          leftAction="back"
          onLeftPress={() => router.back()}
          rightIcon={currentBook.description ? 'information-circle-outline' : undefined}
          onRightPress={currentBook.description ? () => setInfoVisible(true) : undefined}
        />

        <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Ambient gradient wash behind cover art */}
        <LinearGradient
          colors={[withOpacity(themeColors.primary, 0.12), 'transparent']}
          style={styles.ambientGlow}
        />

        {/* Cover Art */}
        <View style={styles.coverSection}>
          {/* Soft glow behind cover image */}
          <View style={[styles.coverGlow, { backgroundColor: withOpacity(themeColors.primary, 0.18) }]} />

          {currentBook.cover_image ? (
            <Image
              source={{ uri: currentBook.cover_image }}
              style={styles.coverImage}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.coverImage, styles.coverPlaceholder, { backgroundColor: withOpacity(themeColors.primary, 0.1) }]}>
              <Ionicons name="book-outline" size={64} color={themeColors.primary} />
            </View>
          )}

          <Text style={[styles.bookTitle, { color: themeColors.text }]}>
            {currentBook.title}
          </Text>
          <Text style={[styles.bookAuthor, { color: themeColors.textSecondary }]}>
            {currentBook.author}
          </Text>
        </View>

        {/* Audio Controls */}
        <View style={styles.controlsSection}>
          <AudioControls />
        </View>

        {/* Toolbar + Speed grouped in a card */}
        <View style={[styles.toolbarCard, { backgroundColor: themeColors.surface }]}>
          {/* Toolbar Buttons — Chapters | Bookmarks | Schedule */}
          <View style={styles.toolbar}>
            <Pressable
              style={styles.toolbarBtn}
              onPress={() => setChaptersVisible(true)}
            >
              <Ionicons name="list-outline" size={22} color={themeColors.textSecondary} />
              <Text style={[styles.toolbarLabel, { color: themeColors.textSecondary }]}>Chapters</Text>
            </Pressable>

            <Pressable
              style={styles.toolbarBtn}
              onPress={() => setBookmarksVisible(true)}
            >
              <Ionicons name="bookmark-outline" size={22} color={themeColors.textSecondary} />
              <Text style={[styles.toolbarLabel, { color: themeColors.textSecondary }]}>Bookmarks</Text>
            </Pressable>

            <Pressable
              style={styles.toolbarBtn}
              onPress={() => setScheduleVisible(true)}
            >
              <Ionicons name="calendar-outline" size={22} color={themeColors.textSecondary} />
              <Text style={[styles.toolbarLabel, { color: themeColors.textSecondary }]}>Schedule</Text>
            </Pressable>
          </View>

          {/* Speed Control — compact cycle button */}
          <View style={styles.speedRow}>
            <Pressable
              style={[styles.speedBtn, { backgroundColor: withOpacity(themeColors.text, 0.06) }]}
              onPress={cycleSpeed}
            >
              <Text style={[styles.speedBtnText, { color: themeColors.textSecondary }]}>
                {playbackRate}x Speed
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Bottom padding */}
        <View style={{ height: spacing.xxxl * 2 }} />
      </ScrollView>

      {/* Book Info Bottom Sheet */}
      {currentBook.description ? (
        <BottomSheet
          visible={infoVisible}
          onClose={() => setInfoVisible(false)}
          title="About This Book"
        >
          <BottomSheetScrollView contentContainerStyle={styles.infoContent}>
            <Text style={[styles.infoAuthor, { color: themeColors.textSecondary }]}>
              by {currentBook.author}
            </Text>
            <Text style={[styles.infoDescription, { color: themeColors.text }]}>
              {stripHtmlPreserveBreaks(currentBook.description)}
            </Text>
          </BottomSheetScrollView>
        </BottomSheet>
      ) : null}

      {/* Chapters Bottom Sheet */}
      <BottomSheet
        visible={chaptersVisible}
        onClose={() => setChaptersVisible(false)}
        title="Chapters"
      >
        <ChapterList onClose={() => setChaptersVisible(false)} />
      </BottomSheet>

      {/* Bookmarks Bottom Sheet */}
      <BottomSheet
        visible={bookmarksVisible}
        onClose={() => setBookmarksVisible(false)}
        title="Bookmarks"
      >
        <BookmarkList onClose={() => setBookmarksVisible(false)} />
      </BottomSheet>

      {/* Schedule Bottom Sheet */}
      <BottomSheet
        visible={scheduleVisible}
        onClose={() => setScheduleVisible(false)}
        title="Schedule"
      >
        <ScheduleSheet
          schedule={currentBook.schedule_data ?? []}
          meetingLink={currentBook.is_current ? currentBook.meeting_link : undefined}
          meetingId={currentBook.is_current ? currentBook.meeting_id : undefined}
          meetingPasscode={currentBook.is_current ? currentBook.meeting_passcode : undefined}
          moderator={currentBook.moderator}
          onModeratorPress={currentBook.moderator?.username ? () => {
            setScheduleVisible(false);
            router.push(`/profile/${currentBook.moderator!.username}`);
          } : undefined}
        />
      </BottomSheet>
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

  scrollContent: {
    paddingHorizontal: spacing.lg,
  },

  ambientGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 350,
  },

  coverSection: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },

  coverGlow: {
    position: 'absolute',
    top: spacing.xl - 10,
    width: 240,
    height: 240,
    borderRadius: sizing.borderRadius.lg + 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },

  coverImage: {
    width: 220,
    height: 220,
    borderRadius: sizing.borderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },

  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  bookTitle: {
    fontSize: typography.size.xl,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.md,
  },

  bookAuthor: {
    fontSize: typography.size.md,
  },

  controlsSection: {
    paddingTop: spacing.xxl,
  },

  toolbarCard: {
    marginTop: spacing.lg,
    borderRadius: sizing.borderRadius.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },

  toolbar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xxxl,
    paddingBottom: spacing.md,
  },

  toolbarBtn: {
    alignItems: 'center',
    gap: spacing.xs,
  },

  toolbarLabel: {
    fontSize: typography.size.xs,
    fontWeight: '500',
  },

  speedRow: {
    alignItems: 'center',
    paddingBottom: spacing.xs,
  },

  speedBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: sizing.borderRadius.full,
  },

  speedBtnText: {
    fontSize: typography.size.sm,
    fontWeight: '600',
  },

  infoContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },

  infoAuthor: {
    fontSize: typography.size.md,
    fontWeight: '500',
    fontStyle: 'italic',
  },

  infoDescription: {
    fontSize: typography.size.md,
    lineHeight: typography.size.md * 1.6,
  },
});
