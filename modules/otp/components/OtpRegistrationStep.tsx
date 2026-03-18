// =============================================================================
// OTP REGISTRATION STEP - Wrapper for PhoneOtpStep in the registration flow
// =============================================================================
// Manages the useOtpVerification hook internally and renders PhoneOtpStep.
// Receives standard RegistrationStepProps from the register screen.
// =============================================================================

import React, { useCallback, useEffect, useRef } from 'react';
import type { RegistrationStepProps } from '../../_types';
import { useOtpVerification } from '@/hooks/useOtpVerification';
import { PhoneOtpStep } from './PhoneOtpStep';

export function OtpRegistrationStep({
  submitResponse,
  submitting,
  onResubmit,
  onBack,
}: RegistrationStepProps) {
  const started = useRef(false);

  const handleVerified = useCallback(async (sessionKey: string) => {
    await onResubmit({ tbc_otp_session_key: sessionKey });
  }, [onResubmit]);

  const otp = useOtpVerification({
    onVerified: handleVerified,
  });

  // Start OTP session on mount
  useEffect(() => {
    if (!started.current && submitResponse.session_key) {
      started.current = true;
      otp.start({
        sessionKey: submitResponse.session_key,
        phoneMasked: submitResponse.phone_masked,
        voiceFallback: submitResponse.voice_fallback,
      });
    }
  }, [submitResponse.session_key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PhoneOtpStep
      otp={otp}
      submitting={submitting}
      onBack={onBack}
    />
  );
}
