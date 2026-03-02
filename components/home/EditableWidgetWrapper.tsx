// =============================================================================
// EDITABLE WIDGET WRAPPER - Edit overlay for headerless widgets
// =============================================================================
// For widgets like WelcomeBanner that don't use HomeWidget, this provides
// a minimal drag handle + toggle in edit mode.
// =============================================================================

import React from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, shadows } from '@/constants/layout';
import { withOpacity } from '@/constants/colors';
import { useTheme } from '@/contexts/ThemeContext';
import type { WidgetConfig } from './widgetRegistry';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface EditableWidgetWrapperProps {
  config: WidgetConfig;
  isEnabled: boolean;
  isEditing: boolean;
  drag?: () => void;
  isActive?: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function EditableWidgetWrapper({
  config,
  isEnabled,
  isEditing,
  drag,
  isActive,
  onToggle,
  children,
}: EditableWidgetWrapperProps) {
  const { colors: themeColors } = useTheme();

  if (!isEditing) return <>{children}</>;

  return (
    <View
      style={[
        styles.container,
        isActive && [styles.activeContainer, shadows.md],
        !isEnabled && { opacity: 0.4 },
      ]}
    >
      {/* Edit bar */}
      <View
        style={[
          styles.editBar,
          { backgroundColor: withOpacity(themeColors.surface, 0.9) },
        ]}
      >
        <Pressable onPressIn={drag} style={styles.dragHandle} hitSlop={8}>
          <Ionicons name="reorder-three" size={24} color={themeColors.textSecondary} />
        </Pressable>

        <Text style={[styles.label, { color: themeColors.text }]}>
          {config.title}
        </Text>

        {config.canDisable && (
          <Switch
            value={isEnabled}
            onValueChange={onToggle}
            trackColor={{
              false: withOpacity(themeColors.textTertiary, 0.3),
              true: withOpacity(themeColors.primary, 0.4),
            }}
            thumbColor={isEnabled ? themeColors.primary : themeColors.textTertiary}
          />
        )}
      </View>

      {/* Widget content — hidden when disabled */}
      {isEnabled && children}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },

  activeContainer: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
    transform: [{ scale: 1.02 }],
  },

  editBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },

  dragHandle: {
    marginRight: spacing.sm,
    padding: spacing.xs,
  },

  label: {
    flex: 1,
    fontSize: typography.size.md,
    fontWeight: '600',
  },
});

export default EditableWidgetWrapper;
