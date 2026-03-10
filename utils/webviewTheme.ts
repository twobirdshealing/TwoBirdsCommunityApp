// =============================================================================
// WebView Theme Injection - Syncs app dark mode to Fluent Community WebViews
// =============================================================================

export function getThemeInjectionScript(isDark: boolean): string {
  const mode = isDark ? 'dark' : 'light';
  return `(function() {
    try {
      var mode = '${mode}';
      var storage = {};
      try { storage = JSON.parse(localStorage.getItem('fcom_global_storage') || '{}'); } catch(e) {}
      storage.fcom_color_mode = mode;
      localStorage.setItem('fcom_global_storage', JSON.stringify(storage));
      document.cookie = 'fcom_color_mode=' + mode + ';path=/;max-age=31536000';
      if (mode === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-color-mode', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-color-mode', 'light');
      }
    } catch(e) {}
    true;
  })();`;
}
