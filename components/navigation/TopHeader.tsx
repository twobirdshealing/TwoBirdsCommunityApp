// =============================================================================
// TOP HEADER - Main navigation header with logo, icons, and avatar menu
// =============================================================================
// SIMPLIFIED: No cart badge, just icon that opens WebView
// UPDATED: Fetches unread notification count on focus
// =============================================================================

import { SITE_URL } from '@/constants/config';
import { spacing } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { messagesApi, notificationsApi, profilesApi } from '@/services/api';
import { Profile } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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

  // State
  const [profile, setProfile] = useState<Profile | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // ---------------------------------------------------------------------------
  // Fetch Profile
  // ---------------------------------------------------------------------------

  const fetchProfile = useCallback(async () => {
    if (!user?.username) return;

    try {
      const response = await profilesApi.getProfile(user.username);
      if (response.success && response.data.profile) {
        setProfile(response.data.profile);
      }
    } catch (err) {
      // Silent fail
    }
  }, [user?.username]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // ---------------------------------------------------------------------------
  // Fetch Unread Counts (Messages + Notifications)
  // ---------------------------------------------------------------------------

  const fetchUnreadCounts = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch in parallel
      const [messagesCount, notificationsCount] = await Promise.all([
        messagesApi.getMessageUnreadCount(),
        notificationsApi.getNotificationUnreadCount(),
      ]);

      setUnreadMessages(messagesCount);
      setUnreadNotifications(notificationsCount);
    } catch (err) {
      // Silent fail - badges just won't update
    }
  }, [user]);

  // Fetch on mount
  useEffect(() => {
    fetchUnreadCounts();
  }, [fetchUnreadCounts]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchUnreadCounts();
    }, [fetchUnreadCounts])
  );

  // ---------------------------------------------------------------------------
  // Real-time: Pusher new_message → bump message badge
  // ---------------------------------------------------------------------------

  useNewMessageListener((data) => {
    if (user?.id && String(data.message.user_id) !== String(user.id)) {
      setUnreadMessages(prev => prev + 1);
    }
  }, [user?.id]);

  // ---------------------------------------------------------------------------
  // Real-time: Foreground push notification → bump notification badge
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!user) return;

    const subscription = Notifications.addNotificationReceivedListener(() => {
      setUnreadNotifications(prev => prev + 1);
    });

    return () => subscription.remove();
  }, [user]);

  // ---------------------------------------------------------------------------
  // Background → Foreground: refetch both counts
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!user) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        fetchUnreadCounts();
      }
    });

    return () => subscription.remove();
  }, [user, fetchUnreadCounts]);

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
    // Open cart page in WebView (no right icon - already on cart)
    router.push({
      pathname: '/webview',
      params: {
        url: `${SITE_URL}/cart/`,
        title: 'Cart',
        // No rightIcon - already viewing cart
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

  const avatar = profile?.avatar;
  const displayName = profile?.display_name || user?.username || 'User';
  const username = profile?.username || user?.username || 'user';
  const email = profile?.email;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
      <View style={styles.content}>
        {/* Left: Logo or Title */}
        <View style={styles.leftSection}>
          {showLogo ? (
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
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

          {/* Cart - no badge, just icon */}
          <HeaderIconButton
            icon="cart-outline"
            onPress={handleCartPress}
            accessibilityLabel="Cart"
          />

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
              <Image source={{ uri: avatar }} style={[styles.avatar, { backgroundColor: themeColors.skeleton }]} />
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
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
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
    fontSize: 18,
    fontWeight: '600',
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
    borderRadius: 20,
  },

  avatarButtonPressed: {
    opacity: 0.7,
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },

  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    fontSize: 16,
    fontWeight: '600',
  },

  dropdownArrow: {
    marginLeft: 4,
  },
});

export default TopHeader;