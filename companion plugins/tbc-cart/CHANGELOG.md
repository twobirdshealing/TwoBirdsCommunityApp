# Changelog

## 2.0.1 — 2026-03-26
- Hooks directly into Fluent Community's `fluent_community/theme_content` action instead of theme-specific filter
- Works with any WordPress theme — no longer requires Fluent Starter theme
- Renders WC content at priority 5, removes default handler to prevent double output

## 2.0.0 — 2026-03-26
- **Major:** Absorbed all WooCommerce integration from tbc-starter-theme
- Mini cart rendering in Fluent Community header (with AJAX item removal)
- GamiPress credits/points display in mini cart dropdown
- WooCommerce page rendering inside Fluent Community frame (shop, product, cart, checkout, account)
- WooCommerce CSS theming with Fluent Community tokens + full dark mode support
- Product gallery thumbnail filmstrip sync
- Settings page under TBC Community App admin menu (WooCommerce menu fallback)
- Settings: WC integration toggle, template choice, mini cart toggle
- WooCommerce theme support declarations (gallery zoom, lightbox, slider)
- Template routing: forces WC pages into Fluent Community frame when enabled
- Hooks into `fluent_community/theme_content` at priority 5 for theme-agnostic content rendering
- Renamed filter `fluent_starter_gamipress_url` → `tbc_cart_gamipress_url`
- Renamed all `fluent_starter_wc_*` functions to `tbc_cart_*`

## 1.0.0 — 2026-03-19
- Initial release — extracted from tbc-community-app
- REST endpoint: `GET /tbc-cart/v1/count` (cart item count)
- Response header: `X-TBC-Cart-Count` on every authenticated REST response
- WooCommerce dependency check with admin notice
