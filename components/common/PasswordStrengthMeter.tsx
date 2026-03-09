// =============================================================================
// PASSWORD STRENGTH METER — Advisory strength indicator for password fields
// =============================================================================
// Renders a thin colored bar + label showing password strength as the user types.
// Purely advisory — does NOT block form submission.
// Algorithm is kept in sync with the web version in
// companion plugins/tbc-fluent-profiles/assets/js/registration.js getPasswordStrength()
// =============================================================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';

// -----------------------------------------------------------------------------
// Strength algorithm (keep in sync with registration.js getPasswordStrength)
// -----------------------------------------------------------------------------

type StrengthLevel = 'weak' | 'medium' | 'strong';

interface StrengthResult {
  level: StrengthLevel;
  label: string;
  percent: number;
}

const STRENGTH_MAP: StrengthResult[] = [
  { level: 'weak', label: 'Very weak', percent: 10 },
  { level: 'weak', label: 'Weak', percent: 25 },
  { level: 'weak', label: 'Weak', percent: 40 },
  { level: 'medium', label: 'Fair', percent: 55 },
  { level: 'medium', label: 'Good', percent: 70 },
  { level: 'strong', label: 'Strong', percent: 85 },
  { level: 'strong', label: 'Very strong', percent: 100 },
];

function getPasswordStrength(pw: string): StrengthResult | null {
  if (!pw) return null;

  let score = 0;
  if (pw.length >= 4) score++;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;

  return STRENGTH_MAP[score];
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

interface PasswordStrengthMeterProps {
  password: string;
}

export const PasswordStrengthMeter = React.memo(function PasswordStrengthMeter({
  password,
}: PasswordStrengthMeterProps) {
  const { colors } = useTheme();
  const strength = getPasswordStrength(password);

  if (!strength) return null;

  const colorMap: Record<StrengthLevel, string> = {
    weak: colors.error,
    medium: colors.warning,
    strong: colors.success,
  };

  const fillColor = colorMap[strength.level];

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: strength.percent, text: strength.label }}
    >
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.fill,
            { width: `${strength.percent}%`, backgroundColor: fillColor },
          ]}
        />
      </View>
      <Text style={[styles.label, { color: fillColor }]}>{strength.label}</Text>
    </View>
  );
});

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  track: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  label: {
    fontSize: typography.size.xs,
  },
});
