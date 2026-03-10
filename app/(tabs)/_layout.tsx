// =============================================================================
// TAB LAYOUT - Bottom tab navigation + Top Header
// =============================================================================
// Tabs: Home, Activity, Spaces, Calendar, Donate (hideable)
// Header: Logo + Messages + Notifications + Avatar Menu
// =============================================================================

import React, { useCallback, useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, interpolate, useAnimatedStyle, useSharedValue, withSequence, withTiming, withRepeat, withDelay, Easing } from 'react-native-reanimated';
import { Tabs, useRouter } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { hapticHeavy } from '@/utils/haptics';
import { SITE_URL } from '@/constants/config';

import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { TabBarProvider, useTabBar } from '@/contexts/TabBarContext';
import { TopHeader } from '@/components/navigation/TopHeader';
import { MiniPlayer } from '@/components/bookclub/MiniPlayer';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { spacing, typography } from '@/constants/layout';

// -----------------------------------------------------------------------------
// Tab Bar Icon Component
// -----------------------------------------------------------------------------

interface TabIconProps {
  name: keyof typeof Ionicons.glyphMap;
  nameOutline: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color: string;
}

function TabIcon({ name, nameOutline, focused, color }: TabIconProps) {
  return (
    <Ionicons
      name={focused ? name : nameOutline}
      size={24}
      color={color}
    />
  );
}

// -----------------------------------------------------------------------------
// Donate Tab Icon - Red heart with gentle pulse
// -----------------------------------------------------------------------------

function DonateTabIcon({ focused, color }: { focused: boolean; color: string }) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!focused) {
      // Gentle heartbeat: scale up then back, repeat with pause
      pulse.value = withRepeat(
        withSequence(
          withDelay(2000, withTiming(1.18, { duration: 200, easing: Easing.out(Easing.ease) })),
          withTiming(1, { duration: 150, easing: Easing.in(Easing.ease) }),
          withTiming(1.12, { duration: 160, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 200, easing: Easing.in(Easing.ease) }),
        ),
        -1, // infinite
      );
    } else {
      pulse.value = withTiming(1, { duration: 150 });
    }
    return () => cancelAnimation(pulse);
  }, [focused, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons
        name={focused ? 'heart' : 'heart-outline'}
        size={24}
        color={color}
      />
    </Animated.View>
  );
}

// -----------------------------------------------------------------------------
// Tab Item Button (with wobble animation + haptic feedback)
// -----------------------------------------------------------------------------

interface TabItemButtonProps {
  routeKey: string;
  label: string;
  icon: React.ReactNode;
  isFocused: boolean;
  color: string;
  accessibilityLabel?: string;
  onPress: () => void;
  onLongPress: () => void;
}

function TabItemButton({ routeKey, label, icon, isFocused, color, accessibilityLabel, onPress, onLongPress }: TabItemButtonProps) {
  const wobble = useSharedValue(0);

  const handlePress = useCallback(() => {
    hapticHeavy();
    wobble.value = withSequence(
      withTiming(1, { duration: 40 }),
      withTiming(-1, { duration: 80 }),
      withTiming(0, { duration: 40 }),
    );
    onPress();
  }, [onPress, wobble]);

  const wobbleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(wobble.value, [-1, 0, 1], [-8, 0, 8])}deg` }],
  }));

  return (
    <Pressable
      key={routeKey}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      onPress={handlePress}
      onLongPress={onLongPress}
      style={styles.tabItem}
    >
      <Animated.View style={wobbleStyle}>
        {icon}
      </Animated.View>
      <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
// Custom Tab Bar
// -----------------------------------------------------------------------------

function CustomTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { colors: themeColors } = useTheme();
  const { translateY } = useTabBar();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.tabBarOuter,
        {
          backgroundColor: themeColors.tabBar.background,
          borderTopColor: themeColors.tabBar.border,
          paddingBottom: insets.bottom,
          ...Platform.select({
            android: { elevation: 8 },
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.1,
              shadowRadius: 3,
            },
          }),
        },
        animatedStyle,
      ]}
    >
      <MiniPlayer />
      <View style={styles.tabBarInner}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const isDonate = route.name === 'donate';
          const color = isDonate ? themeColors.error : (isFocused ? themeColors.tabBar.active : themeColors.tabBar.inactive);

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <TabItemButton
              key={route.key}
              routeKey={route.key}
              label={options.title ?? route.name}
              icon={options.tabBarIcon?.({ focused: isFocused, color, size: 24 })}
              isFocused={isFocused}
              color={color}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>
    </Animated.View>
  );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

const DONATE_URL = `${SITE_URL}/calendar/donate/`;

function TabLayoutInner() {
  const { colors: themeColors } = useTheme();
  const { showTabBar } = useTabBar();
  const { visibility } = useAppConfig();
  const router = useRouter();
  const hideMenu = visibility?.hide_menu ?? [];
  const isDonateHidden = hideMenu.includes('donate');

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Top Header - Consistent across all tabs */}
      <TopHeader showLogo={true} />

      {/* Tab Navigator */}
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
        screenListeners={{ tabPress: () => showTabBar() }}
      >
        {/* ============================================= */}
        {/* TABS: Home, Activity, Spaces, Calendar (+Donate) */}
        {/* ============================================= */}

        {/* Home Tab - Welcome page */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ focused, color }) => (
              <TabIcon name="home" nameOutline="home-outline" focused={focused} color={color} />
            ),
          }}
        />

        {/* Activity Tab - Main feed */}
        <Tabs.Screen
          name="activity"
          options={{
            title: 'Activity',
            tabBarIcon: ({ focused, color }) => (
              <TabIcon name="newspaper" nameOutline="newspaper-outline" focused={focused} color={color} />
            ),
          }}
        />

        {/* Spaces Tab */}
        <Tabs.Screen
          name="spaces"
          options={{
            title: 'Spaces',
            tabBarIcon: ({ focused, color }) => (
              <TabIcon name="people" nameOutline="people-outline" focused={focused} color={color} />
            ),
          }}
        />

        {/* Calendar Tab */}
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Calendar',
            tabBarIcon: ({ focused, color }) => (
              <TabIcon name="calendar" nameOutline="calendar-outline" focused={focused} color={color} />
            ),
          }}
        />

        {/* Donate Tab - hidden from tab bar when 'donate' is in hide_menu */}
        <Tabs.Screen
          name="donate"
          options={{
            title: 'Donate',
            href: isDonateHidden ? null : undefined,
            tabBarIcon: ({ focused, color }) => (
              <DonateTabIcon focused={focused} color={color} />
            ),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              router.push({
                pathname: '/webview',
                params: {
                  url: DONATE_URL,
                  title: 'Donate',
                  rightIcon: 'cart-outline',
                  rightAction: 'cart',
                },
              });
            },
          }}
        />
      </Tabs>
    </View>
  );
}

export default function TabLayout() {
  return (
    <TabBarProvider>
      <TabLayoutInner />
    </TabBarProvider>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  tabBarOuter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
  },

  tabBarInner: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
  },

  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },

  tabLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
});
