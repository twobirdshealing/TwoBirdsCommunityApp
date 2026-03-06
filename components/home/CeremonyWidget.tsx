// =============================================================================
// CEREMONY WIDGET - Upcoming booked event with countdown
// =============================================================================
// Shows the user's next booked event (ceremony, sound journey, kambo, etc.)
// with a live countdown. Returns null if no upcoming bookings, so the
// HomeWidget wrapper auto-hides. Data is pre-populated by the startup batch.
// =============================================================================

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { useTheme } from '@/contexts/ThemeContext';
import { withOpacity } from '@/constants/colors';
import { spacing, sizing, shadows } from '@/constants/layout';
import { useCachedData } from '@/hooks/useCachedData';
import { useEventWebView } from '@/hooks/useEventWebView';
import calendarApi from '@/services/api/calendar';
import type { CalendarEvent } from '@/types/calendar';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface CeremonyWidgetProps {
  refreshKey: number;
}

// -----------------------------------------------------------------------------
// Category → Icon mapping
// -----------------------------------------------------------------------------

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  ceremony: 'flame-outline',
  sapo: 'leaf-outline',
  'sound-healing': 'musical-notes-outline',
  'sunday-service': 'people-outline',
  'special-event': 'star-outline',
};

function getCategoryIcon(categories: string[]): keyof typeof Ionicons.glyphMap {
  for (const cat of categories) {
    if (CATEGORY_ICONS[cat]) return CATEGORY_ICONS[cat];
  }
  return 'calendar-outline';
}

// -----------------------------------------------------------------------------
// Countdown helpers
// -----------------------------------------------------------------------------

function getEventDateTime(event: CalendarEvent): Date {
  const dateStr = event.start;
  if (event.start_time) {
    return new Date(`${dateStr}T${event.start_time}:00`);
  }
  // No time set — default to start of day
  return new Date(`${dateStr}T00:00:00`);
}

function formatCountdown(target: Date): string {
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) return 'Now';

  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays === 0 && diffHours === 0) return `${diffMins}m`;
  if (diffDays === 0) return `${diffHours}h ${diffMins % 60}m`;
  if (diffDays === 1) return 'Tomorrow';
  return `${diffDays}d ${diffHours % 24}h`;
}

function formatEventDate(event: CalendarEvent): string {
  const date = new Date(`${event.start}T00:00:00`);
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
  };
  let formatted = date.toLocaleDateString('en-US', options);

  if (event.start_time) {
    const [h, m] = event.start_time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    formatted += ` at ${hour12}:${String(m).padStart(2, '0')} ${period}`;
  }

  return formatted;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function CeremonyWidget({ refreshKey }: CeremonyWidgetProps) {
  const { colors: themeColors } = useTheme();
  const { openEvent } = useEventWebView();
  const [countdown, setCountdown] = useState('');

  const { data: event } = useCachedData<CalendarEvent | null>({
    cacheKey: 'tbc_widget_ceremony',
    fetcher: async () => {
      const response = await calendarApi.getUserBooked(1);
      if (!response.success) return null;
      return response.data.events[0] ?? null;
    },
    refreshKey,
    refreshOnFocus: false,
    staleTime: 120_000,
  });

  // Live countdown — update every 60s
  useEffect(() => {
    if (!event) return;

    const update = () => setCountdown(formatCountdown(getEventDateTime(event)));
    update();

    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [event]);

  // No upcoming bookings — hide widget entirely
  if (!event) return null;

  const icon = getCategoryIcon(event.categories);
  const location = event.location?.business_name;

  return (
    <AnimatedPressable
      style={[styles.card, { backgroundColor: themeColors.surface }]}
      onPress={() => openEvent(event)}
    >
      {/* Icon */}
      <View style={[styles.iconCircle, { backgroundColor: withOpacity(themeColors.primary, 0.1) }]}>
        <Ionicons name={icon} size={22} color={themeColors.primary} />
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={[styles.date, { color: themeColors.textSecondary }]} numberOfLines={1}>
          {formatEventDate(event)}
        </Text>
        {location ? (
          <Text style={[styles.location, { color: themeColors.textTertiary }]} numberOfLines={1}>
            {location}
          </Text>
        ) : null}
      </View>

      {/* Countdown pill */}
      {countdown ? (
        <View style={[styles.countdownPill, { backgroundColor: withOpacity(themeColors.primary, 0.1) }]}>
          <Text style={[styles.countdownText, { color: themeColors.primary }]}>
            {countdown}
          </Text>
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: sizing.borderRadius.md,
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    ...shadows.sm,
  },

  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  info: {
    flex: 1,
    gap: 2,
  },

  title: {
    fontSize: 15,
    fontWeight: '600',
  },

  date: {
    fontSize: 13,
  },

  location: {
    fontSize: 12,
  },

  countdownPill: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: sizing.borderRadius.full,
  },

  countdownText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

export default CeremonyWidget;
