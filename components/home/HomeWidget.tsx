// =============================================================================
// HOME WIDGET - Shared wrapper for home page widget sections
// =============================================================================
// Provides consistent section header with title, icon, and "See all" link.
// Children render the actual widget content.
// =============================================================================

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

  if (hidden) return null;

  return (
    <View style={styles.container}>
      {/* Section Header */}
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
          <TouchableOpacity
            style={styles.seeAllButton}
            onPress={onSeeAll}
            activeOpacity={0.7}
          >
            <Text style={[styles.seeAllText, { color: themeColors.primary }]}>
              {seeAllLabel}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={themeColors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Widget Content */}
      {children}
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
    fontWeight: '700',
  },

  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  seeAllText: {
    fontSize: typography.size.sm,
    fontWeight: '600',
  },
});

export default HomeWidget;
