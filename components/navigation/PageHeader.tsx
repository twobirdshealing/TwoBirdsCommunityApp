// =============================================================================
// PAGE HEADER - Universal slot-based header
// =============================================================================
// Three universal slots: left, center, right. Put anything in any slot.
// NOT for tab-level headers (use TopHeader for that).
//
// Usage:
//   <PageHeader
//     left={<HeaderIconButton icon="chevron-back" onPress={() => router.back()} />}
//     center={<HeaderTitle>Post</HeaderTitle>}
//   />
//
//   <PageHeader
//     left={<HeaderIconButton icon="chevron-back" onPress={() => router.back()} />}
//     center={<HeaderTitle>Blog</HeaderTitle>}
//     right={<HeaderIconButton icon="share-outline" onPress={handleShare} />}
//   />
//
//   <PageHeader
//     left={<HeaderIconButton icon="close" onPress={onClose} />}
//     center={<HeaderTitle>Comments</HeaderTitle>}
//   />
// =============================================================================

import React, { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, shadows, sizing, typography } from '@/constants/layout';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface PageHeaderProps {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
}

// -----------------------------------------------------------------------------
// HeaderTitle — styled title text for the center slot
// -----------------------------------------------------------------------------

export function HeaderTitle({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
      {children}
    </Text>
  );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function PageHeader({ left, center, right }: PageHeaderProps) {
  const { colors: themeColors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
      <View style={styles.content}>
        {left ? (
          <View style={styles.slot}>{left}</View>
        ) : (
          <View style={styles.spacer} />
        )}

        <View style={styles.center}>
          {center}
        </View>

        {right ? (
          <View style={styles.slot}>{right}</View>
        ) : (
          <View style={styles.spacer} />
        )}
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    ...shadows.sm,
  },

  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 52,
  },

  spacer: {
    width: sizing.iconButton,
    height: sizing.iconButton,
  },

  slot: {
    minWidth: sizing.iconButton,
    alignItems: 'center',
    justifyContent: 'center',
  },

  center: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.sm,
  },

  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
  },
});

export default PageHeader;
