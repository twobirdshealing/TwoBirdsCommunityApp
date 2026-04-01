// =============================================================================
// SPACE LAYOUT - Stack navigation for space screens
// =============================================================================

import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme } from '@/contexts/ThemeContext';

export default function SpaceLayout() {
  const { colors: themeColors } = useTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <Stack screenOptions={{ contentStyle: { backgroundColor: themeColors.background } }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="members"
          options={{ headerShown: false }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
