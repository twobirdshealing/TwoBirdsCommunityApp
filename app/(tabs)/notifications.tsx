// =============================================================================
// NOTIFICATIONS SCREEN - Placeholder for Phase 2
// =============================================================================
// This screen will show user notifications.
// Currently shows a "Coming Soon" message.
// =============================================================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';

export default function NotificationsScreen() {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>
      
      {/* Placeholder Content */}
      <View style={styles.content}>
        <Text style={styles.icon}>🔔</Text>
        <Text style={styles.title}>No Notifications Yet</Text>
        <Text style={styles.message}>
          When someone interacts with your posts,{'\n'}
          you'll see notifications here.
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Coming in Phase 2</Text>
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
  
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  
  icon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  
  message: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.size.md * typography.lineHeight.relaxed,
  },
  
  badge: {
    marginTop: spacing.xl,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  
  badgeText: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
});
