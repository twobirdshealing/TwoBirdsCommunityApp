# Changelog

## 1.5.0 — 2026-04-05

### Added — Guest Quantity Feature
- **Guest label**: "Please select # of Guests — $X.XX each" shown above the quantity input on donation products that allow qty > 1. Price updates dynamically when amount changes (suggested amounts, custom input, variation selection).
- **Single Price RSVP**: New checkbox in Donations tab — "Charge once regardless of quantity". When enabled, qty 2 at $20 = $20 total (not $40). WC still tracks the quantity for guest counts. Price is divided by quantity at cart calculation time.
- Label only appears on non-sold-individually products that have at least one donation feature enabled.
- Uses vanilla JS for dynamic price updates, with jQuery fallback for WC variation events.
- Old standalone `_single_price_rsvp` meta key added to cleanup tool.

## 1.3.7 — 2026-04-05

### Added
- Variation table (Session Type dropdown) now styled to match donation sections — secondary background, rounded border, themed select input. Applies on any page where donation CSS loads.
- Cleaned up last "NYP" / "Name Your Price" references in code comments and default label text (now "My Donation")

## 1.3.6 — 2026-04-05

### Fixed (/simplify)
- `get_feature_product()` now cached per request — was calling `wc_get_product()` on every helper call for variations (7 helpers × N cart items)
- `append_deposit_to_price()` now uses `Helpers::is_deposit_enabled()` directly instead of duplicating parent resolution logic
- Removed dead `type_options` filter and method — was registering a no-op filter on every product edit page
- Admin JS: custom button label was silently overwritten to "Custom Amount" on any list interaction. Now preserves the saved label from data.

## 1.3.4 — 2026-04-05

### Changed
- When a suggested amount has a label, only the label is shown (no price). Same font size as the amount text on other buttons. Label replaces the price, not appended below it.

## 1.3.3 — 2026-04-05

### Fixed
- Re-added label field to suggested amounts admin — was accidentally removed during the simplification. Each amount row now has an inline "Label (optional)" text input. Labels show below the amount on the frontend (e.g., "$0 / Donate In Person"). Existing label data was preserved in the database, just had no UI to edit it.

## 1.3.2 — 2026-04-05

### Fixed
- Variable products: deposit, fee recovery, give extra, donor wall, one-time not working in cart. Root cause: donation feature meta (deposit, fees, etc.) is stored on the parent product, but for variations `$cart_item['data']` is the variation object which doesn't have that meta. Added `get_feature_product()` helper that resolves to the parent for variations before reading feature meta. This matches how the old plugins worked (`get_post_meta($cart_item['product_id'], ...)` always read from the parent).

## 1.3.1 — 2026-04-05

### Fixed
- Standalone donation features (no custom donations enabled) now properly enqueue frontend CSS/JS — were rendering unstyled because PriceInput never ran to register the assets
- Standalone features wrapped in `<div class="tbc-don tbc-don-standalone">` so all Fluent-themed CSS applies consistently
- DonationFeatures registers styles/scripts independently via `wp_enqueue_scripts` as fallback

## 1.3.0 — 2026-04-05

### Changed — Decoupled custom donations from donation features
- **Donations tab is now always visible** for simple/variable/subscription products — no checkbox required in the product type options row
- **"Custom Donations" toggle** moved inside the Donations tab as a checkbox in the first section — controls whether customers can enter their own amount (price input + suggested amounts)
- **Deposit, fee recovery, give extra, donor wall** are independent of custom donations — enable them on any product regardless of whether price input is shown
- For products without custom donations enabled, features render directly via `woocommerce_before_add_to_cart_button` — no dependency on the price input template
- Admin JS: pricing fields (suggested/min/max) show/hide based on the "Custom Donations" checkbox
- Removed "Donation" checkbox from product type options row (was confusing — implied all-or-nothing)

## 1.2.7 — 2026-04-05

