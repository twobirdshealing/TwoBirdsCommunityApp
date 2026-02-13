// =============================================================================
// DROPDOWN MENU - Reusable top-right dropdown menu component
// =============================================================================

import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, sizing, shadows } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';

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
}

export function DropdownMenu({ visible, onClose, items, topOffset = 100 }: DropdownMenuProps) {
  const { colors: themeColors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={[styles.modalOverlay, { paddingTop: topOffset }]}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={[styles.menuContainer, { backgroundColor: themeColors.surface }, shadows.lg]}>
          {items.map((item, index) => (
            <React.Fragment key={item.key}>
              {index > 0 && (
                <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
              )}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={item.onPress}
                disabled={item.disabled}
                activeOpacity={0.7}
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
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingRight: spacing.lg,
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
    fontWeight: '600',
  },

  divider: {
    height: 1,
    marginHorizontal: spacing.sm,
  },
});
