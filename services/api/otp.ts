// =============================================================================
// UNIVERSAL OTP SERVICE - Single set of OTP functions for all contexts
// =============================================================================
// Replaces context-specific OTP functions (registration, password, profile).
// All contexts use the same /otp/verify, /otp/resend, /otp/voice endpoints
// on the tbc-otp plugin (tbc-otp/v1).
// =============================================================================

import { TBC_OTP_URL } from '@/constants/config';
import { createLogger } from '@/utils/logger';

const log = createLogger('OtpAPI');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface OtpVerifyResponse {
  success: boolean;
  verified?: boolean;
  message?: string;
  // Password recovery context only:
  reset_token?: string;
  login?: string;
}

export interface OtpResponse {
  success: boolean;
  message?: string;
}

// -----------------------------------------------------------------------------
// Helper: Public request to TBC-CA OTP endpoints
// -----------------------------------------------------------------------------

async function otpRequest<T>(
  endpoint: string,
  body: Record<string, any>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const response = await fetch(`${TBC_OTP_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data?.message || `Request failed with status ${response.status}`,
      };
    }

    return { success: true, data };
  } catch (error) {
    log.error(error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network request failed',
    };
  }
}

// -----------------------------------------------------------------------------
// API Functions
// -----------------------------------------------------------------------------

/**
 * POST /otp/verify - Verify an OTP code for any session context.
 *
 * For registration/profile: returns { success, verified }
 * For password recovery: also returns { reset_token, login }
 */
export async function verifyOtp(sessionKey: string, code: string): Promise<OtpVerifyResponse> {
  const result = await otpRequest<OtpVerifyResponse>('/otp/verify', {
    session_key: sessionKey,
    code,
  });

  if (result.success) {
    return result.data;
  }

  return {
    success: false,
    message: result.error,
  };
}

/**
 * POST /otp/resend - Resend OTP SMS for any session.
 */
export async function resendOtp(sessionKey: string): Promise<OtpResponse> {
  const result = await otpRequest<OtpResponse>('/otp/resend', {
    session_key: sessionKey,
  });

  if (result.success) {
    return result.data;
  }

  return {
    success: false,
    message: result.error,
  };
}

/**
 * POST /otp/voice - Request voice call OTP for any session.
 */
export async function requestVoiceCall(sessionKey: string): Promise<OtpResponse> {
  const result = await otpRequest<OtpResponse>('/otp/voice', {
    session_key: sessionKey,
  });

  if (result.success) {
    return result.data;
  }

  return {
    success: false,
    message: result.error,
  };
}

// -----------------------------------------------------------------------------
// Export as object for convenience
// -----------------------------------------------------------------------------

export const otpApi = {
  verifyOtp,
  resendOtp,
  requestVoiceCall,
};

export default otpApi;
