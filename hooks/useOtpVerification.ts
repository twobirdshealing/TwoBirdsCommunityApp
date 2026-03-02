// =============================================================================
// USE OTP VERIFICATION - Shared OTP state & handlers
// =============================================================================
// Extracts the duplicated OTP verification logic used by both the registration
// wizard (register.tsx) and the profile editor (profile/edit.tsx).
//
// Manages: code input, session key, phone mask, resend timer, voice fallback,
// error/loading state, and verify/resend/voice-call handlers.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { verifyOtp, resendOtp, requestVoiceCall } from '@/services/api/otp';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface UseOtpVerificationOptions {
  /** Called after OTP is successfully verified, with the session key */
  onVerified: (sessionKey: string) => void | Promise<void>;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useOtpVerification({ onVerified }: UseOtpVerificationOptions) {
  const [code, setCode] = useState('');
  const [sessionKey, setSessionKey] = useState('');
  const [phoneMasked, setPhoneMasked] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [voiceFallback, setVoiceFallback] = useState(false);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  // ---------------------------------------------------------------------------
  // Resend countdown timer
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // ---------------------------------------------------------------------------
  // Start a new OTP session (called by the consumer when server returns OTP data)
  // ---------------------------------------------------------------------------

  const start = useCallback((opts: {
    sessionKey: string;
    phoneMasked?: string;
    voiceFallback?: boolean;
  }) => {
    setSessionKey(opts.sessionKey);
    setPhoneMasked(opts.phoneMasked || '');
    setVoiceFallback(opts.voiceFallback || false);
    setCode('');
    setError('');
    setResendTimer(60);
  }, []);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleVerify = useCallback(async () => {
    if (verifying) return;

    if (!code.length) {
      setError('Please enter the verification code.');
      return;
    }

    setError('');
    setVerifying(true);

    try {
      const result = await verifyOtp(sessionKey, code);

      if (result.success) {
        setVerifying(false);
        await onVerified(sessionKey);
      } else {
        setError(result.message || 'Invalid code. Please try again.');
      }
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  }, [code, sessionKey, verifying, onVerified]);

  const handleResend = useCallback(async () => {
    if (resendTimer > 0) return;

    try {
      const result = await resendOtp(sessionKey);
      if (result.success) {
        setResendTimer(60);
        setError('');
      } else {
        setError(result.message || 'Failed to resend code.');
      }
    } catch {
      setError('Failed to resend code.');
    }
  }, [sessionKey, resendTimer]);

  const handleVoiceCall = useCallback(async () => {
    try {
      const result = await requestVoiceCall(sessionKey);
      if (result.success) {
        setResendTimer(60);
        setError('');
      } else {
        setError(result.message || 'Failed to initiate call.');
      }
    } catch {
      setError('Failed to initiate call.');
    }
  }, [sessionKey]);

  const reset = useCallback(() => {
    setCode('');
    setSessionKey('');
    setPhoneMasked('');
    setResendTimer(0);
    setVoiceFallback(false);
    setError('');
    setVerifying(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    // State
    code,
    setCode,
    sessionKey,
    phoneMasked,
    resendTimer,
    voiceFallback,
    error,
    setError,
    verifying,

    // Actions
    start,
    handleVerify,
    handleResend,
    handleVoiceCall,
    reset,
  };
}
