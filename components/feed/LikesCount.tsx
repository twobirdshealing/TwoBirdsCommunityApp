// =============================================================================
// LIKES COUNT - Avatar stack + count (core fallback, Fluent native style)
// =============================================================================
// Used when the multi-reactions module is NOT installed. Shows overlapping
// user avatars (up to 3, from feed.reactions) + "N like(s)" text.
// Tappable — opens LikesBreakdownSheet with the full list.
// =============================================================================

import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View, Text } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Avatar } from '@/components/common/Avatar';
import { LikesBreakdownSheet } from '@/components/feed/LikesBreakdownSheet';
import { formatCompactNumber } from '@/utils/formatNumber';
import { spacing, typography } from '@/constants/layout';
import type { Reaction } from '@/types/feed';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const MAX_AVATARS = 3;
const AVATAR_SIZE = 22;
const AVATAR_OVERLAP = -8;
const AVATAR_BORDER = 2;

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface LikesCountProps {
  feedId: number;
  reactionsCount: number;
  reactions?: Reaction[];
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function LikesCount({ feedId, reactionsCount, reactions }: LikesCountProps) {
  const { colors: themeColors } = useTheme();
  const [sheetVisible, setSheetVisible] = useState(false);

  const openSheet = useCallback(() => setSheetVisible(true), []);
  const closeSheet = useCallback(() => setSheetVisible(false), []);

  if (reactionsCount <= 0) return null;

  const avatars = (reactions || []).slice(0, MAX_AVATARS);

  return (
    <>
      <Pressable style={styles.container} onPress={openSheet}>
        {avatars.length > 0 && (
          <View style={styles.avatarStack}>
            {avatars.map((reaction, i) => (
              <View
                key={`${reaction.user_id}-${i}`}
                style={[
                  styles.avatarWrapper,
                  {
                    zIndex: MAX_AVATARS - i,
                    marginLeft: i === 0 ? 0 : AVATAR_OVERLAP,
                    borderColor: themeColors.card,
                  },
                ]}
              >
                <Avatar source={reaction.xprofile?.avatar} size="xs" />
              </View>
            ))}
          </View>
        )}
        <Text style={[styles.countText, { color: themeColors.textSecondary }]}>
          {formatCompactNumber(reactionsCount)} {reactionsCount === 1 ? 'like' : 'likes'}
        </Text>
      </Pressable>

      {sheetVisible && (
        <LikesBreakdownSheet
          visible={sheetVisible}
          onClose={closeSheet}
          feedId={feedId}
        />
      )}
    </>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: AVATAR_BORDER,
    overflow: 'hidden',
  },
  countText: {
    fontSize: typography.size.sm,
  },
});
