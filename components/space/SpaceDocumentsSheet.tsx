// =============================================================================
// SPACE DOCUMENTS SHEET — uploaded files for a space (Fluent Community Pro)
// =============================================================================
// Each "document" is a Fluent post with 1+ files in meta.document_lists.
// Tap a file → opens its download URL via Linking.openURL (no in-app preview
// in v1; the OS picks the right handler for the mime type).
// =============================================================================

import { BottomSheet, BottomSheetFlatList } from '@/components/common/BottomSheet';
import { withOpacity } from '@/constants/colors';
import { sizing, spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { useSpaceDocuments } from '@/hooks/useSpaceDocuments';
import { SITE_URL } from '@/constants/config';
import type { SpaceDocument, SpaceDocumentFile } from '@/services/api/documents';
import { formatRelativeTime } from '@/utils/formatDate';
import { createLogger } from '@/utils/logger';
import { iconForMime } from '@/utils/mime';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

const log = createLogger('SpaceDocumentsSheet');

interface SpaceDocumentsSheetProps {
  visible: boolean;
  onClose: () => void;
  spaceId: number;
}

// -----------------------------------------------------------------------------
// Flatten doc-posts → individual files, each with its source post's metadata
// -----------------------------------------------------------------------------

interface FlatFile extends SpaceDocumentFile {
  postId: number;
  uploaderName?: string;
  uploaderAvatar?: string | null;
  uploadedAt: string;
}

function flattenDocs(documents: SpaceDocument[]): FlatFile[] {
  const flat: FlatFile[] = [];
  for (const doc of documents) {
    const files = doc.meta?.document_lists ?? [];
    for (const file of files) {
      flat.push({
        ...file,
        postId: doc.id,
        uploaderName: doc.xprofile?.display_name,
        uploaderAvatar: doc.xprofile?.avatar ?? null,
        uploadedAt: doc.created_at,
      });
    }
  }
  return flat;
}

export function SpaceDocumentsSheet({ visible, onClose, spaceId }: SpaceDocumentsSheetProps) {
  const { colors } = useTheme();
  const { documents, isLoading, error } = useSpaceDocuments(spaceId, visible);

  const flatFiles = React.useMemo(() => flattenDocs(documents), [documents]);

  const handleOpen = async (file: FlatFile) => {
    // Server-issued URLs may be relative (e.g. "/download/doc/456/abc123xyz") —
    // resolve against SITE_URL so Linking can open them.
    const fullUrl = file.url.startsWith('http')
      ? file.url
      : `${SITE_URL}${file.url.startsWith('/') ? '' : '/'}${file.url}`;
    try {
      await Linking.openURL(fullUrl);
    } catch (err) {
      log.error(err, 'Failed to open document URL', { url: fullUrl });
    }
  };

  const renderItem = ({ item }: { item: FlatFile }) => (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 },
      ]}
      onPress={() => handleOpen(item)}
    >
      <View style={[styles.iconBox, { backgroundColor: withOpacity(colors.primary, 0.1) }]}>
        <Ionicons name={iconForMime(item.type)} size={22} color={colors.primary} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.uploaderName ? `${item.uploaderName} · ` : ''}{formatRelativeTime(item.uploadedAt)}
        </Text>
      </View>
      <Ionicons name="download-outline" size={20} color={colors.textTertiary} />
    </Pressable>
  );

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.centered}>
          <Text style={[styles.emptyText, { color: colors.error }]}>
            Couldn't load documents
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.centered}>
        <Ionicons name="folder-open-outline" size={40} color={colors.textTertiary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No documents yet
        </Text>
      </View>
    );
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Documents" heightPercentage={70}>
      <BottomSheetFlatList
        data={flatFiles}
        keyExtractor={(item: FlatFile) => String(item.id)}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={flatFiles.length === 0 ? styles.emptyContainer : styles.listContent}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingBottom: spacing.xl },

  emptyContainer: { flexGrow: 1, justifyContent: 'center' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  iconBox: {
    width: 40,
    height: 40,
    borderRadius: sizing.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  rowText: { flex: 1 },

  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },

  meta: {
    fontSize: typography.size.sm,
    marginTop: 2,
  },

  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },

  emptyText: {
    fontSize: typography.size.md,
  },
});

export default SpaceDocumentsSheet;
