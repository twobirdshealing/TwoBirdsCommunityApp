// =============================================================================
// REGISTRATION API SERVICE - Mobile app registration endpoints
// =============================================================================
// Base registration endpoints are on tbc-community-app (tbc-ca/v1).
// OTP endpoints are on tbc-otp plugin (tbc-otp/v1).
// These are PUBLIC endpoints (no auth required).
// =============================================================================

import { TBC_CA_URL } from '@/constants/config';
import { verifyOtp, resendOtp, requestVoiceCall } from './otp';
import { createLogger } from '@/utils/logger';

const log = createLogger('RegistrationAPI');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RegistrationField {
  label: string;
  placeholder?: string;
  instructions?: string;
  type: 'text' | 'email' | 'password' | 'phone' | 'date' | 'number' | 'select' | 'radio' | 'gender' | 'textarea' | 'url' | 'inline_checkbox' | 'checkbox' | 'multiselect';
  input_type?: string;
  required: boolean;
  options?: string[];
  inline_label?: string;
  step: number;
}

export interface FieldsResponse {
  registration_enabled: boolean;
  email_verification_required: boolean;
  fields: Record<string, RegistrationField>;
  message?: string;
  // Legacy fields (from tbc-registration, no longer returned by tbc-ca base endpoint)
  otp_required?: boolean;
  voice_fallback?: boolean;
  profile_completion?: {
    enabled: boolean;
    require_bio: boolean;
    require_avatar: boolean;
  };
}

export interface RegisterResponse {
  success: boolean;
  access_token?: string;
  refresh_token?: string;
  user?: {
    id: number;
    username: string;
    display_name: string;
    email: string;
  };
  otp_required?: boolean;
  session_key?: string;
  phone_masked?: string;
  email_verification_required?: boolean;
  verification_token?: string;
  message?: string;
  errors?: Record<string, string>;
}

// OTP types re-exported from universal otp service
export type { OtpResponse, OtpVerifyResponse } from './otp';

export interface ForgotPasswordResponse {
  success: boolean;
  otp_sent?: boolean;
  email_sent?: boolean;
  session_key?: string;
  phone_masked?: string;
  voice_fallback?: boolean;
  message?: string;
}

// PasswordVerifyResponse is now OtpVerifyResponse from otp.ts (same shape)
export type { OtpVerifyResponse as PasswordVerifyResponse } from './otp';

export interface PasswordResetResponse {
  success: boolean;
  message?: string;
}

// -----------------------------------------------------------------------------
// Helper: Make public (unauthenticated) request to TBC Registration endpoints
// -----------------------------------------------------------------------------

async function tbcPublicRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  baseUrl: string = TBC_CA_URL
): Promise<{ success: true; data: T } | { success: false; error: string; data?: Record<string, unknown> }> {
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok && !data.otp_required) {
      return {
        success: false,
        error: data?.message || `Request failed with status ${response.status}`,
        data,
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
 * GET /auth/register/fields - Get registration form field definitions
 */
export async function getRegistrationFields(): Promise<FieldsResponse | null> {
  const result = await tbcPublicRequest<FieldsResponse>('/auth/register/fields');
  if (result.success) {
    return result.data;
  }
  log.error('Failed to get fields:', result.error);
  return null;
}

/**
 * POST /auth/register - Submit registration data
 * May return otp_required if phone OTP verification is needed (via tbc-otp plugin hook).
 */
export async function submitRegistration(data: Record<string, any>): Promise<RegisterResponse> {
  const result = await tbcPublicRequest<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (result.success) {
    return result.data;
  }

  return {
    success: false,
    message: result.error,
    errors: 'data' in result ? result.data?.errors as Record<string, string> | undefined : undefined,
  };
}

// OTP functions re-exported from universal otp service
export { verifyOtp, resendOtp, requestVoiceCall };

// -----------------------------------------------------------------------------
// Password Reset API Functions
// -----------------------------------------------------------------------------

/**
 * POST /password/forgot - Initiate password reset (sends OTP or email)
 */
export async function forgotPassword(login: string): Promise<ForgotPasswordResponse> {
  const result = await tbcPublicRequest<ForgotPasswordResponse>('/password/forgot', {
    method: 'POST',
    body: JSON.stringify({ login }),
  }, TBC_CA_URL);

  if (result.success) {
    return result.data;
  }

  return {
    success: false,
    message: result.error,
  };
}

// Password OTP functions — aliases to universal otp service
export const verifyPasswordOtp = verifyOtp;
export const resendPasswordOtp = resendOtp;
export const requestPasswordVoiceCall = requestVoiceCall;

/**
 * POST /password/reset - Set new password with reset token
 */
export async function resetPassword(
  resetToken: string,
  login: string,
  newPassword: string
): Promise<PasswordResetResponse> {
  const result = await tbcPublicRequest<PasswordResetResponse>('/password/reset', {
    method: 'POST',
    body: JSON.stringify({ reset_token: resetToken, login, new_password: newPassword }),
  }, TBC_CA_URL);

  if (result.success) {
    return result.data;
  }

  return {
    success: false,
    message: result.error,
  };
}

// -----------------------------------------------------------------------------
// Export as object for consistency with other API services
// -----------------------------------------------------------------------------

export const registrationApi = {
  getRegistrationFields,
  submitRegistration,
  verifyOtp,
  resendOtp,
  requestVoiceCall,
  forgotPassword,
  verifyPasswordOtp,
  resendPasswordOtp,
  requestPasswordVoiceCall,
  resetPassword,
};

export default registrationApi;
