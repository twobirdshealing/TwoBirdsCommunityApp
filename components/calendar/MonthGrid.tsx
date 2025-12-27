// =============================================================================
// MONTH GRID - Compact calendar grid with event indicators
// =============================================================================
// Modern mobile calendar grid showing:
// - 7-column day grid
// - Colored dots for events (using calendar_color)
// - Today highlight
// - Tap day to select and show events
// =============================================================================

import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { CalendarEvent, EventsByDate } from '@/types/calendar';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface MonthGridProps {
  month: string;                    // "YYYY-MM"
  events: CalendarEvent[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getMonthData(monthString: string) {
  const [year, month] = monthString.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay();
  
  return { year, month, daysInMonth, startWeekday };
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getTodayKey(): string {
  const now = new Date();
  return formatDateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function groupEventsByDate(events: CalendarEvent[]): EventsByDate {
  const grouped: EventsByDate = {};
  
  events.forEach(event => {
    // Handle multi-day events
    const startDate = new Date(event.start + 'T12:00:00');
    const endDate = new Date(event.end + 'T12:00:00');
    
    let current = new Date(startDate);
    while (current <= endDate) {
      const dateKey = formatDateKey(
        current.getFullYear(),
        current.getMonth() + 1,
        current.getDate()
      );
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
      
      current.setDate(current.getDate() + 1);
    }
  });
  
  return grouped;
}

// -----------------------------------------------------------------------------
// Day Cell Component
// -----------------------------------------------------------------------------

interface DayCellProps {
  day: number | null;
  dateKey: string | null;
  isToday: boolean;
  isSelected: boolean;
  isPast: boolean;
  events: CalendarEvent[];
  onPress: () => void;
}

function DayCell({ day, dateKey, isToday, isSelected, isPast, events, onPress }: DayCellProps) {
  if (day === null) {
    return <View style={styles.dayCell} />;
  }

  const hasEvents = events.length > 0;
  
  // Get unique colors from events (max 3 dots)
  const eventColors = [...new Set(events.map(e => e.calendar_color || colors.primary))].slice(0, 3);

  const handlePress = () => {
    if (hasEvents) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  return (
    <TouchableOpacity
      style={[
        styles.dayCell,
        isSelected && styles.dayCellSelected,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={[
        styles.dayNumber,
        isToday && styles.dayNumberToday,
        isSelected && styles.dayNumberSelected,
        isPast && !isToday && styles.dayNumberPast,
      ]}>
        <Text style={[
          styles.dayText,
          isToday && styles.dayTextToday,
          isSelected && styles.dayTextSelected,
          isPast && !isToday && styles.dayTextPast,
        ]}>
          {day}
        </Text>
      </View>
      
      {/* Event Dots */}
      {hasEvents && (
        <View style={styles.dotsContainer}>
          {eventColors.map((color, index) => (
            <View
              key={index}
              style={[styles.dot, { backgroundColor: color }]}
            />
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export function MonthGrid({ month, events, selectedDate, onSelectDate }: MonthGridProps) {
  const { year, month: monthNum, daysInMonth, startWeekday } = getMonthData(month);
  const today = getTodayKey();
  
  // Group events by date
  const eventsByDate = useMemo(() => groupEventsByDate(events), [events]);
  
  // Build calendar grid
  const weeks = useMemo(() => {
    const grid: (number | null)[][] = [];
    let currentWeek: (number | null)[] = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startWeekday; i++) {
      currentWeek.push(null);
    }
    
    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
      currentWeek.push(day);
      
      if (currentWeek.length === 7) {
        grid.push(currentWeek);
        currentWeek = [];
      }
    }
    
    // Fill remaining cells in last week
    while (currentWeek.length > 0 && currentWeek.length < 7) {
      currentWeek.push(null);
    }
    if (currentWeek.length > 0) {
      grid.push(currentWeek);
    }
    
    return grid;
  }, [daysInMonth, startWeekday]);

  return (
    <View style={styles.container}>
      {/* Weekday Headers */}
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map(day => (
          <View key={day} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{day}</Text>
          </View>
        ))}
      </View>
      
      {/* Calendar Grid */}
      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.weekRow}>
          {week.map((day, dayIndex) => {
            const dateKey = day ? formatDateKey(year, monthNum, day) : null;
            const dayEvents = dateKey ? (eventsByDate[dateKey] || []) : [];
            const isPast = dateKey ? dateKey < today : false;
            
            return (
              <DayCell
                key={dayIndex}
                day={day}
                dateKey={dateKey}
                isToday={dateKey === today}
                isSelected={dateKey === selectedDate}
                isPast={isPast}
                events={dayEvents}
                onPress={() => dateKey && onSelectDate(dateKey)}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const CELL_SIZE = 44;

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },

  weekdayRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  weekdayCell: {
    flex: 1,
    alignItems: 'center',
  },

  weekdayText: {
    fontSize: typography.size.xs,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },

  weekRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },

  dayCell: {
    flex: 1,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },

  dayCellSelected: {
    backgroundColor: colors.primaryLight + '15',
    borderRadius: 8,
  },

  dayNumber: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },

  dayNumberToday: {
    backgroundColor: colors.primary,
  },

  dayNumberSelected: {
    backgroundColor: colors.primary,
  },

  dayNumberPast: {
    opacity: 0.5,
  },

  dayText: {
    fontSize: typography.size.sm,
    fontWeight: '500',
    color: colors.text,
  },

  dayTextToday: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  dayTextPast: {
    color: colors.textTertiary,
  },

  dotsContainer: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },

  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});

export default MonthGrid;
