// =============================================================================
// PROFILE COMPLETE SCREEN - Standalone profile completion gate
// =============================================================================
// Shown to authenticated users who logged in but have an incomplete profile.
// Uses the same ProfileCompletionSteps component as the registration flow.
// =============================================================================

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ImageBackground, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, sizing } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { withOpacity } from '@/constants/colors';
import { ProfileCompletionSteps } from '@/components/profile/ProfileCompletionSteps';
import { checkProfileComplete, type ProfileExistingData } from '@/services/api/registration';

export default function ProfileCompleteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, markProfileComplete } = useAuth();
  const { colors: themeColors } = useTheme();
  const [existing, setExisting] = useState<ProfileExistingData | undefined>();
  const [loading, setLoading] = useState(true);

  // Fetch existing profile data on mount so the form pre-populates
  useEffect(() => {
    checkProfileComplete()
      .then(status => setExisting(status.existing))
      .catch(() => {}) // On error, form opens with empty fields — non-blocking
      .finally(() => setLoading(false));
  }, []);

  return (
    <ImageBackground
      source={require('@/assets/images/login_background_img.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top }]}
        behavior="padding"
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Image
              source={require('@/assets/images/login_logo.png')}
              style={styles.logo}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          </View>

          <View style={[styles.formCard, { backgroundColor: withOpacity(themeColors.surface, 0.95) }]}>
            {loading ? (
              <ActivityIndicator color={themeColors.primary} style={{ paddingVertical: spacing.xl }} />
            ) : (
              <ProfileCompletionSteps
                username={user?.username || ''}
                displayName={user?.displayName || ''}
                onComplete={() => { markProfileComplete(); router.replace('/(tabs)'); }}
                existing={existing}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={{ height: insets.bottom }} />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },

  container: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },

  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },

  logo: {
    width: 80,
    height: 80,
  },

  formCard: {
    borderRadius: sizing.borderRadius.lg,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
});
