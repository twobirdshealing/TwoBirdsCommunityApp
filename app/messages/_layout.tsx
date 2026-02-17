// =============================================================================
// MESSAGES LAYOUT - Stack navigation for messages screens
// =============================================================================

import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function MessagesLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="user/[userId]" />
      </Stack>
    </GestureHandlerRootView>
  );
}
