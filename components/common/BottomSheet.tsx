// =============================================================================
// BOTTOM SHEET - Reusable slide-up panel component
// =============================================================================
// Provides consistent UX across all bottom sheets in the app:
// - Handle bar with swipe-to-close
// - Bounce animation on open
// - Tap backdrop to dismiss
// - Configurable height modes
// =============================================================================

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing, shadows } from '@/constants/layout';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;

  // Height
  heightMode?: 'content' | 'percentage';
  heightPercentage?: number;  // 0-100, used when heightMode='percentage'
  minHeight?: number;         // used when heightMode='content'
  maxHeight?: string;         // e.g. '60%', used when heightMode='content'

  // Header
  title?: string;

  // Swipe
  enableSwipeToClose?: boolean;
  swipeThreshold?: number;

  // Content
  children: React.ReactNode;

  // Keyboard
  keyboardAvoiding?: boolean;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function BottomSheet({
  visible,
  onClose,
  heightMode = 'content',
  heightPercentage = 75,
  minHeight = 200,
  maxHeight = '60%',
  title,
  enableSwipeToClose = true,
  swipeThreshold = 100,
  children,
  keyboardAvoiding = false,
}: BottomSheetProps) {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Compute sheet height for percentage mode
  const sheetHeight = heightMode === 'percentage'
    ? SCREEN_HEIGHT * (heightPercentage / 100)
    : undefined;

  // -------------------------------------------------------------------------
  // Bounce-in animation on open/close
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (visible) {
      // Start off-screen, spring up with bounce
      translateY.setValue(sheetHeight || SCREEN_HEIGHT * 0.6);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
        mass: 0.8,
      }).start();
    }
  }, [visible]);

  // -------------------------------------------------------------------------
  // PanResponder for swipe-to-close (attached to handle only)
  // -------------------------------------------------------------------------

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => enableSwipeToClose,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        enableSwipeToClose && gestureState.dy > 10,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > swipeThreshold) {
          // Swipe past threshold - close
          Animated.timing(translateY, {
            toValue: sheetHeight || SCREEN_HEIGHT * 0.6,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onClose();
          });
        } else {
          // Snap back with spring
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 200,
          }).start();
        }
      },
    })
  ).current;

  if (!visible) return null;

  // -------------------------------------------------------------------------
  // Build container style based on height mode
  // -------------------------------------------------------------------------

  const containerStyle: any[] = [
    styles.container,
    {
      backgroundColor: themeColors.surface,
      paddingBottom: insets.bottom,
    },
  ];

  if (heightMode === 'percentage') {
    containerStyle.push({ height: sheetHeight });
  } else {
    // content mode - flex to content with min/max
    containerStyle.push({ minHeight, maxHeight });
  }

  // -------------------------------------------------------------------------
  // Inner content (optionally wrapped in KeyboardAvoidingView)
  // -------------------------------------------------------------------------

  const innerContent = (
    <>
      {/* Handle bar - swipeable */}
      <View style={styles.handleContainer} {...panResponder.panHandlers}>
        <View style={[styles.handle, { backgroundColor: themeColors.borderLight }]} />
      </View>

      {/* Header */}
      {title ? (
        <View style={[styles.header, { borderBottomColor: themeColors.borderLight }]}>
          <Text style={[styles.title, { color: themeColors.text }]}>{title}</Text>
        </View>
      ) : null}

      {/* Content */}
      {children}
    </>
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Backdrop - tap to close */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <Animated.View
        style={[
          ...containerStyle,
          { transform: [{ translateY }] },
        ]}
      >
        {keyboardAvoiding ? (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {innerContent}
          </KeyboardAvoidingView>
        ) : (
          innerContent
        )}
      </Animated.View>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },

  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: sizing.borderRadius.xl,
    borderTopRightRadius: sizing.borderRadius.xl,
    ...shadows.lg,
  },

  flex: {
    flex: 1,
  },

  handleContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },

  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },

  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },

  title: {
    fontSize: typography.size.lg,
    fontWeight: '600',
  },
});

export default BottomSheet;
