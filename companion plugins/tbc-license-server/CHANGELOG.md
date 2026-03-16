# Changelog

All notable changes to TBC License Server.

## [2.1.0] — 2026-03-16

- Add `tar.gz` and `gz` to WordPress allowed upload MIME types so FluentCart can accept update packages
- Fix `wp_check_filetype_and_ext` for `.tar.gz` double extension detection

## [2.0.0] — 2026-03-16

**Breaking: Rebuilt as FluentCart Pro bridge plugin.**

FluentCart Pro now handles all license management — key generation, subscription
sync, admin UI, customer portal, file hosting. This plugin is now a thin bridge
that exposes the REST endpoint the dashboard calls.

- Removed: Custom post type (`tbc_license`) — FluentCart's `fct_licenses` table
- Removed: WooCommerce/FluentCart hooks — FluentCart Pro auto-generates licenses
- Removed: Admin upload page — upload update files via FluentCart product settings
- Removed: Download endpoint — FluentCart serves files via signed URLs
- Rewritten: `/check` endpoint reads from FluentCart's License model + product settings
- Requires: FluentCart Pro with Licensing module enabled

### Migration from v1.x

1. Install FluentCart Pro and enable the Licensing module
2. Create your product in FluentCart with license settings enabled
3. Set `PRODUCT_ID` constant in `class-license-api.php`
4. Upload your `core-update-{version}.tar.gz` as the product's downloadable file
5. Existing v1.x license posts in WordPress are no longer used — re-issue via FluentCart

## [1.1.0] — 2026-03-16

- FluentCart integration: auto-generate license on `fluent_cart/order_paid_done`
- Subscription lifecycle sync
- Re-validate license on download
- Status constants

## [1.0.0] — 2026-03-16

- Initial release
