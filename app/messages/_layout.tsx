// =============================================================================
// MESSAGES LAYOUT - Stack navigation for messages screens
// =============================================================================

import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme } from '@/contexts/ThemeContext';

export default function MessagesLayout() {
  const { colors: themeColors } = useTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: themeColors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="user/[userId]" />
        <Stack.Screen name="group/[threadId]" />
        <Stack.Screen name="space/[threadId]" />
      </Stack>
    </GestureHandlerRootView>
  );
}
