// =============================================================================
// PROFILE LAYOUT - Stack navigation for profile screens
// =============================================================================

import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme } from '@/contexts/ThemeContext';

export default function ProfileLayout() {
  const { colors: themeColors } = useTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <Stack screenOptions={{ contentStyle: { backgroundColor: themeColors.background } }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="connections"
          options={{ headerShown: false }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
