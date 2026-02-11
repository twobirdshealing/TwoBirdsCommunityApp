// =============================================================================
// MODAL SCREEN - Generic modal for the app
// =============================================================================

import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ModalScreen() {
  const router = useRouter();
  const { colors: themeColors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={[styles.content, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.title, { color: themeColors.text }]}>Modal</Text>
        <Text style={[styles.message, { color: themeColors.textSecondary }]}>This is a modal screen.</Text>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: themeColors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.buttonText, { color: themeColors.surface }]}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  
  content: {
    padding: spacing.xl,
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  
  title: {
    fontSize: typography.size.xl,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  
  message: {
    fontSize: typography.size.md,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  
  button: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 8,
  },
  
  buttonText: {
    fontSize: typography.size.md,
    fontWeight: '600',
  },
});