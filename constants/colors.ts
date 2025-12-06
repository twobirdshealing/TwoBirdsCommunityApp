// =============================================================================
// COLORS - Two Birds Community Color Palette
// =============================================================================
// A modern, clean color system inspired by latest social media trends.
// 
// Usage:
//   import { colors } from '@/constants/colors';
//   <View style={{ backgroundColor: colors.background }} />
// =============================================================================

export const colors = {
  // ---------------------------------------------------------------------------
  // Brand Colors
  // ---------------------------------------------------------------------------
  
  // Primary brand color - used for buttons, links, active states
  primary: '#6366F1',        // Indigo - modern, trustworthy
  primaryLight: '#818CF8',   // Lighter variant for hover/pressed
  primaryDark: '#4F46E5',    // Darker variant for emphasis
  
  // Secondary accent - used sparingly for highlights
  accent: '#F59E0B',         // Amber - warm, engaging
  
  // ---------------------------------------------------------------------------
  // Background Colors
  // ---------------------------------------------------------------------------
  
  // Main app background
  background: '#F9FAFB',     // Very light gray (almost white)
  
  // Card/surface background
  surface: '#FFFFFF',        // Pure white for cards
  
  // Slightly darker background for sections
  backgroundSecondary: '#F3F4F6',
  
  // ---------------------------------------------------------------------------
  // Text Colors
  // ---------------------------------------------------------------------------
  
  // Primary text - headings, important content
  text: '#111827',           // Near black
  
  // Secondary text - descriptions, metadata
  textSecondary: '#6B7280',  // Medium gray
  
  // Tertiary text - timestamps, hints
  textTertiary: '#9CA3AF',   // Light gray
  
  // Inverse text - on dark backgrounds
  textInverse: '#FFFFFF',
  
  // ---------------------------------------------------------------------------
  // UI Element Colors
  // ---------------------------------------------------------------------------
  
  // Borders and dividers
  border: '#E5E7EB',         // Light gray border
  borderLight: '#F3F4F6',    // Very subtle border
  
  // Icons
  icon: '#6B7280',           // Default icon color
  iconActive: '#6366F1',     // Active/selected icon
  
  // ---------------------------------------------------------------------------
  // Semantic Colors (meaning-based)
  // ---------------------------------------------------------------------------
  
  // Success - completed actions, positive feedback
  success: '#10B981',        // Green
  successLight: '#D1FAE5',   // Light green background
  
  // Error - problems, destructive actions
  error: '#EF4444',          // Red
  errorLight: '#FEE2E2',     // Light red background
  
  // Warning - caution, pending states
  warning: '#F59E0B',        // Amber
  warningLight: '#FEF3C7',   // Light amber background
  
  // Info - helpful information
  info: '#3B82F6',           // Blue
  infoLight: '#DBEAFE',      // Light blue background
  
  // ---------------------------------------------------------------------------
  // Reaction Colors (for emoji reactions)
  // ---------------------------------------------------------------------------
  
  reactions: {
    like: '#3B82F6',         // Blue thumbs up
    love: '#EF4444',         // Red heart
    laugh: '#F59E0B',        // Yellow laugh
    wow: '#F59E0B',          // Yellow wow
    sad: '#F59E0B',          // Yellow sad
    angry: '#EF4444',        // Red angry
  },
  
  // ---------------------------------------------------------------------------
  // Tab Bar Colors
  // ---------------------------------------------------------------------------
  
  tabBar: {
    background: '#FFFFFF',
    border: '#E5E7EB',
    active: '#6366F1',       // Primary color when selected
    inactive: '#9CA3AF',     // Gray when not selected
  },
  
  // ---------------------------------------------------------------------------
  // Special Colors
  // ---------------------------------------------------------------------------
  
  // Verified badge
  verified: '#3B82F6',       // Blue checkmark
  
  // Online indicator
  online: '#10B981',         // Green dot
  
  // Skeleton loading
  skeleton: '#E5E7EB',
  skeletonHighlight: '#F3F4F6',
  
  // Overlay for modals
  overlay: 'rgba(0, 0, 0, 0.5)',
};

// ---------------------------------------------------------------------------
// Dark Mode Colors (for future use)
// ---------------------------------------------------------------------------

export const darkColors = {
  primary: '#818CF8',
  background: '#111827',
  surface: '#1F2937',
  text: '#F9FAFB',
  textSecondary: '#9CA3AF',
  border: '#374151',
  // ... etc
};

// ---------------------------------------------------------------------------
// Helper: Get color with opacity
// ---------------------------------------------------------------------------

export const withOpacity = (color: string, opacity: number): string => {
  // Only works with hex colors
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};
