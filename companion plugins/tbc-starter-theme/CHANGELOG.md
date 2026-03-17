# Changelog

All notable changes to the Fluent Starter theme.

## 1.0.50

- Fixed memory exhaustion crash (256MB) when activating theme on sites without Fluent Community or WooCommerce
- Added recursion guard to `get_avatar_url` filter — prevents infinite loop if FC's User model internally triggers avatar resolution
- Added recursion guard to profile data/badge lookup for the same reason
- `fluent-integration.php` now bails early if Fluent Community plugin is not active — avoids registering dozens of hooks that can never fire and prevents any FC model calls on bare sites

## 1.0.48

- Rewrote GamiPress partial payments CSS based on actual plugin HTML structure (plugin has no CSS of its own)
- Toggle banner relies on `.woocommerce-info` rules (no duplicate styling needed)
- Form container, labels, inputs, balance text, type display, preview text all properly themed
- "Apply discount" button forced to `--fcom-primary-button` with high specificity to override WooCommerce defaults

## 1.0.47

- Fixed WooCommerce notice `border-top-color` — now uses `--fcom-text-link` instead of WooCommerce default `#1e85be`
- All three notice types (message, info, error) now have themed `border-top` matching their `border-left`

## 1.0.46

- Fixed WooCommerce info notices showing default `border-top: 3px solid #1e85be` — reset to `border-top: none` so only the themed `border-left` shows
- Added link color theming inside `.woocommerce-info` for light and dark mode

## 1.0.45

- Added GamiPress partial payments theming on checkout page (points discount form)
- Styled toggle banner, amount input, balance text, type display, and "Apply discount" button with `--fcom-*` tokens
- Dark mode support for all GamiPress checkout elements
- "Apply discount" button now uses `--fcom-primary-button` instead of GamiPress default green

## 1.0.44

- Fixed payment method radio buttons appearing above labels instead of inline — added flex layout to `<li>` elements so radio input and label sit side by side
- Payment box (Braintree card details) spans full width below the radio+label row

## 1.0.43

- Added Braintree payment gateway theming on checkout page (credit card, PayPal, Venmo payment boxes)
- Styled hosted fields, saved cards dropdown, radio labels, and payment box arrow to use `--fcom-*` tokens
- Dark mode support for all Braintree payment elements

## 1.0.40

- Refined all WooCommerce CSS to use correct Fluent Community token semantics:
  - `--fcom-secondary-border` for inner/subtle dividers (table rows, payment list items, tab underlines)
  - `--fcom-text-off` for inactive tabs, hint text, payment descriptions, terms text
  - `--fcom-light-bg` for table headers, coupon forms, secondary buttons, credits section
  - `--fcom-highlight-bg` for WooCommerce info notices
  - `--fcom-active-bg` for Select2 highlighted options
  - `--fcom-primary-bg` for product cards (card surface, not page background)
- Updated `fluent-compat.css` bridge with all missing token aliases (light_bg, active_bg, highlight_bg, deep_bg, text_off)

## 1.0.39

- Added cart, checkout, and account pages to Fluent Community frame (previously rendered as standalone WP pages)
- Cart/checkout/account now use `the_content()` for proper WooCommerce shortcode rendering within the frame
- Added comprehensive checkout page styling (billing/shipping fields, Select2 dropdowns, order review table, payment methods section)
- Added cart page styling (quantity inputs, coupon form, cart totals, cross-sells, product thumbnails, responsive mobile layout)
- Dark mode support for all new cart/checkout elements using `--fcom-*` CSS variables
- Mobile responsive cart table (stacks vertically on small screens)

## 1.0.38

- Added maintenance mode — toggle via Customizer (Fluent Starter Settings → Maintenance Mode)
- Blocks all frontend visitors except administrators, shows custom message with auto-refresh
- Admin bar shows red "Maintenance Mode ON" indicator with link to settings
- Supports dark mode (syncs with Fluent Community color preference)
- Allows wp-login, wp-admin, REST API, and Customizer preview through

