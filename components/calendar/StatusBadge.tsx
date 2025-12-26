// =============================================================================
// STATUS BADGE - Vertical status indicator for events
// =============================================================================
// Matches the web calendar's vertical sidebar:
// - AVAILABLE (blue) - Event is open for booking
// - WAITLIST (red) - Event is full, can join waitlist  
// - BOOKED (green) - User has booked this event
// =============================================================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { EventStatus, EventUserStatus } from '@/types/calendar';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface StatusBadgeProps {
  status: EventStatus;
  userStatus?: EventUserStatus | null;
  height?: number | '100%';
}

// -----------------------------------------------------------------------------
// Status Config
// -----------------------------------------------------------------------------

interface StatusConfig {
  label: string;
  colors: [string, string];  // Gradient colors
}

function getStatusConfig(
  status: EventStatus,
  userStatus?: EventUserStatus | null
): StatusConfig {
  // User is booked - show BOOKED regardless of event status
  if (userStatus?.is_booked) {
    return {
      label: 'BOOKED',
      colors: ['#28a745', '#34ce57'],  // Green gradient
    };
  }

  // User is on waitlist - show WAITLIST
  if (userStatus?.is_on_waitlist) {
    return {
      label: 'WAITLIST',
      colors: ['#FF4B47', '#FF6B65'],  // Red gradient
    };
  }

  // Based on event status
  switch (status) {
    case 'booked':
      return {
        label: 'BOOKED',
        colors: ['#28a745', '#34ce57'],
      };
    case 'closed':
      return {
        label: 'WAITLIST',
        colors: ['#FF4B47', '#FF6B65'],
      };
    case 'open':
    default:
      return {
        label: 'AVAILABLE',
        colors: ['#345BFF', '#527DFF'],  // Blue gradient
      };
  }
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function StatusBadge({ status, userStatus, height = '100%' }: StatusBadgeProps) {
  const config = getStatusConfig(status, userStatus);

  return (
    <LinearGradient
      colors={config.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.container, { height }]}
    >
      <Text style={styles.label}>{config.label}</Text>
    </LinearGradient>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },

  label: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    // Rotate text vertically
    transform: [{ rotate: '-90deg' }],
    // Ensure text fits when rotated
    width: 100,
    textAlign: 'center',
  },
});

export default StatusBadge;
