// =============================================================================
// HOME WIDGET - Shared wrapper for home page widget sections
// =============================================================================
// Provides consistent section header with title, icon, and "See all" link.
// Children render the actual widget content.
// =============================================================================

import React, { useCallback, useState } from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';

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
}: HomeWidgetProps) {
  const { colors: themeColors } = useTheme();

  // Track whether children rendered any visible content (default true to avoid double-render)
  const [hasContent, setHasContent] = useState(true);
  const handleChildLayout = useCallback((e: LayoutChangeEvent) => {
    const visible = e.nativeEvent.layout.height > 0;
    setHasContent((prev) => (prev === visible ? prev : visible));
  }, []);

  if (hidden) return null;

  // Hide entire widget when children confirmed empty
  if (!hasContent) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
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
      </View>

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
