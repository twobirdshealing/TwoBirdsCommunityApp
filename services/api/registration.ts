// =============================================================================
// REGISTRATION API SERVICE - Mobile app registration endpoints
// =============================================================================
// Base registration endpoints are on tbc-community-app (tbc-ca/v1).
// These are PUBLIC endpoints (no auth required).
// =============================================================================

import { TBC_CA_URL } from '@/constants/config';
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
  /** Module-specific fields from server plugins */
  [key: string]: any;
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
  email_verification_required?: boolean;
  verification_token?: string;
  message?: string;
  errors?: Record<string, string>;
  /** Module-specific fields from server plugins */
  [key: string]: any;
}

export interface ForgotPasswordResponse {
  success: boolean;
  email_sent?: boolean;
  message?: string;
}

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

    if (!response.ok) {
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
  log.error(result.error, 'Failed to get fields');
  return null;
}

/**
 * POST /auth/register - Submit registration data
 * Server may return module-specific fields in error responses — these are
 * passed through so module registration steps can read them.
 */
export async function submitRegistration(data: Record<string, any>): Promise<RegisterResponse> {
  const result = await tbcPublicRequest<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (result.success) {
    return result.data;
  }

  // Spread server response first so module-specific fields are preserved,
  // then overlay success/message so server can't accidentally clobber them
  const serverData = 'data' in result ? result.data : {};
  return {
    ...serverData,
    success: false,
    message: result.error,
  } as RegisterResponse;
}

// -----------------------------------------------------------------------------
// Password Reset API Functions
// -----------------------------------------------------------------------------

/**
 * POST /password/forgot - Initiate password reset (sends reset email)
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
  forgotPassword,
  resetPassword,
};

export default registrationApi;
