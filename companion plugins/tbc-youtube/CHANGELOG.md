# Changelog

## 1.2.0 — 2026-03-14

- Removed hardcoded default channel ID — all fields must be configured by the admin
- Added validation: API endpoints now return clear error if channel ID is not configured
- Updated admin settings descriptions to indicate channel ID is required

## 1.1.0 — 2026-03-14

- Added Channel URL setting for the Subscribe button in the mobile app
- Added `GET /tbc-yt/v1/config` REST endpoint — returns module config (channel URL)
- Channel URL now managed via WordPress admin instead of hardcoded in app config

## 1.0.0 — 2025-03-14

- Initial release — extracted from tbc-community-app core plugin
- YouTube Data API v3 integration with 6-hour server-side caching
- REST endpoints under `tbc-yt/v1` namespace (latest, playlists, playlist videos)
- Backward-compatible routes under `tbc-ca/v1/youtube/*` for older app versions
- Admin settings page (API key, channel ID, cache clear)
- Settings auto-migrate from tbc-community-app on activation
- Nests under TBC Community App admin menu (or standalone if core not active)
