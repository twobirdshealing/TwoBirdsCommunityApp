// =============================================================================
// MEDIA VIEWER - Fullscreen image gallery/lightbox with swipe and pinch-to-zoom
// =============================================================================
// Reusable component for viewing images in a gallery overlay.
// Used from FeedCard image taps and Single Post View.
// =============================================================================

import React, { useState, useCallback } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { File, Directory, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { sizing, spacing, typography } from '@/constants/layout';
import { createLogger } from '@/utils/logger';

const log = createLogger('MediaViewer');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface MediaViewerImage {
  url: string;
  width?: number;
  height?: number;
}

interface MediaViewerProps {
  visible: boolean;
  images: MediaViewerImage[];
  initialIndex?: number;
  onClose: () => void;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// -----------------------------------------------------------------------------
// Zoomable Image Sub-component
// -----------------------------------------------------------------------------

function ZoomableImage({ uri }: { uri: string }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        savedScale.value = scale.value;
      }
    });

  const panGesture = Gesture.Pan()
    .minPointers(2)
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onStart(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  const composed = Gesture.Simultaneous(pinchGesture, panGesture);
  const gesture = Gesture.Exclusive(doubleTapGesture, composed);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.imageWrapper, animatedStyle]}>
        <Image
          source={{ uri }}
          style={styles.fullImage}
          contentFit="contain"
          transition={200}
          cachePolicy="memory-disk"
        />
      </Animated.View>
    </GestureDetector>
  );
}

// -----------------------------------------------------------------------------
// MediaViewer Component
// -----------------------------------------------------------------------------

export function MediaViewer({
  visible,
  images,
  initialIndex = 0,
  onClose,
}: MediaViewerProps) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [saving, setSaving] = useState(false);

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      if (index >= 0 && index < images.length) {
        setCurrentIndex(index);
      }
    },
    [images.length]
  );

  // ---------------------------------------------------------------------------
  // Share / Download handler
  // ---------------------------------------------------------------------------

  const handleShare = async () => {
    if (saving) return;
    const imageUrl = images[currentIndex]?.url;
    if (!imageUrl) return;

    try {
      setSaving(true);

      // Extract a filename from the URL
      const urlParts = imageUrl.split('/');
      const rawName = urlParts[urlParts.length - 1]?.split('?')[0] || 'image.jpg';
      const fileName = rawName.includes('.') ? rawName : `${rawName}.jpg`;

      // Download using new File API (SDK 54)
      const destination = new Directory(Paths.cache);
      const output = await File.downloadFileAsync(imageUrl, destination, { idempotent: true });

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(output.uri, {
          mimeType: 'image/jpeg',
          dialogTitle: 'Share Image',
        });
      } else {
        Alert.alert('Sharing not available', 'Sharing is not supported on this device.');
      }
    } catch (err) {
      log.error(err, 'Failed to share image');
      Alert.alert('Error', 'Failed to share image. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Save to gallery handler
  // ---------------------------------------------------------------------------

  const handleSave = async () => {
    if (saving) return;
    const imageUrl = images[currentIndex]?.url;
    if (!imageUrl) return;

    try {
      setSaving(true);

      // Request permission
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photo library to save images.');
        return;
      }

      // Download to cache
      const destination = new Directory(Paths.cache);
      const output = await File.downloadFileAsync(imageUrl, destination, { idempotent: true });

      // Save to gallery
      await MediaLibrary.saveToLibraryAsync(output.uri);
      Alert.alert('Saved', 'Image saved to your gallery.');
    } catch (err) {
      log.error(err, 'Failed to save image');
      Alert.alert('Error', 'Failed to save image. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!visible || images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.container}>
        <View style={styles.container}>
          {/* Background */}
          <View style={StyleSheet.absoluteFill}>
            <View style={styles.backdrop} />
          </View>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: SCREEN_WIDTH * initialIndex, y: 0 }}
            onMomentumScrollEnd={handleMomentumScrollEnd}
          >
            {images.map((image, idx) => (
              <ZoomableImage key={idx} uri={image.url} />
            ))}
          </ScrollView>

          {/* Top Bar - Close + Counter + Share */}
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <Pressable
              style={styles.topBarButton}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>

            {images.length > 1 && (
              <View style={styles.counter}>
                <Text style={styles.counterText}>
                  {currentIndex + 1} / {images.length}
                </Text>
              </View>
            )}

            <View style={styles.topBarActions}>
              <Pressable
                style={styles.topBarButton}
                onPress={handleSave}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                disabled={saving}
              >
                <Ionicons
                  name="download-outline"
                  size={24}
                  color={saving ? 'rgba(255,255,255,0.4)' : '#fff'}
                />
              </Pressable>

              <Pressable
                style={styles.topBarButton}
                onPress={handleShare}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                disabled={saving}
              >
                <Ionicons
                  name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'}
                  size={24}
                  color={saving ? 'rgba(255,255,255,0.4)' : '#fff'}
                />
              </Pressable>
            </View>
          </View>

          {/* Thumbnail Strip (only if multiple images) */}
          {images.length > 1 && (
            <View style={[styles.thumbnailStrip, { paddingBottom: insets.bottom + 12 }]}>
              {images.map((img, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.thumbnail,
                    idx === currentIndex && styles.thumbnailActive,
                  ]}
                >
                  <Image
                    source={{ uri: img.url }}
                    style={styles.thumbnailImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },

  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  topBarButton: {
    width: sizing.iconButton,
    height: sizing.iconButton,
    justifyContent: 'center',
    alignItems: 'center',
  },

  counter: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: sizing.borderRadius.lg,
  },

  counterText: {
    color: '#fff',
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },

  imageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },

  fullImage: {
    width: '100%',
    height: '100%',
  },

  // Thumbnail strip
  thumbnailStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },

  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: sizing.borderRadius.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    opacity: 0.5,
  },

  thumbnailActive: {
    borderColor: '#fff',
    opacity: 1,
  },

  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
});

export default MediaViewer;
