// =============================================================================
// SOCIAL PROVIDERS - Types, icon mapping & module-level cache
// =============================================================================
// No API fetch here — data arrives via the /app-config endpoint (theme.ts)
// and is stored by ThemeContext. Components consume via useSocialProviders hook.
// =============================================================================

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface SocialProvider {
  key: string;
  title: string;
  placeholder: string;
  domain: string;
}

// -----------------------------------------------------------------------------
// Icon mapping (Ionicons name for each Fluent Community provider key)
// -----------------------------------------------------------------------------

const PROVIDER_ICON_MAP: Record<string, string> = {
  instagram: 'logo-instagram',
  twitter:   'logo-twitter',
  youtube:   'logo-youtube',
  linkedin:  'logo-linkedin',
  fb:        'logo-facebook',
  blue_sky:  'cloud-outline',
  tiktok:    'logo-tiktok',
  pinterest: 'logo-pinterest',
  telegram:  'paper-plane-outline',
  snapchat:  'logo-snapchat',
  reddit:    'logo-reddit',
  twitch:    'logo-twitch',
  vk:        'globe-outline',
  github:    'logo-github',
  mastodon:  'logo-mastodon',
};

/** Get the Ionicons name for a provider key (fallback: link-outline) */
export function getProviderIcon(key: string): string {
  return PROVIDER_ICON_MAP[key] || 'link-outline';
}

// -----------------------------------------------------------------------------
// Default fallback (matches the 5 providers currently hardcoded in the app)
// -----------------------------------------------------------------------------

export const DEFAULT_PROVIDERS: SocialProvider[] = [
  { key: 'instagram', title: 'Instagram', placeholder: 'instagram @username',  domain: 'https://instagram.com/' },
  { key: 'youtube',   title: 'YouTube',   placeholder: 'youtube @username',    domain: 'https://youtube.com/' },
  { key: 'fb',        title: 'Facebook',  placeholder: 'fb_username',          domain: 'https://facebook.com/' },
  { key: 'blue_sky',  title: 'Bluesky',   placeholder: 'bluesky_username',     domain: 'https://bsky.app/profile/' },
  { key: 'reddit',    title: 'Reddit',    placeholder: 'techjewel',            domain: 'https://www.reddit.com/user/' },
];

// -----------------------------------------------------------------------------
// Module-level cache + listener pattern
// -----------------------------------------------------------------------------

let _providers: SocialProvider[] = DEFAULT_PROVIDERS;
let _listeners: Array<() => void> = [];

/** Get the current social providers (synchronous) */
export function getSocialProviders(): SocialProvider[] {
  return _providers;
}

/** Update the cached providers and notify all listeners (called by ThemeContext) */
export function setSocialProviders(providers: SocialProvider[]) {
  if (providers.length === 0) return; // keep current if empty
  _providers = providers;
  _listeners.forEach((fn) => fn());
}

/** Subscribe to provider updates — returns unsubscribe function */
export function subscribeSocialProviders(listener: () => void): () => void {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter((fn) => fn !== listener);
  };
}

/** Clear cache (e.g. on logout) */
export function clearSocialProvidersCache() {
  _providers = DEFAULT_PROVIDERS;
}
