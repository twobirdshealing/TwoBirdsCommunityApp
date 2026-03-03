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
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { FEATURES, PRIVACY_POLICY_URL } from '@/constants/config';
import { spacing, typography, shadows } from '@/constants/layout';
import { hapticLight, hapticMedium, hapticWarning } from '@/utils/haptics';

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
  onDirectoryPress: () => void;
  onBookmarksPress: () => void;
  onCoursesPress: () => void;
  onBlogPress: () => void;
  onNotificationSettingsPress: () => void;
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
  const { colors: themeColors } = useTheme();
  return (
    <TouchableOpacity style={styles.menuItem} onPress={() => { destructive ? hapticWarning() : hapticLight(); onPress(); }} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons
        name={icon}
        size={22}
        color={destructive ? themeColors.error : themeColors.textSecondary}
      />
      <Text style={[styles.menuItemText, { color: destructive ? themeColors.error : themeColors.text, marginLeft: spacing.md }]}>
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
  onDirectoryPress,
  onBookmarksPress,
  onCoursesPress,
  onBlogPress,
  onNotificationSettingsPress,
  onLogout,
}: UserMenuProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isDark, setTheme, colors: themeColors } = useTheme();

  const themeModeLabel = isDark ? 'Dark' : 'Light';

  const handleThemeToggle = () => {
    hapticMedium();
    setTheme(isDark ? 'light' : 'dark');
  };

  const handleProfilePress = () => {
    onClose();
    onProfilePress();
  };

  const handleMySpacesPress = () => {
    onClose();
    onMySpacesPress();
  };

  const handleDirectoryPress = () => {
    onClose();
    onDirectoryPress();
  };

  const handleBookmarksPress = () => {
    onClose();
    onBookmarksPress();
  };

  const handleCoursesPress = () => {
    onClose();
    onCoursesPress();
  };

  const handleBlogPress = () => {
    onClose();
    onBlogPress();
  };

  const handleNotificationSettingsPress = () => {
    onClose();
    onNotificationSettingsPress();
  };

  const handlePrivacyPolicyPress = () => {
    onClose();
    router.push({ pathname: '/webview', params: { url: PRIVACY_POLICY_URL, title: 'Privacy Policy' } });
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
      <Pressable style={[styles.backdrop, { backgroundColor: themeColors.overlay }]} onPress={onClose}>
        {/* Menu Container - positioned top right */}
        <View style={[styles.menuContainer, { top: insets.top + 50, backgroundColor: themeColors.surface }]}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            {/* Profile Preview - Tappable to go to profile */}
            <TouchableOpacity
              style={styles.profilePreview}
              onPress={handleProfilePress}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="View profile"
            >
              {user.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: themeColors.primary }]}>
                  <Text style={[styles.avatarText, { color: themeColors.textInverse }]}>
                    {user.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.profileInfo}>
                <Text style={[styles.displayName, { color: themeColors.text }]} numberOfLines={1}>
                  {user.displayName}
                </Text>
                <Text style={[styles.email, { color: themeColors.textSecondary }]} numberOfLines={1}>
                  {user.email || `@${user.username}`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={themeColors.textTertiary} />
            </TouchableOpacity>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

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
                icon="globe-outline"
                label="Church Directory"
                onPress={handleDirectoryPress}
              />
              <MenuItem
                icon="bookmark-outline"
                label="Bookmarks"
                onPress={handleBookmarksPress}
              />
              {FEATURES.COURSES && (
                <MenuItem
                  icon="school-outline"
                  label="My Courses"
                  onPress={handleCoursesPress}
                />
              )}
              <MenuItem
                icon="newspaper-outline"
                label="Blog"
                onPress={handleBlogPress}
              />
              <MenuItem
                icon="notifications-outline"
                label="Notification Settings"
                onPress={handleNotificationSettingsPress}
              />
              <MenuItem
                icon="shield-checkmark-outline"
                label="Privacy Policy"
                onPress={handlePrivacyPolicyPress}
              />

              {/* Dark Mode Toggle */}
              <TouchableOpacity style={styles.menuItem} onPress={handleThemeToggle} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`Toggle dark mode, currently ${themeModeLabel}`}>
                <Ionicons
                  name={isDark ? 'sunny-outline' : 'moon-outline'}
                  size={22}
                  color={themeColors.textSecondary}
                />
                <Text style={[styles.menuItemText, { color: themeColors.text, marginLeft: spacing.md }]}>Dark Mode</Text>
                <Text style={[styles.themeLabel, { color: themeColors.textTertiary }]}>{themeModeLabel}</Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

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
  },

  menuContainer: {
    position: 'absolute',
    right: spacing.md,
    width: 280,
    borderRadius: 16,
    ...shadows.lg,
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
  },

  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    fontSize: 20,
    fontWeight: '600',
  },

  profileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },

  displayName: {
    fontSize: typography.size.md,
    fontWeight: '600',
  },

  email: {
    fontSize: typography.size.sm,
    marginTop: 2,
  },

  // Divider
  divider: {
    height: 1,
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
    marginLeft: spacing.md,
  },

  menuItemDestructive: {},

  themeLabel: {
    fontSize: typography.size.sm,
    marginLeft: 'auto',
  },
});

export default UserMenu;
