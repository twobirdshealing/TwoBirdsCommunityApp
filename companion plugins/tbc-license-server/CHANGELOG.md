# Changelog

All notable changes to TBC License Server.

## [1.0.0] — 2026-04-11

- Initial release for white-label launch
- FluentCart Pro native license API bridge (activate, deactivate, version check)
- License keys are self-identifying — product resolved from key via FluentCart's License model, no hardcoded product ID mapping
- Module update checking — `/check` endpoint accepts `installedModules` array with per-module license keys
- Dedicated `/activate` endpoint for both core and module license activation
- Returns `moduleUpdates` array with available updates for licensed modules
- Error messages translated from FluentCart's error types to user-friendly text
