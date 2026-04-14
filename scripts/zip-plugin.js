#!/usr/bin/env node
// =============================================================================
// ZIP A COMPANION PLUGIN
// =============================================================================
// Zips a single plugin folder from `companion plugins/` into a .zip that
// buyers can upload via WordPress Plugins -> Add New -> Upload Plugin.
//
// Uses the same zero-dep createZip() engine the buyer's dashboard uses for
// module exports, so dev and runtime produce byte-identical zips.
//
// Usage:
//   node scripts/zip-plugin.js <plugin-name> [output-path]
//
// Examples:
//   node scripts/zip-plugin.js tbc-community-app
//     -> dist/plugins/tbc-community-app.zip
//
//   node scripts/zip-plugin.js tbc-youtube dist/plugins/tbc-youtube.zip
//     -> dist/plugins/tbc-youtube.zip
//
//   node scripts/zip-plugin.js /abs/path/to/staged-plugin /abs/path/out.zip
//     -> absolute path mode (used by create-white-label.sh)
// =============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const { createZip } = require('../setup/lib/http-helpers');

const REPO_ROOT = path.resolve(__dirname, '..');

function zipPlugin(sourceDir, outputZip) {
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    console.error(`ERROR: plugin folder not found: ${sourceDir}`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(outputZip), { recursive: true });
  if (fs.existsSync(outputZip)) fs.unlinkSync(outputZip);

  // Walk the source directory; all paths inside the zip are rooted at basename(sourceDir)
  // so unzipping into wp-content/plugins/ reproduces the correct WP layout.
  const rootName = path.basename(sourceDir);
  const files = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        const rel = path.relative(sourceDir, full).split(path.sep).join('/');
        files.push({
          path: `${rootName}/${rel}`,
          data: fs.readFileSync(full),
        });
      }
    }
  })(sourceDir);

  fs.writeFileSync(outputZip, createZip(files));

  const sizeKb = (fs.statSync(outputZip).size / 1024).toFixed(1);
  console.log(`Wrote ${outputZip} (${sizeKb} KB, ${files.length} files)`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node scripts/zip-plugin.js <plugin-name> [output-path]');
    console.error('       node scripts/zip-plugin.js <absolute-source-dir> <absolute-output-zip>');
    process.exit(1);
  }

  const first = args[0];
  let sourceDir, outputZip;

  if (path.isAbsolute(first)) {
    // Absolute mode: both args are full paths (used by create-white-label.sh staging)
    if (args.length < 2) {
      console.error('ERROR: absolute mode requires <source-dir> <output-zip>');
      process.exit(1);
    }
    sourceDir = first;
    outputZip = args[1];
  } else {
    // Named mode: first arg is plugin name, resolve against companion plugins/
    sourceDir = path.join(REPO_ROOT, 'companion plugins', first);
    outputZip = args[1]
      ? (path.isAbsolute(args[1]) ? args[1] : path.join(REPO_ROOT, args[1]))
      : path.join(REPO_ROOT, 'dist', 'plugins', `${first}.zip`);
  }

  zipPlugin(sourceDir, outputZip);
}

main();
