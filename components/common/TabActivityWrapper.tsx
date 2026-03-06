// =============================================================================
// TAB ACTIVITY WRAPPER - React 19.2 <Activity> for tab state preservation
// =============================================================================
// Wraps tab screen content with React.Activity to pause effects on hidden tabs
// while preserving component state (scroll position, form inputs, etc.).
//
// When a tab is hidden:
//   - Effects unmount (subscriptions, timers, fetch listeners cleaned up)
//   - State is preserved (component tree stays in memory)
//   - Re-renders are deferred to low priority
//
// When a tab becomes visible:
//   - Effects re-mount (data re-fetches, subscriptions reconnect)
//   - Preserved state is immediately available (no flash of loading)
//
// Usage:
//   export default function HomeScreen() {
//     return (
//       <TabActivityWrapper>
//         <View style={styles.container}>...</View>
//       </TabActivityWrapper>
//     );
//   }
// =============================================================================

import React from 'react';
import { useIsFocused } from 'expo-router';

// React 19.2 exposes Activity as a component, but TypeScript types may lag.
// Activity is confirmed available as a symbol in React 19.2 (react-native 0.83).
const Activity = (React as any).Activity as React.ComponentType<{
  mode: 'visible' | 'hidden';
  children: React.ReactNode;
}>;

interface TabActivityWrapperProps {
  children: React.ReactNode;
}

export function TabActivityWrapper({ children }: TabActivityWrapperProps) {
  const isFocused = useIsFocused();

  return (
    <Activity mode={isFocused ? 'visible' : 'hidden'}>
      {children}
    </Activity>
  );
}
