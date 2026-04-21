#!/usr/bin/env bash
# =============================================================================
# CREATE WHITE-LABEL SNAPSHOT
# =============================================================================
# Copies the current app to the white-label folder with all site-specific
# values replaced by placeholders. Does NOT modify this repo in any way.
#
# Usage: bash scripts/create-white-label.sh
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WHITE_LABEL_ROOT="$(cd "$SOURCE_DIR/.." && pwd)/TBC-Community-App (White Lable)"

# Helper: generate manifest.json with a given version
# NOTE: updateUrl points at twobirdscode.com on purpose — that is the
# white-label license/update server we run for buyers, not a Two Birds Church
# leak. Do NOT replace it with a placeholder.
generate_manifest() {
  local version="$1"
  local dest="$2"
  cat > "$dest" << GENMANIFEST_EOF
{
  "product": "tbc-community-app",
  "version": "${version}",
  "dashboardVersion": 1,
  "updateUrl": "https://www.twobirdscode.com/wp-json/tbc-license/v1/check",
  "corePlugins": [
    "tbc-community-app"
  ]
}
GENMANIFEST_EOF
}

# Read the current CORE version from manifest.json. This is the version of the
# white-label product we're selling — intentionally decoupled from our own
# Two Birds Church app version in package.json/app.json (those track OUR
# store releases, not the product we ship to buyers).
CURRENT_VERSION=$(grep -o '"version": "[^"]*"' "$SOURCE_DIR/manifest.json" | head -1 | cut -d'"' -f4)

echo ""
echo "========================================"
echo "  White-Label Snapshot Creator"
echo "========================================"
echo ""
echo "Source:  $SOURCE_DIR"
echo "Current core version: $CURRENT_VERSION"
echo ""

# ---------------------------------------------------------------------------
# Safety check
# ---------------------------------------------------------------------------

if [ ! -f "$SOURCE_DIR/app.json" ]; then
  echo "ERROR: app.json not found in source. Run this from the project root."
  exit 1
fi

# ---------------------------------------------------------------------------
# Interactive version bump (TTY only — skipped when piped)
# ---------------------------------------------------------------------------

parse_semver() {
  local ver="$1"
  if ! [[ "$ver" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then return 1; fi
  echo "${BASH_REMATCH[1]} ${BASH_REMATCH[2]} ${BASH_REMATCH[3]}"
}

NEXT_PATCH=$(read M m p <<<"$(parse_semver "$CURRENT_VERSION")" && echo "$M.$m.$((p + 1))")
NEXT_MINOR=$(read M m p <<<"$(parse_semver "$CURRENT_VERSION")" && echo "$M.$((m + 1)).0")
NEXT_MAJOR=$(read M m p <<<"$(parse_semver "$CURRENT_VERSION")" && echo "$((M + 1)).0.0")

SOURCE_VERSION="$CURRENT_VERSION"

# Env var override — bypasses the interactive prompt (useful for CI / testing)
# Accepts: p / m / M / patch / minor / major / X.Y.Z
if [ -n "${SNAPSHOT_VERSION:-}" ]; then
  case "$SNAPSHOT_VERSION" in
    p|P|patch)    SOURCE_VERSION="$NEXT_PATCH" ;;
    m|minor)      SOURCE_VERSION="$NEXT_MINOR" ;;
    M|major)      SOURCE_VERSION="$NEXT_MAJOR" ;;
    keep|current) SOURCE_VERSION="$CURRENT_VERSION" ;;
    *)
      if parse_semver "$SNAPSHOT_VERSION" >/dev/null; then
        SOURCE_VERSION="$SNAPSHOT_VERSION"
      else
        echo "ERROR: invalid SNAPSHOT_VERSION='$SNAPSHOT_VERSION'"
        exit 1
      fi
      ;;
  esac