## 1.0.37

- Added auth page banner theme sync — login/signup left panel now follows FC light/dark mode via CSS variables instead of static inline colors

## 1.0.36

- Moved inline onclick handler on copy-link button (single.php) to external theme.js for CSP compliance and best practice
- Added `data-copy-url` attribute pattern for clipboard copy buttons

## 1.0.35

- Consolidated duplicated WooCommerce CSS/JS into shared helper functions (mini cart CSS/JS, product tabs, My Account styles were each duplicated 2-3 times)
- Fixed unescaped `the_title()` output in hero, blog cards, and single post headers — now uses safe `the_title('<tag>', '</tag>')` pattern
- Added `wp_kses_post()` escaping to WooCommerce HTML output (thumbnails, prices, cart totals)
- Made GamiPress achievements URL filterable via `fluent_starter_gamipress_url` (was hardcoded)
- Simplified WooCommerce active check to standard `class_exists('WooCommerce')`
- Updated theme description (removed stale "Under 8KB" claim)
- Added remove (×) button to mini cart items with AJAX removal via WooCommerce cart fragments

## 1.0.34

- Added WooCommerce My Account page styling (horizontal full-width navigation tabs, content area, orders table, addresses, forms)
- Pure CSS layout override — no WooCommerce template overrides needed (nav stacks above content)
- Dark mode support for all My Account elements using `--fcom-*` CSS variables
- Inline portal styles for My Account navigation within Fluent Community frame
- Mobile responsive (tabs wrap to 2-column at 767px, single-column at 480px)

## 1.0.33

- Blog cards redesigned as image-only overlay cards (title centered at top, author bottom left, comment count bottom right)
- Hero post updated to same overlay format (wider/bigger, whole card clickable)
- Removed excerpt, "Read Article" button, and read time from blog listing cards
- Removed read time from single post views
- Added comment count badge to blog cards and hero
- Added verified badges and profile badges to blog card author names

## 1.0.31

- Fixed badge rendering: reads `config.emoji` and `config.logo` from correct nested structure
- Fixed `show_label` check: respects `'yes'`/`'no'` strings (was treating `'no'` as truthy)
- Added icon-only badge mode (no pill background, larger icon) when `show_label` is `'no'`
- Badge images now render as `<img>` tags, emojis as text (was dumping both as text)
- Added `background_color` and `color` support from badge definitions
- Added verified checkmark (blue decagram SVG) next to verified user names
- Shared profile cache for badges + verified status (single DB lookup per user)

## 1.0.30

- Added Fluent Community avatar integration (`get_avatar_url` filter replaces Gravatar with FC xprofile avatars)
- Added profile badge rendering on blog cards, single post hero/fallback, author bio, and comments
- Badge styles: colored pills on light backgrounds, white pills on hero overlays

## 1.0.29

- WooCommerce integration (shop/product pages in Fluent Community frame)
- Customizer settings for WooCommerce template, mini cart, GamiPress credits
- Comments section toggle via customizer
- Gallery thumbnail scroll sync for WooCommerce product pages

## 1.0.28

- Comments section styled to match Fluent Community native layout
- Custom comment callback using FC CSS classes (`.each_comment`, `.comment_wrap`)
- Dark mode support for comment form and comment list
- Robust CSS selectors for WordPress default comment form elements

## 1.0.27

- Blog shortcode `[fluent_blog]` with hero featured post + card grid
- Gutenberg block registration (`fluent-starter/blog-grid`)
- Single post hero layout with gradient overlay
- Author bio box, share buttons, post navigation
- Reading time calculation (200 wpm)
- Pagination with SVG arrows

## 1.0.26

- Fluent Community frame template integration for blog pages
- Dark mode sync via `fcom_global_storage` localStorage
- Flash prevention script in portal head
- Custom content renderer to prevent double output

## 1.0.0

- Initial release
- Blank-canvas theme for Fluent Community
- Zero interference with FC portal SPA
- Basic component styling for non-portal pages
- Under 8KB CSS/JS footprint
