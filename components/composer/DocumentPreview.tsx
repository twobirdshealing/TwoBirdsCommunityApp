// =============================================================================
// DOCUMENT PREVIEW - Shows attached documents before posting
// =============================================================================
// Vertical list of file rows (icon + filename + remove). Mirrors MediaPreview's
// shape but stacks vertically since file names need to wrap/truncate fully.
// Renders alongside the other composer previews and is mutually exclusive with
// images/video/GIF/poll — that gating is enforced by CreatePostContent.
// =============================================================================

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import type { SpaceDocumentFile } from '@/services/api/documents';
import { iconForMime } from '@/utils/mime';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface DocumentPreviewProps {
  items: SpaceDocumentFile[];
  onRemove: (index: number) => void;
  isUploading: boolean;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function DocumentPreview({ items, onRemove, isUploading }: DocumentPreviewProps) {
  const { colors } = useTheme();

  if (items.length === 0 && !isUploading) {
    return null;
  }

  return (
    <View style={[styles.container, { borderTopColor: colors.border }]}>
      {items.map((item, index) => (
        <View
          key={`${item.id}-${index}`}
          style={[styles.row, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
        >
          <Ionicons
            name={iconForMime(item.type)}
            size={22}
            color={colors.primary}
            style={styles.icon}
          />
          <Text
            style={[styles.title, { color: colors.text }]}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {item.title}
          </Text>
          <Pressable style={styles.removeButton} onPress={() => onRemove(index)}>
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
      ))}

      {isUploading && (
        <View style={[styles.row, styles.uploadingRow, { borderColor: colors.border }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.title, { color: colors.textSecondary }]}>
            Uploading…
          </Text>
        </View>
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    gap: spacing.xs,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: sizing.borderRadius.sm,
    borderWidth: 1,
    gap: spacing.sm,
  },

  uploadingRow: {
    borderStyle: 'dashed',
  },

  icon: {
    width: 22,
  },

  title: {
    flex: 1,
    fontSize: typography.size.sm,
  },

  removeButton: {
    padding: spacing.xs,
  },
});

export default DocumentPreview;
