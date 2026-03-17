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

# Allowlist: only these companion plugins ship with the base product
CORE_PLUGINS=("tbc-community-app" "tbc-fluent-profiles" "tbc-multi-reactions" "tbc-starter-theme")

# Protected paths: buyer-customized files that updates must NEVER overwrite
# Used to generate manifest.json AND find exclusions for core-update tar
PROTECTED_PATHS=(
  "constants/config.ts"
  "app.json"
  "eas.json"
  "app.config.ts"
  "package.json"
  "assets/images/"
  "google-services.json"
  "GoogleService-Info.plist"
  "modules/"
  "setup/.license"
  "setup/.backups/"
  "setup/dashboard.next.js"
  "manifest.json"
)

# Helper: generate JSON array from PROTECTED_PATHS
generate_protected_paths_json() {
  local indent="${1:-    }"
  local last=$(( ${#PROTECTED_PATHS[@]} - 1 ))
  for i in "${!PROTECTED_PATHS[@]}"; do
    local comma=","
    [ "$i" -eq "$last" ] && comma=""
    echo "${indent}\"${PROTECTED_PATHS[$i]}\"${comma}"
  done
}

# Helper: generate manifest.json with a given version
generate_manifest() {
  local version="$1"
  local dest="$2"
  cat > "$dest" << GENMANIFEST_EOF
{
  "product": "tbc-community-app",
  "version": "${version}",
  "dashboardVersion": 1,
  "updateUrl": "https://www.twobirdscode.com/wp-json/tbc-license/v1/check",
  "protectedPaths": [
$(generate_protected_paths_json "    ")
  ],
  "corePlugins": [
    "tbc-community-app",
    "tbc-fluent-profiles",
    "tbc-multi-reactions",
    "tbc-starter-theme"
  ]
}
GENMANIFEST_EOF
}

# Read version from source package.json
SOURCE_VERSION=$(grep -o '"version": "[^"]*"' "$SOURCE_DIR/package.json" | head -1 | cut -d'"' -f4)
TARGET_DIR="$WHITE_LABEL_ROOT/$SOURCE_VERSION"

echo ""
echo "========================================"
echo "  White-Label Snapshot Creator"
echo "========================================"
echo ""
echo "Source:  $SOURCE_DIR"
echo "Target:  $TARGET_DIR"
echo "Version: $SOURCE_VERSION"
echo ""

# ---------------------------------------------------------------------------
# Safety check
# ---------------------------------------------------------------------------

if [ ! -f "$SOURCE_DIR/app.json" ]; then
  echo "ERROR: app.json not found in source. Run this from the project root."
  exit 1
fi

# Warn if target exists
if [ -d "$TARGET_DIR" ] && [ "$(ls -A "$TARGET_DIR" 2>/dev/null)" ]; then
  echo "WARNING: Target folder is not empty. Contents will be replaced."
  read -p "Continue? (y/N) " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
  echo "Cleaning target folder..."
  rm -rf "$TARGET_DIR"
fi

mkdir -p "$TARGET_DIR"

# ---------------------------------------------------------------------------
# Step 1: Copy project (excluding build artifacts, deps, git, plugins, etc.)
# ---------------------------------------------------------------------------

echo "[1/9] Copying project files..."

tar -cf - \
  --exclude='node_modules' \
  --exclude='.expo' \
  --exclude='.git' \
  --exclude='.claude' \
  --exclude='dist' \
  --exclude='web-build' \
  --exclude='ios' \
  --exclude='android' \
  --exclude='.kotlin' \
  --exclude='app-example' \
  --exclude='scripts' \
  --exclude='companion plugins' \
  --exclude='modules' \
  -C "$SOURCE_DIR" . | tar -xf - -C "$TARGET_DIR"

# Copy only core companion plugins (allowlist — new plugins won't leak in)
mkdir -p "$TARGET_DIR/companion plugins"
for plugin in "${CORE_PLUGINS[@]}"; do
  cp -r "$SOURCE_DIR/companion plugins/$plugin" "$TARGET_DIR/companion plugins/$plugin"
done

# Copy only module infrastructure (no module folders — those are add-ons)
mkdir -p "$TARGET_DIR/modules"
cp "$SOURCE_DIR/modules/_registry.ts" "$TARGET_DIR/modules/_registry.ts"
cp "$SOURCE_DIR/modules/_types.ts" "$TARGET_DIR/modules/_types.ts"

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
  "$TARGET_DIR/constants/config.ts"

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
  "$TARGET_DIR/app.json"

# --- eas.json ---
sed -i \
  -e 's|https://community.twobirdschurch.com|https://community.yoursite.com|g' \
  -e 's|"appleId": "[^"]*"|"appleId": "your-apple-id@example.com"|' \
  -e 's|"ascAppId": "[^"]*"|"ascAppId": "YOUR_ASC_APP_ID"|' \
  "$TARGET_DIR/eas.json"

# --- app.config.ts ---
sed -i \
  -e "s|'https://community.twobirdschurch.com'|'https://community.yoursite.com'|" \
  -e "s|config.name ?? 'Two Birds'|config.name ?? 'My Community'|" \
  -e "s|config.slug ?? 'twobirdscommunityapp'|config.slug ?? 'mycommunityapp'|" \
  -e "/'\\/blog\\//d" \
  -e "/'\\/bookclub\\//d" \
  "$TARGET_DIR/app.config.ts"

# --- package.json ---
sed -i \
  -e 's|"name": "twobirdscommunity"|"name": "community-app"|' \
  -e 's|"version": "[^"]*"|"version": "1.0.0"|' \
  "$TARGET_DIR/package.json"

echo "  Done."

# ---------------------------------------------------------------------------
# Step 3: Remove modules (all are either site-specific or paid add-ons)
# ---------------------------------------------------------------------------

echo "[3/9] Cleaning module system..."

# Remove module tab stubs from app/(tabs)/
rm -f "$TARGET_DIR/app/(tabs)/calendar.tsx"
rm -f "$TARGET_DIR/app/(tabs)/donate.tsx"

# Remove module route stub directories from app/
rm -rf "$TARGET_DIR/app/blog"
rm -rf "$TARGET_DIR/app/blog-comments"
rm -rf "$TARGET_DIR/app/bookclub"
rm -rf "$TARGET_DIR/app/youtube"

# Clean _registry.ts: remove module imports and empty the MODULES array
sed -i \
  -e "/^import { .*Module } from /d" \
  -e "/^  calendarModule,$/d" \
  -e "/^  bookclubModule,$/d" \
  -e "/^  donateModule,$/d" \
  -e "/^  donorModule,$/d" \
  -e "/^  youtubeModule,$/d" \
  -e "/^  blogModule,$/d" \
  "$TARGET_DIR/modules/_registry.ts"

echo "  Done."

# ---------------------------------------------------------------------------
# Step 4: Handle Firebase config files
# ---------------------------------------------------------------------------

echo "[4/9] Replacing Firebase configs with placeholders..."

rm -f "$TARGET_DIR/google-services.json"
rm -f "$TARGET_DIR/GoogleService-Info.plist"

cat > "$TARGET_DIR/FIREBASE_SETUP.md" << 'FIREBASE_EOF'
# Firebase Setup

Replace these placeholder files with your own Firebase config files:

## Android — `google-services.json`
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a project or select an existing one
3. Add an Android app with your package name (from `app.json` → `android.package`)
4. Download `google-services.json`
5. Place it in the project root (same level as `app.json`)

## iOS — `GoogleService-Info.plist`
1. In the same Firebase project, add an iOS app
2. Use your bundle ID (from `app.json` → `ios.bundleIdentifier`)
3. Download `GoogleService-Info.plist`
4. Place it in the project root (same level as `app.json`)
FIREBASE_EOF

echo "  Done."

# ---------------------------------------------------------------------------
# Step 5: Clean up extras
# ---------------------------------------------------------------------------

echo "[5/9] Cleaning up..."

# scripts/ excluded from tar — only setup/ ships to buyers

# Remove branded assets (buyers replace via dashboard — empty = dashboard shows what's needed)
rm -f "$TARGET_DIR/assets/images/app_icon_ios.png"
rm -f "$TARGET_DIR/assets/images/app_icon_android.png"
rm -f "$TARGET_DIR/assets/images/app_icon_android_adaptive_fg.png"
rm -f "$TARGET_DIR/assets/images/app_icon_android_adaptive_bg.png"
rm -f "$TARGET_DIR/assets/images/app_icon_android_notification.png"
rm -f "$TARGET_DIR/assets/images/splash_screen_img.png"
rm -f "$TARGET_DIR/assets/images/login_logo.png"
rm -f "$TARGET_DIR/assets/images/login_background_img.png"

# Strip site-specific section from CLAUDE.md (keep generic buyer-facing content)
if [ -f "$TARGET_DIR/CLAUDE.md" ]; then
  sed -i '/<!-- SNAPSHOT_STRIP_BELOW -->/,$d' "$TARGET_DIR/CLAUDE.md"
  echo "" >> "$TARGET_DIR/CLAUDE.md"
fi

# Remove any backup or temp files (single find traversal)
find "$TARGET_DIR" \( -name "*.orig" -o -name ".DS_Store" -o -name "nul" \) -delete 2>/dev/null || true

echo "  Done."

# ---------------------------------------------------------------------------
# Step 6: Verify — check for leftover site-specific references
# ---------------------------------------------------------------------------

echo "[6/9] Verifying no site-specific references remain..."
echo ""

ISSUES=0

# Single grep pass checking all site-specific patterns
if grep -rlE "twobirdschurch|Two Birds Community|2ee0dcc0255ee7f9a996|TBCCommunityApp" \
    "$TARGET_DIR" --include="*.ts" --include="*.tsx" --include="*.json" 2>/dev/null; then
  echo "  WARNING: Found site-specific references in the above files!"
  ISSUES=$((ISSUES + 1))
fi

# Separate check for "Two Birds" in source files (excluding "Two Birds Code" dev brand)
MATCHES=$(grep -rlE "Two Birds[^C]|Two Birds'" "$TARGET_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null || true)
if [ -n "$MATCHES" ]; then
  echo "$MATCHES"
  echo "  WARNING: Found 'Two Birds' references in the above files!"
  ISSUES=$((ISSUES + 1))
fi

if [ $ISSUES -eq 0 ]; then
  echo "  All clean — no site-specific references found."
fi

# ---------------------------------------------------------------------------
# Step 7: Generate / update CHANGELOG.md
# ---------------------------------------------------------------------------

echo "[7/9] Updating CHANGELOG..."

CHANGELOG="$TARGET_DIR/CHANGELOG.md"
DATE=$(date +%Y-%m-%d)

if [ ! -f "$CHANGELOG" ]; then
  # First snapshot — create the file
  cat > "$CHANGELOG" << CHANGELOG_EOF
# Changelog

All notable changes to the TBC Community App white-label product.

## [$SOURCE_VERSION] — $DATE

- Initial white-label release
CHANGELOG_EOF
else
  # Subsequent snapshot — prepend new version entry after the header
  # Create temp file with new entry inserted after "All notable changes..." line
  # Skip if this version already has an entry
  if grep -q "## \[$SOURCE_VERSION\]" "$CHANGELOG"; then
    echo "  Version $SOURCE_VERSION already in CHANGELOG, skipping."
  else
    TEMP_CL=$(mktemp)
    awk -v ver="$SOURCE_VERSION" -v dt="$DATE" '
      /^All notable changes/ { print; print ""; print "## [" ver "] — " dt; print ""; print "- Update from upstream"; next }
      { print }
    ' "$CHANGELOG" > "$TEMP_CL"
    mv "$TEMP_CL" "$CHANGELOG"
  fi
fi

echo "  Done."

# ---------------------------------------------------------------------------
# Step 8: Generate manifest.json & build core-update tar.gz
# ---------------------------------------------------------------------------

echo "[8/9] Generating manifest.json & core-update package..."

generate_manifest "$SOURCE_VERSION" "$TARGET_DIR/manifest.json"

# The core-update tar.gz contains the FULL snapshot — everything a buyer needs.
# On first install, they extract the whole thing. On updates, the dashboard
# reads PROTECTED_PATHS from manifest.json and skips buyer-customized files.

CORE_UPDATE_TAR="$TARGET_DIR/core-update-${SOURCE_VERSION}.tar.gz"

# Exclude only build/system paths that should never ship
FIND_EXCLUDES=()
FIND_EXCLUDES+=( ! -path './node_modules/*' ! -path './.git/*' ! -path './core-update-*' )
FIND_EXCLUDES+=( ! -path './setup/.temp/*' ! -path './setup/.backups/*' ! -path './setup/.license' )

cd "$TARGET_DIR"

find . -type f "${FIND_EXCLUDES[@]}" > /tmp/tbc-core-files.txt

tar -czf "$CORE_UPDATE_TAR" -T /tmp/tbc-core-files.txt 2>/dev/null || true

rm -f /tmp/tbc-core-files.txt
cd "$SOURCE_DIR"

CORE_SIZE=$(du -h "$CORE_UPDATE_TAR" | cut -f1)
echo "  Core update package: core-update-${SOURCE_VERSION}.tar.gz ($CORE_SIZE)"
echo "  Done."

# ---------------------------------------------------------------------------
# Git tag (if target is a git repo)
# ---------------------------------------------------------------------------

if [ -d "$TARGET_DIR/.git" ]; then
  echo ""
  read -p "Tag this release as v${SOURCE_VERSION}? (y/N) " tag_confirm
  if [[ "$tag_confirm" =~ ^[Yy]$ ]]; then
    cd "$TARGET_DIR"
    git add -A
    git commit -m "Update to v${SOURCE_VERSION}" --allow-empty
    if git tag -a "v${SOURCE_VERSION}" -m "Release v${SOURCE_VERSION}" 2>/dev/null; then
      echo "  Tagged v${SOURCE_VERSION}"
    else
      echo "  Tag v${SOURCE_VERSION} already exists, skipping."
    fi
    cd "$SOURCE_DIR"
  fi
fi

echo ""
echo "========================================"
echo "  White-Label Snapshot Complete!"
echo "========================================"
echo ""
echo "Output:  $TARGET_DIR"
echo "Version: $SOURCE_VERSION"
echo ""
echo "Next steps:"
if [ -d "$TARGET_DIR/.git" ]; then
  echo "  1. Review the changes: cd \"$TARGET_DIR\" && git diff HEAD~1"
  echo "  2. Push: git push && git push --tags"
  echo "  3. Upload core-update-${SOURCE_VERSION}.tar.gz to your license server for dashboard updates"
else
  echo "  1. Open the folder in VS Code and review"
  echo "  2. cd into it, run: git init && git add . && git commit -m 'White-label release v${SOURCE_VERSION}'"
  echo "  3. Create a private GitHub repo and push"
  echo "  4. Test: npm install && npx expo start"
fi
echo ""
echo "Update package: core-update-${SOURCE_VERSION}.tar.gz"
echo "  Upload this to your license server for buyers to receive dashboard updates."
echo ""
