# Changelog

All notable changes to TBC License Server.

## [1.1.0] — 2026-04-28

- `/check` response now returns a `modules` array with one entry per installed module — each entry includes `id`, `valid`, and (when valid) `plan`, `expiresAt`, `currentVersion`, `latest` (null when up-to-date). Replaces the previous `moduleUpdates` field, which only surfaced modules with available updates and discarded plan/expiry info.
- Invalid module licenses now appear in the response as `{ id, valid: false, error }` so the dashboard can render an error state per module instead of silently dropping them.
- Dashboard side: module cards now render the same `Licensed · {plan} · Expires …` row and `Up to date` / `Update available` status row as the core card, using the new per-module data. Requires dashboard build that consumes the new shape.

## [1.0.0] — 2026-04-11

- Initial release for white-label launch
- FluentCart Pro native license API bridge (activate, deactivate, version check)
- License keys are self-identifying — product resolved from key via FluentCart's License model, no hardcoded product ID mapping
- Module update checking — `/check` endpoint accepts `installedModules` array with per-module license keys
- Dedicated `/activate` endpoint for both core and module license activation
- Returns `moduleUpdates` array with available updates for licensed modules
- Error messages translated from FluentCart's error types to user-friendly text
