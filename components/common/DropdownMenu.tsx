// =============================================================================
// DROPDOWN MENU - Reusable dropdown menu component
// =============================================================================
// Supports two positioning modes:
// - Default (no anchor): top-right corner with topOffset (used by ProfileMenu, SpaceMenu)
// - Anchored: positioned absolutely near the trigger button (used by FeedCard, CommentSheet)
// =============================================================================

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, sizing, shadows } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { hapticLight, hapticWarning } from '@/utils/haptics';

export interface DropdownMenuItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export interface DropdownMenuProps {
  visible: boolean;
  onClose: () => void;
  items: DropdownMenuItem[];
  topOffset?: number;
  anchor?: { top: number; right: number };
}

export function DropdownMenu({ visible, onClose, items, topOffset = 100, anchor }: DropdownMenuProps) {
  const { colors: themeColors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[
          styles.modalOverlay,
          { backgroundColor: themeColors.overlay },
          !anchor && { paddingTop: topOffset, justifyContent: 'flex-start', alignItems: 'flex-end', paddingRight: spacing.lg },
        ]}
        onPress={onClose}
      >
        <View
          style={[
            styles.menuContainer,
            { backgroundColor: themeColors.surface },
            shadows.lg,
            anchor && { position: 'absolute', top: anchor.top, right: anchor.right },
          ]}
        >
          {items.map((item, index) => (
            <React.Fragment key={item.key}>
              {index > 0 && (
                <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
              )}
              <AnimatedPressable
                style={styles.menuItem}
                onPress={() => {
                  item.destructive ? hapticWarning() : hapticLight();
                  item.onPress();
                }}
                disabled={item.disabled}
              >
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={item.destructive ? themeColors.error : themeColors.text}
                  style={styles.menuItemIcon}
                />
                <Text
                  style={[
                    styles.menuItemText,
                    { color: item.destructive ? themeColors.error : themeColors.text },
                    item.destructive && styles.destructiveText,
                  ]}
                >
                  {item.label}
                </Text>
              </AnimatedPressable>
            </React.Fragment>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
  },

  menuContainer: {
    borderRadius: sizing.borderRadius.sm,
    minWidth: 220,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },

  menuItemIcon: {
    marginRight: spacing.md,
    width: 24,
    textAlign: 'center',
  },

  menuItemText: {
    fontSize: typography.size.md,
  },

  destructiveText: {
    fontWeight: typography.weight.semibold,
  },

  divider: {
    height: 1,
    marginHorizontal: spacing.sm,
  },
});
