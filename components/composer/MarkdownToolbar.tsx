// =============================================================================
// MARKDOWN TOOLBAR - Formatting buttons for Bold, Italic, Strike, Code, Link
// =============================================================================
// Matches Fluent Community web editor toolbar (B, I, S, <>, Link).
// Inserts markdown syntax into the TextInput via applyMarkdownFormat().
// Server (Parsedown) converts markdown → HTML on render.
// =============================================================================

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing } from '@/constants/layout';
import { hapticLight } from '@/utils/haptics';
import { SheetInput } from '@/components/common/BottomSheet';
import {
  applyMarkdownFormat,
  type MarkdownFormat,
  type TextSelection,
  type FormatResult,
} from '@/utils/markdown';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface MarkdownToolbarProps {
  /** Current text in the input */
  text: string;
  /** Current cursor/selection position */
  selection: TextSelection;
  /** Callback with new text and cursor position after formatting */
  onFormat: (result: FormatResult) => void;
  /** Smaller buttons for comment sheet inputs */
  compact?: boolean;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function MarkdownToolbar({
  text,
  selection,
  onFormat,
  compact = false,
}: MarkdownToolbarProps) {
  const { colors: themeColors } = useTheme();
  const [linkMode, setLinkMode] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const buttonSize = compact ? 32 : 36;
  const fontSize = compact ? typography.size.sm : typography.size.md;

  // ---------------------------------------------------------------------------
  // Handle format button press
  // ---------------------------------------------------------------------------

  const handleFormat = (format: MarkdownFormat) => {
    hapticLight();

    if (format === 'link') {
      setLinkMode(true);
      setLinkUrl('');
      return;
    }

    const result = applyMarkdownFormat(text, selection, format);
    onFormat(result);
  };

  // ---------------------------------------------------------------------------
  // Handle link insertion
  // ---------------------------------------------------------------------------

  const handleLinkInsert = () => {
    hapticLight();
    const url = linkUrl.trim();
    if (!url) return;

    const result = applyMarkdownFormat(text, selection, 'link', url);
    onFormat(result);
    setLinkMode(false);
    setLinkUrl('');
  };

  const handleLinkCancel = () => {
    setLinkMode(false);
    setLinkUrl('');
  };

  // ---------------------------------------------------------------------------
  // Link URL input mode
  // ---------------------------------------------------------------------------

  if (linkMode) {
    return (
      <View style={[styles.container, { borderTopColor: themeColors.border }]}>
        <View style={styles.linkRow}>
          <Ionicons name="link-outline" size={18} color={themeColors.textSecondary} />
          <SheetInput>
            {(inputProps) => (
              <TextInput
                {...inputProps}
                style={[
                  styles.linkInput,
                  {
                    color: themeColors.text,
                    backgroundColor: themeColors.background,
                    borderColor: themeColors.border,
                  },
                ]}
                placeholder="Paste URL..."
                placeholderTextColor={themeColors.textTertiary}
                value={linkUrl}
                onChangeText={setLinkUrl}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
                onSubmitEditing={handleLinkInsert}
              />
            )}
          </SheetInput>
          <TouchableOpacity
            style={[styles.linkButton, { backgroundColor: themeColors.primary }]}
            onPress={handleLinkInsert}
            disabled={!linkUrl.trim()}
          >
            <Ionicons name="checkmark" size={18} color={themeColors.textInverse} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkCancelButton}
            onPress={handleLinkCancel}
          >
            <Ionicons name="close" size={18} color={themeColors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Format buttons
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, { borderTopColor: themeColors.border }]}>
      <View style={styles.buttonRow}>
        {/* Bold */}
        <TouchableOpacity
          style={[styles.button, { width: buttonSize, height: buttonSize }]}
          onPress={() => handleFormat('bold')}
        >
          <Text style={[styles.boldLabel, { color: themeColors.textSecondary, fontSize }]}>
            B
          </Text>
        </TouchableOpacity>

        {/* Italic */}
        <TouchableOpacity
          style={[styles.button, { width: buttonSize, height: buttonSize }]}
          onPress={() => handleFormat('italic')}
        >
          <Text style={[styles.italicLabel, { color: themeColors.textSecondary, fontSize }]}>
            I
          </Text>
        </TouchableOpacity>

        {/* Strikethrough */}
        <TouchableOpacity
          style={[styles.button, { width: buttonSize, height: buttonSize }]}
          onPress={() => handleFormat('strikethrough')}
        >
          <Text style={[styles.strikethroughLabel, { color: themeColors.textSecondary, fontSize }]}>
            S
          </Text>
        </TouchableOpacity>

        {/* Code */}
        <TouchableOpacity
          style={[styles.button, { width: buttonSize, height: buttonSize }]}
          onPress={() => handleFormat('code')}
        >
          <Ionicons
            name="code-slash-outline"
            size={compact ? 16 : 18}
            color={themeColors.textSecondary}
          />
        </TouchableOpacity>

        {/* Link */}
        <TouchableOpacity
          style={[styles.button, { width: buttonSize, height: buttonSize }]}
          onPress={() => handleFormat('link')}
        >
          <Ionicons
            name="link-outline"
            size={compact ? 16 : 18}
            color={themeColors.textSecondary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },

  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  button: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: sizing.borderRadius.sm,
  },

  boldLabel: {
    fontWeight: '700',
  },

  italicLabel: {
    fontStyle: 'italic',
  },

  strikethroughLabel: {
    textDecorationLine: 'line-through',
  },

  // Link mode
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  linkInput: {
    flex: 1,
    height: 34,
    paddingHorizontal: spacing.sm,
    borderRadius: sizing.borderRadius.sm,
    borderWidth: 1,
    fontSize: typography.size.sm,
  },

  linkButton: {
    width: 30,
    height: 30,
    borderRadius: sizing.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },

  linkCancelButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MarkdownToolbar;
