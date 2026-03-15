# Changelog

## 5.1.0
- Added `GET /user/booked` REST endpoint — returns upcoming events the authenticated user has booked (purchased), sorted by date ascending with configurable `limit` param (default 3). Uses efficient direct DB query on order item meta.

## 5.0.3
- Added `deposit` field to events API response (reads `_enable_non_refundable_deposit` and `_non_refundable_deposit` product meta from tbc-donation-addons plugin)

## 5.0.2
- Previous release
