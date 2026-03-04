// =============================================================================
// LESSON VIEW - Display lesson content with completion tracking
// =============================================================================
// Route: /courses/[slug]/lesson/[lessonSlug]
// Features:
// - Lesson content (HTML) via HtmlContent
// - Embedded video (YouTube) via YouTubeEmbed
// - Mark complete / incomplete toggle
// - Previous / Next lesson navigation
// =============================================================================

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HtmlContent } from '@/components/common/HtmlContent';
import { YouTubeEmbed } from '@/components/media/YouTubeEmbed';
import { PageHeader } from '@/components/navigation/PageHeader';
import { spacing, typography, sizing } from '@/constants/layout';
import { withOpacity } from '@/constants/colors';
import { useTheme } from '@/contexts/ThemeContext';
import { coursesApi } from '@/services/api/courses';
import { CourseLesson, CourseSection, CourseTrack } from '@/types/course';
import { extractYouTubeId } from '@/utils/youtube';
import { hapticMedium, hapticLight } from '@/utils/haptics';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Document icon based on file extension
function getDocumentIcon(url: string): keyof typeof Ionicons.glyphMap {
  const ext = url.split('.').pop()?.toLowerCase() || '';
  if (['pdf'].includes(ext)) return 'document-text-outline';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image-outline';
  if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) return 'videocam-outline';
  if (['mp3', 'wav', 'ogg', 'aac'].includes(ext)) return 'musical-note-outline';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive-outline';
  return 'attach-outline';
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function LessonViewScreen() {
  const { slug, lessonSlug } = useLocalSearchParams<{ slug: string; lessonSlug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();

  // State
  const [lesson, setLesson] = useState<CourseLesson | null>(null);
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [track, setTrack] = useState<CourseTrack | null>(null);
  const [courseId, setCourseId] = useState<number | null>(null);
  const [courseCommentsDisabled, setCourseCommentsDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [commentsCount, setCommentsCount] = useState(0);

  // Refs for scroll-to
  const scrollViewRef = useRef<ScrollView>(null);
  const [docsY, setDocsY] = useState(0);

  // Completion animation
  const completeAnim = useRef(new Animated.Value(0)).current;
  const navAnim = useRef(new Animated.Value(1)).current;

  // ---------------------------------------------------------------------------
  // Fetch Lesson (via course by-slug with intended_lesson_slug)
  // ---------------------------------------------------------------------------

  const fetchLesson = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await coursesApi.getCourseBySlug(slug, lessonSlug);

      if (!response.success) {
        setError(response.error?.message || 'Failed to load lesson');
        return;
      }

      const { course, sections: courseSections, track: courseTrack } = response.data;
      setCourseId(course.id);
      setCourseCommentsDisabled(course.settings?.disable_comments === 'yes');
      setSections(courseSections);
      setTrack(courseTrack);

      // Find the target lesson (the one with content populated)
      let targetLesson: CourseLesson | null = null;
      for (const section of courseSections) {
        for (const l of section.lessons) {
          if (l.slug === lessonSlug) {
            targetLesson = l;
            break;
          }
        }
        if (targetLesson) break;
      }

      if (targetLesson) {
        // If content is empty due to lazy_load, fetch individually
        if (!targetLesson.content && targetLesson.can_view && !targetLesson.is_locked) {
          const lessonResponse = await coursesApi.getLessonBySlug(slug, lessonSlug);
          if (lessonResponse.success) {
            targetLesson = lessonResponse.data.lesson;
          }
        }
        setLesson(targetLesson);
        setCommentsCount(targetLesson.comments_count || 0);
      } else {
        setError('Lesson not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [slug, lessonSlug]);

  useEffect(() => {
    fetchLesson();
  }, [fetchLesson]);

  // ---------------------------------------------------------------------------
  // Flat lesson list for prev/next navigation
  // ---------------------------------------------------------------------------

  const flatLessons = useMemo(() => {
    const list: CourseLesson[] = [];
    for (const section of sections) {
      for (const l of section.lessons) {
        list.push(l);
      }
    }
    return list;
  }, [sections]);

  const currentIndex = flatLessons.findIndex((l) => l.slug === lessonSlug);
  const prevLesson = currentIndex > 0 ? flatLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < flatLessons.length - 1 ? flatLessons[currentIndex + 1] : null;

  // "Lesson 3 of 16" for nav bar (avoids duplicating hero title)
  const navTitle = currentIndex >= 0 && flatLessons.length > 0
    ? `Lesson ${currentIndex + 1} of ${flatLessons.length}`
    : 'Lesson';

  // ---------------------------------------------------------------------------
  // Completion toggle
  // ---------------------------------------------------------------------------

  const isCompleted = useMemo(() => {
    if (!track || !lesson) return false;
    return track.completed_lessons.some((id) => String(id) === String(lesson.id));
  }, [track, lesson]);

  const handleMarkComplete = async () => {
    if (!courseId || !lesson || isCompleted) return;
    hapticMedium();
    setCompleting(true);

    // Optimistic update
    setTrack((prev) => {
      if (!prev) return prev;
      return { ...prev, completed_lessons: [...prev.completed_lessons, String(lesson.id)] };
    });

    try {
      const response = await coursesApi.toggleLessonCompletion(courseId, lesson.id, 'completed');

      if (!response.success) {
        // Revert optimistic update
        setTrack((prev) => {
          if (!prev) return prev;
          const lessonIdStr = String(lesson.id);
          return { ...prev, completed_lessons: prev.completed_lessons.filter((id) => String(id) !== lessonIdStr) };
        });
        Alert.alert('Error', response.error?.message || 'Failed to mark complete');
        setCompleting(false);
        return;
      }

      // Use server track state
      setTrack(response.data.track);

      // Show success state briefly, then animate to nav row
      setJustCompleted(true);
      completeAnim.setValue(0);
      Animated.timing(completeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        // After success shown, transition to nav row
        setTimeout(() => {
          setCompleting(false);
          setJustCompleted(false);
          navAnim.setValue(0);
          Animated.spring(navAnim, {
            toValue: 1,
            tension: 80,
            friction: 12,
            useNativeDriver: true,
          }).start();
        }, 800);
      });

      if (response.data.is_completed) {
        setTimeout(() => {
          Alert.alert('Congratulations!', 'You have completed this course!');
        }, 1400);
      }
    } catch (err) {
      // Revert optimistic update
      setTrack((prev) => {
        if (!prev) return prev;
        const lessonIdStr = String(lesson.id);
        return { ...prev, completed_lessons: prev.completed_lessons.filter((id) => String(id) !== lessonIdStr) };
      });
      Alert.alert('Error', 'Something went wrong');
      setCompleting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Navigate to prev/next lesson
  // ---------------------------------------------------------------------------

  const navigateToLesson = (targetLesson: CourseLesson) => {
    if (targetLesson.is_locked || !targetLesson.can_view) return;
    hapticLight();
    router.replace({
      pathname: '/courses/[slug]/lesson/[lessonSlug]',
      params: { slug, lessonSlug: targetLesson.slug },
    });
  };

  // ---------------------------------------------------------------------------
  // Extract hero image from content HTML
  // ---------------------------------------------------------------------------
  // Fluent uses featured_image for thumbnails only — the actual display image
  // is added as an image block inside lesson content. We extract the first
  // <img> to render as a full-width hero and strip it from the HTML.

  const [heroHeight, setHeroHeight] = useState<number | null>(null);

  const { heroImageUrl, cleanedHtml } = useMemo(() => {
    const content = lesson?.content || '';
    if (!content.trim()) return { heroImageUrl: null, cleanedHtml: content };

    // Match the first <figure> containing an <img>, or a standalone <img>
    const figureMatch = content.match(/<figure[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["'][^>]*>[\s\S]*?<\/figure>/i);
    if (figureMatch) {
      return {
        heroImageUrl: figureMatch[1],
        cleanedHtml: content.replace(figureMatch[0], '').trim(),
      };
    }

    // Fallback: standalone <img> (not inside a figure)
    const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["'][^>]*\/?>/i);
    if (imgMatch) {
      return {
        heroImageUrl: imgMatch[1],
        cleanedHtml: content.replace(imgMatch[0], '').trim(),
      };
    }

    return { heroImageUrl: null, cleanedHtml: content };
  }, [lesson?.content]);

  // Resolve natural aspect ratio for hero image
  useEffect(() => {
    if (!heroImageUrl) return;
    Image.getSize(
      heroImageUrl,
      (w, h) => setHeroHeight(Math.round((SCREEN_WIDTH / w) * h)),
      () => setHeroHeight(Math.round(SCREEN_WIDTH * 0.56)), // fallback ~16:9
    );
  }, [heroImageUrl]);

  // ---------------------------------------------------------------------------
  // Media detection
  // ---------------------------------------------------------------------------

  const videoUrl = lesson?.meta?.media?.url;
  const youtubeId = videoUrl ? extractYouTubeId(videoUrl) : null;
  const contentWidth = SCREEN_WIDTH - spacing.lg * 2;

  // Documents & comments
  const documents = lesson?.meta?.document_lists ?? [];
  const commentsEnabled = lesson?.meta?.enable_comments !== 'no' && !courseCommentsDisabled;
  const hasHeroImage = !!heroImageUrl && !!heroHeight;

  // ---------------------------------------------------------------------------
  // Render: Loading / Error
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { backgroundColor: themeColors.background, paddingTop: insets.top }]}>
          <PageHeader leftAction="back" onLeftPress={() => router.back()} title="Lesson" />
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={themeColors.primary} />
          </View>
        </View>
      </>
    );
  }

  if (error || !lesson) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { backgroundColor: themeColors.background, paddingTop: insets.top }]}>
          <PageHeader leftAction="back" onLeftPress={() => router.back()} title="Lesson" />
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={themeColors.error} />
            <Text style={[styles.errorText, { color: themeColors.error }]}>{error || 'Lesson not found'}</Text>
            <Text style={[styles.retryButton, { color: themeColors.primary }]} onPress={fetchLesson}>
              Tap to retry
            </Text>
          </View>
        </View>
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Locked lesson
  // ---------------------------------------------------------------------------

  if (lesson.is_locked || !lesson.can_view) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { backgroundColor: themeColors.background, paddingTop: insets.top }]}>
          <PageHeader leftAction="back" onLeftPress={() => router.back()} title={lesson.title} />
          <View style={styles.centerContainer}>
            <Ionicons name="lock-closed" size={64} color={themeColors.textTertiary} />
            <Text style={[styles.lockedTitle, { color: themeColors.text }]}>This lesson is locked</Text>
            <Text style={[styles.lockedMessage, { color: themeColors.textSecondary }]}>
              Please enroll in this course to access this lesson
            </Text>
            <TouchableOpacity
              style={[styles.backToCourseButton, { backgroundColor: themeColors.primary }]}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Text style={[styles.backToCourseText, { color: themeColors.textInverse }]}>Back to Course</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.container, { backgroundColor: themeColors.background, paddingTop: insets.top }]}>
        <PageHeader leftAction="back" onLeftPress={() => router.back()} title={navTitle} />

        <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollContent}>
          {/* Hero Image with Gradient Overlay + Title + Action Badges */}
          {hasHeroImage && (
            <View style={[styles.heroContainer, { height: heroHeight! }]}>
              <Image
                source={{ uri: heroImageUrl! }}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.7)']}
                locations={[0, 0.4, 1]}
                style={styles.heroGradient}
              >
                {/* Title at top */}
                <Text style={styles.heroTitle} numberOfLines={3}>{lesson.title}</Text>

                {/* Action badges at bottom-right */}
                <View style={styles.heroBadgeRow}>
                  {commentsEnabled && (
                    <TouchableOpacity
                      style={styles.heroBadge}
                      onPress={() => router.push({ pathname: '/comments/[postId]', params: { postId: lesson.id.toString() } })}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="chatbubble-outline" size={14} color="#fff" />
                      {commentsCount > 0 && (
                        <Text style={styles.heroBadgeText}>{commentsCount}</Text>
                      )}
                    </TouchableOpacity>
                  )}
                  {documents.length > 0 && (
                    <TouchableOpacity
                      style={styles.heroBadge}
                      onPress={() => scrollViewRef.current?.scrollTo({ y: docsY, animated: true })}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="attach-outline" size={14} color="#fff" />
                      <Text style={styles.heroBadgeText}>{documents.length}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </LinearGradient>
            </View>
          )}

          {/* Video Embed (below hero, centered in themed card) */}
          {youtubeId && (
            <View style={[styles.videoContainer, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <YouTubeEmbed videoId={youtubeId} />
            </View>
          )}

          {/* Lesson Content */}
          <View style={[styles.contentContainer, hasHeroImage && { paddingTop: spacing.md }]}>
            {/* Title (only when no hero image — hero has title overlay) */}
            {!hasHeroImage && (
              <Text style={[styles.lessonTitle, { color: themeColors.text }]}>{lesson.title}</Text>
            )}
            {cleanedHtml && cleanedHtml.trim() !== '' ? (
              <HtmlContent html={cleanedHtml} contentWidth={contentWidth} />
            ) : (
              <Text style={[styles.noContent, { color: themeColors.textTertiary }]}>
                No content available for this lesson.
              </Text>
            )}
          </View>

          {/* Documents */}
          {documents.length > 0 && (
            <View
              style={[styles.documentsSection, { borderTopColor: themeColors.border }]}
              onLayout={(e) => setDocsY(e.nativeEvent.layout.y)}
            >
              <Text style={[styles.documentsSectionTitle, { color: themeColors.text }]}>
                Documents
              </Text>
              {documents.map((doc, index) => {
                const title = doc.title || doc.media_key || doc.url.split('/').pop() || 'Document';
                const iconName = getDocumentIcon(doc.url);
                return (
                  <TouchableOpacity
                    key={doc.id || index}
                    style={[styles.documentRow, { backgroundColor: themeColors.backgroundSecondary }]}
                    onPress={() => Linking.openURL(doc.url)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.documentIcon, { backgroundColor: withOpacity(themeColors.primary, 0.1) }]}>
                      <Ionicons name={iconName} size={18} color={themeColors.primary} />
                    </View>
                    <Text style={[styles.documentTitle, { color: themeColors.text }]} numberOfLines={2}>
                      {title}
                    </Text>
                    <Ionicons name="open-outline" size={16} color={themeColors.textTertiary} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Comments Button */}
          {commentsEnabled && (
            <TouchableOpacity
              style={[styles.commentsButton, { borderTopColor: themeColors.border }]}
              onPress={() => router.push({ pathname: '/comments/[postId]', params: { postId: lesson.id.toString() } })}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubble-outline" size={18} color={themeColors.primary} />
              <Text style={[styles.commentsButtonText, { color: themeColors.text }]}>
                {commentsCount > 0 ? `${commentsCount} Comment${commentsCount === 1 ? '' : 's'}` : 'Comments'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={themeColors.textTertiary} />
            </TouchableOpacity>
          )}

          {/* Bottom padding for sticky bar */}
          <View style={{ height: 120 }} />
        </ScrollView>


        {/* Sticky Bottom Bar */}
        <View style={[styles.bottomBar, { backgroundColor: themeColors.surface, borderTopColor: themeColors.border, paddingBottom: insets.bottom }]}>
          {/* State: Completing / Just completed — animated button */}
          {track?.isEnrolled && (completing || justCompleted) && (
            <Animated.View
              style={[
                styles.completeButton,
                {
                  backgroundColor: justCompleted ? themeColors.success : themeColors.primary,
                  transform: justCompleted
                    ? [{ scale: completeAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.08, 1] }) }]
                    : [],
                  opacity: justCompleted
                    ? completeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] })
                    : 1,
                },
              ]}
            >
              {justCompleted ? (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={themeColors.textInverse} />
                  <Text style={[styles.completeButtonText, { color: themeColors.textInverse }]}>
                    Completed!
                  </Text>
                </>
              ) : (
                <ActivityIndicator size="small" color={themeColors.textInverse} />
              )}
            </Animated.View>
          )}

          {/* State: Not completed (idle) — show Mark as Complete button */}
          {track?.isEnrolled && !isCompleted && !completing && !justCompleted && (
            <TouchableOpacity
              style={[styles.completeButton, { backgroundColor: themeColors.primary }]}
              onPress={handleMarkComplete}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color={themeColors.textInverse} />
              <Text style={[styles.completeButtonText, { color: themeColors.textInverse }]}>
                Mark as Complete
              </Text>
            </TouchableOpacity>
          )}

          {/* State: Completed OR not enrolled — show nav row */}
          {(!track?.isEnrolled || (isCompleted && !completing && !justCompleted)) && (
            <Animated.View
              style={[
                styles.navRow,
                isCompleted && {
                  opacity: navAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
                  transform: [{ translateY: navAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
                },
              ]}
            >
              {/* Prev button */}
              <TouchableOpacity
                style={[styles.navButton, { backgroundColor: themeColors.backgroundSecondary }]}
                onPress={() => prevLesson && navigateToLesson(prevLesson)}
                disabled={!prevLesson || prevLesson.is_locked}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="chevron-back"
                  size={18}
                  color={!prevLesson || prevLesson.is_locked ? themeColors.textTertiary : themeColors.primary}
                />
                <Text
                  style={[
                    styles.navButtonLabel,
                    { color: !prevLesson || prevLesson.is_locked ? themeColors.textTertiary : themeColors.text },
                  ]}
                  numberOfLines={1}
                >
                  {prevLesson ? prevLesson.title : 'Previous'}
                </Text>
              </TouchableOpacity>

              {/* Completed checkmark (center) */}
              {track?.isEnrolled && isCompleted && (
                <View style={[styles.completedBadge, { backgroundColor: withOpacity(themeColors.success, 0.15) }]}>
                  <Ionicons name="checkmark-circle" size={22} color={themeColors.success} />
                </View>
              )}

              {/* Next button */}
              <TouchableOpacity
                style={[styles.navButton, { backgroundColor: themeColors.backgroundSecondary }]}
                onPress={() => nextLesson && navigateToLesson(nextLesson)}
                disabled={!nextLesson || nextLesson.is_locked}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.navButtonLabel,
                    { color: !nextLesson || nextLesson.is_locked ? themeColors.textTertiary : themeColors.text, textAlign: 'right' },
                  ]}
                  numberOfLines={1}
                >
                  {nextLesson ? nextLesson.title : 'Next'}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={!nextLesson || nextLesson.is_locked ? themeColors.textTertiary : themeColors.primary}
                />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
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
    flexGrow: 1,
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },

  errorText: {
    fontSize: typography.size.md,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },

  retryButton: {
    fontSize: typography.size.sm,
    fontWeight: '600',
  },

  // Locked
  lockedTitle: {
    fontSize: typography.size.xl,
    fontWeight: '600',
    marginTop: spacing.lg,
  },

  lockedMessage: {
    fontSize: typography.size.md,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xxl,
  },

  backToCourseButton: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: sizing.borderRadius.md,
  },

  backToCourseText: {
    fontSize: typography.size.md,
    fontWeight: '600',
  },

  // Hero
  heroContainer: {
    width: '100%',
    position: 'relative',
  },

  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },

  heroTitle: {
    fontSize: typography.size.xxl,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    marginTop: spacing.md,
  },

  heroBadgeRow: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    gap: spacing.sm,
  },

  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 20,
  },

  heroBadgeText: {
    fontSize: typography.size.xs,
    fontWeight: '600',
    color: '#fff',
  },

  // Video
  videoContainer: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: sizing.borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },

  // Content
  contentContainer: {
    padding: spacing.lg,
  },

  lessonTitle: {
    fontSize: typography.size.xl,
    fontWeight: '700',
    marginBottom: spacing.lg,
  },

  noContent: {
    fontSize: typography.size.md,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.xxl,
  },

  // Bottom Bar (sticky — nav + complete)
  bottomBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },

  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: sizing.borderRadius.md,
    gap: spacing.sm,
  },

  completeButtonText: {
    fontSize: typography.size.sm,
    fontWeight: '600',
  },

  navRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },

  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: sizing.borderRadius.sm,
    gap: 4,
  },

  navButtonLabel: {
    flex: 1,
    fontSize: typography.size.xs,
    fontWeight: '500',
  },

  completedBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Documents
  documentsSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  documentsSectionTitle: {
    fontSize: typography.size.md,
    fontWeight: '600',
    marginBottom: spacing.md,
  },

  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: sizing.borderRadius.sm,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },

  documentIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  documentTitle: {
    flex: 1,
    fontSize: typography.size.sm,
    fontWeight: '500',
  },

  // Comments
  commentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },

  commentsButtonText: {
    flex: 1,
    fontSize: typography.size.md,
    fontWeight: '500',
  },
});
