// =============================================================================
// DATE BADGE - Displays date in styled badge format
// =============================================================================
// Matches the web calendar's date display:
//   SATURDAY
//     27th
//   DECEMBER
// =============================================================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface DateBadgeProps {
  date: string;                   // "YYYY-MM-DD"
  size?: 'sm' | 'md' | 'lg';
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString + 'T12:00:00'); // Noon to avoid timezone issues
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'long' }).toUpperCase();
  
  return {
    dayName,
    day,
    ordinal: getOrdinalSuffix(day),
    month,
  };
}

// -----------------------------------------------------------------------------
// Size Configs
// -----------------------------------------------------------------------------

const SIZES = {
  sm: {
    container: { width: 60, height: 60, borderRadius: 6, padding: 4 },
    dayName: { fontSize: 8 },
    day: { fontSize: 18 },
    ordinal: { fontSize: 8 },
    month: { fontSize: 8 },
  },
  md: {
    container: { width: 80, height: 80, borderRadius: 8, padding: 6 },
    dayName: { fontSize: 10 },
    day: { fontSize: 24 },
    ordinal: { fontSize: 10 },
    month: { fontSize: 10 },
  },
  lg: {
    container: { width: 100, height: 100, borderRadius: 10, padding: 8 },
    dayName: { fontSize: 12 },
    day: { fontSize: 28 },
    ordinal: { fontSize: 12 },
    month: { fontSize: 12 },
  },
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function DateBadge({ date, size = 'md' }: DateBadgeProps) {
  const { colors: themeColors } = useTheme();
  const { dayName, day, ordinal, month } = formatDate(date);
  const sizeConfig = SIZES[size];

  return (
    <View style={[styles.container, sizeConfig.container, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
      <Text style={[styles.dayName, sizeConfig.dayName, { color: themeColors.text }]}>{dayName}</Text>
      <View style={styles.dayRow}>
        <Text style={[styles.day, sizeConfig.day, { color: themeColors.text }]}>{day}</Text>
        <Text style={[styles.ordinal, sizeConfig.ordinal, { color: themeColors.text }]}>{ordinal}</Text>
      </View>
      <Text style={[styles.month, sizeConfig.month, { color: themeColors.text }]}>{month}</Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dayName: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  dayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  day: {
    fontWeight: '700',
    lineHeight: 28,
  },

  ordinal: {
    fontWeight: '600',
    marginTop: 2,
  },

  month: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default DateBadge;
