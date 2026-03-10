// =============================================================================
// USER MENU - Dropdown menu from avatar in header
// =============================================================================
// Displays: Profile preview, My Profile, My Spaces, Bookmarks, Logout
// =============================================================================

import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FEATURES, PRIVACY_POLICY_URL } from '@/constants/config';
import { spacing, typography, shadows, sizing } from '@/constants/layout';
import { hapticLight, hapticMedium, hapticWarning } from '@/utils/haptics';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';

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
  onDonorDashboardPress: () => void;
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
    <AnimatedPressable style={styles.menuItem} onPress={() => { destructive ? hapticWarning() : hapticLight(); onPress(); }} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons
        name={icon}
        size={22}
        color={destructive ? themeColors.error : themeColors.textSecondary}
      />
      <Text style={[styles.menuItemText, { color: destructive ? themeColors.error : themeColors.text, marginLeft: spacing.md }]}>
        {label}
      </Text>
    </AnimatedPressable>
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
  onDonorDashboardPress,
  onNotificationSettingsPress,
  onLogout,
}: UserMenuProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isDark, setTheme, colors: themeColors } = useTheme();
  const { visibility } = useAppConfig();
  const hideMenu = visibility?.hide_menu ?? [];
  const isHidden = (key: string) => hideMenu.includes(key);

  const themeModeLabel = isDark ? 'Dark' : 'Light';

  const handleThemeToggle = () => {
    hapticMedium();
    setTheme(isDark ? 'light' : 'dark');
  };

  // Note: onClose() is NOT called here — the parent (TopHeader) already
  // calls setMenuVisible(false) inside each callback it passes down.

  const handlePrivacyPolicyPress = () => {
    onClose();
    router.push({ pathname: '/webview', params: { url: PRIVACY_POLICY_URL, title: 'Privacy Policy', noAuth: '1' } });
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
            <AnimatedPressable
              style={styles.profilePreview}
              onPress={onProfilePress}
              accessibilityRole="button"
              accessibilityLabel="View profile"
            >
              {user.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" />
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
            </AnimatedPressable>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

            {/* Menu Items */}
            <View style={styles.menuItems}>
              <MenuItem
                icon="person-outline"
                label="My Profile"
                onPress={onProfilePress}
              />
              <MenuItem
                icon="people-outline"
                label="My Spaces"
                onPress={onMySpacesPress}
              />
              {!isHidden('directory') && (
                <MenuItem
                  icon="globe-outline"
                  label="Church Directory"
                  onPress={onDirectoryPress}
                />
              )}
              {!isHidden('bookmarks') && (
                <MenuItem
                  icon="bookmark-outline"
                  label="Bookmarks"
                  onPress={onBookmarksPress}
                />
              )}
              {FEATURES.COURSES && !isHidden('courses') && (
                <MenuItem
                  icon="school-outline"
                  label="My Courses"
                  onPress={onCoursesPress}
                />
              )}
              {!isHidden('blog') && (
                <MenuItem
                  icon="newspaper-outline"
                  label="Blog"
                  onPress={onBlogPress}
                />
              )}
              {!isHidden('donor_dashboard') && (
                <MenuItem
                  icon="heart-outline"
                  label="Donor Dashboard"
                  onPress={onDonorDashboardPress}
                />
              )}
              {!isHidden('notification_settings') && (
                <MenuItem
                  icon="notifications-outline"
                  label="Notification Settings"
                  onPress={onNotificationSettingsPress}
                />
              )}
              <MenuItem
                icon="shield-checkmark-outline"
                label="Privacy Policy"
                onPress={handlePrivacyPolicyPress}
              />

              {/* Dark Mode Toggle */}
              <AnimatedPressable style={styles.menuItem} onPress={handleThemeToggle} accessibilityRole="button" accessibilityLabel={`Toggle dark mode, currently ${themeModeLabel}`}>
                <Ionicons
                  name={isDark ? 'sunny-outline' : 'moon-outline'}
                  size={22}
                  color={themeColors.textSecondary}
                />
                <Text style={[styles.menuItemText, { color: themeColors.text, marginLeft: spacing.md }]}>Dark Mode</Text>
                <Text style={[styles.themeLabel, { color: themeColors.textTertiary }]}>{themeModeLabel}</Text>
              </AnimatedPressable>
            </View>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

            {/* Logout */}
            <View style={styles.menuItems}>
              <MenuItem 
                icon="log-out-outline" 
                label="Logout" 
                onPress={onLogout}
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
    borderRadius: sizing.borderRadius.lg,
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
    borderRadius: sizing.borderRadius.full,
  },

  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
  },

  profileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },

  displayName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
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
