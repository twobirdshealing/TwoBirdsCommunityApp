// =============================================================================
// SHARED VERIFICATION STEP STYLES
// =============================================================================
// Used by EmailVerifyStep and PhoneOtpStep

import { StyleSheet } from 'react-native';
import { spacing, typography, sizing } from '@/constants/layout';

export const verificationStyles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },

  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
  },

  subtitle: {
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  inputContainer: {
    marginBottom: spacing.lg,
  },

  input: {
    borderWidth: 1,
    borderRadius: sizing.borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
  },

  otpInput: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
    letterSpacing: 8,
  },

  errorContainer: {
    borderWidth: 1,
    borderRadius: sizing.borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },

  errorText: {
    fontSize: typography.size.sm,
    textAlign: 'center',
  },

  buttonMargin: {
    marginTop: spacing.md,
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.lg,
  },

  action: {
    paddingVertical: spacing.xs,
  },

  linkText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },

  linkButton: {
    marginTop: spacing.sm,
  },
});
