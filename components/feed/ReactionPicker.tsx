// =============================================================================
// REACTION PICKER - Bottom sheet emoji picker for multi-reactions
// =============================================================================
// Shows on long-press of the reaction button. Uses BottomSheet for consistent
// appearance with all other popups. Wraps into multiple rows if many reactions.
// =============================================================================

import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useReactionConfig } from '@/hooks';
import { ReactionIcon } from './ReactionIcon';
import { ReactionType } from '@/types/feed';
import { spacing, typography } from '@/constants/layout';
import { hapticLight } from '@/utils/haptics';
import { BottomSheet } from '@/components/common/BottomSheet';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface ReactionPickerProps {
  visible: boolean;
  onSelect: (type: ReactionType) => void;
  onClose: () => void;
  currentType?: ReactionType | null;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ReactionPicker({
  visible,
  onSelect,
  onClose,
  currentType,
}: ReactionPickerProps) {
  const { colors: themeColors } = useTheme();
  const { reactions } = useReactionConfig();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Reactions"
    >
      <View style={styles.picker}>
        {reactions.map((r) => {
          const isActive = currentType === r.id;
          return (
            <TouchableOpacity
              key={r.id}
              style={[
                styles.emojiButton,
                isActive && [styles.emojiButtonActive, { backgroundColor: (r.color || '#1877F2') + '20' }],
              ]}
              onPress={() => {
                hapticLight();
                onSelect(r.id as ReactionType);
                onClose();
              }}
              activeOpacity={0.7}
            >
              <ReactionIcon iconUrl={r.icon_url} emoji={r.emoji} size={35} />
              <Text
                style={[
                  styles.emojiLabel,
                  { color: isActive ? (r.color || '#1877F2') : themeColors.textTertiary },
                ]}
              >
                {r.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </BottomSheet>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  picker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: 50,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  emojiButton: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
  },
  emojiButtonActive: {
    borderRadius: 16,
  },
  emojiLabel: {
    fontSize: typography.size.xs,
    fontWeight: '500',
    marginTop: 2,
  },
});

export default ReactionPicker;
