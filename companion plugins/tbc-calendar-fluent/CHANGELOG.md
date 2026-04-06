# Changelog

## 5.1.22
- Added dark mode styling for Google Maps info window (background, text, links, close button)

## 5.1.2
- Fixed map toggle button (`+`) not working inside Fluent Community templates — Fluent's headless mode skips `wp_footer()` so enqueued scripts never load. Inlined Google Maps scripts directly in template output and switched click handler to event delegation for reliable binding

## 5.1.0
- Added `GET /user/booked` REST endpoint — returns upcoming events the authenticated user has booked (purchased), sorted by date ascending with configurable `limit` param (default 3). Uses efficient direct DB query on order item meta.

## 5.0.3
- Added `deposit` field to events API response (reads `_enable_non_refundable_deposit` and `_non_refundable_deposit` product meta from tbc-donation-addons plugin)

## 5.0.2
- Previous release
