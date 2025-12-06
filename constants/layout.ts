// =============================================================================
// LAYOUT - Spacing, sizing, and layout constants
// =============================================================================
// Consistent spacing makes the app feel polished and professional.
// Using a scale system (like 4, 8, 12, 16...) keeps things harmonious.
//
// Usage:
//   import { spacing, sizing } from '@/constants/layout';
//   <View style={{ padding: spacing.md, borderRadius: sizing.borderRadius.lg }} />
// =============================================================================

// -----------------------------------------------------------------------------
// Spacing Scale (based on 4px grid)
// -----------------------------------------------------------------------------

export const spacing = {
  // Extra small - tiny gaps, icon padding
  xs: 4,
  
  // Small - between related elements
  sm: 8,
  
  // Medium - default padding, gaps
  md: 12,
  
  // Large - section padding
  lg: 16,
  
  // Extra large - screen padding
  xl: 20,
  
  // 2x Extra large - major sections
  xxl: 24,
  
  // 3x Extra large - screen margins
  xxxl: 32,
};

// -----------------------------------------------------------------------------
// Sizing (fixed sizes for UI elements)
// -----------------------------------------------------------------------------

export const sizing = {
  // Avatar sizes
  avatar: {
    xs: 24,    // Tiny - in lists
    sm: 32,    // Small - comments
    md: 40,    // Medium - feed cards
    lg: 56,    // Large - profile headers
    xl: 80,    // Extra large - my profile
    xxl: 120,  // Huge - profile page hero
  },
  
  // Icon sizes
  icon: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 28,
    xl: 32,
  },
  
  // Border radius
  borderRadius: {
    xs: 4,     // Subtle rounding
    sm: 8,     // Buttons, small cards
    md: 12,    // Cards, inputs
    lg: 16,    // Large cards
    xl: 20,    // Modals
    full: 9999, // Circular (avatars, pills)
  },
  
  // Common heights
  height: {
    button: 48,
    buttonSmall: 36,
    input: 48,
    tabBar: 60,
    header: 56,
  },
  
  // Touch targets (minimum for accessibility)
  touchTarget: 44,
};

// -----------------------------------------------------------------------------
// Typography Scale
// -----------------------------------------------------------------------------

export const typography = {
  // Font sizes
  size: {
    xs: 11,    // Captions, timestamps
    sm: 13,    // Secondary text
    md: 15,    // Body text
    lg: 17,    // Emphasized body
    xl: 20,    // Section headers
    xxl: 24,   // Screen titles
    xxxl: 32,  // Hero text
  },
  
  // Line heights (as multipliers)
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  
  // Font weights
  weight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

// -----------------------------------------------------------------------------
// Shadows (for elevation)
// -----------------------------------------------------------------------------

export const shadows = {
  // No shadow
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  
  // Subtle shadow - cards
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  
  // Medium shadow - floating elements
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  // Large shadow - modals, dropdowns
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
};

// -----------------------------------------------------------------------------
// Screen-related constants
// -----------------------------------------------------------------------------

export const screen = {
  // Horizontal padding for screen content
  horizontalPadding: spacing.lg,
  
  // Safe area additions (status bar, notch)
  statusBarHeight: 44,
  bottomSafeArea: 34,
  
  // Maximum content width (for tablets)
  maxContentWidth: 600,
};

// -----------------------------------------------------------------------------
// Animation durations (in milliseconds)
// -----------------------------------------------------------------------------

export const animation = {
  fast: 150,
  normal: 250,
  slow: 350,
};
