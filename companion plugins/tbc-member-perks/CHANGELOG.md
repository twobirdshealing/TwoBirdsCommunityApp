# Changelog

## 2.1.0 — 2026-04-06

- Fluent Community theme integration: all frontend CSS now uses `--fcom-*` variables for automatic light/dark mode sync
- Enqueue Fluent Community global assets on frontend pages (theme variables + dark mode detection)
- perk-dashboard.css: replaced all hardcoded colors with Fluent theme variables, added dark mode shadow overrides, themed selects and role dropdowns
- perk-labels.css: replaced hardcoded price box colors with Fluent theme variables (kept purple sale badge as-is — status/brand color)
- Added `color-scheme: dark` for native form elements in dark mode

## 2.0.0

- Initial release with WooCommerce Subscriptions integration
- Renewal-based perk levels with percentage discounts
- Role management per perk level
- External subscriber import
- Frontend dashboard shortcode
