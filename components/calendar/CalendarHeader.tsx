// =============================================================================
// CALENDAR HEADER - Month navigation and view toggle
// =============================================================================
// Shows: ◀ DECEMBER 2025 ▶   [List] [Month]
// Matches the web calendar's navigation bar
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
  }).toUpperCase();
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
      {/* Month Navigation Row */}
      <View style={styles.navRow}>
        {/* Previous Month Button */}
        <TouchableOpacity
          style={[styles.navButton, !canGoPrev && styles.navButtonDisabled]}
          onPress={onPrevMonth}
          disabled={!canGoPrev}
        >
          <Ionicons
            name="chevron-back"
            size={18}
            color={canGoPrev ? '#fff' : 'rgba(255,255,255,0.4)'}
          />
          <Text style={[styles.navButtonText, !canGoPrev && styles.navButtonTextDisabled]}>
            BACK
          </Text>
        </TouchableOpacity>

        {/* Current Month */}
        <Text style={styles.monthText}>{monthDisplay}</Text>

        {/* Next Month Button */}
        <TouchableOpacity
          style={[styles.navButton, !canGoNext && styles.navButtonDisabled]}
          onPress={onNextMonth}
          disabled={!canGoNext}
        >
          <Text style={[styles.navButtonText, !canGoNext && styles.navButtonTextDisabled]}>
            NEXT
          </Text>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={canGoNext ? '#fff' : 'rgba(255,255,255,0.4)'}
          />
        </TouchableOpacity>
      </View>

      {/* View Toggle Row */}
      <View style={styles.toggleRow}>
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
            color={viewMode === 'list' ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.toggleText,
              viewMode === 'list' && styles.toggleTextActive,
            ]}
          >
            List
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleButton,
            viewMode === 'month' && styles.toggleButtonActive,
          ]}
          onPress={() => onViewModeChange('month')}
        >
          <Ionicons
            name="calendar"
            size={18}
            color={viewMode === 'month' ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.toggleText,
              viewMode === 'month' && styles.toggleTextActive,
            ]}
          >
            Month
          </Text>
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
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#00a2e8',  // Match web calendar blue
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },

  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
    minWidth: 80,
    justifyContent: 'center',
  },

  navButtonDisabled: {
    borderColor: 'rgba(255,255,255,0.2)',
  },

  navButtonText: {
    color: '#fff',
    fontSize: typography.size.xs,
    fontWeight: '700',
    letterSpacing: 1,
    marginHorizontal: spacing.xs,
  },

  navButtonTextDisabled: {
    color: 'rgba(255,255,255,0.4)',
  },

  monthText: {
    color: '#fff',
    fontSize: typography.size.lg,
    fontWeight: '700',
    letterSpacing: 1,
  },

  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },

  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.backgroundSecondary,
    gap: spacing.xs,
  },

  toggleButtonActive: {
    backgroundColor: colors.primaryLight + '30',
  },

  toggleText: {
    fontSize: typography.size.sm,
    fontWeight: '500',
    color: colors.textSecondary,
  },

  toggleTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});

export default CalendarHeader;
