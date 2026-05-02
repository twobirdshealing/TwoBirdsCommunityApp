// =============================================================================
// DONATE TAB ICON - Static heart for the tab bar
// =============================================================================
// Previously animated with a Reanimated heartbeat pulse. Removed: the pulse
// added a permanent UI-thread display-link callback for cosmetic flair only,
// and shared the same Reanimated mount-and-animate pattern as the lesson-
// completion crash. A static heart matches every other tab icon in the app.
// =============================================================================

import React from 'react';
import { Ionicons } from '@expo/vector-icons';

interface DonateTabIconProps {
  focused: boolean;
  color: string;
}

export function DonateTabIcon({ focused, color }: DonateTabIconProps) {
  return (
    <Ionicons
      name={focused ? 'heart' : 'heart-outline'}
      size={24}
      color={color}
    />
  );
}
