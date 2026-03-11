# Fluent Community Theme Integration Guide

Quick reference for aligning WordPress plugins with the Fluent Community theming system.

---

## CSS Variable Reference

All Fluent variables use the `--fcom-` prefix. **Always include fallback values.**

### Core Variables

| Variable | Purpose | Light Fallback | Dark Mode |
|----------|---------|----------------|-----------|
| `--fcom-primary-bg` | Main backgrounds | `#ffffff` | `#2B2E33` |
| `--fcom-secondary-bg` | Secondary surfaces | `#f0f2f5` | `#191B1F` |
| `--fcom-primary-text` | Main text | `#19283a` | `#F0F3F5` |
| `--fcom-secondary-text` | Meta/labels | `#525866` | lighter gray |
| `--fcom-primary-border` | Borders/dividers | `#e3e8ee` | darker |
| `--fcom-text-link` | Links/accents | `#2271b1` | same |
| `--fcom-primary-button` | Button backgrounds | `#2B2E33` | varies |
| `--fcom-primary-button-text` | Button text | `#ffffff` | `#ffffff` |
| `--fcom-active-bg` | Hover/active states | `rgba(0,0,0,0.05)` | `rgba(255,255,255,0.05)` |

### Extended Variables

| Variable | Purpose |
|----------|---------|
| `--fcom-secondary-content-bg` | Content boxes |
| `--fcom-light-bg` | Light backgrounds |
| `--fcom-deep-bg` | Deep/dark backgrounds |
| `--fcom-text-off` | Muted/disabled text |
| `--fcom-secondary-border` | Secondary borders |
| `--fcom-highlight-bg` | Highlights/emphasis |
| `--fcom-menu-text` | Menu text |
| `--fcom-menu-text-active` | Active menu items |
| `--fcom-menu-text-hover` | Hover menu items |
| `--fcom-menu-bg-hover` | Menu hover backgrounds |

---

## The Golden Rule: Always Use Fallbacks

```css
/* CORRECT - Works with or without Fluent */
background: var(--fcom-primary-bg, #ffffff);
color: var(--fcom-primary-text, #19283a);
border: 1px solid var(--fcom-primary-border, #e3e8ee);

/* WRONG - Breaks without Fluent */
background: var(--fcom-primary-bg);
```

---

## Dark Mode Pattern

Dark mode is activated via the `html.dark` class on the document root.

### Basic Structure

```css
/* Light mode (default) - uses CSS variables with fallbacks */
.my-component {
    background: var(--fcom-primary-bg, #ffffff);
    color: var(--fcom-primary-text, #19283a);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

/* Dark mode overrides - only override what changes */
html.dark .my-component {
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);  /* Darker shadows */
}

/* Dark mode hover states */
html.dark .my-component:hover {
    background: rgba(255,255,255,0.05);  /* Light overlay on dark */
}
```

### What to Override in Dark Mode

| Property | Light Mode | Dark Mode |
|----------|------------|-----------|
| `box-shadow` | `rgba(0,0,0,0.1-0.2)` | `rgba(0,0,0,0.3-0.5)` |
| Hover backgrounds | `rgba(0,0,0,0.05)` | `rgba(255,255,255,0.05)` |
| Highlights | Light tints | Darker tints |

**Note:** Colors using `--fcom-*` variables auto-switch. Only override shadows, overlays, and special effects.

---

## Component Examples

### Buttons

```css
.my-button {
    background: var(--fcom-primary-button, #2B2E33);
    color: var(--fcom-primary-button-text, #ffffff);
    border: 1px solid transparent;
    cursor: pointer;
}

.my-button:hover {
    filter: brightness(1.1);
}

.my-button.secondary {
    background: var(--fcom-secondary-bg, #f0f2f5);
    color: var(--fcom-secondary-text, #525866);
    border: 1px solid var(--fcom-primary-border, #e3e8ee);
}
```

### Cards/Boxes

```css
.my-card {
    background: var(--fcom-primary-bg, #ffffff);
    border: 1px solid var(--fcom-primary-border, #e3e8ee);
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

html.dark .my-card {
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}
```

### Form Inputs

```css
.my-input {
    background: var(--fcom-primary-bg, #ffffff);
    color: var(--fcom-primary-text, #19283a);
    border: 1px solid var(--fcom-primary-border, #e3e8ee);
}

.my-input:focus {
    border-color: var(--fcom-text-link, #2271b1);
    outline: none;
}

.my-input::placeholder {
    color: var(--fcom-secondary-text, #525866);
}
```

### Navigation/Tabs

```css
.my-nav {
    background: var(--fcom-secondary-bg, #f0f2f5);
}

.my-nav-item {
    color: var(--fcom-secondary-text, #525866);
}

.my-nav-item:hover {
    color: var(--fcom-primary-text, #19283a);
    background: var(--fcom-active-bg, rgba(0,0,0,0.05));
}

html.dark .my-nav-item:hover {
    background: rgba(255,255,255,0.05);
}

.my-nav-item.active {
    background: var(--fcom-text-link, #2271b1);
    color: #ffffff;
}
```