elif [ -t 0 ]; then
  echo "Core version options:"
  echo "  [Enter]   Keep $CURRENT_VERSION"
  echo "  p         Bump patch  ($CURRENT_VERSION -> $NEXT_PATCH)"
  echo "  m         Bump minor  ($CURRENT_VERSION -> $NEXT_MINOR)"
  echo "  M         Bump major  ($CURRENT_VERSION -> $NEXT_MAJOR)"
  echo "  X.Y.Z     Custom version"
  echo ""
  read -p "Choice: " version_choice
  echo ""

  case "$version_choice" in
    "")           SOURCE_VERSION="$CURRENT_VERSION" ;;
    p|P|patch)    SOURCE_VERSION="$NEXT_PATCH" ;;
    m|minor)      SOURCE_VERSION="$NEXT_MINOR" ;;
    M|major)      SOURCE_VERSION="$NEXT_MAJOR" ;;
    *)
      if parse_semver "$version_choice" >/dev/null; then
        SOURCE_VERSION="$version_choice"
      else
        echo "ERROR: invalid version '$version_choice' (expected X.Y.Z or p/m/M)"
        exit 1
      fi
      ;;
  esac
fi

# Apply the version bump to manifest.json ONLY — this is the core product
# version buyers see. Our own Two Birds Church app version in package.json /
# app.json is deliberately left alone; that tracks OUR App Store submissions
# and has nothing to do with the white-label product we sell.
if [ "$SOURCE_VERSION" != "$CURRENT_VERSION" ]; then
  echo "Bumping core version $CURRENT_VERSION -> $SOURCE_VERSION"

  sed -i -e "s|\"version\": \"$CURRENT_VERSION\"|\"version\": \"$SOURCE_VERSION\"|" "$SOURCE_DIR/manifest.json"

  echo "  manifest.json -> $SOURCE_VERSION"
  echo ""

  # Regenerate CHANGELOG.md using git history since the last release.
  # Baseline is read from the cached .last-release-commit file if present;
  # otherwise update-changelog.sh falls back to finding the last bump commit.
  PREV_RELEASE_COMMIT=""
  if [ -f "$WHITE_LABEL_ROOT/.last-release-commit" ]; then
    PREV_RELEASE_COMMIT=$(cat "$WHITE_LABEL_ROOT/.last-release-commit" 2>/dev/null || echo "")
  fi
  echo "Regenerating CHANGELOG.md for $SOURCE_VERSION..."
  CHANGELOG_AUTO=1 CHANGELOG_SINCE="$PREV_RELEASE_COMMIT" bash "$SCRIPT_DIR/update-changelog.sh"
  echo ""
else
  echo "Keeping current version $SOURCE_VERSION"
  echo ""
fi

# ---------------------------------------------------------------------------
# Staging directory — ephemeral. Script emits only the zip at the end.
# ---------------------------------------------------------------------------

STAGING_DIR="$WHITE_LABEL_ROOT/.staging"
FINAL_ZIP="$WHITE_LABEL_ROOT/core-update-${SOURCE_VERSION}.zip"

mkdir -p "$WHITE_LABEL_ROOT"
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"

# Nuke staging no matter how we exit (success or failure)
cleanup_staging() { rm -rf "$STAGING_DIR"; }
trap cleanup_staging EXIT

echo "Staging: $STAGING_DIR"
echo "Output:  $FINAL_ZIP"
echo ""

# ---------------------------------------------------------------------------
# Step 1: Copy project (excluding build artifacts, deps, git, plugins, etc.)
# ---------------------------------------------------------------------------

echo "[1/9] Copying project files..."

tar -cf - \
  --exclude='node_modules' \
  --exclude='.expo' \
  --exclude='.git' \
  --exclude='.claude' \
  --exclude='.vscode' \
  --exclude='.gitignore' \
  --exclude='dist' \
  --exclude='web-build' \
  --exclude='ios' \
  --exclude='android' \
  --exclude='.kotlin' \
  --exclude='app-example' \
  --exclude='scripts' \
  --exclude='companion plugins' \
  --exclude='website' \
  --exclude='setup/.backups' \
  --exclude='setup/.temp' \
  --exclude='modules' \
  --exclude='setup/.app-presets.json' \
  --exclude='setup/logs' \
  --exclude='setup/.core-files.json' \
  --exclude='asc-api-key.p8' \
  --exclude='google-play-service-account.json' \
  --exclude='NOTES.md' \
  -C "$SOURCE_DIR" . | tar -xf - -C "$STAGING_DIR"