### Fixed
- Variable products: deposit, fee recovery, give extra, and one-time option were not displaying. Root cause: `is_donation()` only matches simple/subscription types — `variable` was excluded. For the variation hook, now checks `_tbc_don_enabled` directly on the parent product instead of relying on `is_donation()` (which requires simple types). The donation features fire from `tbc_don_after_price_input` which now correctly triggers for variable products with the Donation checkbox enabled.

## 1.2.6 — 2026-04-05

### Fixed
- "Donation" checkbox on variable products wouldn't save — `_tbc_don_enabled` was never included in the save method. WooCommerce only auto-saves built-in type options (Virtual, Downloadable), custom ones must be saved manually. Now saved outside the tab nonce check since the checkbox is in the product type row, not the Donations tab.

## 1.2.5 — 2026-04-05

### Changed
- Custom amount `$` symbol and input font size bumped from `1.4em` to `1.6em` — matches the preset button amount text size
- Removed Migration.php and activation hook — migration already ran
- Added cleanup tool (`tbc-don-cleanup.php`) — admin page at Tools > Donation Cleanup that shows all old plugin meta/options and deletes them. Auto-loads when file exists, delete after use.

## 1.2.4 — 2026-04-05

### Fixed (/simplify)
- Removed dead `.tbc-don-billing-period` CSS block (orphaned from removed billing period feature)
- Removed dead `.tbc-don-give-extra-wrapper` selector (class doesn't exist in HTML)
- Checked button inset shadow now uses `--tbc-don-shadow-lg` variable instead of hardcoded rgba
- Fixed `found_variation` listener — WooCommerce fires this as a jQuery event, not a native DOM event. Switched to `jQuery().on()` with feature detection so fee recovery updates when a variation is selected
- Removed duplicate shadow variable declarations from donor-wall.css (frontend.css defines them)
- Updated JS doc comment to remove legacy NYP reference

## 1.2.2 — 2026-04-05

### Changed — Fluent Theme Compliance Audit
- Deposit/fee/give-extra containers: border changed from `--fcom-text-link` (accent) to `--fcom-primary-border` (standard border), removed box-shadow, lighter padding — matches Fluent card pattern
- All inputs now use `color: inherit` instead of hardcoded `--fcom-primary-text` — inherits from parent like Fluent does
- Added `html.dark` `color-scheme: dark` for all native inputs/selects — ensures browser renders form controls correctly in dark mode
- Removed redundant `fluent_community/enqueue_global_assets` call — tbc-cart already handles this on WooCommerce pages

## 1.2.1 — 2026-04-05

### Fixed
- Frequency toggle: both options now look like proper buttons with visible borders and rounded corners. Unselected option has a bordered card appearance with hover highlight. Selected option fills with accent color. Gap between them makes it clear they're two separate clickable options.

## 1.2.0 — 2026-04-04

### Code Cleanup (/simplify)

**Dead code removed:**
- Removed `is_billing_period_variable()`, `get_suggested_billing_period()`, `get_minimum_billing_period()`, `annualize_price()`, `get_posted_period()` from Helpers — all variable billing period remnants
- Removed unused `format_price()` wrapper (callers use `wc_price()` directly)
- Removed unused `$suggested` variable in `get_data_attributes()`
- Removed dead `annual_price_factors` and `i18n_subscription_string` from frontend script params
- Removed empty `render_amount_template()` method and its call
- Removed unused `save_amounts_nonce` from admin localized data
- Removed all period handling from StoreAPI and Blocks compat

**Performance fixes:**
- Added static cache to `is_donation()` and `has_donation_variations()` — eliminates repeated meta reads on archive pages
- CSS now registered (not enqueued) globally, only enqueued when price input renders — no longer loaded on blog/homepage
- Cart fee methods use `$cart_item['data']` instead of redundant `wc_get_product()` calls
- Removed duplicate `_tbc_don_has_variations` child-scanning from ProductSettings (already handled by VariableProducts compat)

**Security fixes:**
- Donor wall JSON uses `JSON_HEX_TAG | JSON_HEX_AMP` to prevent `</script>` injection
- Donor wall JS uses `textContent` for user-controlled strings instead of `innerHTML`

**Code quality:**
- Renamed legacy `$nyp_product` template variable to `$product`
- Renamed `_nypnonce` hidden field to `_tbc_don_nonce`
- Fixed duplicate filter name: `tbc_don_price_input_attributes` renamed to `tbc_don_data_attributes` in Helpers (template args filter keeps original name)
- Replaced `is_admin() && !defined('DOING_AJAX')` with modern `is_admin() && !wp_doing_ajax()`

## 1.1.8 — 2026-04-04

### Changed
- "Donate Extra" redesigned as inline: `[✓ Donate Extra  $ [___]]` — checkbox and amount input on one row
- Removed separate "Amount (USD)" label and stacked layout
- Currency symbol shown inline before the input
- Amount input auto-focuses when checkbox is checked
- Removed number input spinners for cleaner look

## 1.1.7 — 2026-04-04

### Fixed
- Root cause: WooCommerce's `.button.alt` selector was overriding all our button styles with `!important`. Replaced `class="button alt"` with `class="tbc-don-btn"` to escape WC's specificity war
- Selected state is now a simple "pressed" effect — `scale(0.95)` + `inset box-shadow` — same color, just visually pushed in. No color changes needed.
- All button styles use `!important` to guarantee they win against any WC theme overrides
- Removed hardcoded white/dark color overrides — buttons stay themed, just look pressed when active

## 1.1.6 — 2026-04-04

### Fixed
- Selected button now uses hardcoded white background + dark text instead of `--fcom-primary-bg` which resolves to dark in dark mode, making it invisible. Explicit `html.dark` rule ensures it works in both modes. Outer glow ring using `--fcom-text-link` highlights the selection.

## 1.1.5 — 2026-04-04

### Fixed
- Selected button now inverts to white/light background with blue text — clearly distinct from unselected blue buttons in both light and dark mode
- Frequency toggle: removed outer border causing blue not to fill bottom edge — uses overflow hidden on borderless container
- Removed redundant "/mo" from monthly price — "Monthly" label already communicates the period

## 1.1.4 — 2026-04-04

### Changed
- Active suggested amount button now switches to dark background (`--fcom-primary-button`) with accent border — clearly distinct from unselected buttons
- Frequency toggle redesigned as inline pill buttons: `[ One-Time $25 | Monthly $25/mo ]` — selected option highlights with theme accent color
- Removed the big bordered box and separate price fields — frequency is now a compact inline toggle
- Frequency prices update dynamically as donation amount changes

## 1.1.3 — 2026-04-04

### Removed
- Variable billing period feature entirely — admin setting, frontend dropdown, cart period handling, annualized validation, order-again period recovery
- Donations use simple one-time vs monthly recurring (handled by the one-time option toggle), no day/week/year selection needed

## 1.1.2 — 2026-04-04

### Changed
- Buttons are now square (`aspect-ratio: 1/1`) with large centered amounts (`1.6em`, `font-weight: 700`)
- Selected button has a clear white border + subtle scale-up (`scale(1.03)`) + outer glow — unmistakable which is active
- Hover lifts button up with enhanced shadow
- Custom input font bumped to `1.4em` and `4ch` min-width — no more clipping of `0.00`
- Removed `min-height` / `padding` — square aspect ratio handles sizing naturally

## 1.1.1 — 2026-04-04

### Changed
- Completely rebuilt admin suggested amounts UI — replaced collapsible metabox panels with a clean sortable list
- Removed all per-button color pickers — buttons now use Fluent theme colors (`--fcom-text-link`) automatically
- Removed all per-button font size controls and show/hide toggles
- Admin UI is now: add amount → drag to reorder → pick default → toggle custom button
- Frontend buttons use `--fcom-text-link` background and `--fcom-primary-button-text` text color — auto-adapts to light/dark mode and site branding
- No more inline `style=""` attributes on buttons

## 1.1.0 — 2026-04-04

### Changed
- Removed all per-button font size controls (amount font size, label font size, font unit selectors) — buttons are now uniform and auto-sized
- Simplified admin template: each amount now only has Label, Colors, and Default selection
- Simplified custom button: only Enable, Label, Colors, Default
- Removed `show_amount`/`show_label` toggles — amount always shows, label shows when set
- Admin metabox uses simple `<p>` layout instead of `<table>` — cleaner, no broken field widths

## 1.0.9 — 2026-04-04

### Fixed
- All suggested amount buttons now have uniform `min-height: 56px` with `box-sizing: border-box` — preset and custom buttons are the same height
- Active/checked button uses `brightness(0.9)` instead of `0.85` — keeps blue visible, not washed out to gray

## 1.0.8 — 2026-04-04

### Fixed
- Custom input uses `all: unset` to nuke all browser default styling — no more white background
- Switched from `type="number"` to `type="text" inputmode="decimal"` — browsers force white bg on number inputs
- Input auto-sizes to content width using `ch` units (starts at 3ch, grows as you type)

## 1.0.7 — 2026-04-04

### Fixed
- Admin product page: form wouldn't submit due to "invalid form control not focusable" — font size inputs in the suggested amounts template had `min="1"` but value `0` (from empty fields). Changed to `min="0"` so empty/zero values are valid

## 1.0.6 — 2026-04-04

### Fixed
- Custom input uses `color: inherit` — matches button text color in both light and dark mode
- Input is now `3.5em` wide with transparent background — no stretching, blends seamlessly with button
- Symbol also uses `inherit` color — consistent with preset button styling

## 1.0.5 — 2026-04-04

### Added
- Currency symbol ($) prefix inside the custom amount button to match preset amount buttons

## 1.0.4 — 2026-04-04

### Fixed
- Custom amount inline input now has translucent background matching the button gradient instead of white
- Input width fixed to `5em` to prevent stretching the grid column

## 1.0.3 — 2026-04-04

### Changed
- Custom Amount button now becomes an inline input when clicked — user types the amount directly inside the button instead of a separate input box above
- Hidden form input still syncs the value for submission
- When a preset amount is re-selected, the inline input hides and the "Custom Amount" label returns

## 1.0.2 — 2026-04-04

### Fixed
- Price input showing raw HTML (`<span class="woocommerce...`) instead of plain number — added `format_price_value()` for input fields vs `format_price()` for display HTML
- Price input now hidden when suggested amounts are enabled — only shows when "Custom Amount" is clicked
- Initial price now set from default suggested amount button on page load (JS sets value from checked radio)
- Variation display_price also fixed to use plain number format

## 1.0.1 — 2026-04-04

### Fixed
- Fatal error: `WC_Settings_Page` not found — moved settings page class to separate file with lazy loading
- Layout order: donation features (one-time, deposit, fees, give extra) now render below suggested amount buttons, not above
- Theming: all CSS now uses Fluent Community variables (`--fcom-*`) with proper fallbacks for light/dark mode
- Suggested amount buttons: consistent sizing across all buttons in the grid
- Shadow variables use `html.dark` override pattern matching other companion plugins

## 1.0.0 — 2026-04-04

### Added
- Initial release — merged three plugins into one:
  - WooCommerce Name Your Price (v3.7.3) — core price input system
  - TBC NYP Suggested Amounts (v2.0.03) — suggested amount radio buttons
  - TBC Custom Donation Addons (v2.5.204) — deposits, fee recovery, give extra, donor wall, one-time option
- Modern PHP 8.0+ codebase with `declare(strict_types=1)`, typed properties, PSR-4 namespaces
- HPOS compatible: all product/order meta via WC CRUD methods, `FeaturesUtil::declare_compatibility()`
- WC Blocks compatible: Store API support with feature declaration
- Unified "Donations" product data tab (replaces 3 separate admin panels)
- WC Settings > Donations page for global label/text customization
- REST API + Store API extensions
- One-time meta key migration from old plugin prefixes to `_tbc_don_*`
- Vanilla JS frontend (no jQuery dependency)
- Lazy-loaded donor wall assets
- Nonce verification on all admin saves
- 4 compatibility modules: WC Subscriptions, Braintree, Variable Products, WC Blocks
