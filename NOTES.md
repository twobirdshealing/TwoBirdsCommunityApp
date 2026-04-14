# Project Notes — Two Birds Church

This file is **buyer-owned** and preserved across core updates via the dashboard's snapshot system. Put any project-specific notes, conventions, credentials, or instructions for AI agents here. CLAUDE.md is core-owned and gets overwritten on updates.

---

## Site: Two Birds Church

Site: https://community.twobirdschurch.com
Dev brand: Two Birds Code (twobirdscode.com) — TBC

### Dev Workflow

**This repo is both our live production app AND the development source for the white-label product.** All coding happens here. When we hit a milestone, we run `bash scripts/create-white-label.sh` to generate a clean snapshot at `../TBC-Community-App (White Lable)/` with site-specific values replaced by placeholders. Never edit the white-label folder directly — it gets overwritten each snapshot.

**Architecture goal:** Keep core clean, fast, and stable — only update it for Fluent Community compatibility. New features go in as modules so they don't interfere with core code.

> **Buyer-facing setup documentation lives in `setup/setup-guide.html`.**
> When making changes to config files, module system, or plugin structure, keep docs in sync.

### Internal Release Commands (invoke directly — NOT in package.json scripts)

These are our internal release tooling. They're deliberately NOT registered as `npm run` entries in `package.json` so they don't ship as ghost references in the buyer's white-label install. Run them by their full path. **When the user says "run snapshot," "create snapshot," "build a release," etc., use these exact commands:**

| If the user says... | Run |
|---|---|
| "run snapshot" / "create snapshot" / "snapshot same version" | `bash scripts/create-white-label.sh` (interactive — prompts to keep current core version or bump) |
| "snapshot and bump version" / "release a new core version" | `bash scripts/create-white-label.sh` then choose the bump option in the interactive prompt |
| "update changelog" / "regenerate changelog" | `bash scripts/update-changelog.sh` |
| "zip a plugin" / "package companion plugin X" | `node scripts/zip-plugin.js <plugin-name>` (rare — `create-white-label.sh` already calls this for every core companion plugin during a snapshot, so you usually don't need to run it standalone) |

`scripts/zip-plugin.js` is invoked indirectly by `create-white-label.sh` during every snapshot to bundle the companion plugin folders into installable zips for buyers. It's still active code, just not a top-level command we run by hand often.

### Add-on Modules

Blog module — available as a paid add-on, not part of the snapshot.

Book Club module — available as a paid add-on, not part of the snapshot.

YouTube module — available as a paid add-on, not part of the snapshot.

### Site-Specific Modules (not sold)

Calendar module — custom to Two Birds Church, not a public add-on.

Donate module — custom to Two Birds Church, not a public add-on.

Donor module — custom to Two Birds Church, not a public add-on.

Admin module — custom to Two Birds Church, not a public add-on.

### Add-on Modules Companion Plugins

- **tbc-youtube** — YouTube channel integration with server-side caching (companion to youtube module)
- **tbc-book-club** — Book club audiobook player with meetings (companion to bookclub module)
- **tbc-calendar-fluent** — Our private calendar plugin that links to the calendar module

### Reference Plugins (outside repo)

Fluent Community/Cart/Messaging plugin source code kept at `../../playground/Refrence plugins ONLY/` (outside the project directory) for dev reference. Not part of the product, not tracked in git.

### Site-Specific Plugins (in companion folder — not sold)
Donation addons, donor dashboard, messaging center, checkout prerequisites, participant frontend, message roles, entry review — these are Two Birds Church site-specific plugins kept in `companion plugins/` for reference. Not part of the product and excluded from the white-label snapshot.

### Versioning — Core vs App (decoupled)

There are two independent version numbers. They are **not** kept in sync:

- **Core version** (`manifest.json` → `version`) — The version of the white-label product we sell. Controlled entirely by us. Buyers see it as a badge in the dashboard header to confirm which update they have. Starts at `1.0.0` for the commercial launch and grows as we ship core updates (`1.0.1`, `1.1.0`, etc.). Bumped via the `bash scripts/create-white-label.sh` interactive prompt.
- **Our Two Birds Church app version** (`app.json` + `package.json`) — The version of *our own* TBC church app for our App Store submissions. Bump it via the dashboard or manually when we submit a build. Completely independent of the core version.
- **Buyer's app version** (`app.json` + `package.json` in their project) — Each buyer's own App Store version, starting at `1.0.0`. The snapshot sed-replaces our version values with `1.0.0` in staging, so buyers always start fresh regardless of where our TBC app is.

The snapshot script only bumps `manifest.json` when we release a new core version — it deliberately does not touch our `package.json` or `app.json`. For our own TBC church app releases, bump `package.json` and `app.json` separately via the dashboard's version buttons.

### White-Label Snapshot

After a version bump, ask the user if we should create a new white-label snapshot.

The snapshot script copies this app to the white-label folder with all site-specific values replaced by generic placeholders. It does NOT modify this repo — only writes to the target folder.

**To run:** `bash scripts/create-white-label.sh`

**What it does:**
1. Copies project to `../TBC-Community-App (White Lable)/` (excludes node_modules, .git, modules, companion plugins)
2. Copies only core companion plugins (allowlist: tbc-community-app)
3. Copies only module infrastructure (`_registry.ts`, `_types.ts`) — no module folders
4. Replaces Two Birds-specific values with placeholders in config.ts, app.json, eas.json, app.config.ts, package.json
5. Removes Firebase configs, adds FIREBASE_SETUP.md guide
6. NOTES.md is excluded from the snapshot (it's buyer-owned by definition)
7. Writes `setup/.core-files.json` listing every file shipped in the snapshot (used by the update system to know what to clean up on next update)
8. Verifies no site-specific references remain

**What ships in the base white-label product:**
- Core app (all screens, services, components)
- Core companion plugin: tbc-community-app

**Sold separately as add-ons (NOT in white-label):**
- tbc-otp plugin (phone OTP verification), tbc-profile-completion plugin (profile completion gate)
- Blog module, YouTube module + tbc-youtube plugin, Book Club module + tbc-book-club plugin

**Two Birds site-specific (never sold):**
- Calendar, Donate, Donor modules

### Dev Rules

Before every native build (`eas build`), run `npx expo install --check` to check for patch updates. If outdated, run `npx expo install --fix` before building. Patch updates often include native crash fixes that can only ship via a new build, not OTA.

We use both `.easignore` and `.gitignore`. `.easignore` is a superset — it has everything in `.gitignore` plus non-app files (setup/, companion plugins/, scripts/, docs) that we track in git but EAS doesn't need. When adding a pattern to `.gitignore`, also add it to `.easignore`. Buyers only get `.easignore` (snapshot excludes `.gitignore`).

After fixes or completed tasks ask user if we want to run /simplify

When working on companion plugins after updates/fixes/changes, update the version number on the plugin or theme and update changelog. If changelog is missing add one. Always update version to bust cache even on small updates.

### Testing

Current test credentials — ask for fresh token:
```
curl -s -X POST "https://community.twobirdschurch.com/wp-json/tbc-ca/v1/auth/login" -H "Content-Type: application/json" -d '{"username":"bluejay","password":"sapo"}' | python3 -m json.tool
```

Don't try running commands yourself — give them to me and wait for response. If unsure, always ask for an API response to understand the full picture.

Server runs Ubuntu — use `python3` not `python` for curl JSON formatting (e.g. `| python3 -m json.tool`)

All agents run opus
