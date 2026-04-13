'use strict';

const fs   = require('fs');
const path = require('path');

const { PATHS }                    = require('./paths');
const { fileExists, extractTsValue, getPluginVersion } = require('./file-utils');
const { createZip, parseZip }      = require('./http-helpers');

// ---------------------------------------------------------------------------
// Shared helper — extract files from a zip with path traversal guard
// ---------------------------------------------------------------------------

function safeExtractFiles(files, prefix, destDir) {
  for (const file of files) {
    const relPath = file.path.replace(prefix, '');
    const destPath = path.resolve(destDir, relPath);
    if (!destPath.startsWith(destDir + path.sep) && destPath !== destDir) continue;
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, file.data);
  }
}

// ---------------------------------------------------------------------------
// Module System — read, export, import, remove modules
// ---------------------------------------------------------------------------

/** Parse module.ts to extract id, name, version, companionPlugin, whether it has a tab */
function parseModuleManifest(moduleDir) {
  let moduleTs = path.join(moduleDir, 'module.ts');
  if (!fileExists(moduleTs)) moduleTs = path.join(moduleDir, 'module.tsx');
  if (!fileExists(moduleTs)) return null;
  const content = fs.readFileSync(moduleTs, 'utf8');

  const id = extractTsValue(content, /id:\s*'([^']*)'/);
  const name = extractTsValue(content, /name:\s*'([^']*)'/);
  const version = extractTsValue(content, /version:\s*'([^']*)'/);
  const description = extractTsValue(content, /description:\s*'([^']*)'/);
  const author = extractTsValue(content, /author:\s*'([^']*)'/);
  const authorUrl = extractTsValue(content, /authorUrl:\s*'([^']*)'/);
  const license = extractTsValue(content, /license:\s*'([^']*)'/);
  const minAppVersion = extractTsValue(content, /minAppVersion:\s*'([^']*)'/);
  const companionPlugin = extractTsValue(content, /companionPlugin:\s*'([^']*)'/);
  const hasTab = /\btab:\s*\{/.test(content);
  const apiBase = extractTsValue(content, /apiBase:\s*'([^']*)'/);

  // routePrefixes: ['/blog', '/blog-comments'] — declares which app/<prefix>/ folders this module owns
  const routePrefixes = [];
  const routePrefixMatch = content.match(/routePrefixes:\s*\[([^\]]*)\]/);
  if (routePrefixMatch) {
    const entries = routePrefixMatch[1].matchAll(/'([^']+)'/g);
    for (const m of entries) routePrefixes.push(m[1]);
  }

  // Detect which integration slots this module uses
  const integrations = [];
  if (hasTab) integrations.push('Tab');
  if (/\bwidgets:\s*\[/.test(content)) integrations.push('Widget');
  if (/\blauncherItems:\s*\[/.test(content)) integrations.push('Launcher');
  if (/\bheaderIcons:\s*\[/.test(content)) integrations.push('Header Icon');
  if (/\bproviders:\s*\[/.test(content)) integrations.push('Provider');
  if (/\bslots:\s*\[/.test(content)) integrations.push('Slot');
  if (/\bregistrationSteps:\s*\[/.test(content)) integrations.push('Registration Step');
  if (/\bresponseHeaders:\s*\[/.test(content)) integrations.push('Response Header');
  if (/\btabBarAddon:\s*\w/.test(content)) integrations.push('Tab Bar Addon');
  if (/\bnotificationHandler:\s*[\w(]/.test(content)) integrations.push('Push Handler');

  // Extract all visibility keys — modules can have multiple hideable elements
  const visibilityKeys = [];
  const hideKeyMatches = content.matchAll(/hideKey:\s*'([^']*)'/g);
  for (const m of hideKeyMatches) { if (!visibilityKeys.includes(m[1])) visibilityKeys.push(m[1]); }
  const hideMenuKeyMatches = content.matchAll(/hideMenuKey:\s*'([^']*)'/g);
  for (const m of hideMenuKeyMatches) { if (!visibilityKeys.includes(m[1])) visibilityKeys.push(m[1]); }

  return { id, name, version, description, author, authorUrl, license, minAppVersion, companionPlugin, hasTab, apiBase, visibilityKeys, integrations, routePrefixes };
}

/** Get all installed modules */
function getInstalledModules() {
  const modules = [];
  if (!fileExists(PATHS.modulesDir)) return modules;

  const dirs = fs.readdirSync(PATHS.modulesDir).filter(d => {
    if (d.startsWith('_')) return false; // skip _registry.ts, _types.ts, _shared
    const full = path.join(PATHS.modulesDir, d);
    return fs.statSync(full).isDirectory();
  });

  // Read registry to see which are active
  const registryContent = fileExists(PATHS.registryTs)
    ? fs.readFileSync(PATHS.registryTs, 'utf8') : '';

  for (const dir of dirs) {
    const moduleDir = path.join(PATHS.modulesDir, dir);
    const manifest = parseModuleManifest(moduleDir);
    if (!manifest) continue;

    // Check if module is registered (active) in _registry.ts.
    // A module is only truly active if BOTH the import line exists AND it
    // appears as an entry inside the MODULES array. The import alone isn't
    // enough — without the array entry the module never gets loaded at
    // runtime (toggleModule had a regex bug in older core versions that
    // could leave things in that stuck half-registered state).
    const importPattern = new RegExp(`from\\s+['\\./"]+${dir}/module['\"]`);
    const hasImport = importPattern.test(registryContent);
    const exportName = dir.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + 'Module';
    const arrayMatch = registryContent.match(/export const MODULES: ModuleManifest\[\] = \[([\s\S]*?)\n\];/);
    const arrayBody = arrayMatch ? arrayMatch[1] : '';
    const inArray = new RegExp(`\\b${exportName}\\b`).test(arrayBody);
    const isActive = hasImport && inArray;

    // Check for route stub
    const routeStub = manifest.hasTab
      ? path.join(PATHS.tabsDir, dir + '.tsx')
      : null;
    const hasRouteStub = routeStub ? fileExists(routeStub) : false;

    // Check companion plugin
    const companionExists = manifest.companionPlugin
      ? fileExists(path.join(PATHS.pluginsDir, manifest.companionPlugin))
      : null;
    const companionVersion = manifest.companionPlugin
      ? getPluginVersion(manifest.companionPlugin)
      : null;

    // Count files
    const fileCount = countFiles(moduleDir);

    modules.push({
      ...manifest,
      folder: dir,
      active: isActive,
      hasRouteStub,
      companionExists,
      companionVersion,
      fileCount,
    });
  }

  return modules;
}

function countFiles(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) count += countFiles(path.join(dir, entry.name));
    else count++;
  }
  return count;
}

/** Toggle a module active/inactive in _registry.ts. Pass mod to skip re-scan. */
function toggleModule(moduleId, active, mod) {
  if (!fileExists(PATHS.registryTs)) return { ok: false, error: '_registry.ts not found' };

  if (!mod) {
    const modules = getInstalledModules();
    mod = modules.find(m => m.id === moduleId);
  }
  if (!mod) return { ok: false, error: 'Module not found: ' + moduleId };

  let content = fs.readFileSync(PATHS.registryTs, 'utf8');
  const exportName = mod.folder.replace(/-/g, '') + 'Module';

  if (active && !mod.active) {
    // Add import line — insert before `export const MODULES`
    const importLine = `import { ${exportName} } from './${mod.folder}/module';`;
    content = content.replace(
      /(\n)(export const MODULES)/,
      `\n${importLine}\n$2`
    );

    // Add entry to the MODULES array — anchor on the array declaration itself
    // and insert before its closing `];`. Works regardless of what comes after
    // the array (e.g. a `setModules(MODULES);` call between it and any comment).
    content = content.replace(
      /(export const MODULES: ModuleManifest\[\] = \[)([\s\S]*?)(\n\];)/,
      (_m, open, body, close) => `${open}${body}\n  ${exportName},${close}`
    );

    // Clean up triple+ blank lines
    content = content.replace(/\n{3,}/g, '\n\n');
    fs.writeFileSync(PATHS.registryTs, content);
    return { ok: true, message: `${mod.name} activated` };

  } else if (!active && mod.active) {
    // Remove import line
    const importRegex = new RegExp(`import\\s*\\{\\s*${exportName}\\s*\\}\\s*from\\s*['\\./"]+${mod.folder}/module['\"];?\\n?`, 'g');
    content = content.replace(importRegex, '');

    // Remove from MODULES array
    const arrayRegex = new RegExp(`\\s*${exportName},?\\n`, 'g');
    content = content.replace(arrayRegex, '\n');

    // Clean up triple+ blank lines
    content = content.replace(/\n{3,}/g, '\n\n');
    fs.writeFileSync(PATHS.registryTs, content);
    return { ok: true, message: `${mod.name} deactivated` };
  }

  return { ok: true, message: 'No change needed' };
}

/** Remove a module entirely */
function removeModule(moduleId) {
  const modules = getInstalledModules();
  const mod = modules.find(m => m.id === moduleId);
  if (!mod) return { ok: false, error: 'Module not found: ' + moduleId };

  // Deactivate first (pass mod to avoid re-scanning)
  if (mod.active) toggleModule(moduleId, false, mod);

  // Remove module folder
  const moduleDir = path.join(PATHS.modulesDir, mod.folder);
  fs.rmSync(moduleDir, { recursive: true, force: true });

  // Remove tab stub if exists
  if (mod.hasTab) {
    const stubPath = path.join(PATHS.tabsDir, mod.folder + '.tsx');
    if (fileExists(stubPath)) fs.unlinkSync(stubPath);
  }

  // Remove non-tab route directories the module owned (app/<prefix>/)
  for (const p of mod.routePrefixes || []) {
    const folderName = String(p).replace(/^\/+/, '').replace(/\/+$/, '');
    if (!folderName || folderName.includes('/') || folderName.includes('..')) continue;
    const routeDir = path.join(PATHS.appDir, folderName);
    if (fileExists(routeDir)) fs.rmSync(routeDir, { recursive: true, force: true });
  }

  return { ok: true, message: `${mod.name} removed` };
}

// ---------------------------------------------------------------------------
// Module Export — create a zip package from a module folder
// ---------------------------------------------------------------------------

/** Recursively collect all files in a directory (relative paths) */
function collectFiles(dir, base) {
  base = base || dir;
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, base));
    } else {
      results.push({ path: rel, data: fs.readFileSync(full) });
    }
  }
  return results;
}

