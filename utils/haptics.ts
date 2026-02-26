// =============================================================================
// HAPTICS - Centralized haptic feedback utilities
// =============================================================================
// Wraps expo-haptics with short named exports for consistent usage.
// See CLAUDE.md plan for haptic type reference.
// =============================================================================

import * as Haptics from 'expo-haptics';

/** Standard taps: buttons, toggles, menu items, bookmarks */
export const hapticLight = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

/** Important actions: form submissions, follow/unfollow, long-press */
export const hapticMedium = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

/** Major navigation: tab bar only */
export const hapticHeavy = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

/** Destructive actions: delete, logout */
export const hapticWarning = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

/** Checkboxes, radio buttons, select picker options */
export const hapticSelection = () => Haptics.selectionAsync();
