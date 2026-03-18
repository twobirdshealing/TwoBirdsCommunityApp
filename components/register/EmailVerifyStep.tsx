// =============================================================================
// EMAIL VERIFY STEP - Registration step 3: verify email with 6-digit code
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { withOpacity } from '@/constants/colors';
import { Button } from '@/components/common/Button';
import { hapticMedium } from '@/utils/haptics';
import { verificationStyles as styles } from './styles';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface EmailVerifyStepProps {
  email: string;
  verificationToken: string;
  submitting: boolean;
  /** Called with (code, token) when user taps Verify. Returns error string or null. */
  onVerify: (code: string, token: string) => Promise<string | null>;
  /** Called to resend — should return a new token (or null on failure) */
  onResend: () => Promise<{ token?: string; error?: string } | void>;
  onBack: () => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function EmailVerifyStep({
  email,
  verificationToken,
  submitting,
  onVerify,
  onResend,
  onBack,
}: EmailVerifyStepProps) {
  const { colors: themeColors } = useTheme();
  const [code, setCode] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Resend countdown
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleVerify = useCallback(async () => {
    hapticMedium();
    setError(null);

    if (!code.length) {
      setError('Please enter the verification code from your email.');
      return;
    }

    const errorMsg = await onVerify(code, verificationToken);
    if (errorMsg) {
      setError(errorMsg);
    }
  }, [code, verificationToken, onVerify]);

  const handleResend = useCallback(async () => {
    if (resendTimer > 0) return;
    setError(null);

    const result = await onResend();
    if (result?.error) {
      setError(result.error);
    } else {
      setResendTimer(60);
      setCode('');
    }
  }, [resendTimer, onResend]);

  return (
    <>
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text }]}>
          Verify Your Email
        </Text>
        <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
          Enter the 6-digit code sent to {email || 'your email'}
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            styles.otpInput,
            {
              backgroundColor: themeColors.background,
              borderColor: themeColors.border,
              color: themeColors.text,
            },
          ]}
          value={code}
          onChangeText={(text) => setCode(text.replace(/[^0-9]/g, ''))}
          placeholder="000000"
          placeholderTextColor={themeColors.textTertiary}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
        />
      </View>

      {error ? (
        <View style={[styles.errorContainer, { backgroundColor: themeColors.errorLight, borderColor: withOpacity(themeColors.error, 0.3) }]}>
          <Text style={[styles.errorText, { color: themeColors.error }]}>{error}</Text>
        </View>
      ) : null}

      <Button
        title="Verify Email"
        onPress={handleVerify}
        loading={submitting}
        style={styles.buttonMargin}
      />

      <View style={styles.actions}>
        <Pressable
          onPress={handleResend}
          disabled={resendTimer > 0}
          style={styles.action}
        >
          <Text style={[
            styles.linkText,
            { color: resendTimer > 0 ? themeColors.textTertiary : themeColors.primary },
          ]}>
            {resendTimer > 0 ? `Resend code (${resendTimer}s)` : 'Resend code'}
          </Text>
        </Pressable>
      </View>

      <Button
        title="Go Back"
        variant="text"
        onPress={onBack}
        style={styles.linkButton}
      />
    </>
  );
}
