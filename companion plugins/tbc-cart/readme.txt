=== TBC Cart ===
Contributors: twobirdscommunity
Tags: woocommerce, cart, fluent-community, mobile-app, rest-api
Requires at least: 5.8
Tested up to: 6.9
Requires PHP: 7.4
Requires Plugins: woocommerce
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Native WooCommerce cart REST API + Fluent Community integration for the TBC Community App mobile client. Adds a cart icon with live badge to the app header.

== Description ==

TBC Cart exposes a lightweight REST API around the WooCommerce cart, built for the TBC Community App mobile client. The native app uses these endpoints to show a cart icon in the header with a live badge count, open a native bottom sheet cart UI, update quantities, remove items, and apply coupons — all without loading the full WooCommerce frontend.

On the WordPress side, the plugin can also iframe the WooCommerce shop and checkout into the Fluent Community portal so members stay inside the community UI while browsing products.

= Core Features =

* **Lightweight cart count endpoint** — `/tbc-cart/v1/count` reads directly from persistent-cart user meta without loading the full WC session (fast, low overhead)
* **Full cart endpoint** — `/tbc-cart/v1/cart` returns cart contents, totals, coupons, and WC settings
* **Quantity and removal endpoints** — PATCH and DELETE on `/tbc-cart/v1/cart/items/{key}`
* **Coupon endpoints** — POST and DELETE on `/tbc-cart/v1/cart/coupons`
* **Mobile app header integration** — `X-TBC-Cart-Count` response header keeps the app's header badge in sync on every authenticated API call
* **Fluent Community shop frame (optional)** — Embeds the WC shop and checkout inside the FC portal via a customizer toggle
* **Mini-cart slide-out (optional)** — Classic WC mini-cart overlay in the portal
* **WooCommerce dependency check** — Admin notice if WC is missing

== Installation ==

1. Install and activate WooCommerce.
2. Configure at least one payment gateway in **WooCommerce → Settings → Payments** (Stripe, PayPal, etc.).
3. Upload the `tbc-cart` folder to `/wp-content/plugins/`.
4. Activate the plugin through the Plugins menu.
5. (Optional) Go to **TBC Community App → Cart Settings** and enable the Fluent Community shop frame / mini-cart toggles if you want the WC storefront embedded in the FC portal.
6. In the TBC Community App mobile client, the cart icon will appear in the header automatically once the `cart` module is registered.

== Frequently Asked Questions ==

= Does this require WooCommerce? =

Yes. TBC Cart is a thin REST + UI layer around WooCommerce's existing cart — WC has to be installed and active.

= Does it handle payments itself? =

No. Payments are processed by WooCommerce and whatever payment gateway plugin you've installed (Stripe, PayPal, etc.). TBC Cart is only a cart surface — it hands off to WC checkout when the user proceeds to pay.

= What about the mobile app? =

The TBC Community App mobile client ships with a `cart` module that consumes these endpoints. Install + activate the plugin on your site, and the cart icon will appear in the app's header with a live badge count.

= Does the cart count endpoint load the full WC session? =

No. The `/count` endpoint reads directly from the persistent cart user meta (`_woocommerce_persistent_cart_1`), which keeps it fast enough to call on every request. The `/cart` endpoint initializes the full WC session via `wc_load_cart()` — call it only when the user opens the cart UI.

= What happens on uninstall? =

By default, nothing is removed on uninstall — your plugin settings stay in the database. If you want a full wipe, enable **Delete data on uninstall** on the admin settings page (under Data Management) before deleting the plugin. WooCommerce cart data, orders, and products are always untouched regardless of this setting — that data is owned by WooCommerce.

== Changelog ==

= 1.0.0 =
* Initial public release
* REST endpoints: count, cart, update quantity, remove item, apply coupon, remove coupon
* `X-TBC-Cart-Count` response header for mobile app badge sync
* Optional Fluent Community shop and checkout frame embedding
* Optional mini-cart slide-out overlay
* WooCommerce dependency check with admin notice

== Upgrade Notice ==

= 1.0.0 =
Initial release.
