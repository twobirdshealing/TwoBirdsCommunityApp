// =============================================================================
// TAB LAYOUT - Bottom tab navigation (4 tabs) + Top Header
// =============================================================================
// Tabs: Home, Activity, Spaces, Calendar
// Header: Logo + Messages + Notifications + Avatar Menu
// =============================================================================

import React, { useRef, useCallback } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';

import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { TopHeader } from '@/components/navigation';

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
  const wobble = useRef(new Animated.Value(0)).current;

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.sequence([
      Animated.timing(wobble, { toValue: 1, duration: 40, useNativeDriver: true }),
      Animated.timing(wobble, { toValue: -1, duration: 80, useNativeDriver: true }),
      Animated.timing(wobble, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
    onPress();
  }, [onPress, wobble]);

  const rotation = wobble.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-8deg', '0deg', '8deg'],
  });

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
      <Animated.View style={{ transform: [{ rotate: rotation }] }}>
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

  return (
    <View
      style={[
        styles.tabBarOuter,
        {
          backgroundColor: themeColors.surface,
          borderTopColor: themeColors.border,
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
      ]}
    >
      <View style={styles.tabBarInner}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const color = isFocused ? themeColors.primary : themeColors.textTertiary;

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
    </View>
  );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function TabLayout() {
  const { colors: themeColors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Top Header - Consistent across all tabs */}
      <TopHeader showLogo={true} />

      {/* Tab Navigator */}
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        {/* ============================================= */}
        {/* 4 TABS: Home, Activity, Spaces, Calendar     */}
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
      </Tabs>
    </View>
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
    paddingVertical: 8,
  },

  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },

  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});
