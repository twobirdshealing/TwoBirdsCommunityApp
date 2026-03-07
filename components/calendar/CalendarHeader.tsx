// =============================================================================
// CALENDAR HEADER - Modern compact month navigation
// =============================================================================
// Slim single-row design with month selector and view toggle
// =============================================================================

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { CalendarViewMode } from '@/types/calendar';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface CalendarHeaderProps {
  currentMonth: string;           // "YYYY-MM"
  viewMode: CalendarViewMode;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onViewModeChange: (mode: CalendarViewMode) => void;
  canGoPrev?: boolean;
  canGoNext?: boolean;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function formatMonthYear(monthString: string): string {
  const [year, month] = monthString.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function CalendarHeader({
  currentMonth,
  viewMode,
  onPrevMonth,
  onNextMonth,
  onViewModeChange,
  canGoPrev = true,
  canGoNext = true,
}: CalendarHeaderProps) {
  const { colors: themeColors } = useTheme();
  const monthDisplay = formatMonthYear(currentMonth);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
      {/* Month Navigation */}
      <View style={styles.monthNav}>
        <Pressable
          style={styles.navButton}
          onPress={onPrevMonth}
          disabled={!canGoPrev}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={canGoPrev ? themeColors.primary : themeColors.textTertiary}
          />
        </Pressable>

        <Text style={[styles.monthText, { color: themeColors.text }]}>{monthDisplay}</Text>

        <Pressable
          style={styles.navButton}
          onPress={onNextMonth}
          disabled={!canGoNext}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name="chevron-forward"
            size={22}
            color={canGoNext ? themeColors.primary : themeColors.textTertiary}
          />
        </Pressable>
      </View>

      {/* View Toggle */}
      <View style={[styles.viewToggle, { backgroundColor: themeColors.backgroundSecondary }]}>
        <Pressable
          style={[
            styles.toggleButton,
            viewMode === 'list' && styles.toggleButtonActive,
            viewMode === 'list' && { backgroundColor: themeColors.primary },
          ]}
          onPress={() => onViewModeChange('list')}
        >
          <Ionicons
            name="list"
            size={18}
            color={viewMode === 'list' ? themeColors.surface : themeColors.textSecondary}
          />
        </Pressable>

        <Pressable
          style={[
            styles.toggleButton,
            viewMode === 'month' && styles.toggleButtonActive,
            viewMode === 'month' && { backgroundColor: themeColors.primary },
          ]}
          onPress={() => onViewModeChange('month')}
        >
          <Ionicons
            name="grid-outline"
            size={18}
            color={viewMode === 'month' ? themeColors.surface : themeColors.textSecondary}
          />
        </Pressable>
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },

  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  navButton: {
    padding: spacing.xs,
  },

  monthText: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    minWidth: 160,
    textAlign: 'center',
  },

  viewToggle: {
    flexDirection: 'row',
    borderRadius: sizing.borderRadius.sm,
    padding: 2,
  },

  toggleButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: sizing.borderRadius.sm,
  },

  toggleButtonActive: {
  },
});

export default CalendarHeader;