/**
 * Create a .zip package for a module (sellable as an add-on).
 * Format:
 *   manifest.json                 — metadata (includes routePrefixes so import knows what to unpack)
 *   module/<files>                — the module folder (modules/<folder>/)
 *   route-stubs/<file>.tsx        — tab stub file (if the module has a bottom tab)
 *   app-routes/<prefix>/<files>   — non-tab route directories declared via routePrefixes
 *                                   (e.g. app/blog/*, app/blog-comments/*)
 *   companion-plugin/<files>      — companion WordPress plugin (if any)
 *
 * Zero-dep DEFLATE zip via createZip() in http-helpers.js.
 */
function exportModule(moduleId) {
  const modules = getInstalledModules();
  const mod = modules.find(m => m.id === moduleId);
  if (!mod) return { ok: false, error: 'Module not found: ' + moduleId };

  const moduleDir = path.join(PATHS.modulesDir, mod.folder);
  const files = [];

  // Normalize routePrefixes -> folder names (strip leading slash, drop empties)
  const routeFolders = (mod.routePrefixes || [])
    .map((p) => String(p).replace(/^\/+/, '').replace(/\/+$/, ''))
    .filter((p) => p && !p.includes('/') && !p.includes('..'));

  const manifest = {
    id: mod.id,
    name: mod.name,
    version: mod.version,
    description: mod.description,
    author: mod.author || null,
    authorUrl: mod.authorUrl || null,
    license: mod.license || null,
    minAppVersion: mod.minAppVersion || null,
    folder: mod.folder,
    hasTab: mod.hasTab,
    companionPlugin: mod.companionPlugin || null,
    apiBase: mod.apiBase || null,
    routePrefixes: mod.routePrefixes || [],
    exportedAt: new Date().toISOString(),
    format: 2,
  };
  files.push({ path: 'manifest.json', data: Buffer.from(JSON.stringify(manifest, null, 2)) });

  // Module files
  const moduleFiles = collectFiles(moduleDir);
  for (const f of moduleFiles) {
    files.push({ path: 'module/' + f.path, data: f.data });
  }

  // Tab stub (if module has a bottom tab)
  if (mod.hasTab) {
    const stubPath = path.join(PATHS.tabsDir, mod.folder + '.tsx');
    if (fileExists(stubPath)) {
      files.push({ path: 'route-stubs/' + mod.folder + '.tsx', data: fs.readFileSync(stubPath) });
    }
  }

  // Non-tab route directories (app/<prefix>/) declared via routePrefixes.
  // These hold the actual screens for modules like blog, bookclub, youtube —
  // without them the imported module would be missing its feature pages.
  for (const folderName of routeFolders) {
    const routeDir = path.join(PATHS.appDir, folderName);
    if (!fileExists(routeDir)) continue;
    const routeFiles = collectFiles(routeDir);
    for (const f of routeFiles) {
      files.push({ path: `app-routes/${folderName}/${f.path}`, data: f.data });
    }
  }

  // Companion plugin
  if (mod.companionPlugin) {
    const pluginDir = path.join(PATHS.pluginsDir, mod.companionPlugin);
    if (fileExists(pluginDir)) {
      const pluginFiles = collectFiles(pluginDir);
      for (const f of pluginFiles) {
        files.push({ path: 'companion-plugin/' + f.path, data: f.data });
      }
    }
  }

  const zipBuffer = createZip(files);

  return {
    ok: true,
    filename: `${mod.id}-module-${mod.version}.zip`,
    data: zipBuffer,
    manifest,
  };
}

