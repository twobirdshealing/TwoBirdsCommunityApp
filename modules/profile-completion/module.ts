// =============================================================================
// PROFILE COMPLETION MODULE - Login gate for users with incomplete profiles
// =============================================================================
// Add-on module that blocks app access until bio/avatar are completed.
// Uses ProfileIncompleteProvider to intercept the X-TBC-Profile-Incomplete
// response header and redirect to the completion screen. Requires the
// tbc-profile-completion WordPress plugin to be installed.
// =============================================================================

import type { ModuleManifest } from '../_types';
import { ProfileIncompleteProvider } from './ProfileIncompleteProvider';

export const profileCompletionModule: ModuleManifest = {
  id: 'profile-completion',
  name: 'Profile Completion',
  version: '1.0.0',
  description: 'Profile completion gate with bio and avatar requirements',
  author: 'Two Birds Code',
  authorUrl: 'https://twobirdscode.com',
  license: 'Proprietary',
  companionPlugin: 'tbc-profile-completion',
  routePrefixes: ['/profile-complete'],

  responseHeaders: [
    {
      header: 'X-TBC-Profile-Incomplete',
      key: 'profileIncomplete',
      transform: (value) => value === '1',
    },
  ],

  providers: [
    {
      id: 'profile-incomplete-guard',
      order: 90,
      component: ProfileIncompleteProvider,
    },
  ],
};
