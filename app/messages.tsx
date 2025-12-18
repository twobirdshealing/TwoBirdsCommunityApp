// =============================================================================
// MESSAGES SCREEN - Direct messages list
// =============================================================================
// Route: /messages (ROOT LEVEL - accessed from header mail icon)
// =============================================================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Messages',
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />

      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <View style={styles.emptyState}>
          <View style={styles.iconContainer}>
            <Ionicons name="mail-outline" size={64} color={colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>Messages Coming Soon</Text>
          <Text style={styles.emptyText}>
            Direct messaging will be available in a future update.
          </Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },

  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },

  emptyTitle: {
    fontSize: typography.size.xl,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },

  emptyText: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
});
