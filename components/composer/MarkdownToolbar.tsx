// =============================================================================
// MARKDOWN TOOLBAR - Rich text formatting buttons powered by 10tap EditorBridge
// =============================================================================
// Matches Fluent Community web editor features: B, I, S, H2-H4, lists,
// blockquote, code block, HR, link. Scrollable single row with separators.
// Active state highlighting shows which formats are currently applied.
// =============================================================================

import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBridgeState, type EditorBridge } from '@10play/tentap-editor';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing } from '@/constants/layout';
import { hapticLight } from '@/utils/haptics';
import { SheetInput } from '@/components/common/BottomSheet';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface MarkdownToolbarProps {
  /** 10tap EditorBridge instance */
  editor: EditorBridge;
  /** Smaller buttons for comment sheet inputs */
  compact?: boolean;
}

// Button definition for the toolbar
interface ToolbarButton {
  key: string;
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  isActive: () => boolean;
  labelStyle?: object;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function MarkdownToolbar({
  editor,
  compact = false,
}: MarkdownToolbarProps) {
  const { colors: themeColors } = useTheme();
  const editorState = useBridgeState(editor);
  const [linkMode, setLinkMode] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const buttonSize = compact ? 32 : 36;
  const fontSize = compact ? typography.size.sm : typography.size.md;
  const iconSize = compact ? 16 : 18;
  const smallFontSize = compact ? typography.size.xs : typography.size.sm;

  // ---------------------------------------------------------------------------
  // Button definitions — grouped with separators
  // ---------------------------------------------------------------------------

  const buttonGroups: ToolbarButton[][] = [
    // Inline formatting
    [
      {
        key: 'bold',
        label: 'B',
        onPress: () => editor.toggleBold(),
        isActive: () => (editorState as any).isBoldActive ?? false,
        labelStyle: styles.boldLabel,
      },
      {
        key: 'italic',
        label: 'I',
        onPress: () => editor.toggleItalic(),
        isActive: () => (editorState as any).isItalicActive ?? false,
        labelStyle: styles.italicLabel,
      },
      {
        key: 'strike',
        label: 'S',
        onPress: () => editor.toggleStrike(),
        isActive: () => (editorState as any).isStrikeActive ?? false,
        labelStyle: styles.strikethroughLabel,
      },
    ],
    // Headings
    [
      {
        key: 'h2',
        label: 'H2',
        onPress: () => editor.toggleHeading(2),
        isActive: () => (editorState as any).headingLevel === 2,
        labelStyle: styles.headingLabel,
      },
      {
        key: 'h3',
        label: 'H3',
        onPress: () => editor.toggleHeading(3),
        isActive: () => (editorState as any).headingLevel === 3,
        labelStyle: styles.headingLabel,
      },
      {
        key: 'h4',
        label: 'H4',
        onPress: () => editor.toggleHeading(4),
        isActive: () => (editorState as any).headingLevel === 4,
        labelStyle: styles.headingLabel,
      },
    ],
    // Block formatting
    [
      {
        key: 'bulletList',
        icon: 'list-outline',
        onPress: () => editor.toggleBulletList(),
        isActive: () => (editorState as any).isBulletListActive ?? false,
      },
      {
        key: 'orderedList',
        label: '1.',
        onPress: () => editor.toggleOrderedList(),
        isActive: () => (editorState as any).isOrderedListActive ?? false,
        labelStyle: styles.orderedListLabel,
      },
      {
        key: 'blockquote',
        icon: 'chatbox-outline',
        onPress: () => editor.toggleBlockquote(),
        isActive: () => (editorState as any).isBlockquoteActive ?? false,
      },
    ],
    // Other
    [
      {
        key: 'code',
        icon: 'code-slash-outline',
        onPress: () => editor.toggleCode(),
        isActive: () => (editorState as any).isCodeActive ?? false,
      },
      {
        key: 'link',
        icon: 'link-outline',
        onPress: () => {
          // If link is active, remove it
          if ((editorState as any).isLinkActive) {
            editor.setLink(null);
          } else {
            setLinkMode(true);
            setLinkUrl((editorState as any).activeLink || '');
          }
        },
        isActive: () => (editorState as any).isLinkActive ?? false,
      },
    ],
  ];

  // ---------------------------------------------------------------------------
  // Handle link insertion
  // ---------------------------------------------------------------------------

  const handleLinkInsert = () => {
    hapticLight();
    const url = linkUrl.trim();
    if (!url) return;

    editor.setLink(url);
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
  // Format buttons — scrollable row with group separators
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, { borderTopColor: themeColors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
      >
        {buttonGroups.map((group, groupIndex) => (
          <React.Fragment key={groupIndex}>
            {/* Separator between groups */}
            {groupIndex > 0 && (
              <View style={[styles.separator, { backgroundColor: themeColors.border }]} />
            )}
            {group.map((btn) => {
              const active = btn.isActive();
              return (
                <TouchableOpacity
                  key={btn.key}
                  style={[
                    styles.button,
                    { width: buttonSize, height: buttonSize },
                    active && [styles.buttonActive, { backgroundColor: themeColors.activeBg }],
                  ]}
                  onPress={() => {
                    hapticLight();
                    btn.onPress();
                  }}
                >
                  {btn.icon ? (
                    <Ionicons
                      name={btn.icon}
                      size={iconSize}
                      color={active ? themeColors.primary : themeColors.textSecondary}
                    />
                  ) : (
                    <Text
                      style={[
                        btn.labelStyle,
                        {
                          color: active ? themeColors.primary : themeColors.textSecondary,
                          fontSize: btn.key.startsWith('h') ? smallFontSize : fontSize,
                        },
                      ]}
                    >
                      {btn.label}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </React.Fragment>
        ))}
      </ScrollView>
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

  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  button: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: sizing.borderRadius.sm,
  },

  buttonActive: {
    borderRadius: sizing.borderRadius.sm,
  },

  separator: {
    width: 1,
    height: 20,
    marginHorizontal: spacing.xs,
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

  headingLabel: {
    fontWeight: '700',
  },

  orderedListLabel: {
    fontWeight: '600',
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
