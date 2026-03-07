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
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hapticLight } from '@/utils/haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, shadows, sizing, typography } from '@/constants/layout';

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
  const { colors: themeColors } = useTheme();

  // ---------------------------------------------------------------------------
  // Handlers with haptic feedback
  // ---------------------------------------------------------------------------
  
  const handleLeftPress = () => {
    hapticLight();
    onLeftPress?.();
  };
  
  const handleRightPress = () => {
    hapticLight();
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
    <View style={[styles.container, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
      <View style={styles.content}>
        {/* Left Button */}
        {leftIcon ? (
          <Pressable
            onPress={handleLeftPress}
            style={({ pressed }) => [
              styles.button,
              pressed && [styles.buttonPressed, { backgroundColor: themeColors.backgroundSecondary }],
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={leftAction === 'close' ? 'Close' : 'Go back'}
          >
            <Ionicons name={leftIcon} size={24} color={themeColors.text} />
          </Pressable>
        ) : (
          <View style={styles.buttonSpacer} />
        )}
        
        {/* Center: Title + Loader */}
        <View style={styles.center}>
          {title && (
            <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={1}>
              {title}
            </Text>
          )}
          {showLoader && (
            <ActivityIndicator
              size="small"
              color={themeColors.primary}
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
              pressed && [styles.buttonPressed, { backgroundColor: themeColors.backgroundSecondary }],
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Action"
          >
            <Ionicons name={rightIcon} size={24} color={themeColors.text} />
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
    borderBottomWidth: 1,
    ...shadows.sm,
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
    width: sizing.iconButton,
    height: sizing.iconButton,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: sizing.iconButton / 2,
  },
  
  buttonPressed: {
    opacity: 0.7,
  },
  
  buttonSpacer: {
    width: sizing.iconButton,
    height: sizing.iconButton,
  },
  
  center: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.sm,
  },
  
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
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
