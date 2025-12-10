// =============================================================================
// TAB LAYOUT - 5-tab bottom navigation
// =============================================================================

import { Tabs } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      {/* Home Tab */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <Text style={styles.icon}>{focused ? '🏠' : '🏡'}</Text>
          ),
        }}
      />
      
      {/* Spaces Tab */}
      <Tabs.Screen
        name="spaces"
        options={{
          title: 'Spaces',
          tabBarIcon: ({ focused }) => (
            <Text style={styles.icon}>{focused ? '👥' : '👤'}</Text>
          ),
        }}
      />
      
      {/* Create Tab (Center) */}
      <Tabs.Screen
        name="create"
        options={{
          title: '',
          tabBarIcon: () => (
            <View style={styles.createButton}>
              <Text style={styles.createIcon}>+</Text>
            </View>
          ),
        }}
      />
      
      {/* Notifications Tab */}
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ focused }) => (
            <Text style={styles.icon}>{focused ? '🔔' : '🔕'}</Text>
          ),
        }}
      />
      
      {/* Profile Tab */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <Text style={styles.icon}>{focused ? '😊' : '🙂'}</Text>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E5E7EB',
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 88 : 70,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
  },
  
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  
  icon: {
    fontSize: 24,
  },
  
  createButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -15,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  
  createIcon: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '300',
    marginTop: -2,
  },
});