# Copy only module infrastructure (no module folders — those are add-ons)
mkdir -p "$STAGING_DIR/modules"
cp "$SOURCE_DIR/modules/_registry.ts" "$STAGING_DIR/modules/_registry.ts"
cp "$SOURCE_DIR/modules/_registry-core.ts" "$STAGING_DIR/modules/_registry-core.ts"
cp "$SOURCE_DIR/modules/_types.ts" "$STAGING_DIR/modules/_types.ts"

echo "  Done."

# ---------------------------------------------------------------------------
# Step 2: Replace site-specific values in config files
# ---------------------------------------------------------------------------

echo "[2/9] Replacing site-specific values..."

# --- constants/config.ts ---
sed -i \
  -e "s|export const APP_NAME = 'Two Birds Community';|export const APP_NAME = 'My Community';|" \
  -e "s|export const APP_USER_AGENT = 'TBCCommunityApp/1.0';|export const APP_USER_AGENT = 'CommunityApp/1.0';|" \
  -e "/export const TBC_YT_URL/d" \
  "$STAGING_DIR/constants/config.ts"

# --- app.json ---
sed -i \
  -e 's|"name": "Two Birds Community"|"name": "My Community App"|' \
  -e 's|"slug": "TwoBirdsCommunity"|"slug": "MyCommunityApp"|' \
  -e 's|"version": "[^"]*"|"version": "1.0.0"|' \
  -e 's|"scheme": "twobirdscommunity"|"scheme": "mycommunityapp"|' \
  -e 's|"bundleIdentifier": "com.twobirdschurch.community"|"bundleIdentifier": "com.yourcompany.communityapp"|' \
  -e 's|"buildNumber": "[^"]*"|"buildNumber": "1.0.0"|' \
  -e 's|"package": "com.community.twobirdschurch"|"package": "com.yourcompany.communityapp"|' \
  -e 's|"versionCode": [0-9]*|"versionCode": 100|' \
  -e 's|"projectId": "[^"]*"|"projectId": "YOUR_EAS_PROJECT_ID"|' \
  -e 's|"owner": "twobirdschurch"|"owner": "your-expo-account"|' \
  -e 's|Allow Two Birds Community to|Allow this app to|g' \
  -e 's|https://u.expo.dev/[^"]*|https://u.expo.dev/YOUR_EAS_PROJECT_ID|' \
  "$STAGING_DIR/app.json"

# --- eas.json ---
# Note: Sentry env var refs ($SENTRY_AUTH_TOKEN, $SENTRY_ORG, $SENTRY_PROJECT,
# SENTRY_ALLOW_FAILURE) are deliberately PASSED THROUGH untouched. They resolve
# to nothing for buyers who haven't set EAS secrets, which is the right default
# (builds succeed without source-map upload). Buyers who want symbolicated
# stack traces run `eas secret:create --name SENTRY_AUTH_TOKEN ...` themselves
# — see setup-guide.html "Crash Reporting (Sentry)" card.
# ASC API Key fields (ascApiKey*) get sed-deleted here — buyers upload their
# own via the dashboard. Trailing commas left by deletes are repaired by the
# JSON round-trip pass at the end of the package.json edits below.
sed -i \
  -e 's|https://community.twobirdschurch.com|https://community.yoursite.com|g' \
  -e 's|https://staging.twobirdschurch.com|https://community.yoursite.com|g' \
  -e 's|"appleId": "[^"]*"|"appleId": "your-apple-id@example.com"|' \
  -e 's|"ascAppId": "[^"]*"|"ascAppId": "YOUR_ASC_APP_ID"|' \
  -e '/"ascApiKey/d' \
  "$STAGING_DIR/eas.json"

# --- app.config.ts ---
sed -i \
  -e "s|'https://community.twobirdschurch.com'|'https://community.yoursite.com'|" \
  -e "s|const stagingUrl = '.*'|const stagingUrl = ''|" \
  -e "s|config.name ?? 'Two Birds'|config.name ?? 'My Community'|" \
  -e "s|config.slug ?? 'twobirdscommunityapp'|config.slug ?? 'mycommunityapp'|" \
  -e "/'\\/blog\\//d" \
  -e "/'\\/bookclub\\//d" \
  "$STAGING_DIR/app.config.ts"

