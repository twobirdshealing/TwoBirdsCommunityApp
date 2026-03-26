// =============================================================================
// VISIBILITY UTILITIES - Role-based UI element visibility
// =============================================================================
// Shared helpers for checking whether a UI element (tab, widget, launcher
// item, header icon) should be hidden based on the server's hide_menu array.
// =============================================================================

/** Stable empty array — use as fallback to avoid creating new references */
export const EMPTY_HIDE_MENU: string[] = [];

/** Check if an element key is hidden in the current hide_menu list */
export function isHidden(hideMenu: string[], key: string): boolean {
  return hideMenu.includes(key);
}

/** Check if an optional hideKey is present in hide_menu (falsy key = not hidden) */
export function isItemHidden(hideMenu: string[], hideKey?: string): boolean {
  return !!hideKey && hideMenu.includes(hideKey);
}
