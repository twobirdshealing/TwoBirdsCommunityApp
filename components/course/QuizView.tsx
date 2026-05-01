// =============================================================================
// QUIZ VIEW - Quiz-taking UI for course lessons with content_type: 'quiz'
// =============================================================================
// Shows quiz questions with radio/checkbox options, submit button, and results.
// Fetches existing result on mount (for retakes / review).
// =============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing } from '@/constants/layout';
import { withOpacity } from '@/constants/colors';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { Button } from '@/components/common/Button';
import { HtmlContent } from '@/components/common/HtmlContent';
import { coursesApi } from '@/services/api/courses';
import { QuizAnswers, QuizQuestion, QuizResult } from '@/types/course';
import { hapticMedium, hapticLight } from '@/utils/haptics';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface QuizViewProps {
  questions: QuizQuestion[];
  courseId: number;
  lessonId: number;
  passingScore: number;
  enablePassingScore: boolean;
  enforcePassingScore: boolean;
  hideResult: boolean;
  contentWidth: number;
  /** Called when quiz result is loaded or submitted (server enforces pass-to-continue independently) */
  onQuizResult?: (passed: boolean) => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function QuizView({
  questions,
  courseId,
  lessonId,
  passingScore,
  enablePassingScore,
  enforcePassingScore,
  hideResult,
  contentWidth,
  onQuizResult,
}: QuizViewProps) {
  const { colors: themeColors } = useTheme();

  const enabledQuestions = useMemo(() => questions.filter((q) => q.enabled), [questions]);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [loadingResult, setLoadingResult] = useState(true);

  // ---------------------------------------------------------------------------
  // Fetch existing result on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    (async () => {
      try {
        const response = await coursesApi.getQuizResult(courseId, lessonId);
        if (response.success && response.data.result) {
          setResult(response.data.result);
          onQuizResult?.(response.data.result.status === 'passed');
        }
      } catch {
        // No existing result — that's fine
      } finally {
        setLoadingResult(false);
      }
    })();
  }, [courseId, lessonId, onQuizResult]);

  // ---------------------------------------------------------------------------
  // Answer selection
  // ---------------------------------------------------------------------------

  const selectAnswer = (questionSlug: string, optionLabel: string, type: string) => {
    hapticLight();
    setAnswers((prev) => {
      if (type === 'multiple_choice') {
        const current = (prev[questionSlug] as string[]) || [];
        const isSelected = current.includes(optionLabel);
        return {
          ...prev,
          [questionSlug]: isSelected
            ? current.filter((l) => l !== optionLabel)
            : [...current, optionLabel],
        };
      }
      return { ...prev, [questionSlug]: optionLabel };
    });
  };

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const allAnswered = useMemo(() => enabledQuestions.every((q) => {
    const answer = answers[q.slug];
    if (!answer) return false;
    if (Array.isArray(answer)) return answer.length > 0;
    return true;
  }), [enabledQuestions, answers]);

  const handleSubmit = async () => {
    if (!allAnswered) {
      Alert.alert('Incomplete', 'Please answer all questions before submitting.');
      return;
    }

    hapticMedium();
    setSubmitting(true);

    try {
      const response = await coursesApi.submitQuiz(courseId, lessonId, answers);

      if (!response.success) {
        Alert.alert('Error', response.error?.message || 'Failed to submit quiz');
        return;
      }

      setResult(response.data.result);
      onQuizResult?.(response.data.result.status === 'passed');
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Retake
  // ---------------------------------------------------------------------------

  const handleRetake = () => {
    setResult(null);
    setAnswers({});
  };

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  if (loadingResult) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={themeColors.primary} />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Result view
  // ---------------------------------------------------------------------------

  if (result) {
    const passed = result.status === 'passed';
    const scoreColor = passed ? themeColors.success : themeColors.error;

    return (
      <View style={styles.container}>
        {/* Score card */}
        <View style={[styles.scoreCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <View style={[styles.scoreCircle, { borderColor: scoreColor }]}>
            <Text style={[styles.scoreText, { color: scoreColor }]}>{result.score}%</Text>
          </View>
          <Text style={[styles.scoreStatus, { color: scoreColor }]}>
            {passed ? 'Passed' : 'Failed'}
          </Text>
          <Text style={[styles.scoreDetail, { color: themeColors.textSecondary }]}>
            {result.meta.correct_answers} of {result.meta.total_questions} correct
          </Text>
          {enablePassingScore && (
            <Text style={[styles.passingInfo, { color: themeColors.textTertiary }]}>
              Passing score: {passingScore}%
            </Text>
          )}
          {result.meta.attempts > 1 && (
            <Text style={[styles.attemptsInfo, { color: themeColors.textTertiary }]}>
              Attempt #{result.meta.attempts}
            </Text>
          )}
        </View>

        {/* Per-question results (unless hidden) */}
        {!hideResult && result.message && (
          <View style={styles.questionsContainer}>
            {enabledQuestions.map((question, idx) => {
              const questionResult = result.message[question.slug];
              if (!questionResult) return null;
              const isCorrect = questionResult.is_correct;
              const badgeColor = isCorrect ? themeColors.success : themeColors.error;

              return (
                <View
                  key={question.slug}
                  style={[styles.resultQuestion, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                >
                  {/* Question image */}
                  {question.image_enabled && question.image_url ? (
                    <Image
                      source={{ uri: question.image_url }}
                      style={styles.questionImage}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={200}
                    />
                  ) : null}
                  <View style={styles.questionHeader}>
                    <Text style={[styles.questionNumber, { color: themeColors.textSecondary }]}>
                      Q{idx + 1}
                    </Text>
                  </View>
                  {question.label_rendered ? (
                    <HtmlContent html={question.label_rendered} contentWidth={contentWidth - spacing.xl * 2} />
                  ) : (
                    <Text style={[styles.questionLabel, { color: themeColors.text }]}>
                      {question.label.trim()}
                    </Text>
                  )}
                  <View
                    style={[
                      styles.resultBadge,
                      { backgroundColor: withOpacity(badgeColor, 0.12) },
                    ]}
                  >
                    <Ionicons
                      name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                      size={16}
                      color={badgeColor}
                    />
                    <Text style={[styles.resultBadgeText, { color: badgeColor }]}>
                      {isCorrect ? 'Correct' : 'Incorrect'}
                    </Text>
                  </View>
                  <Text style={[styles.yourAnswer, { color: themeColors.textSecondary }]}>
                    Your answer: {Array.isArray(questionResult.user_answer) ? questionResult.user_answer.join(', ') : questionResult.user_answer}
                  </Text>
                  {question.help_text ? (
                    <Text style={[styles.helpText, { color: themeColors.textTertiary }]}>
                      {question.help_text}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        {/* Retake button */}
        {(!passed || !enforcePassingScore) && (
          <Button
            title="Retake Quiz"
            icon="refresh-outline"
            onPress={handleRetake}
            variant="secondary"
            style={styles.retakeButton}
          />
        )}
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Quiz form
  // ---------------------------------------------------------------------------

  return (
    <View style={styles.container}>
      {/* Passing score info */}
      {enablePassingScore && (
        <View style={[styles.passingBanner, { backgroundColor: withOpacity(themeColors.primary, 0.1) }]}>
          <Ionicons name="information-circle-outline" size={18} color={themeColors.primary} />
          <Text style={[styles.passingBannerText, { color: themeColors.primary }]}>
            Passing score: {passingScore}%
          </Text>
        </View>
      )}

      {/* Questions */}
      {enabledQuestions.map((question, idx) => (
        <View
          key={question.slug}
          style={[styles.questionCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
        >
          {/* Question image */}
          {question.image_enabled && question.image_url ? (
            <Image
              source={{ uri: question.image_url }}
              style={styles.questionImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
            />
          ) : null}
          {/* Question number + label */}
          <View style={styles.questionHeader}>
            <Text style={[styles.questionNumber, { color: themeColors.textTertiary }]}>
              Q{idx + 1}
            </Text>
          </View>
          {question.label_rendered ? (
            <HtmlContent html={question.label_rendered} contentWidth={contentWidth - spacing.xl * 2} />
          ) : (
            <Text style={[styles.questionLabel, { color: themeColors.text }]}>
              {question.label.trim()}
            </Text>
          )}
          {question.help_text ? (
            <Text style={[styles.helpText, { color: themeColors.textTertiary }]}>
              {question.help_text}
            </Text>
          ) : null}

          {/* Options */}
          <View style={styles.optionsContainer}>
            {question.options.map((option) => {
              const isMultiple = question.type === 'multiple_choice';
              const currentAnswer = answers[question.slug];
              const isSelected = isMultiple
                ? Array.isArray(currentAnswer) && currentAnswer.includes(option.label)
                : currentAnswer === option.label;

              return (
                <AnimatedPressable
                  key={option.label}
                  style={[
                    styles.optionRow,
                    {
                      backgroundColor: isSelected
                        ? withOpacity(themeColors.primary, 0.1)
                        : themeColors.backgroundSecondary,
                      borderColor: isSelected ? themeColors.primary : themeColors.border,
                    },
                  ]}
                  onPress={() => selectAnswer(question.slug, option.label, question.type)}
                >
                  {/* Radio / Checkbox indicator */}
                  <View
                    style={[
                      isMultiple ? styles.checkbox : styles.radio,
                      {
                        borderColor: isSelected ? themeColors.primary : themeColors.textTertiary,
                        backgroundColor: isSelected ? themeColors.primary : 'transparent',
                      },
                    ]}
                  >
                    {isSelected && (
                      <Ionicons
                        name={isMultiple ? 'checkmark' : 'ellipse'}
                        size={isMultiple ? 14 : 8}
                        color={themeColors.textInverse}
                      />
                    )}
                  </View>
                  <Text style={[styles.optionLabel, { color: themeColors.text }]}>
                    {option.label}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </View>
      ))}

      {/* Submit */}
      <Button
        title="Submit Quiz"
        icon="checkmark-circle-outline"
        onPress={handleSubmit}
        loading={submitting}
        disabled={!allAnswered}
        style={styles.submitButton}
      />
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },

  loadingContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },

  // Passing score banner
  passingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: sizing.borderRadius.sm,
  },

  passingBannerText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },

  // Question card
  questionCard: {
    borderWidth: 1,
    borderRadius: sizing.borderRadius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },

  questionImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: sizing.borderRadius.sm,
  },

  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  questionNumber: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },

  questionLabel: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    lineHeight: 22,
  },

  helpText: {
    fontSize: typography.size.sm,
    fontStyle: 'italic',
  },

  // Options
  optionsContainer: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: sizing.borderRadius.sm,
    borderWidth: 1,
  },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: sizing.borderRadius.sm,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },

  optionLabel: {
    flex: 1,
    fontSize: typography.size.md,
  },

  // Submit
  submitButton: {
    marginTop: spacing.sm,
  },

  // Score card (result view)
  scoreCard: {
    alignItems: 'center',
    padding: spacing.xl,
    borderRadius: sizing.borderRadius.md,
    borderWidth: 1,
    gap: spacing.xs,
  },

  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },

  scoreText: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
  },

  scoreStatus: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },

  scoreDetail: {
    fontSize: typography.size.md,
  },

  passingInfo: {
    fontSize: typography.size.sm,
  },

  attemptsInfo: {
    fontSize: typography.size.xs,
  },

  // Result question cards
  questionsContainer: {
    gap: spacing.sm,
  },

  resultQuestion: {
    borderWidth: 1,
    borderRadius: sizing.borderRadius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },

  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: sizing.borderRadius.sm,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },

  resultBadgeText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },

  yourAnswer: {
    fontSize: typography.size.sm,
    marginTop: spacing.xs,
  },

  retakeButton: {
    marginTop: spacing.sm,
  },
});