# --- package.json ---
# Internal-only scripts (snapshot, zip-plugin, changelog, reset-project) are not in
# the source package.json — we invoke them directly via `bash scripts/X.sh` and
# `node scripts/X.js`, so there are no ghost entries for the buyer to trip on.
sed -i \
  -e 's|"name": "twobirdscommunity"|"name": "community-app"|' \
  -e 's|"version": "[^"]*"|"version": "1.0.0"|' \
  -e 's|https://staging.twobirdschurch.com|https://staging.yoursite.com|g' \
  "$STAGING_DIR/package.json"

# Fix trailing commas in JSON (sed deletes can leave them) — single node spawn
# handles every JSON file we sed-edited above. Round-trips through JSON.parse
# for reliability — sed can't handle edge cases with escaped quotes.
node -e "
  var fs = require('fs');
  process.argv.slice(1).forEach(function(p) {
    var raw = fs.readFileSync(p, 'utf8').replace(/,(\s*[}\]])/g, '\$1');
    fs.writeFileSync(p, JSON.stringify(JSON.parse(raw), null, 2) + '\n');
  });
" "$STAGING_DIR/package.json" "$STAGING_DIR/eas.json"

# --- package-lock.json ---
# Not shipped in tar — buyer generates their own via npm install.
# Remove from snapshot to prevent stale lock files causing npm ci failures.
rm -f "$STAGING_DIR/package-lock.json"

echo "  Done."

# ---------------------------------------------------------------------------
# Step 3: Remove modules (all are either site-specific or paid add-ons)
# ---------------------------------------------------------------------------

echo "[3/9] Cleaning module system..."

# Remove module tab stubs from app/(tabs)/
rm -f "$STAGING_DIR/app/(tabs)/calendar.tsx"
rm -f "$STAGING_DIR/app/(tabs)/donate.tsx"

# Remove module route stub directories from app/
rm -rf "$STAGING_DIR/app/blog"
rm -rf "$STAGING_DIR/app/blog-comments"
rm -rf "$STAGING_DIR/app/bookclub"
rm -rf "$STAGING_DIR/app/youtube"

# Remove module login gate route stub
rm -f "$STAGING_DIR/app/profile-complete.tsx"

# Clean _registry.ts: remove module imports and entries from the MODULES array
sed -i \
  -e "/^import { .*Module } from /d" \
  -e "/^  calendarModule,$/d" \
  -e "/^  bookclubModule,$/d" \
  -e "/^  donateModule,$/d" \
  -e "/^  donorModule,$/d" \
  -e "/^  youtubeModule,$/d" \
  -e "/^  blogModule,$/d" \
  -e "/^  otpModule,$/d" \
  -e "/^  profileCompletionModule,$/d" \
  -e "/^  cartModule,$/d" \
  -e "/^  multiReactionsModule,$/d" \
  "$STAGING_DIR/modules/_registry.ts"

echo "  Done."

# ---------------------------------------------------------------------------
# Step 4: Handle Firebase config files
# ---------------------------------------------------------------------------

echo "[4/9] Removing Firebase configs (buyers upload via dashboard)..."

rm -f "$STAGING_DIR/google-services.json"
rm -f "$STAGING_DIR/GoogleService-Info.plist"

echo "  Done."

# ---------------------------------------------------------------------------
# Step 5: Clean up extras
# ---------------------------------------------------------------------------

echo "[5/9] Cleaning up..."

# scripts/ excluded from tar — only setup/ ships to buyers

# Remove branded assets (buyers replace via dashboard — empty = dashboard shows what's needed)
rm -f "$STAGING_DIR/assets/images/app_icon_ios.png"
rm -f "$STAGING_DIR/assets/images/app_icon_android.png"
rm -f "$STAGING_DIR/assets/images/app_icon_android_adaptive_fg.png"
rm -f "$STAGING_DIR/assets/images/app_icon_android_adaptive_bg.png"
rm -f "$STAGING_DIR/assets/images/app_icon_android_notification.png"
rm -f "$STAGING_DIR/assets/images/splash_screen_img.png"
rm -f "$STAGING_DIR/assets/images/login_logo.png"
rm -f "$STAGING_DIR/assets/images/login_background_img.png"

