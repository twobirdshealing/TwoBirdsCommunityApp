// =============================================================================
// PAGE HEADER - Reusable header for detail screens, modals, etc.
// =============================================================================
// Use this for any screen that needs: back/close button, title, optional right action
// NOT for tab-level headers (use TopHeader for that)
//
// Usage:
//   <PageHeader
//     leftAction="back"
//     onLeftPress={() => router.back()}
//     title="Event Details"
//     showLoader={isLoading}
//     rightIcon="cart-outline"
//     onRightPress={handleCart}
//   />
//
//   <PageHeader
//     leftAction="close"
//     onLeftPress={onClose}
//     title="Select Space"
//   />
//
//   <PageHeader
//     leftAction="back"
//     onLeftPress={() => router.back()}
//     title={space?.title}
//     rightElement={<SpaceMenu slug={slug} />}
//   />
// =============================================================================

import React, { ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/layout';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface PageHeaderProps {
  // Left side
  leftAction?: 'back' | 'close' | 'none';
  onLeftPress?: () => void;
  
  // Center
  title?: string;
  showLoader?: boolean;
  
  // Right side - use ONE of these
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
  rightElement?: ReactNode;
  
  // Optional: include safe area padding (default: false, container handles it)
  includeSafeArea?: boolean;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function PageHeader({
  leftAction = 'back',
  onLeftPress,
  title,
  showLoader = false,
  rightIcon,
  onRightPress,
  rightElement,
  includeSafeArea = false,
}: PageHeaderProps) {
  
  // ---------------------------------------------------------------------------
  // Handlers with haptic feedback
  // ---------------------------------------------------------------------------
  
  const handleLeftPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLeftPress?.();
  };
  
  const handleRightPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRightPress?.();
  };
  
  // ---------------------------------------------------------------------------
  // Determine left icon
  // ---------------------------------------------------------------------------
  
  const getLeftIcon = (): keyof typeof Ionicons.glyphMap | null => {
    switch (leftAction) {
      case 'back':
        return 'chevron-back';
      case 'close':
        return 'close';
      case 'none':
        return null;
      default:
        return 'chevron-back';
    }
  };
  
  const leftIcon = getLeftIcon();
  
  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Left Button */}
        {leftIcon ? (
          <Pressable
            onPress={handleLeftPress}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name={leftIcon} size={24} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.buttonSpacer} />
        )}
        
        {/* Center: Title + Loader */}
        <View style={styles.center}>
          {title && (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          )}
          {showLoader && (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={styles.loader}
            />
          )}
        </View>
        
        {/* Right Side */}
        {rightElement ? (
          <View style={styles.rightElement}>
            {rightElement}
          </View>
        ) : rightIcon ? (
          <Pressable
            onPress={handleRightPress}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name={rightIcon} size={24} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.buttonSpacer} />
        )}
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 52,
  },
  
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  
  buttonPressed: {
    backgroundColor: colors.backgroundSecondary,
  },
  
  buttonSpacer: {
    width: 40,
    height: 40,
  },
  
  center: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.sm,
  },
  
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  
  loader: {
    marginLeft: spacing.xs,
  },
  
  rightElement: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
});

export default PageHeader;
