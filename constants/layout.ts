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
  xs: 4,     // Tiny gaps, icon padding
  sm: 8,     // Between related elements
  md: 12,    // Default padding, gaps
  lg: 16,    // Section padding
  xl: 20,    // Screen padding
  xxl: 24,   // Major sections
};

// -----------------------------------------------------------------------------
// Sizing (fixed sizes for UI elements)
// -----------------------------------------------------------------------------

export const sizing = {
  // Large placeholder emojis (cards, error screens)
  icon: {
    xxl: 48,
  },

  // Icon button (header buttons, close buttons, send buttons)
  iconButton: 40,

  // Border radius
  borderRadius: {
    sm: 8,     // Buttons, small cards
    md: 12,    // Cards, inputs
    lg: 16,    // Large cards, modals
    full: 9999, // Circular (avatars, pills)
  },

  // Common heights
  height: {
    button: 48,
    buttonSmall: 36,
    tabBar: 46,
  },

  // Form input sizing
  input: {
    height: 48,            // Standard input height
    heightSmall: 36,       // Compact inputs (search bars, filters)
    paddingHorizontal: 16, // spacing.lg
    paddingVertical: 12,   // spacing.md
  },

  // Touch targets (minimum for accessibility)
  touchTarget: 44,

  // Avatar sizes (circular profile images)
  avatar: {
    xs: 24,    // Tiny - in lists
    sm: 32,    // Small - comments
    md: 48,    // Medium - feed cards, widgets
    lg: 56,    // Large - profile headers
    xl: 80,    // Extra large - my profile
    xxl: 120,  // Huge - profile page hero
  },
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
    xxl: 24,   // Screen titles, hero text
  },

  // Line heights (as multipliers)
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },

  // Font weights
  weight: {
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

// -----------------------------------------------------------------------------
// Shadows (for elevation)
// -----------------------------------------------------------------------------

export const shadows = {
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
