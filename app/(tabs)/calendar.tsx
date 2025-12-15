// =============================================================================
// CALENDAR SCREEN - Events and calendar
// =============================================================================
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Calendar</Text>
        <Text style={styles.headerSubtitle}>
          Community events and ceremonies
        </Text>
      </View>

      {/* Coming Soon */}
      <View style={styles.content}>
        <Text style={styles.icon}>📅</Text>
        <Text style={styles.title}>Events Calendar</Text>
        <Text style={styles.message}>
          View upcoming ceremonies, retreats,{'\n'}
          and community gatherings here.
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Phase 2</Text>
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

  header: {
    backgroundColor: colors.surface,
    paddingTop: 60,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  headerTitle: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },

  headerSubtitle: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

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
    fontWeight: typography.weight.bold,
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
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },

  badgeText: {
    color: colors.textInverse,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
});