# CLAUDE.md is now pure core — TBC-specific content lives in NOTES.md (excluded from snapshot)

# Write a blank NOTES.md into the staging dir. The project-root NOTES.md is
# excluded from the tar above (keeps our internal dev notes private), and this
# heredoc drops a fresh starter in its place so every buyer has the file from
# day one. On buyer updates, the identity system restores their own NOTES.md
# over this blank template — so existing content is never clobbered.
cat > "$STAGING_DIR/NOTES.md" <<'NOTES_EOF'
# Project Notes

This file is **buyer-owned** and preserved across core updates via the
dashboard's snapshot system. Put any project-specific notes, conventions,
credentials, or instructions for AI agents here. CLAUDE.md is core-owned
and gets overwritten on updates — keep your stuff in this file.

AI agents read this file **before** CLAUDE.md, and any rule here takes
precedence. Use it however you like.

---

## Site

Site URL:
Admin URL:
Primary contact:

## Conventions

-

## In-progress work

-

## Notes for AI agents

-
NOTES_EOF

# Remove any backup or temp files (single find traversal)
find "$STAGING_DIR" \( -name "*.orig" -o -name ".DS_Store" -o -name "nul" \) -delete 2>/dev/null || true

echo "  Done."

# ---------------------------------------------------------------------------
# Step 6: Verify — check for leftover site-specific references
# ---------------------------------------------------------------------------

echo "[6/9] Verifying no site-specific references remain..."
echo ""

ISSUES=0

# Single grep pass checking all site-specific patterns
if grep -rlE "twobirdschurch|Two Birds Community|2ee0dcc0255ee7f9a996|TBCCommunityApp" \
    "$STAGING_DIR" --include="*.ts" --include="*.tsx" --include="*.json" 2>/dev/null; then
  echo "  WARNING: Found site-specific references in the above files!"
  ISSUES=$((ISSUES + 1))
fi

