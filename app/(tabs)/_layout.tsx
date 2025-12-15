// =============================================================================
// TAB LAYOUT - Bottom tab navigation
// =============================================================================
// Updated: Removed "+ Post" tab, added "Activity" tab
// Posting is now done via inline composers on feed/space pages
// =============================================================================

import React from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  
  // Calculate tab bar height with safe area
  const tabBarHeight = 60 + Math.max(insets.bottom, 10);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          position: 'absolute', // Keep visible on all pages
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
      {/* Home Feed */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.6 }}>🏠</Text>
          ),
        }}
      />
      
      {/* Spaces */}
      <Tabs.Screen
        name="spaces"
        options={{
          title: 'Spaces',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.6 }}>👥</Text>
          ),
        }}
      />
      
      {/* Activity - NEW! Replaces "+ Post" */}
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.6 }}>📊</Text>
          ),
        }}
      />
      
      {/* Notifications */}
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.6 }}>🔔</Text>
          ),
        }}
      />
      
      {/* Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.6 }}>😊</Text>
          ),
        }}
      />
      
      {/* Hide old create tab */}
      <Tabs.Screen
        name="create"
        options={{
          href: null, // Removes from tab bar
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
