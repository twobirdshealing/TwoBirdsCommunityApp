#!/usr/bin/env bash
# =============================================================================
# UPDATE CHANGELOG
# =============================================================================
# Reads git history since the last version bump and prepends a new entry to
# CHANGELOG.md with categorized commits (Added / Fixed / Changed).
#
# Usage: bash scripts/update-changelog.sh
#        npm run changelog
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CHANGELOG="$SOURCE_DIR/CHANGELOG.md"
VERSION=$(cd "$SOURCE_DIR" && node -p "require('./package.json').version")
DATE=$(date +%Y-%m-%d)

# Clean up temp files on exit
TEMP=""
trap 'rm -f "$TEMP" 2>/dev/null' EXIT

# ---------------------------------------------------------------------------
# Check if this version already has an entry
# ---------------------------------------------------------------------------

if [ -f "$CHANGELOG" ] && grep -q "## \[$VERSION\]" "$CHANGELOG"; then
  echo "Version $VERSION already in CHANGELOG.md."
  echo ""
  read -p "Regenerate it? This will replace the existing entry. (y/N) " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
  REPLACING=true
else
  REPLACING=false
fi

# ---------------------------------------------------------------------------
# Find the previous version bump commit (current branch only)
# ---------------------------------------------------------------------------

# Skip the current version's bump, grab the one before it
PREV_BUMP=$(git log --grep="^chore: bump version to" --format="%H" \
  | grep -v "$(git log --grep="bump version to $VERSION" --format="%H" | head -1)" \
  | head -1 || true)

if [ -z "$PREV_BUMP" ]; then
  echo "Could not find a previous version bump commit. Using last 50 commits."
  RANGE="HEAD~50..HEAD"
else
  RANGE="${PREV_BUMP}..HEAD"
fi

echo ""
echo "Generating changelog for v$VERSION ($DATE)"
echo "Commit range: $RANGE"
echo ""

# ---------------------------------------------------------------------------
# Categorize commits (single git log pass)
# ---------------------------------------------------------------------------

ALL_COMMITS=$(git log --format="%s" "$RANGE" 2>/dev/null \
  | grep -vi "bump version\|snapshot\|CLAUDE.md" \
  || true)

ADDED=$(echo "$ALL_COMMITS" | grep -iE "^feat:" | sed -E 's/^[Ff]eat: /- /' || true)
FIXED=$(echo "$ALL_COMMITS" | grep -iE "^fix:" | sed -E 's/^[Ff]ix: /- /' || true)
CHANGED=$(echo "$ALL_COMMITS" | grep -iE "^(refactor|style):" | sed -E 's/^([Rr]efactor|[Ss]tyle): /- /' || true)

# ---------------------------------------------------------------------------
# Build the entry
# ---------------------------------------------------------------------------

ENTRY="## [$VERSION] — $DATE"

if [ -n "$ADDED" ]; then
  ENTRY="$ENTRY

### Added
$ADDED"
fi

if [ -n "$FIXED" ]; then
  ENTRY="$ENTRY

### Fixed
$FIXED"
fi

if [ -n "$CHANGED" ]; then
  ENTRY="$ENTRY

### Changed
$CHANGED"
fi

# If nothing was found, add a placeholder
if [ -z "$ADDED" ] && [ -z "$FIXED" ] && [ -z "$CHANGED" ]; then
  ENTRY="$ENTRY

- Maintenance update"
fi

# ---------------------------------------------------------------------------
# Preview
# ---------------------------------------------------------------------------

echo "========================================="
echo "$ENTRY"
echo "========================================="
echo ""
read -p "Write this to CHANGELOG.md? (Y/n) " write_confirm
if [[ "$write_confirm" =~ ^[Nn]$ ]]; then
  echo "Aborted. You can edit CHANGELOG.md manually."
  exit 0
fi

# ---------------------------------------------------------------------------
# Write to CHANGELOG.md
# ---------------------------------------------------------------------------

if [ ! -f "$CHANGELOG" ]; then
  # Create fresh changelog
  cat > "$CHANGELOG" << EOF
# Changelog

All notable changes to the TBC Community App white-label product.

$ENTRY
EOF
elif [ "$REPLACING" = true ]; then
  # Remove existing entry for this version and insert new one
  TEMP=$(mktemp)
  awk -v ver="$VERSION" '
    BEGIN { skip=0 }
    /^## \[/ {
      if (index($0, "[" ver "]")) { skip=1; next }
      else { skip=0 }
    }
    skip && /^###? / { next }
    skip && /^- / { next }
    skip && /^$/ { next }
    !skip { print }
  ' "$CHANGELOG" > "$TEMP"
  # Insert new entry after header
  awk -v entry="$ENTRY" '
    /^All notable changes/ { print; print ""; print entry; next }
    { print }
  ' "$TEMP" > "$TEMP.2"
  mv "$TEMP.2" "$CHANGELOG"
  rm -f "$TEMP"
  TEMP=""
else
  # Prepend new entry after the header line
  TEMP=$(mktemp)
  awk -v entry="$ENTRY" '
    /^All notable changes/ { print; print ""; print entry; next }
    { print }
  ' "$CHANGELOG" > "$TEMP"
  mv "$TEMP" "$CHANGELOG"
  TEMP=""
fi

echo ""
echo "CHANGELOG.md updated with v$VERSION entry."
echo "Review it, then run: npm run snapshot"
