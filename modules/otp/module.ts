// =============================================================================
// OTP MODULE - Phone OTP verification during registration
// =============================================================================
// Add-on module that adds a phone OTP verification step to the registration
// flow. Requires the tbc-otp WordPress plugin to be installed.
// =============================================================================

import type { ModuleManifest } from '../_types';
import { OtpRegistrationStep } from './components/OtpRegistrationStep';

export const otpModule: ModuleManifest = {
  id: 'otp',
  name: 'Phone OTP Verification',
  version: '1.0.0',
  description: 'Phone number verification via SMS/voice OTP during registration',
  author: 'Two Birds Code',
  authorUrl: 'https://twobirdscode.com',
  license: 'Proprietary',
  companionPlugin: 'tbc-otp',

  registrationSteps: [
    {
      id: 'otp',
      order: 20,
      phase: 'pre-creation',
      title: 'Verify Phone',
      component: OtpRegistrationStep,
      shouldActivate: ({ submitResponse }) =>
        !!(submitResponse?.otp_required && submitResponse?.session_key),
    },
  ],
};