### Links

```css
.my-link {
    color: var(--fcom-text-link, #2271b1);
    text-decoration: none;
}

.my-link:hover {
    text-decoration: underline;
}
```

### Badges/Tags

```css
.my-badge {
    display: inline-flex;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 4px;
}

.my-badge.active {
    background: rgba(139,92,246,0.15);  /* Purple tint */
    color: #a78bfa;
}

.my-badge.inactive {
    background: var(--fcom-secondary-bg, #f0f2f5);
    color: var(--fcom-secondary-text, #525866);
}
```

---

## Status Colors (Non-Themed)

Some colors should NOT change with theme (status indicators, alerts):

```css
/* Success/Available - Always green */
.status-success {
    background: linear-gradient(to bottom, #28a745, #34ce57);
    color: #ffffff;
}

/* Error/Closed - Always red */
.status-error {
    background: linear-gradient(to bottom, #FF4B47, #FF6B65);
    color: #ffffff;
}

/* Info/Open - Always blue */
.status-info {
    background: linear-gradient(to bottom, #345BFF, #527DFF);
    color: #ffffff;
}

/* Warning - Always amber */
.status-warning {
    background: linear-gradient(to bottom, #f0ad4e, #ec971f);
    color: #ffffff;
}
```

---

## Quick Start Checklist

### 1. Replace hardcoded colors

Find and replace:
- `#ffffff` backgrounds → `var(--fcom-primary-bg, #ffffff)`
- `#f0f2f5` secondary → `var(--fcom-secondary-bg, #f0f2f5)`
- Dark text colors → `var(--fcom-primary-text, #19283a)`
- Gray text → `var(--fcom-secondary-text, #525866)`
- Border colors → `var(--fcom-primary-border, #e3e8ee)`
- Link/accent colors → `var(--fcom-text-link, #2271b1)`

### 2. Add dark mode shadows

For each `box-shadow`, add:
```css
html.dark .your-selector {
    box-shadow: /* same shadow with higher opacity */;
}
```

### 3. Fix dark mode hovers

Replace light overlays with dark-compatible versions:
```css
html.dark .your-selector:hover {
    background: rgba(255,255,255,0.05);
}
```

### 4. Test both modes

1. Load page normally (light mode)
2. Add `dark` class to `<html>` element in DevTools
3. Verify all components are visible and readable
4. Check shadows aren't too harsh or invisible

---

## CSS File Template

```css
/**
 * Plugin Name - Frontend Styles
 * Fluent Community Theme Compatible
 */

/* ==========================================================================
   CSS Variables (if defining custom ones)
   ========================================================================== */

:root {
    --my-plugin-gap: 1rem;
    --my-plugin-radius: 8px;
}

/* ==========================================================================
   Base Styles (Light Mode Default)
   ========================================================================== */

.my-plugin-container {
    background: var(--fcom-primary-bg, #ffffff);
    color: var(--fcom-primary-text, #19283a);
    border: 1px solid var(--fcom-primary-border, #e3e8ee);
    border-radius: var(--my-plugin-radius);
}

.my-plugin-header {
    background: var(--fcom-secondary-bg, #f0f2f5);
    border-bottom: 1px solid var(--fcom-primary-border, #e3e8ee);
}

.my-plugin-content {
    padding: var(--my-plugin-gap);
}

.my-plugin-link {
    color: var(--fcom-text-link, #2271b1);
}

.my-plugin-button {
    background: var(--fcom-primary-button, #2B2E33);
    color: var(--fcom-primary-button-text, #ffffff);
}

.my-plugin-meta {
    color: var(--fcom-secondary-text, #525866);
}

/* ==========================================================================
   Dark Mode Overrides
   ========================================================================== */

html.dark .my-plugin-container {
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

html.dark .my-plugin-item:hover {
    background: rgba(255,255,255,0.05);
}

/* ==========================================================================
   Responsive
   ========================================================================== */

@media (max-width: 768px) {
    .my-plugin-container {
        /* mobile adjustments */
    }
}

/* ==========================================================================
   Accessibility
   ========================================================================== */

@media (prefers-reduced-motion: reduce) {
    .my-plugin-container,
    .my-plugin-button {
        animation: none !important;
        transition: none !important;
    }
}
```

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| No fallback values | Always use `var(--fcom-x, fallback)` |
| Same shadows in dark mode | Increase shadow opacity for dark |
| Light hover on dark backgrounds | Use `rgba(255,255,255,0.05)` for dark |
| Hardcoded white/black text | Use `--fcom-primary-text` |
| Using `!important` on colors | Breaks theme customization |

---

## Reference Files

- Calendar CSS examples: `TBC Calendar/css/template-main-view.css`
- Fluent core variables: `fluent-community/app/Functions/Utility.php`
- Fluent customizer: `fluent-community/app/Hooks/Handlers/CustomizerHander.php`
