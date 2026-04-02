// =============================================================================
// LAUNCHER - Icon grid bottom sheet (main navigation surface)
// =============================================================================
// Displays navigation items as a sortable grid of icon tiles inside a BottomSheet.
// Core items + module launcher items are merged into a single grid.
// Long-press any tile to drag and reorder — order persists via MMKV.
// Dark mode toggle sits in the profile row; logout is pinned at bottom.
// =============================================================================

import { useCallback, useMemo } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Sortable from 'react-native-sortables';
import type { SortableGridRenderItem } from 'react-native-sortables';
import { useAppConfig, useFeatures } from '@/contexts/AppConfigContext';
import { useTheme } from '@/contexts/ThemeContext';
import { PRIVACY_POLICY_URL } from '@/constants/config';
import { spacing, typography, sizing } from '@/constants/layout';
import { withOpacity } from '@/constants/colors';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { BottomSheet, BottomSheetScrollView } from '@/components/common/BottomSheet';
import { getLauncherItems } from '@/modules/_registry';
import { useLauncherPreferences } from '@/hooks/useLauncherPreferences';
import { hapticMedium, hapticSelection } from '@/utils/haptics';
import type { ColorTheme } from '@/constants/colors';

import { EMPTY_HIDE_MENU, isHidden as isMenuHidden } from '@/utils/visibility';


// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface LauncherProps {
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
  onNotificationSettingsPress: () => void;
  onLogout: () => void;
}

interface GridItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  iconColor?: string;
  iconBackground?: string;
}

// -----------------------------------------------------------------------------
// Grid Tile
// -----------------------------------------------------------------------------

const SCREEN_WIDTH = Dimensions.get('window').width;
const NUM_COLUMNS = 4;
const GRID_PADDING = spacing.lg;
const TILE_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2) / NUM_COLUMNS;
const ICON_CIRCLE_SIZE = 52;

