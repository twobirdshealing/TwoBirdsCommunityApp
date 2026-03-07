// =============================================================================
// TOP HEADER - Main navigation header with logo, icons, and avatar menu
// =============================================================================
// Reads unread counts from UnreadCountsContext. Counts are kept fresh by:
// 1. Startup batch (initial load)
// 2. Response headers on every API call (_layout.tsx interceptor)
// 3. Pusher (instant message badge bump)
// 4. Push notifications (instant notification badge bump)
// =============================================================================

import { SITE_URL } from '@/constants/config';
import { spacing, shadows, typography, sizing } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useUnreadCounts } from '@/contexts/UnreadCountsContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useNewMessageListener } from '@/contexts/PusherContext';
import { HeaderIconButton } from './HeaderIconButton';
import { UserMenu } from './UserMenu';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface TopHeaderProps {
  showLogo?: boolean;
  title?: string;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function TopHeader({ showLogo = true, title }: TopHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { colors: themeColors } = useTheme();
  const { visibility } = useAppConfig();
  const {
    unreadMessages,
    unreadNotifications,
    setUnreadMessages,
    setUnreadNotifications,
  } = useUnreadCounts();

  // State
  const [menuVisible, setMenuVisible] = useState(false);

  // ---------------------------------------------------------------------------
  // Real-time: Pusher new_message → bump message badge
  // ---------------------------------------------------------------------------

  useNewMessageListener((data) => {
    if (user?.id && String(data.message.user_id) !== String(user.id)) {
      setUnreadMessages((prev: number) => prev + 1);
    }
  });

  // ---------------------------------------------------------------------------
  // Real-time: Foreground push notification → bump notification badge
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!user) return;

    const subscription = Notifications.addNotificationReceivedListener(() => {
      setUnreadNotifications((prev: number) => prev + 1);
    });

    return () => subscription.remove();
  }, [user, setUnreadNotifications]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleMessagesPress = () => {
    router.push('/messages' as any);
  };

  const handleNotificationsPress = () => {
    router.push('/notifications');
  };

  const handleCartPress = () => {
    router.push({
      pathname: '/webview',
      params: {
        url: `${SITE_URL}/cart/`,
        title: 'Cart',
      },
    });
  };

  const handleProfilePress = () => {
    setMenuVisible(false);
    if (user?.username) {
      router.push(`/profile/${user.username}`);
    }
  };

  const handleMySpacesPress = () => {
    setMenuVisible(false);
    router.push('/(tabs)/spaces');
  };

  const handleDirectoryPress = () => {
    setMenuVisible(false);
    router.push('/directory');
  };

  const handleBookmarksPress = () => {
    setMenuVisible(false);
    router.push('/bookmarks');
  };

  const handleCoursesPress = () => {
    setMenuVisible(false);
    router.push('/courses');
  };

  const handleBlogPress = () => {
    setMenuVisible(false);
    router.push('/blog');
  };

  const handleNotificationSettingsPress = () => {
    setMenuVisible(false);
    router.push('/notification-settings');
  };

  const handleLogout = () => {
    setMenuVisible(false);
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const avatar = user?.avatar;
  const displayName = user?.displayName || user?.username || 'User';
  const username = user?.username || 'user';
  const email = user?.email;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
      <View style={styles.content}>
        {/* Left: Logo or Title */}
        <View style={styles.leftSection}>
          {showLogo ? (
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logo}
              contentFit="contain"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : title ? (
            <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
        </View>

        {/* Right: Icons + Avatar */}
        <View style={styles.rightSection}>
          {/* Messages */}
          <HeaderIconButton
            icon="mail-outline"
            onPress={handleMessagesPress}
            badgeCount={unreadMessages}
            accessibilityLabel={unreadMessages > 0 ? `Messages, ${unreadMessages} unread` : 'Messages'}
          />

          {/* Notifications */}
          <HeaderIconButton
            icon="notifications-outline"
            onPress={handleNotificationsPress}
            badgeCount={unreadNotifications}
            accessibilityLabel={unreadNotifications > 0 ? `Notifications, ${unreadNotifications} unread` : 'Notifications'}
          />

          {/* Cart - hidden for roles with cart visibility disabled */}
          {!visibility?.hide_cart && (
            <HeaderIconButton
              icon="cart-outline"
              onPress={handleCartPress}
              accessibilityLabel="Cart"
            />
          )}

          {/* Avatar with dropdown arrow */}
          <Pressable
            style={({ pressed }) => [
              styles.avatarButton,
              pressed && [styles.avatarButtonPressed, { backgroundColor: themeColors.backgroundSecondary }],
            ]}
            onPress={() => setMenuVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
          >
            {avatar ? (
              <Image source={{ uri: avatar }} style={[styles.avatar, { backgroundColor: themeColors.border }]} contentFit="cover" transition={200} cachePolicy="memory-disk" />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: themeColors.primary }]}>
                <Text style={[styles.avatarText, { color: themeColors.textInverse }]}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Ionicons
              name="chevron-down"
              size={14}
              color={themeColors.textSecondary}
              style={styles.dropdownArrow}
            />
          </Pressable>
        </View>
      </View>

      {/* User Menu Dropdown */}
      <UserMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        user={{
          displayName,
          username,
          email,
          avatar,
        }}
        onProfilePress={handleProfilePress}
        onMySpacesPress={handleMySpacesPress}
        onDirectoryPress={handleDirectoryPress}
        onBookmarksPress={handleBookmarksPress}
        onCoursesPress={handleCoursesPress}
        onBlogPress={handleBlogPress}
        onNotificationSettingsPress={handleNotificationSettingsPress}
        onLogout={handleLogout}
      />
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    ...shadows.sm,
  },

  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 52,
  },

  leftSection: {
    flex: 1,
  },

  logo: {
    width: 140,
    height: 36,
  },

  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },

  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: sizing.borderRadius.lg,
  },

  avatarButtonPressed: {
    opacity: 0.7,
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: sizing.borderRadius.full,
  },

  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },

  dropdownArrow: {
    marginLeft: spacing.xs,
  },
});

export default TopHeader;
