// =============================================================================
// TAB LAYOUT - Bottom tab navigation
// =============================================================================

import React from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';

// Tab icons as emoji (simple, no external deps)
const TabIcon = ({ emoji, focused }: { emoji: string; focused: boolean }) => (
  <View style={[styles.iconContainer, focused && styles.iconFocused]}>
    <View style={styles.icon}>
      <View style={{ opacity: focused ? 1 : 0.6 }}>
        <View><Text style={{ fontSize: 24 }}>{emoji}</Text></View>
      </View>
    </View>
  </View>
);

// Need to import Text
import { Text } from 'react-native';

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
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 10),
          // Ensure it's above Android nav
          ...Platform.select({
            android: {
              elevation: 8,
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
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.6 }}>🏠</Text>
          ),
        }}
      />
      
      <Tabs.Screen
        name="spaces"
        options={{
          title: 'Spaces',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.6 }}>👥</Text>
          ),
        }}
      />
      
      <Tabs.Screen
        name="create"
        options={{
          title: '',
          tabBarIcon: ({ focused }) => (
            <View style={styles.createButton}>
              <Text style={{ fontSize: 24, color: '#fff' }}>+</Text>
            </View>
          ),
        }}
      />
      
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.6 }}>🔔</Text>
          ),
        }}
      />
      
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.6 }}>😊</Text>
          ),
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
  
  iconFocused: {},
  
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  createButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});
