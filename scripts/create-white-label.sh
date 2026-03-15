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
TARGET_DIR="$(cd "$SOURCE_DIR/.." && pwd)/TBC-Community-App (White Lable)"

# Allowlist: only these companion plugins ship with the base product
CORE_PLUGINS=("tbc-community-app" "tbc-fluent-profiles" "tbc-multi-reactions" "tbc-starter-theme")

echo ""
echo "========================================"
echo "  White-Label Snapshot Creator"
echo "========================================"
echo ""
echo "Source: $SOURCE_DIR"
echo "Target: $TARGET_DIR"
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

echo "[1/6] Copying project files..."

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
  --exclude='scripts/create-white-label.sh' \
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

echo "[2/6] Replacing site-specific values..."

# --- constants/config.ts ---
sed -i \
  -e "s|export const APP_NAME = 'Two Birds';|export const APP_NAME = 'My Community';|" \
  -e "s|export const APP_USER_AGENT = 'TBCCommunityApp/1.0';|export const APP_USER_AGENT = 'CommunityApp/1.0';|" \
  -e "s|APP_KEY: '2ee0dcc0255ee7f9a996',|APP_KEY: 'YOUR_PUSHER_APP_KEY',|" \
  -e "s|CLUSTER: 'us3',|CLUSTER: 'YOUR_PUSHER_CLUSTER',|" \
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
  -e "s|name: config.name ?? 'Two Birds'|name: config.name ?? 'My Community'|" \
  -e "s|slug: config.slug ?? 'twobirdscommunityapp'|slug: config.slug ?? 'mycommunityapp'|" \
  -e "/pathPrefix: '\/blog\/'/d" \
  -e "/pathPrefix: '\/bookclub\/'/d" \
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

echo "[3/6] Cleaning module system..."

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

echo "[4/6] Replacing Firebase configs with placeholders..."

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

echo "[5/6] Cleaning up..."

# Remove the scripts folder from white-label (snapshot script is not for buyers)
rm -rf "$TARGET_DIR/scripts"

# Remove CLAUDE.md (dev-specific, not for buyers)
rm -f "$TARGET_DIR/CLAUDE.md"

# Remove any backup or temp files (single find traversal)
find "$TARGET_DIR" \( -name "*.orig" -o -name ".DS_Store" -o -name "nul" \) -delete 2>/dev/null || true

echo "  Done."

# ---------------------------------------------------------------------------
# Step 6: Verify — check for leftover site-specific references
# ---------------------------------------------------------------------------

echo "[6/6] Verifying no site-specific references remain..."
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

echo ""
echo "========================================"
echo "  White-Label Snapshot Complete!"
echo "========================================"
echo ""
echo "Output: $TARGET_DIR"
echo ""
echo "Next steps:"
echo "  1. Open the folder in VS Code and review"
echo "  2. cd into it, run: git init && git add . && git commit -m 'Initial white-label release v1.0.0'"
echo "  3. Create a private GitHub repo and push"
echo "  4. Test: npm install && npx expo start"
echo ""