# Separate check for "Two Birds" in source files (excluding "Two Birds Code" dev brand)
MATCHES=$(grep -rlE "Two Birds[^C]|Two Birds'" "$STAGING_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null || true)
if [ -n "$MATCHES" ]; then
  echo "$MATCHES"
  echo "  WARNING: Found 'Two Birds' references in the above files!"
  ISSUES=$((ISSUES + 1))
fi

if [ $ISSUES -eq 0 ]; then
  echo "  All clean — no site-specific references found."
fi

# ---------------------------------------------------------------------------
# Step 7: Copy CHANGELOG.md
# ---------------------------------------------------------------------------

echo "[7/9] Copying CHANGELOG..."

if [ -f "$SOURCE_DIR/CHANGELOG.md" ]; then
  cp "$SOURCE_DIR/CHANGELOG.md" "$STAGING_DIR/CHANGELOG.md"
else
  echo "  WARNING: No CHANGELOG.md found in source. Skipping."
fi

echo "  Done."

# ---------------------------------------------------------------------------
# Step 8: Generate manifest.json & core-update zip
# ---------------------------------------------------------------------------

echo "[8/9] Generating manifest.json & core-update package..."

generate_manifest "$SOURCE_VERSION" "$STAGING_DIR/manifest.json"

# Exclude only build/system paths that should never ship
FIND_EXCLUDES=()
FIND_EXCLUDES+=( ! -path './node_modules/*' ! -path './.git/*' ! -path './core-update-*' )
FIND_EXCLUDES+=( ! -path './setup/.temp/*' ! -path './setup/.backups/*' ! -path './setup/.license' ! -path './setup/.app-presets.json' )
FIND_EXCLUDES+=( ! -path './setup/logs/*' )
FIND_EXCLUDES+=( ! -path './package-lock.json' )

cd "$STAGING_DIR"
rm -f "$FINAL_ZIP"

# Use a temp file outside $STAGING_DIR (so find never sees it) but in a path
# that both bash and Node resolve to the same location. On Git Bash for Windows,
# `/tmp/` diverges (bash → MSYS /tmp, Node → C:\tmp), so we can't use /tmp here.
CORE_FILES_LIST="$WHITE_LABEL_ROOT/.tbc-core-files.txt"

find . -type f "${FIND_EXCLUDES[@]}" > "$CORE_FILES_LIST"

# Snapshot package.json as setup/.core-package.json — the deps baseline for the
# dashboard's snapshot system. Used by extractIdentity to compute "buyer-added" deps
# as a diff vs the core's shipped deps.
mkdir -p "$STAGING_DIR/setup"
cp "$STAGING_DIR/package.json" "$STAGING_DIR/setup/.core-package.json"

# Write setup/.core-files.json — the manifest of every file this core ships.
# The dashboard's update flow reads this on the NEXT update to know exactly
# which previous-core files to delete (cleanup is precise — buyer files like
# .git, NOTES.md, custom modules, and anything they added are never touched).
CORE_FILES_LIST="$CORE_FILES_LIST" node -e '
  var fs = require("fs");
  var list = fs.readFileSync(process.env.CORE_FILES_LIST, "utf8")
    .split("\n").filter(Boolean).map(function(p) { return p.replace(/^\.\//, ""); });
  // Include both manifest files in the list so they get cleaned up on next update
  for (var extra of ["setup/.core-files.json", "setup/.core-package.json"]) {
    if (list.indexOf(extra) === -1) list.push(extra);
  }
  list.sort();
  fs.writeFileSync(process.argv[1], JSON.stringify(list, null, 2) + "\n");
' "$STAGING_DIR/setup/.core-files.json"

# Re-run find so the file list passed to the zipper now includes both manifest files
find . -type f "${FIND_EXCLUDES[@]}" > "$CORE_FILES_LIST"

# Build the core-update zip with our zero-dep Node zip engine — same createZip()
# the dashboard ships with. Works on any OS that has Node (guaranteed via npm run).
TBC_CORE_REPO_ROOT="$SOURCE_DIR" \
TBC_CORE_BASE_DIR="$STAGING_DIR" \
TBC_CORE_OUT_ZIP="$FINAL_ZIP" \
TBC_CORE_LIST_FILE="$CORE_FILES_LIST" \
node -e '
  const { createZip } = require(process.env.TBC_CORE_REPO_ROOT + "/setup/lib/http-helpers");
  const fs = require("fs");
  const path = require("path");
  const baseDir = process.env.TBC_CORE_BASE_DIR;
  const outZip = process.env.TBC_CORE_OUT_ZIP;
  const listFile = process.env.TBC_CORE_LIST_FILE;
  const list = fs.readFileSync(listFile, "utf8").split("\n").filter(Boolean);
  const files = list.map((rel) => {
    const clean = rel.replace(/^\.\//, "");
    return { path: clean, data: fs.readFileSync(path.join(baseDir, clean)) };
  });
  fs.writeFileSync(outZip, createZip(files));
'

rm -f "$CORE_FILES_LIST"
cd "$SOURCE_DIR"

# On a version bump, cache the current HEAD hash so the NEXT bumped snapshot
# can use it as the baseline for changelog generation. We only update this on
# bumps so that same-version reruns don't wipe the real baseline.
if [ "$SOURCE_VERSION" != "$CURRENT_VERSION" ]; then
  CURRENT_HEAD=$(git -C "$SOURCE_DIR" rev-parse HEAD 2>/dev/null || echo "")
  if [ -n "$CURRENT_HEAD" ]; then
    echo "$CURRENT_HEAD" > "$WHITE_LABEL_ROOT/.last-release-commit"
  fi
fi

CORE_SIZE=$(du -h "$FINAL_ZIP" | cut -f1)
echo "  Core update package: $(basename "$FINAL_ZIP") ($CORE_SIZE)"
echo "  Done."

echo ""
echo "========================================"
echo "  White-Label Snapshot Complete!"
echo "========================================"
echo ""
echo "Output:  $FINAL_ZIP"
echo "Version: $SOURCE_VERSION"
echo ""
echo "Next steps:"
echo "  - Upload $(basename "$FINAL_ZIP") to your license server for buyer dashboard updates."
echo "  - Or sell it directly — buyers drop it into Dashboard -> Updates -> Manual Upload."
echo ""
