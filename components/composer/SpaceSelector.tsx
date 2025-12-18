// =============================================================================
// SPACE SELECTOR - Dropdown to choose which space to post in
// =============================================================================

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { spacesApi } from '@/services/api';
import { Space } from '@/types';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface SpaceSelectorProps {
  selectedSpaceId: number | null;
  selectedSpaceName: string | null;
  onSelect: (spaceId: number, spaceName: string) => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function SpaceSelector({
  selectedSpaceId,
  selectedSpaceName,
  onSelect,
}: SpaceSelectorProps) {
  const [visible, setVisible] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch spaces when modal opens
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (visible && spaces.length === 0) {
      fetchSpaces();
    }
  }, [visible]);

  const fetchSpaces = async () => {
    try {
      setLoading(true);
      const response = await spacesApi.getSpaces();
      
      if (response.success) {
        // Filter to only spaces user can post in (joined spaces)
        const joinedSpaces = response.data.spaces.filter(
          (s: Space) => s.is_joined
        );
        setSpaces(joinedSpaces);
      }
    } catch (err) {
      console.error('Failed to fetch spaces:', err);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Handle selection
  // ---------------------------------------------------------------------------

  const handleSelect = (space: Space) => {
    onSelect(space.id, space.title);
    setVisible(false);
  };

  // ---------------------------------------------------------------------------
  // Render space item
  // ---------------------------------------------------------------------------

  const renderSpaceItem = ({ item }: { item: Space }) => {
    const isSelected = item.id === selectedSpaceId;

    return (
      <TouchableOpacity
        style={[styles.spaceItem, isSelected && styles.spaceItemSelected]}
        onPress={() => handleSelect(item)}
      >
        {/* Space icon/emoji */}
        <View style={styles.spaceIcon}>
          <Text style={styles.spaceEmoji}>
            {item.settings?.emoji || '👥'}
          </Text>
        </View>

        {/* Space info */}
        <View style={styles.spaceInfo}>
          <Text style={styles.spaceName}>{item.title}</Text>
          {item.members_count !== undefined && (
            <Text style={styles.spaceMeta}>
              {item.members_count} members
            </Text>
          )}
        </View>

        {/* Checkmark if selected */}
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Trigger Button */}
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setVisible(true)}
      >
        <Ionicons
          name="people-outline"
          size={18}
          color={selectedSpaceId ? colors.primary : colors.textSecondary}
        />
        <Text
          style={[
            styles.triggerText,
            selectedSpaceId && styles.triggerTextSelected,
          ]}
          numberOfLines={1}
        >
          {selectedSpaceName || 'Select a space'}
        </Text>
        <Ionicons
          name="chevron-down"
          size={16}
          color={colors.textSecondary}
        />
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Space</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setVisible(false)}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Content */}
            {loading ? (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : spaces.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  No spaces available. Join a space first!
                </Text>
              </View>
            ) : (
              <FlatList
                data={spaces}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderSpaceItem}
                contentContainerStyle={styles.spacesList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Trigger button
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    gap: spacing.xs,
    maxWidth: 200,
  },

  triggerText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    flex: 1,
  },

  triggerTextSelected: {
    color: colors.primary,
    fontWeight: '500',
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },

  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  modalTitle: {
    fontSize: typography.size.lg,
    fontWeight: '600',
    color: colors.text,
  },

  closeButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loading: {
    padding: spacing.xxl,
    alignItems: 'center',
  },

  empty: {
    padding: spacing.xxl,
    alignItems: 'center',
  },

  emptyText: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Spaces list
  spacesList: {
    padding: spacing.md,
  },

  spaceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },

  spaceItemSelected: {
    backgroundColor: colors.primaryLight + '20',
    borderWidth: 1,
    borderColor: colors.primary,
  },

  spaceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },

  spaceEmoji: {
    fontSize: 20,
  },

  spaceInfo: {
    flex: 1,
  },

  spaceName: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.text,
  },

  spaceMeta: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
});

export default SpaceSelector;
