// =============================================================================
// SURVEY CARD - Renders poll/survey in feed items
// Matches Fluent Community native behavior: options are always clickable
// and results are always shown inline. Users can change/undo votes freely.
// =============================================================================

import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { spacing, sizing, typography } from '@/constants/layout';
import { SurveyConfig } from '@/types/feed';
import { feedsApi } from '@/services/api/feeds';
import { hapticLight } from '@/utils/haptics';
import { optimisticUpdate } from '@/utils/optimisticUpdate';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface SurveyCardProps {
  config: SurveyConfig;
  feedId: number;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function SurveyCard({ config: initialConfig, feedId }: SurveyCardProps) {
  const { colors } = useTheme();
  const [config, setConfig] = useState(initialConfig);
  const [isSyncing, setIsSyncing] = useState(false);

  const isMultiChoice = config.type === 'multi_choice';
  const isExpired = config.end_date ? new Date(config.end_date) < new Date() : false;
  const totalVotes = config.options.reduce((sum, o) => sum + (o.vote_counts || 0), 0);

  const getPercentage = (count: number) => {
    if (totalVotes === 0) return 0;
    return Math.round((count / totalVotes) * 100);
  };

  // Toggle vote on an option (matches Fluent Community's toggleVote)
  const toggleVote = async (slug: string) => {
    if (isExpired || isSyncing) return;
    hapticLight();
    setIsSyncing(true);

    // Compute the new voted slugs for the API call
    const newVotedSlugs: string[] = isMultiChoice
      ? (() => {
          const current = config.options.filter(o => o.voted).map(o => o.slug);
          return current.includes(slug)
            ? current.filter(s => s !== slug)
            : [...current, slug];
        })()
      : config.options.find(o => o.voted)?.slug === slug
        ? []       // unvote: tapping same option
        : [slug];  // vote or switch

    try {
      const response = await optimisticUpdate(
        setConfig,
        (prev) => ({
          ...prev,
          options: prev.options.map(o => {
            if (isMultiChoice) {
              if (o.slug === slug) {
                return {
                  ...o,
                  voted: !o.voted,
                  vote_counts: o.voted
                    ? Math.max((o.vote_counts || 0) - 1, 0)
                    : (o.vote_counts || 0) + 1,
                };
              }
              return o;
            }
            // Single choice
            const wasTapped = o.slug === slug;
            const wasVoted = o.voted === true;
            if (wasTapped) {
              return {
                ...o,
                voted: !wasVoted,
                vote_counts: wasVoted
                  ? Math.max((o.vote_counts || 0) - 1, 0)
                  : (o.vote_counts || 0) + 1,
              };
            }
            if (wasVoted) {
              return {
                ...o,
                voted: false,
                vote_counts: Math.max((o.vote_counts || 0) - 1, 0),
              };
            }
            return o;
          }),
        }),
        () => feedsApi.castSurveyVote(feedId, newVotedSlugs),
      );

      // Reconcile with server data on success
      if (response.success && response.data.survey_config) {
        setConfig(response.data.survey_config);
      }
    } catch {
      Alert.alert('Error', 'Failed to update vote');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <View style={styles.container}>
      {config.options.map((option) => {
        const count = option.vote_counts || 0;
        const pct = getPercentage(count);
        const isVoted = option.voted === true;

        return (
          <AnimatedPressable
            key={option.slug}
            style={[
              styles.optionRow,
              {
                borderColor: isVoted ? colors.primary : colors.borderLight,
                backgroundColor: colors.backgroundSecondary,
              },
            ]}
            onPress={() => toggleVote(option.slug)}
            disabled={isExpired || isSyncing}
          >
            {/* Progress fill bar */}
            <View
              style={[
                styles.progressFill,
                {
                  width: `${pct}%`,
                  backgroundColor: isVoted ? colors.primary + '25' : colors.lightBg,
                },
              ]}
            />

            {/* Content overlay */}
            <View style={styles.optionContent}>
              <View style={styles.optionLeft}>
                {/* Vote indicator: radio or checkbox */}
                {isMultiChoice ? (
                  <Ionicons
                    name={isVoted ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={isVoted ? colors.primary : colors.textTertiary}
                    style={{ marginRight: spacing.sm }}
                  />
                ) : (
                  <Ionicons
                    name={isVoted ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={isVoted ? colors.primary : colors.textTertiary}
                    style={{ marginRight: spacing.sm }}
                  />
                )}
                <Text
                  style={[
                    styles.optionLabel,
                    { color: colors.text },
                    isVoted && { fontWeight: '600' },
                  ]}
                  numberOfLines={2}
                >
                  {option.label}
                </Text>
              </View>
              {totalVotes > 0 && (
                <Text style={[styles.percentage, { color: colors.textSecondary }]}>
                  {pct}%
                </Text>
              )}
            </View>
          </AnimatedPressable>
        );
      })}

      {/* Footer: total votes + expiry */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textTertiary }]}>
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
        </Text>
        {isExpired && (
          <Text style={[styles.footerText, { color: colors.textTertiary }]}>
            {' '}·  Poll ended
          </Text>
        )}
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },

  optionRow: {
    borderRadius: sizing.borderRadius.sm,
    borderWidth: 1,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },

  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: sizing.borderRadius.sm,
  },

  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },

  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  optionLabel: {
    fontSize: typography.size.md,
    flex: 1,
  },

  percentage: {
    fontSize: typography.size.sm,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  footerText: {
    fontSize: typography.size.xs,
  },
});

export default SurveyCard;
