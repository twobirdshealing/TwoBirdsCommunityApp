// =============================================================================
// REPORT MODAL - Report post or comment to moderators
// =============================================================================
// Shared modal for reporting content. Uses Fluent Community Pro's built-in
// moderation API. Server handles duplicate prevention & moderator protection.
// =============================================================================

import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, sizing, typography } from '@/constants/layout';
import { withOpacity } from '@/constants/colors';
import { Button } from '@/components/common/Button';
import { submitReport, ReportData } from '@/services/api/moderation';
import { hapticLight, hapticWarning } from '@/utils/haptics';
import { createLogger } from '@/utils/logger';

const log = createLogger('ReportModal');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  contentType: 'post' | 'comment';
  postId: number;
  parentId?: number;
  userId: number;
}

const REPORT_REASONS = [
  'Spam',
  'Harassment or Bullying',
  'Misinformation',
  'Inappropriate Content',
  'Hate Speech',
  'Other',
] as const;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ReportModal({ visible, onClose, contentType, postId, parentId, userId }: ReportModalProps) {
  const { colors } = useTheme();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);

  const label = contentType === 'post' ? 'Post' : 'Comment';

  const handleClose = () => {
    setSelectedReason(null);
    setExplanation('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedReason) return;
    if (selectedReason === 'Other' && !explanation.trim()) {
      Alert.alert('Details Required', 'Please describe the issue when selecting "Other".');
      return;
    }

    hapticWarning();
    setLoading(true);

    try {
      const data: ReportData = {
        content_type: contentType,
        reason: selectedReason,
        post_id: postId,
        user_id: userId,
        ...(contentType === 'comment' && { parent_id: parentId! }),
        ...(explanation.trim() && { explanation: explanation.trim() }),
      } as ReportData;

      const response = await submitReport(data);

      if (response.success) {
        handleClose();
        Alert.alert('Report Submitted', 'Thank you. A moderator will review as soon as possible.');
      } else {
        const msg = response.error?.message || 'Something went wrong.';
        Alert.alert('Unable to Report', msg);
      }
    } catch (err) {
      log.error('Report failed:', err);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <Pressable
            style={[styles.container, { backgroundColor: colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>Report {label}</Text>
              <Pressable onPress={handleClose} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Why are you reporting this {label.toLowerCase()}?
            </Text>

            <ScrollView style={styles.scroll} bounces={false}>
              {/* Reason List */}
              {REPORT_REASONS.map((reason) => {
                const isSelected = selectedReason === reason;
                return (
                  <Pressable
                    key={reason}
                    style={[
                      styles.reasonRow,
                      { borderBottomColor: colors.borderLight },
                      isSelected && { backgroundColor: withOpacity(colors.primary, 0.08) },
                    ]}
                    onPress={() => { hapticLight(); setSelectedReason(reason); }}
                  >
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={22}
                      color={isSelected ? colors.primary : colors.textTertiary}
                      style={styles.radioIcon}
                    />
                    <Text style={[styles.reasonText, { color: colors.text }]}>{reason}</Text>
                  </Pressable>
                );
              })}

              {/* Explanation */}
              {selectedReason && (
                <View style={styles.explanationWrap}>
                  <Text style={[styles.explanationLabel, { color: colors.textSecondary }]}>
                    Additional details {selectedReason === 'Other' ? '' : '(optional)'}
                  </Text>
                  <TextInput
                    style={[
                      styles.explanationInput,
                      {
                        color: colors.text,
                        backgroundColor: colors.background,
                        borderColor: colors.borderLight,
                      },
                    ]}
                    placeholder="Describe the issue..."
                    placeholderTextColor={colors.textTertiary}
                    value={explanation}
                    onChangeText={setExplanation}
                    multiline
                    maxLength={1000}
                    textAlignVertical="top"
                  />
                </View>
              )}
            </ScrollView>

            {/* Submit */}
            <View style={styles.footer}>
              <Button
                title="Submit Report"
                variant="destructive"
                onPress={handleSubmit}
                loading={loading}
                disabled={!selectedReason}
              />
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },

  keyboardView: {
    width: '100%',
    maxWidth: 400,
  },

  container: {
    borderRadius: sizing.borderRadius.lg,
    maxHeight: '90%',
    overflow: 'hidden',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },

  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
  },

  subtitle: {
    fontSize: typography.size.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },

  scroll: {
    flexGrow: 0,
  },

  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
  },

  radioIcon: {
    marginRight: spacing.md,
  },

  reasonText: {
    fontSize: typography.size.md,
    flex: 1,
  },

  explanationWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },

  explanationLabel: {
    fontSize: typography.size.sm,
    marginBottom: spacing.xs,
  },

  explanationInput: {
    borderWidth: 1,
    borderRadius: sizing.borderRadius.sm,
    padding: spacing.md,
    fontSize: typography.size.md,
    minHeight: 80,
  },

  footer: {
    padding: spacing.lg,
  },
});
