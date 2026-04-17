// =============================================================================
// LOGIN GATE SCREEN - Profile completion for returning users
// =============================================================================
// Shown to authenticated users who logged in but have an incomplete profile.
// Uses the same ProfileCompletionSteps component as the registration flow.
// The ProfileIncompleteProvider handles detecting incomplete profiles and
// routing here; this screen handles the actual completion UI.
// =============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ProfileCompletionSteps } from '../components/ProfileCompletionSteps';
import { checkProfileComplete, type ProfileExistingData } from '../services/profileCompletion';

export default function LoginGateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors: themeColors } = useTheme();
  const [existing, setExisting] = useState<ProfileExistingData | undefined>();
  const [missingFields, setMissingFields] = useState<string[] | undefined>();
  const [loading, setLoading] = useState(true);

  const avatarRequired = useMemo(
    () => missingFields?.includes('avatar') ?? true,
    [missingFields]
  );

  // Block Android back button — this is a gate, not a dismissable screen
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  // Fetch existing profile data on mount so the form pre-populates
  useEffect(() => {
    checkProfileComplete()
      .then(status => {
        setExisting(status.existing);
        setMissingFields(status.missing);
      })
      .catch(() => {}) // On error, form opens with empty fields — non-blocking
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={[styles.screen, { backgroundColor: themeColors.background }]}>
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top }]}
        behavior="padding"
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <ActivityIndicator color={themeColors.primary} style={{ paddingVertical: spacing.xl }} />
          ) : (
            <ProfileCompletionSteps
              username={user?.username || ''}
              displayName={user?.displayName || ''}
              onComplete={() => router.replace('/(tabs)')}
              existing={existing}
              avatarRequired={avatarRequired}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={{ height: insets.bottom }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  container: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
});
