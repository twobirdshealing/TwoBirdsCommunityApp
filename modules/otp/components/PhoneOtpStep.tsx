// =============================================================================
// PHONE OTP STEP - Verify phone number via SMS/voice code
// =============================================================================

import React from 'react';
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
import type { OtpVerificationState } from '../hooks/useOtpVerification';
import { verificationStyles as styles } from '@/components/register/styles';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface PhoneOtpStepProps {
  otp: OtpVerificationState;
  submitting: boolean;
  onBack: () => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function PhoneOtpStep({
  otp,
  submitting,
  onBack,
}: PhoneOtpStepProps) {
  const { colors: themeColors } = useTheme();

  return (
    <>
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text }]}>
          Verify Your Phone
        </Text>
        <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
          Enter the code sent to {otp.phoneMasked}
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
          value={otp.code}
          onChangeText={(text) => otp.setCode(text.replace(/[^0-9]/g, ''))}
          placeholder="0000"
          placeholderTextColor={themeColors.textTertiary}
          keyboardType="number-pad"
          maxLength={8}
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          autoFocus
        />
      </View>

      {otp.error ? (
        <View style={[styles.errorContainer, { backgroundColor: themeColors.errorLight, borderColor: withOpacity(themeColors.error, 0.3) }]}>
          <Text style={[styles.errorText, { color: themeColors.error }]}>{otp.error}</Text>
        </View>
      ) : null}

      <Button
        title="Verify"
        onPress={() => { hapticMedium(); otp.handleVerify(); }}
        loading={otp.verifying || submitting}
        style={styles.buttonMargin}
      />

      <View style={styles.actions}>
        <Pressable
          onPress={otp.handleResend}
          disabled={otp.resendTimer > 0}
          style={styles.action}
        >
          <Text style={[
            styles.linkText,
            { color: otp.resendTimer > 0 ? themeColors.textTertiary : themeColors.primary },
          ]}>
            {otp.resendTimer > 0 ? `Resend code (${otp.resendTimer}s)` : 'Resend code'}
          </Text>
        </Pressable>
        {otp.voiceFallback && (
          <Pressable onPress={otp.handleVoiceCall} style={styles.action}>
            <Text style={[styles.linkText, { color: themeColors.primary }]}>
              Try voice call
            </Text>
          </Pressable>
        )}
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
