/**
 * TBC Docs — Theme Toggle + Ionicons Loader
 *
 * - Detects system preference (prefers-color-scheme)
 * - Remembers user choice in localStorage
 * - Toggle button (sun/moon) at top-right
 * - Loads Ionicons from CDN
 */

// Ionicons (loaded as ES module with nomodule fallback)
(function() {
  var esm = document.createElement('script');
  esm.type = 'module';
  esm.src = 'https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js';
  document.head.appendChild(esm);

  var nomod = document.createElement('script');
  nomod.noModule = true;
  nomod.src = 'https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.js';
  document.head.appendChild(nomod);
})();

// Theme toggle
(function() {
  // Apply saved or system theme immediately
  var saved = localStorage.getItem('tbc-docs-theme');
  if (!saved) {
    saved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  // Create toggle button when DOM is ready
  function createToggle() {
    var btn = document.createElement('button');
    btn.className = 'docs-theme-toggle';
    btn.id = 'docs-theme-toggle';
    btn.title = 'Toggle light/dark mode';
    btn.innerHTML = saved === 'dark' ? '\u263E' : '\u2600';
    btn.addEventListener('click', function() {
      var html = document.documentElement;
      var current = html.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      if (next === 'dark') {
        html.setAttribute('data-theme', 'dark');
      } else {
        html.removeAttribute('data-theme');
      }
      localStorage.setItem('tbc-docs-theme', next);
      btn.innerHTML = next === 'dark' ? '\u263E' : '\u2600';
    });
    document.body.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createToggle);
  } else {
    createToggle();
  }
})();
