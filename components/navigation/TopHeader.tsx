// =============================================================================
// TOP HEADER - Main navigation header with logo, icons, and avatar menu
// =============================================================================
// SIMPLIFIED: No cart badge, just icon that opens WebView
// UPDATED: Fetches unread notification count on focus
// =============================================================================

import { colors } from '@/constants/colors';
import { SITE_URL } from '@/constants/config';
import { spacing } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { notificationsApi, profilesApi } from '@/services/api';
import { Profile } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  // Fetch Unread Notification Count
  // ---------------------------------------------------------------------------

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;

    try {
      const count = await notificationsApi.getUnreadCount();
      setUnreadNotifications(count);
    } catch (err) {
      // Silent fail - badge just won't update
    }
  }, [user]);

  // Fetch on mount
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Refresh when screen comes into focus (e.g., returning from notifications)
  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount();
    }, [fetchUnreadCount])
  );

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleMessagesPress = () => {
    router.push('/messages');
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

  const handleBookmarksPress = () => {
    setMenuVisible(false);
    router.push('/bookmarks');
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
            <Text style={styles.title} numberOfLines={1}>
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
          />

          {/* Notifications */}
          <HeaderIconButton
            icon="notifications-outline"
            onPress={handleNotificationsPress}
            badgeCount={unreadNotifications}
          />

          {/* Cart - no badge, just icon */}
          <HeaderIconButton
            icon="cart-outline"
            onPress={handleCartPress}
          />

          {/* Avatar with dropdown arrow */}
          <Pressable
            style={({ pressed }) => [
              styles.avatarButton,
              pressed && styles.avatarButtonPressed,
            ]}
            onPress={() => setMenuVisible(true)}
          >
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Ionicons
              name="chevron-down"
              size={14}
              color={colors.textSecondary}
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
        onBookmarksPress={handleBookmarksPress}
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
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    color: colors.text,
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
    backgroundColor: colors.backgroundSecondary,
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.skeleton,
  },

  avatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  dropdownArrow: {
    marginLeft: 4,
  },
});

export default TopHeader;