function GridTile({
  item,
  colors,
  onPress,
}: {
  item: GridItem;
  colors: ColorTheme;
  onPress?: () => void;
}) {
  const bgColor = item.iconBackground
    ? withOpacity((colors as any)[item.iconBackground] ?? colors.backgroundSecondary, 0.15)
    : colors.backgroundSecondary;
  const iconColor = item.iconColor
    ? (colors as any)[item.iconColor] ?? colors.textSecondary
    : colors.textSecondary;

  return (
    <AnimatedPressable
      style={[styles.tile, { width: TILE_WIDTH }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.label}
    >
      <View style={[styles.iconCircle, { backgroundColor: bgColor }]}>
        <Ionicons name={item.icon} size={24} color={iconColor} />
      </View>
      <Text style={[styles.tileLabel, { color: colors.text }]} numberOfLines={1}>
        {item.label}
      </Text>
    </AnimatedPressable>
  );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function Launcher({
  visible,
  onClose,
  user,
  onProfilePress,
  onMySpacesPress,
  onDirectoryPress,
  onBookmarksPress,
  onCoursesPress,
  onNotificationSettingsPress,
  onLogout,
}: LauncherProps) {
  const router = useRouter();
  const { isDark, setTheme, colors: themeColors } = useTheme();
  const { visibility } = useAppConfig();
  const features = useFeatures();
  const hideMenu = visibility?.hide_menu ?? EMPTY_HIDE_MENU;
  const isHidden = (key: string) => isMenuHidden(hideMenu, key);

  // Modules are static — memoize to avoid re-sorting on every render
  const moduleLauncherItems = useMemo(() => getLauncherItems(), []);

  const handleThemeToggle = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  const handlePrivacyPolicyPress = () => {
    onClose();
    router.push({ pathname: '/webview', params: { url: PRIVACY_POLICY_URL, title: 'Privacy Policy', noAuth: '1' } });
  };

  // ---------------------------------------------------------------------------
  // Build reorderable items (everything except logout)
  // ---------------------------------------------------------------------------

  const reorderableItems = useMemo(() => {
    const items: GridItem[] = [];

    items.push({ id: 'profile', icon: 'person-outline', label: 'My Profile' });
    items.push({ id: 'spaces', icon: 'people-outline', label: 'My Spaces' });

    if (!isHidden('directory')) {
      items.push({ id: 'directory', icon: 'globe-outline', label: 'Directory' });
    }

    if (!isHidden('bookmarks')) {
      items.push({ id: 'bookmarks', icon: 'bookmark-outline', label: 'Bookmarks' });
    }

    if (features.courses && !isHidden('courses')) {
      items.push({ id: 'courses', icon: 'school-outline', label: 'Courses' });
    }

    if (!isHidden('notification_settings')) {
      items.push({ id: 'notifications', icon: 'notifications-outline', label: 'Notifications' });
    }

    // Module items
    for (const item of moduleLauncherItems) {
      if (item.hideKey && isHidden(item.hideKey)) continue;
      items.push({
        id: item.id,
        icon: item.icon,
        label: item.label,
        iconColor: item.iconColor,
        iconBackground: item.iconBackground,
      });
    }

    // Privacy Policy
    if (!isHidden('privacy')) {
      items.push({ id: 'privacy', icon: 'shield-checkmark-outline', label: 'Privacy' });
    }

    return items;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideMenu, features.courses, moduleLauncherItems]);

  // Stable list of available IDs for the preferences hook
  const availableIds = useMemo(
    () => reorderableItems.map((i) => i.id),
    [reorderableItems],
  );

  // ---------------------------------------------------------------------------
  // Launcher order preferences (persisted to MMKV)
  // ---------------------------------------------------------------------------

  const { orderedIds, reorder } = useLauncherPreferences(availableIds);

  // Sort reorderable items by persisted order
  const sortedItems = useMemo(() => {
    const map = new Map(reorderableItems.map((item) => [item.id, item]));
    const sorted: GridItem[] = [];
    for (const id of orderedIds) {
      const item = map.get(id);
      if (item) sorted.push(item);
    }
    return sorted;
  }, [reorderableItems, orderedIds]);

  // ---------------------------------------------------------------------------
  // Press handler lookup (resolves fresh handler each render — no stale refs)
  // ---------------------------------------------------------------------------

  const getPressHandler = useCallback((id: string): (() => void) | undefined => {
    switch (id) {
      case 'profile': return onProfilePress;
      case 'spaces': return onMySpacesPress;
      case 'directory': return onDirectoryPress;
      case 'bookmarks': return onBookmarksPress;
      case 'courses': return onCoursesPress;
      case 'notifications': return onNotificationSettingsPress;
      case 'privacy': return handlePrivacyPolicyPress;
      default: {
        const moduleItem = moduleLauncherItems.find((m) => m.id === id);
        if (!moduleItem) return undefined;
        return () => {
          onClose();
          router.push(moduleItem.route as any);
        };
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onProfilePress, onMySpacesPress, onDirectoryPress, onBookmarksPress,
      onCoursesPress, onNotificationSettingsPress, moduleLauncherItems]);

  // ---------------------------------------------------------------------------
  // Sortable grid callbacks
  // ---------------------------------------------------------------------------

  const handleDragStart = useCallback(() => {
    hapticMedium();
  }, []);

  const handleOrderChange = useCallback(() => {
    hapticSelection();
  }, []);

  const handleDragEnd = useCallback(
    ({ data }: { data: GridItem[] }) => {
      hapticMedium();
      reorder(data.map((item) => item.id));
    },
    [reorder],
  );

  const renderSortableItem = useCallback<SortableGridRenderItem<GridItem>>(
    ({ item }) => (
      <GridTile
        item={item}
        colors={themeColors}
        onPress={getPressHandler(item.id)}
      />
    ),
    [themeColors, getPressHandler],
  );

  const keyExtractor = useCallback((item: GridItem) => item.id, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <BottomSheet visible={visible} onClose={onClose} heightPercentage={60}>
      <BottomSheetScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileRow}>
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
          </AnimatedPressable>
          {features.dark_mode && (
            <AnimatedPressable
              style={[styles.themeToggle, { backgroundColor: themeColors.backgroundSecondary }]}
              onPress={handleThemeToggle}
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            >
              <Ionicons
                name={isDark ? 'sunny-outline' : 'moon-outline'}
                size={20}
                color={themeColors.textSecondary}
              />
            </AnimatedPressable>
          )}
        </View>

        <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

        {/* Sortable icon grid — long-press to drag and reorder */}
        <View style={styles.gridContainer}>
          <Sortable.Grid
            data={sortedItems}
            columns={NUM_COLUMNS}
            renderItem={renderSortableItem}
            keyExtractor={keyExtractor}
            onDragStart={handleDragStart}
            onOrderChange={handleOrderChange}
            onDragEnd={handleDragEnd}
            rowGap={0}
            columnGap={0}
            dragActivationDelay={400}
            activeItemScale={1.15}
            activeItemOpacity={1}
            activeItemShadowOpacity={0.3}
            inactiveItemOpacity={0.5}
            activationAnimationDuration={250}
            dropAnimationDuration={400}
          />
        </View>

        {/* Logout — pinned at bottom, not reorderable */}
        <View style={styles.logoutRow}>
          <GridTile
            item={{ id: 'logout', icon: 'log-out-outline', label: 'Logout', iconColor: 'error' }}
            colors={themeColors}
            onPress={onLogout}
          />
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.lg,
  },

  profilePreview: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },

  themeToggle: {
    width: 36,
    height: 36,
    borderRadius: sizing.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
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

  divider: {
    height: 1,
    marginHorizontal: spacing.lg,
  },

  gridContainer: {
    paddingHorizontal: GRID_PADDING,
    paddingVertical: spacing.md,
  },

  logoutRow: {
    alignItems: 'flex-start',
    paddingHorizontal: GRID_PADDING,
  },

  tile: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },

  iconCircle: {
    width: ICON_CIRCLE_SIZE,
    height: ICON_CIRCLE_SIZE,
    borderRadius: ICON_CIRCLE_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },

  tileLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    marginTop: spacing.xs,
    textAlign: 'center',
    paddingHorizontal: 2,
  },

});

export default Launcher;
