// =============================================================================
// REGISTRATION API SERVICE - Mobile app registration endpoints
// =============================================================================
// Endpoints are on the TBC-CA plugin, NOT Fluent Community API.
// These are PUBLIC endpoints (no auth required).
// Follows the same pattern as push.ts for TBC-CA API calls.
// =============================================================================

import { SITE_URL } from '@/constants/config';
import { getAuthToken } from '@/services/auth';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RegistrationField {
  label: string;
  placeholder?: string;
  type: 'text' | 'email' | 'password' | 'phone' | 'date' | 'number' | 'select' | 'radio' | 'gender' | 'textarea' | 'url' | 'inline_checkbox';
  input_type?: string;
  required: boolean;
  options?: string[];
  inline_label?: string;
  step: number;
}

export interface FieldsResponse {
  registration_enabled: boolean;
  otp_required: boolean;
  voice_fallback: boolean;
  email_verification_required: boolean;
  fields: Record<string, RegistrationField>;
  message?: string;
}

export interface RegisterResponse {
  success: boolean;
  token?: string;
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

export interface OtpResponse {
  success: boolean;
  message?: string;
}

export interface ForgotPasswordResponse {
  success: boolean;
  otp_sent?: boolean;
  email_sent?: boolean;
  session_key?: string;
  phone_masked?: string;
  voice_fallback?: boolean;
  message?: string;
}

export interface PasswordVerifyResponse {
  success: boolean;
  reset_token?: string;
  login?: string;
  message?: string;
}

export interface PasswordResetResponse {
  success: boolean;
  message?: string;
}

// -----------------------------------------------------------------------------
// Base URL for TBC-CA plugin
// -----------------------------------------------------------------------------

const TBC_CA_BASE = `${SITE_URL}/wp-json/tbc-ca/v1`;

// -----------------------------------------------------------------------------
// Helper: Make public (unauthenticated) request to TBC-CA endpoints
// -----------------------------------------------------------------------------

async function tbcPublicRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: true; data: T } | { success: false; error: string; data?: any }> {
  try {
    const response = await fetch(`${TBC_CA_BASE}${endpoint}`, {
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
    console.error('[Registration API Error]', error);
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
 * GET /register/fields - Get registration form field definitions
 */
export async function getRegistrationFields(): Promise<FieldsResponse | null> {
  const result = await tbcPublicRequest<FieldsResponse>('/register/fields');
  if (result.success) {
    return result.data;
  }
  console.error('[Registration] Failed to get fields:', result.error);
  return null;
}

/**
 * POST /register - Submit registration data
 * May return otp_required if phone OTP verification is needed.
 */
export async function submitRegistration(data: Record<string, any>): Promise<RegisterResponse> {
  const result = await tbcPublicRequest<RegisterResponse>('/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (result.success) {
    return result.data;
  }

  return {
    success: false,
    message: result.error,
    errors: 'data' in result ? result.data?.errors : undefined,
  };
}

/**
 * POST /register/otp/verify - Verify an OTP code
 */
export async function verifyOtp(sessionKey: string, code: string): Promise<OtpResponse> {
  const result = await tbcPublicRequest<OtpResponse>('/register/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ session_key: sessionKey, code }),
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
 * POST /register/otp/resend - Resend OTP SMS
 */
export async function resendOtp(sessionKey: string): Promise<OtpResponse> {
  const result = await tbcPublicRequest<OtpResponse>('/register/otp/resend', {
    method: 'POST',
    body: JSON.stringify({ session_key: sessionKey }),
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
 * POST /register/otp/voice - Request voice call OTP
 */
export async function requestVoiceCall(sessionKey: string): Promise<OtpResponse> {
  const result = await tbcPublicRequest<OtpResponse>('/register/otp/voice', {
    method: 'POST',
    body: JSON.stringify({ session_key: sessionKey }),
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
 * POST /profile/avatar - Update user avatar (JWT authenticated)
 * Uses our TBC-CA endpoint with native Fluent models.
 */
export async function updateAvatar(avatarUrl: string): Promise<{ success: boolean; avatar?: string; message?: string }> {
  try {
    const token = await getAuthToken();
    if (!token) {
      return { success: false, message: 'Not authenticated.' };
    }

    const response = await fetch(`${TBC_CA_BASE}/profile/avatar`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ avatar: avatarUrl }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, message: data?.message || 'Failed to update avatar.' };
    }

    return { success: true, avatar: data?.avatar };
  } catch (error) {
    console.error('[Registration] Avatar update error:', error);
    return { success: false, message: 'Failed to update avatar.' };
  }
}

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
 * POST /password/verify - Verify OTP code for password recovery
 */
export async function verifyPasswordOtp(
  sessionKey: string,
  code: string
): Promise<PasswordVerifyResponse> {
  const result = await tbcPublicRequest<PasswordVerifyResponse>('/password/verify', {
    method: 'POST',
    body: JSON.stringify({ session_key: sessionKey, code }),
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
 * POST /password/verify - Resend OTP for password recovery
 */
export async function resendPasswordOtp(sessionKey: string): Promise<OtpResponse> {
  const result = await tbcPublicRequest<OtpResponse>('/password/verify', {
    method: 'POST',
    body: JSON.stringify({ session_key: sessionKey, action: 'resend' }),
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
 * POST /password/verify - Request voice call OTP for password recovery
 */
export async function requestPasswordVoiceCall(sessionKey: string): Promise<OtpResponse> {
  const result = await tbcPublicRequest<OtpResponse>('/password/verify', {
    method: 'POST',
    body: JSON.stringify({ session_key: sessionKey, action: 'voice' }),
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
// Export as object for consistency with other API services
// -----------------------------------------------------------------------------

export const registrationApi = {
  getRegistrationFields,
  submitRegistration,
  verifyOtp,
  resendOtp,
  requestVoiceCall,
  updateAvatar,
  forgotPassword,
  verifyPasswordOtp,
  resendPasswordOtp,
  requestPasswordVoiceCall,
  resetPassword,
};

export default registrationApi;
