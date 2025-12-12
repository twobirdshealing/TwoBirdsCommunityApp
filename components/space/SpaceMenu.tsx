// =============================================================================
// SPACE MENU - Dropdown menu for space actions
// =============================================================================
// Phase 1: UI only, no functionality
// Phase 2: Wire up Posts, Members, Documents, About, Leave Space
// =============================================================================

import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Modal, 
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { colors } from '@/constants/colors';
import { spacing, typography, sizing } from '@/constants/layout';

interface SpaceMenuProps {
  onPostsPress?: () => void;
  onMembersPress?: () => void;
  onDocumentsPress?: () => void;
  onAboutPress?: () => void;
  onLeavePress?: () => void;
}

export function SpaceMenu({
  onPostsPress,
  onMembersPress,
  onDocumentsPress,
  onAboutPress,
  onLeavePress,
}: SpaceMenuProps) {
  const [visible, setVisible] = useState(false);

  const handlePress = (action?: () => void) => {
    setVisible(false);
    // Phase 2: Call the action
    if (action) {
      setTimeout(() => action(), 100);
    }
  };

  return (
    <>
      {/* Menu Button */}
      <TouchableOpacity 
        style={styles.menuButton} 
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.menuIcon}>⋮</Text>
      </TouchableOpacity>

      {/* Dropdown Modal */}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable 
          style={styles.overlay} 
          onPress={() => setVisible(false)}
        >
          <View style={styles.dropdown}>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => handlePress(onPostsPress)}
            >
              <Text style={styles.menuItemIcon}>📝</Text>
              <Text style={styles.menuItemText}>Posts</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => handlePress(onMembersPress)}
            >
              <Text style={styles.menuItemIcon}>👥</Text>
              <Text style={styles.menuItemText}>Members</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => handlePress(onDocumentsPress)}
            >
              <Text style={styles.menuItemIcon}>📄</Text>
              <Text style={styles.menuItemText}>Documents</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => handlePress(onAboutPress)}
            >
              <Text style={styles.menuItemIcon}>ℹ️</Text>
              <Text style={styles.menuItemText}>About</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity 
              style={[styles.menuItem, styles.leaveItem]}
              onPress={() => handlePress(onLeavePress)}
            >
              <Text style={styles.menuItemIcon}>🚪</Text>
              <Text style={[styles.menuItemText, styles.leaveText]}>Leave Space</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  menuButton: {
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
  },

  menuIcon: {
    fontSize: 24,
    color: colors.text,
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: spacing.md,
  },

  dropdown: {
    backgroundColor: colors.surface,
    borderRadius: sizing.borderRadius.md,
    minWidth: 200,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },

  menuItemIcon: {
    fontSize: 18,
    marginRight: spacing.md,
  },

  menuItemText: {
    fontSize: typography.size.md,
    color: colors.text,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },

  leaveItem: {
    // Extra styling for leave action
  },

  leaveText: {
    color: colors.error,
  },
});

export default SpaceMenu;
