// =============================================================================
// TAB LAYOUT - Bottom tab navigation (4 tabs) + Top Header
// =============================================================================
// Tabs: Home, Activity, Spaces, Calendar
// Header: Logo + Messages + Notifications + Avatar Menu
// =============================================================================

import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
// Component
// -----------------------------------------------------------------------------

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();

  const tabBarHeight = 60 + Math.max(insets.bottom, 10);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Top Header - Consistent across all tabs */}
      <TopHeader showLogo={true} />

      {/* Tab Navigator */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: themeColors.primary,
          tabBarInactiveTintColor: themeColors.textTertiary,
          tabBarStyle: {
            position: 'absolute',
            backgroundColor: themeColors.surface,
            borderTopWidth: 1,
            borderTopColor: themeColors.border,
            height: tabBarHeight,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 10),
            ...Platform.select({
              android: {
                elevation: 8,
              },
              ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.1,
                shadowRadius: 3,
              },
            }),
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
            marginTop: 2,
          },
        }}
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
});
