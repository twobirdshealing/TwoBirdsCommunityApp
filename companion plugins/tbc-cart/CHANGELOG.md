# Changelog

## 3.1.0 — 2026-04-01
- Add WooCommerce fees support — `fees` array in cart response with name, amount, and tax per fee
- Add `fee` total to totals object (from WC `fee_total`)
- App now renders individual fee line items in cart summary between shipping and tax

## 3.0.0 — 2026-03-31
- **Major:** Native cart API for TBC Community App — replaces WebView cart with native screen
- New endpoint: `GET /tbc-cart/v1/cart` — full cart contents, totals, applied coupons, and WC store settings
- New endpoint: `PATCH /tbc-cart/v1/cart/items/{key}` — update item quantity
- New endpoint: `DELETE /tbc-cart/v1/cart/items/{key}` — remove item from cart
- New endpoint: `POST /tbc-cart/v1/cart/coupons` — apply coupon code
- New endpoint: `DELETE /tbc-cart/v1/cart/coupons/{code}` — remove coupon code
- WC session initialization via `wc_load_cart()` for REST context
- Settings object in cart response: `coupons_enabled`, `tax_enabled`, `shipping_enabled`, currency formatting
- All mutation endpoints return full updated cart (single round-trip)
- Error notices from WC operations captured and returned in response

## 2.0.2 — 2026-03-30
- Fix variable product dropdown styling — added `.variations` table and select theming with dark mode support, custom arrow, and focus states

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
