// =============================================================================
// TAB LAYOUT - Bottom tab navigation
// =============================================================================
// FIXED: Uses /profile/{username} like profile page does (NOT /profile/me)!
// =============================================================================

import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform, Text, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { profilesApi } from '@/services/api';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [avatar, setAvatar] = useState<string | null>(null);
  
  const tabBarHeight = 60 + Math.max(insets.bottom, 10);

  // Fetch avatar - EXACT same way profile page does it!
  useEffect(() => {
    const fetchAvatar = async () => {
      if (!user?.username) return;
      
      try {
        // Same as profile page: profilesApi.getProfile(user.username)
        const response = await profilesApi.getProfile(user.username);
        
        if (response.success && response.data.profile?.avatar) {
          setAvatar(response.data.profile.avatar);
        }
      } catch (err) {
        // Silent fail - show fallback emoji
      }
    };

    fetchAvatar();
  }, [user?.username]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
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
      {/* Home */}
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
      
      {/* Calendar */}
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.6 }}>📅</Text>
          ),
        }}
      />
      
      {/* Messages */}
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.6 }}>💬</Text>
          ),
        }}
      />
      
      {/* Profile - Shows user avatar */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => {
            if (avatar) {
              return (
                <View style={[styles.avatarContainer, focused && styles.avatarFocused]}>
                  <Image 
                    source={{ uri: avatar }}
                    style={styles.avatar}
                  />
                </View>
              );
            }
            return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.6 }}>👤</Text>;
          },
        }}
      />
      
      {/* Hidden routes */}
      <Tabs.Screen name="space/[slug]" options={{ href: null }} />
      <Tabs.Screen name="activity" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="create" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  avatarContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  
  avatarFocused: {
    borderColor: colors.primary,
  },
  
  avatar: {
    width: '100%',
    height: '100%',
  },
});
