#!/usr/bin/env bash
# =============================================================================
# UPDATE CHANGELOG
# =============================================================================
# Reads git history since the last version bump and prepends a new entry to
# CHANGELOG.md with categorized commits (Added / Fixed / Changed).
#
# Usage: bash scripts/update-changelog.sh
#        npm run changelog
#
# Environment variables (optional, set by create-white-label.sh):
#   CHANGELOG_AUTO=1            Skip all interactive prompts (force regenerate)
#   CHANGELOG_SINCE=<commit>    Override the "previous release" commit baseline
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CHANGELOG="$SOURCE_DIR/CHANGELOG.md"
# Read CORE version from manifest.json — this is the product we ship to buyers,
# not our own Two Birds Church app version (which lives in package.json).
VERSION=$(cd "$SOURCE_DIR" && node -p "require('./manifest.json').version")
DATE=$(date +%Y-%m-%d)

# Clean up temp files on exit
TEMP=""
trap 'rm -f "$TEMP" 2>/dev/null' EXIT

# ---------------------------------------------------------------------------
# Check if this version already has an entry
# ---------------------------------------------------------------------------

if [ -f "$CHANGELOG" ] && grep -q "## \[$VERSION\]" "$CHANGELOG"; then
  if [ "${CHANGELOG_AUTO:-0}" = "1" ]; then
    REPLACING=true
  else
    echo "Version $VERSION already in CHANGELOG.md."
    echo ""
    read -p "Regenerate it? This will replace the existing entry. (y/N) " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
      echo "Aborted."
      exit 0
    fi
    REPLACING=true
  fi
else
  REPLACING=false
fi

# ---------------------------------------------------------------------------
# Determine the commit range for this release
# ---------------------------------------------------------------------------
# Priority:
#   1. CHANGELOG_SINCE env var (set by create-white-label.sh from its cached
#      .last-release-commit file)
#   2. Most recent "chore: bump version to" commit in git history
#   3. Fallback: last 50 commits

if [ -n "${CHANGELOG_SINCE:-}" ] && git -C "$SOURCE_DIR" cat-file -e "${CHANGELOG_SINCE}^{commit}" 2>/dev/null; then
  RANGE="${CHANGELOG_SINCE}..HEAD"
else
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

if [ "${CHANGELOG_AUTO:-0}" != "1" ]; then
  read -p "Write this to CHANGELOG.md? (Y/n) " write_confirm
  if [[ "$write_confirm" =~ ^[Nn]$ ]]; then
    echo "Aborted. You can edit CHANGELOG.md manually."
    exit 0
  fi
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
