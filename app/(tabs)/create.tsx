// =============================================================================
// CREATE SCREEN - Placeholder for Phase 2
// =============================================================================
// This screen will allow users to create new posts.
// Currently shows a "Coming Soon" message.
// =============================================================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';

export default function CreateScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>✍️</Text>
        <Text style={styles.title}>Create Post</Text>
        <Text style={styles.message}>
          This feature is coming soon!{'\n'}
          You'll be able to share updates with the community.
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  content: {
    alignItems: 'center',
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
    lineHeight: typography.size.md * typography.lineHeight.relaxed,
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
