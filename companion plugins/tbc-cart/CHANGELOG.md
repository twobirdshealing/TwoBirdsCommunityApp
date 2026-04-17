# Changelog

## 1.0.0 — Initial release

- Opt-in "Delete data on uninstall" setting under Data Management — settings are preserved by default so deactivating for testing doesn't wipe your configuration
- WooCommerce integration bridge for TBC Community App + Fluent Community
- Native cart REST API under `tbc-cart/v1`:
  - `GET /cart` — full cart contents, totals, applied coupons, WC store settings (coupons/tax/shipping enabled, currency formatting)
  - `PATCH /cart/items/{key}` — update item quantity
  - `DELETE /cart/items/{key}` — remove item from cart
  - `POST /cart/coupons` — apply coupon code
  - `DELETE /cart/coupons/{code}` — remove coupon code
  - `GET /count` — cart item count (used for badge counts in mobile app)
- WooCommerce fees support — `fees` array + `fee` total in cart response
- Response header `X-TBC-Cart-Count` on every authenticated REST response
- WC session initialization via `wc_load_cart()` for REST context
- All mutation endpoints return full updated cart in a single round-trip; WC error notices captured and returned
- Mini cart dropdown in Fluent Community header with AJAX item removal and line-item meta (event dates, variation attributes, custom line item data) via `wc_get_formatted_cart_item_data()`
- GamiPress credits/points display in mini cart
- WooCommerce page rendering (shop, product, cart, checkout, account) inside the Fluent Community portal frame via direct `fluent_community/theme_content` hook — works with any theme, no theme-specific filter needed
- Variation table + dropdown theming (dark mode, custom arrow, focus states, table-cell layout)
- Product gallery thumbnail filmstrip scroll sync
- WooCommerce CSS fully themed with Fluent Community tokens and light/dark mode
- Settings page under the TBC Community App admin menu (WooCommerce fallback): WC integration toggle, template choice, mini cart toggle
- WooCommerce dependency check with admin notice
