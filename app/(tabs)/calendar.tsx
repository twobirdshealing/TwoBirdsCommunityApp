// =============================================================================
// CALENDAR SCREEN - Events and calendar
// =============================================================================
// UPDATED: Removed built-in header - TopHeader handles it now
// Phase 1: Placeholder
// Phase 2: Church events, ceremony dates, community calendar
// =============================================================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';

export default function CalendarScreen() {
  return (
    <View style={styles.container}>
      {/* NO HEADER HERE - TopHeader in tabs layout handles it */}

      {/* Coming Soon */}
      <View style={styles.content}>
        <Text style={styles.icon}>📅</Text>
        <Text style={styles.title}>Events Calendar</Text>
        <Text style={styles.message}>
          View upcoming ceremonies, retreats,{'\n'}
          and community gatherings here.
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Coming Soon</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // REMOVED: header styles - TopHeader handles it now

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },

  icon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },

  title: {
    fontSize: typography.size.xxl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },

  message: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.size.md * 1.5,
  },

  badge: {
    marginTop: spacing.xl,
    backgroundColor: colors.primaryLight || colors.primary + '20',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },

  badgeText: {
    color: colors.primary,
    fontSize: typography.size.sm,
    fontWeight: '600',
  },
});
