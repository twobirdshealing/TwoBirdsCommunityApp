# Changelog

## 1.0.0 — 2026-04-14

- Initial release
- YouTube Data API v3 integration with 6-hour server-side caching
- REST endpoints under `tbc-yt/v1` namespace (latest, playlists, playlist videos, config)
- Admin settings page nested under TBC Community App menu (API key, channel ID, channel URL, cache clear)
- Channel ID and Channel URL required — no hardcoded defaults; endpoints return clear errors when unconfigured
- "Delete all plugin data when uninstalled" opt-in setting; `uninstall.php` removes settings, version option, and YouTube cache transients when enabled