// ---------------------------------------------------------------------------
// Module Import — extract a .zip package and install
// ---------------------------------------------------------------------------

function importModule(zipBuffer) {
  let files;
  try {
    files = parseZip(zipBuffer);
  } catch (err) {
    return { ok: false, error: 'Failed to read zip — ' + err.message };
  }
  if (files.length === 0) return { ok: false, error: 'Empty archive' };

  // Find manifest
  const manifestFile = files.find(f => f.path === 'manifest.json');
  if (!manifestFile) return { ok: false, error: 'No manifest.json found in package' };

  let manifest;
  try { manifest = JSON.parse(manifestFile.data.toString('utf8')); }
  catch { return { ok: false, error: 'Invalid manifest.json' }; }

  if (!manifest.id || !manifest.name) return { ok: false, error: 'manifest.json missing required fields (id, name)' };

  const folder = manifest.folder || manifest.id;
  const moduleDir = path.join(PATHS.modulesDir, folder);

  fs.rmSync(moduleDir, { recursive: true, force: true });

  // Extract module files
  const moduleFiles = files.filter(f => f.path.startsWith('module/'));
  if (moduleFiles.length === 0) return { ok: false, error: 'No module files found in package' };

  safeExtractFiles(moduleFiles, /^module\//, moduleDir);

  // Extract tab stubs
  const routeStubs = files.filter(f => f.path.startsWith('route-stubs/'));
  for (const file of routeStubs) {
    const filename = path.basename(file.path);
    const destPath = path.join(PATHS.tabsDir, filename);
    fs.writeFileSync(destPath, file.data);
  }

  // Extract non-tab app route directories (app-routes/<prefix>/...)
  // Replace each target app/<prefix>/ folder to keep the state clean on update.
  const appRouteFiles = files.filter(f => f.path.startsWith('app-routes/'));
  const touchedPrefixes = new Set();
  for (const file of appRouteFiles) {
    const rest = file.path.slice('app-routes/'.length);
    const firstSlash = rest.indexOf('/');
    if (firstSlash === -1) continue;
    const prefix = rest.slice(0, firstSlash);
    if (!prefix || prefix.includes('..') || prefix.startsWith('.')) continue;
    if (!touchedPrefixes.has(prefix)) {
      const prefixDir = path.join(PATHS.appDir, prefix);
      if (fileExists(prefixDir)) fs.rmSync(prefixDir, { recursive: true, force: true });
      touchedPrefixes.add(prefix);
    }
  }
  for (const prefix of touchedPrefixes) {
    const prefixDir = path.join(PATHS.appDir, prefix);
    const scoped = appRouteFiles.filter(f => f.path.startsWith(`app-routes/${prefix}/`));
    safeExtractFiles(scoped, new RegExp(`^app-routes/${prefix}/`), prefixDir);
  }

  // Extract companion plugin
  const pluginFiles = files.filter(f => f.path.startsWith('companion-plugin/'));
  if (pluginFiles.length > 0 && manifest.companionPlugin) {
    const pluginDir = path.join(PATHS.pluginsDir, manifest.companionPlugin);
    fs.mkdirSync(pluginDir, { recursive: true });
    safeExtractFiles(pluginFiles, /^companion-plugin\//, pluginDir);
  }

  // Register in _registry.ts
  const result = toggleModule(manifest.id, true);

  return {
    ok: true,
    message: `${manifest.name} v${manifest.version} installed (${moduleFiles.length} files)`,
    manifest,
    registryResult: result,
  };
}

// ---------------------------------------------------------------------------

module.exports = {
  parseModuleManifest,
  getInstalledModules,
  toggleModule,
  removeModule,
  exportModule,
  importModule,
};
