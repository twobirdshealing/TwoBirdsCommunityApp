// =============================================================================
// BOOKMARK LIST - Bottom sheet showing saved bookmarks + add new
// =============================================================================

import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAudioPlayerContext, formatTime } from '@/contexts/AudioPlayerContext';
import { spacing, typography, sizing } from '@/constants/layout';
import { withOpacity } from '@/constants/colors';
import { BottomSheetScrollView, SheetInput } from '@/components/common/BottomSheet';
import { hapticLight } from '@/utils/haptics';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

interface BookmarkListProps {
  onClose?: () => void;
}

export function BookmarkList({ onClose }: BookmarkListProps) {
  const { colors: themeColors } = useTheme();
  const { bookmarks, currentTime, addBookmark, removeBookmark, seekTo } = useAudioPlayerContext();
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const success = await addBookmark(title.trim() || undefined);
      if (success) {
        setTitle('');
      } else {
        Alert.alert('Error', 'Failed to save bookmark. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }, [addBookmark, title, saving]);

  const handleDelete = useCallback((id: number) => {
    Alert.alert('Delete Bookmark', 'Remove this bookmark?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const success = await removeBookmark(id);
          if (!success) {
            Alert.alert('Error', 'Failed to delete bookmark. Please try again.');
          }
        },
      },
    ]);
  }, [removeBookmark]);

  return (
    <View style={styles.container}>
      {/* Add Bookmark */}
      <View style={[styles.addRow, { borderBottomColor: themeColors.borderLight }]}>
        <SheetInput>
          {(inputProps) => (
            <TextInput
              {...inputProps}
              style={[styles.input, { color: themeColors.text, backgroundColor: withOpacity(themeColors.text, 0.05) }]}
              placeholder={`Bookmark at ${formatTime(currentTime)}`}
              placeholderTextColor={themeColors.textTertiary}
              value={title}
              onChangeText={setTitle}
              returnKeyType="done"
              onSubmitEditing={handleAdd}
            />
          )}
        </SheetInput>
        <Pressable
          style={[styles.addBtn, { backgroundColor: themeColors.primary, opacity: saving ? 0.5 : 1 }]}
          onPress={handleAdd}
          disabled={saving}
        >
          <Ionicons name="bookmark" size={18} color={themeColors.textInverse} />
        </Pressable>
      </View>

      {/* Bookmarks List */}
      <BottomSheetScrollView contentContainerStyle={styles.listContent}>
        {bookmarks.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="bookmark-outline" size={32} color={themeColors.textTertiary} />
            <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>
              No bookmarks yet
            </Text>
          </View>
        ) : (
          bookmarks.map((bm) => (
            <Pressable
              key={bm.id}
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.6 }]}
              onPress={() => { hapticLight(); seekTo(bm.timestamp); onClose?.(); }}
            >
              <View style={styles.itemContent}>
                <Ionicons name="bookmark" size={16} color={themeColors.primary} />
                <View style={styles.itemText}>
                  <Text style={[styles.itemTitle, { color: themeColors.text }]} numberOfLines={1}>
                    {bm.title || `Bookmark`}
                  </Text>
                  <Text style={[styles.itemTime, { color: themeColors.textTertiary }]}>
                    {formatTime(bm.timestamp)}
                  </Text>
                </View>
              </View>

              <Pressable onPress={() => handleDelete(bm.id)} hitSlop={12}>
                <Ionicons name="trash-outline" size={18} color={themeColors.textTertiary} />
              </Pressable>
            </Pressable>
          ))
        )}
      </BottomSheetScrollView>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  addRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },

  input: {
    flex: 1,
    height: 40,
    borderRadius: sizing.borderRadius.sm,
    paddingHorizontal: spacing.md,
    fontSize: typography.size.sm,
  },

  addBtn: {
    width: 40,
    height: 40,
    borderRadius: sizing.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  listContent: {
    paddingVertical: spacing.sm,
  },

  empty: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },

  emptyText: {
    fontSize: typography.size.sm,
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },

  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },

  itemText: {
    flex: 1,
    gap: 1,
  },

  itemTitle: {
    fontSize: typography.size.sm,
    fontWeight: '500',
  },

  itemTime: {
    fontSize: typography.size.xs,
    fontVariant: ['tabular-nums'],
  },
});

export default BookmarkList;
