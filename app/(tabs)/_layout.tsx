// =============================================================================
// TAB LAYOUT - Bottom tab navigation (3 tabs) + Top Header
// =============================================================================
// Tabs: Home, Spaces, Calendar
// Header: Logo + Messages + Notifications + Avatar Menu
// =============================================================================

import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { TopHeader } from '@/components/navigation';

// -----------------------------------------------------------------------------
// Tab Bar Icon Component
// -----------------------------------------------------------------------------

interface TabIconProps {
  name: keyof typeof Ionicons.glyphMap;
  nameOutline: keyof typeof Ionicons.glyphMap;
  focused: boolean;
}

function TabIcon({ name, nameOutline, focused }: TabIconProps) {
  return (
    <Ionicons
      name={focused ? name : nameOutline}
      size={24}
      color={focused ? colors.primary : colors.textTertiary}
    />
  );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  const tabBarHeight = 60 + Math.max(insets.bottom, 10);

  return (
    <View style={styles.container}>
      {/* Top Header - Consistent across all tabs */}
      <TopHeader showLogo={true} />

      {/* Tab Navigator */}
      <Tabs
        screenOptions={{
          headerShown: false, // Using custom TopHeader
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textTertiary,
          tabBarStyle: {
            position: 'absolute',
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
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
        {/* Home Tab */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ focused }) => (
              <TabIcon name="home" nameOutline="home-outline" focused={focused} />
            ),
          }}
        />

        {/* Spaces Tab */}
        <Tabs.Screen
          name="spaces"
          options={{
            title: 'Spaces',
            tabBarIcon: ({ focused }) => (
              <TabIcon name="people" nameOutline="people-outline" focused={focused} />
            ),
          }}
        />

        {/* Calendar Tab */}
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Calendar',
            tabBarIcon: ({ focused }) => (
              <TabIcon name="calendar" nameOutline="calendar-outline" focused={focused} />
            ),
          }}
        />

        {/* ============================================= */}
        {/* HIDDEN SCREENS - Don't show in tab bar       */}
        {/* These files exist but shouldn't be tabs      */}
        {/* ============================================= */}
        
        <Tabs.Screen name="activity" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="create" options={{ href: null }} />
        
        {/* Old tabs - hide if files still exist during transition */}
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="messages" options={{ href: null }} />
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
    backgroundColor: colors.background,
  },
});
