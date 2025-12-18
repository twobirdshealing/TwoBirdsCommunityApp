// =============================================================================
// USER MENU - Dropdown menu from avatar in header
// =============================================================================
// Displays: Profile preview, My Profile, My Spaces, Bookmarks, Logout
// =============================================================================

import React from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface UserMenuProps {
  visible: boolean;
  onClose: () => void;
  user: {
    displayName: string;
    username: string;
    email?: string;
    avatar?: string | null;
  };
  onProfilePress: () => void;
  onMySpacesPress: () => void;
  onBookmarksPress: () => void;
  onLogout: () => void;
}

// -----------------------------------------------------------------------------
// Menu Item Component
// -----------------------------------------------------------------------------

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

function MenuItem({ icon, label, onPress, destructive = false }: MenuItemProps) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <Ionicons 
        name={icon} 
        size={22} 
        color={destructive ? colors.error : colors.textSecondary} 
      />
      <Text style={[styles.menuItemText, destructive && styles.menuItemDestructive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function UserMenu({
  visible,
  onClose,
  user,
  onProfilePress,
  onMySpacesPress,
  onBookmarksPress,
  onLogout,
}: UserMenuProps) {
  const insets = useSafeAreaInsets();

  const handleProfilePress = () => {
    onClose();
    onProfilePress();
  };

  const handleMySpacesPress = () => {
    onClose();
    onMySpacesPress();
  };

  const handleBookmarksPress = () => {
    onClose();
    onBookmarksPress();
  };

  const handleLogout = () => {
    onClose();
    onLogout();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Menu Container - positioned top right */}
        <View style={[styles.menuContainer, { top: insets.top + 50 }]}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            {/* Profile Preview - Tappable to go to profile */}
            <TouchableOpacity 
              style={styles.profilePreview} 
              onPress={handleProfilePress}
              activeOpacity={0.7}
            >
              {user.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarText}>
                    {user.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.profileInfo}>
                <Text style={styles.displayName} numberOfLines={1}>
                  {user.displayName}
                </Text>
                <Text style={styles.email} numberOfLines={1}>
                  {user.email || `@${user.username}`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Menu Items */}
            <View style={styles.menuItems}>
              <MenuItem 
                icon="person-outline" 
                label="My Profile" 
                onPress={handleProfilePress} 
              />
              <MenuItem 
                icon="people-outline" 
                label="My Spaces" 
                onPress={handleMySpacesPress} 
              />
              <MenuItem 
                icon="bookmark-outline" 
                label="Bookmarks" 
                onPress={handleBookmarksPress} 
              />
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Logout */}
            <View style={styles.menuItems}>
              <MenuItem 
                icon="log-out-outline" 
                label="Logout" 
                onPress={handleLogout}
                destructive
              />
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },

  menuContainer: {
    position: 'absolute',
    right: spacing.md,
    width: 280,
    backgroundColor: colors.surface,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },

  // Profile Preview
  profilePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.skeleton,
  },

  avatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },

  profileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },

  displayName: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.text,
  },

  email: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },

  // Menu Items
  menuItems: {
    paddingVertical: spacing.xs,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },

  menuItemText: {
    fontSize: typography.size.md,
    color: colors.text,
    marginLeft: spacing.md,
  },

  menuItemDestructive: {
    color: colors.error,
  },
});

export default UserMenu;
