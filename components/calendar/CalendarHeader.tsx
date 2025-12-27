// =============================================================================
// CALENDAR HEADER - Modern compact month navigation
// =============================================================================
// Slim single-row design with month selector and view toggle
// =============================================================================

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
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
  const monthDisplay = formatMonthYear(currentMonth);

  return (
    <View style={styles.container}>
      {/* Month Navigation */}
      <View style={styles.monthNav}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={onPrevMonth}
          disabled={!canGoPrev}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={canGoPrev ? colors.primary : colors.textTertiary}
          />
        </TouchableOpacity>

        <Text style={styles.monthText}>{monthDisplay}</Text>

        <TouchableOpacity
          style={styles.navButton}
          onPress={onNextMonth}
          disabled={!canGoNext}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name="chevron-forward"
            size={22}
            color={canGoNext ? colors.primary : colors.textTertiary}
          />
        </TouchableOpacity>
      </View>

      {/* View Toggle */}
      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            viewMode === 'list' && styles.toggleButtonActive,
          ]}
          onPress={() => onViewModeChange('list')}
        >
          <Ionicons
            name="list"
            size={18}
            color={viewMode === 'list' ? colors.surface : colors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleButton,
            viewMode === 'month' && styles.toggleButtonActive,
          ]}
          onPress={() => onViewModeChange('month')}
        >
          <Ionicons
            name="grid-outline"
            size={18}
            color={viewMode === 'month' ? colors.surface : colors.textSecondary}
          />
        </TouchableOpacity>
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
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    fontWeight: '600',
    color: colors.text,
    minWidth: 160,
    textAlign: 'center',
  },

  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    padding: 2,
  },

  toggleButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
  },

  toggleButtonActive: {
    backgroundColor: colors.primary,
  },
});

export default CalendarHeader;
