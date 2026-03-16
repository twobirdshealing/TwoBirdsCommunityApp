// =============================================================================
// COURSE LOCK SCREEN - Shown to non-enrolled users on private/paid courses
// =============================================================================
// Handles: default card, custom HTML lockscreen, pending request state.
// Follows the same pattern as SpaceLockScreen but uses HTML string for custom
// content (courses use a single HTML string, not structured blocks).
// =============================================================================

import React from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing } from '@/constants/layout';
import { Button } from '@/components/common/Button';
import { HtmlContent } from '@/components/common/HtmlContent';
import { CourseLockscreenConfig } from '@/types/course';

const SCREEN_WIDTH = Dimensions.get('window').width;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface CourseLockScreenProps {
  config: CourseLockscreenConfig;
  onRequestAccess?: () => void;
  onEnroll?: () => void;
  isPending?: boolean;
  isRequesting?: boolean;
  isEnrolling?: boolean;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function CourseLockScreen({
  config,
  onRequestAccess,
  onEnroll,
  isPending = false,
  isRequesting = false,
  isEnrolling = false,
}: CourseLockScreenProps) {
  const { colors: themeColors } = useTheme();

  // Pending state — request has been submitted
  if (isPending) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={[styles.defaultCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <Ionicons name="time-outline" size={48} color={themeColors.textTertiary} />
          <Text style={[styles.defaultTitle, { color: themeColors.text }]}>
            Request Submitted
          </Text>
          <Text style={[styles.defaultDescription, { color: themeColors.textSecondary }]}>
            A team member will review your request and let you in soon.
          </Text>
        </View>
      </View>
    );
  }

  // Custom HTML lock screen
  if (config.showCustom && config.lockScreen) {
    const contentWidth = SCREEN_WIDTH - spacing.lg * 2;
    return (
      <ScrollView style={{ backgroundColor: themeColors.background }} contentContainerStyle={styles.customContainer}>
        <View style={styles.customContent}>
          <HtmlContent html={config.lockScreen} contentWidth={contentWidth} />
        </View>
        {config.canSendRequest && onRequestAccess && (
          <View style={styles.buttonContainer}>
            <Button
              title="Request Access"
              onPress={onRequestAccess}
              loading={isRequesting}
            />
          </View>
        )}
        {!config.canSendRequest && onEnroll && (
          <View style={styles.buttonContainer}>
            <Button
              title="Enroll in Course"
              icon="add-circle-outline"
              onPress={onEnroll}
              loading={isEnrolling}
            />
          </View>
        )}
      </ScrollView>
    );
  }

  // Default lock screen
  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={[styles.defaultCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Ionicons name="lock-closed-outline" size={48} color={themeColors.textTertiary} />
        <Text style={[styles.defaultTitle, { color: themeColors.text }]}>
          This course is private
        </Text>
        <Text style={[styles.defaultDescription, { color: themeColors.textSecondary }]}>
          {config.canSendRequest
            ? 'Request access and a team member will review your request.'
            : 'Enroll in this course to access the content.'}
        </Text>
        {config.canSendRequest && onRequestAccess ? (
          <Button
            title="Request Access"
            onPress={onRequestAccess}
            loading={isRequesting}
            style={styles.actionButton}
          />
        ) : onEnroll ? (
          <Button
            title="Enroll in Course"
            icon="add-circle-outline"
            onPress={onEnroll}
            loading={isEnrolling}
            style={styles.actionButton}
          />
        ) : null}
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },

  defaultCard: {
    alignItems: 'center',
    padding: spacing.xxl,
    borderRadius: sizing.borderRadius.md,
    borderWidth: 1,
    width: '100%',
    gap: spacing.sm,
  },

  defaultTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  defaultDescription: {
    fontSize: typography.size.md,
    textAlign: 'center',
    lineHeight: typography.size.md * 1.5,
  },

  actionButton: {
    marginTop: spacing.md,
  },

  customContainer: {
    paddingBottom: spacing.xxl,
  },

  customContent: {
    padding: spacing.lg,
  },

  buttonContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
});
