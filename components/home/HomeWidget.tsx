// =============================================================================
// HOME WIDGET - Shared wrapper for home page widget sections
// =============================================================================
// Provides consistent section header with title, icon, and "See all" link.
// Supports edit mode with drag handle, toggle switch, and long-press entry.
// Children render the actual widget content.
// =============================================================================

import React, { useCallback, useState } from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, shadows, sizing } from '@/constants/layout';
import { withOpacity } from '@/constants/colors';
import { useTheme } from '@/contexts/ThemeContext';
import { hapticMedium } from '@/utils/haptics';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface HomeWidgetProps {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  seeAllLabel?: string;
  onSeeAll?: () => void;
  children: React.ReactNode;
  hidden?: boolean;
  // Edit mode
  isEditing?: boolean;
  isEnabled?: boolean;
  canDisable?: boolean;
  onToggle?: () => void;
  drag?: () => void;
  isActive?: boolean;
  onEnterEditMode?: () => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function HomeWidget({
  title,
  icon,
  seeAllLabel = 'See all',
  onSeeAll,
  children,
  hidden,
  isEditing,
  isEnabled = true,
  canDisable = true,
  onToggle,
  drag,
  isActive,
  onEnterEditMode,
}: HomeWidgetProps) {
  const { colors: themeColors } = useTheme();

  // Track whether children rendered any visible content (normal mode only)
  const [hasContent, setHasContent] = useState<boolean | null>(null);
  const handleChildLayout = useCallback((e: LayoutChangeEvent) => {
    setHasContent(e.nativeEvent.layout.height > 0);
  }, []);

  if (hidden) return null;

  const containerStyle = [
    styles.container,
    isActive && [styles.activeContainer, shadows.md],
    isEditing && !isEnabled && { opacity: 0.4 },
  ];

  // In edit mode, header has drag grip + toggle instead of "See all"
  // Hide entirely if widget has no content (e.g. user not in that space)
  if (isEditing) {
    return (
      <View style={hasContent ? containerStyle : undefined}>
        {hasContent === true && (
          <View style={styles.header}>
            {/* Drag Handle */}
            <Pressable
              onPressIn={drag}
              style={styles.dragHandle}
              hitSlop={8}
            >
              <Ionicons name="reorder-three" size={24} color={themeColors.textSecondary} />
            </Pressable>

            {/* Title */}
            <View style={styles.headerLeft}>
              {icon && (
                <Ionicons
                  name={icon}
                  size={20}
                  color={themeColors.text}
                  style={styles.headerIcon}
                />
              )}
              <Text style={[styles.title, { color: themeColors.text }]}>{title}</Text>
            </View>

            {/* Toggle */}
            {canDisable && onToggle && (
              <Switch
                value={isEnabled}
                onValueChange={onToggle}
                trackColor={{
                  false: withOpacity(themeColors.textTertiary, 0.3),
                  true: withOpacity(themeColors.primary, 0.4),
                }}
                thumbColor={isEnabled ? themeColors.primary : themeColors.textTertiary}
              />
            )}
          </View>
        )}

        {/* Widget Content — measured; hidden when disabled in edit mode */}
        <View onLayout={handleChildLayout}>
          {isEnabled && children}
        </View>
      </View>
    );
  }

  // Normal mode — long-press header to enter edit mode
  // Hide header (and container spacing) when children render nothing
  return (
    <View style={hasContent ? styles.container : undefined}>
      {hasContent === true && (
        <Pressable
          onLongPress={() => {
            hapticMedium();
            onEnterEditMode?.();
          }}
          delayLongPress={400}
          style={styles.header}
        >
          <View style={styles.headerLeft}>
            {icon && (
              <Ionicons
                name={icon}
                size={20}
                color={themeColors.text}
                style={styles.headerIcon}
              />
            )}
            <Text style={[styles.title, { color: themeColors.text }]}>{title}</Text>
          </View>

          {onSeeAll && (
            <Pressable
              style={styles.seeAllButton}
              onPress={onSeeAll}
            >
              <Text style={[styles.seeAllText, { color: themeColors.primary }]}>
                {seeAllLabel}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={themeColors.primary} />
            </Pressable>
          )}
        </Pressable>
      )}

      {/* Widget Content — measured to detect empty widgets */}
      <View onLayout={handleChildLayout}>
        {children}
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },

  activeContainer: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: sizing.borderRadius.md,
    transform: [{ scale: 1.02 }],
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  headerIcon: {
    marginRight: spacing.sm,
  },

  dragHandle: {
    marginRight: spacing.sm,
    padding: spacing.xs,
  },

  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },

  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  seeAllText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
});

export default HomeWidget;
