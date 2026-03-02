// =============================================================================
// DYNAMIC FORM FIELD - Shared field renderer for registration & profile edit
// =============================================================================
// Handles the common field types used in both register.tsx and profile/edit.tsx:
// text, email, phone, number, date, url, textarea, select/radio/gender, password,
// inline_checkbox, and multiselect/checkbox chips.
//
// Unique features per context are supported via optional props:
// - Password show/hide toggles
// - Inline checkbox with custom label
// - Multiselect chip toggles
// - Field instructions text
// - Extra content (e.g. visibility selector) rendered after the input
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
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { hapticLight, hapticSelection } from '@/utils/haptics';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface FormFieldConfig {
  label: string;
  type: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  /** Custom label for inline_checkbox fields */
  inline_label?: string;
  /** Help text shown below the label (profile edit) */
  instructions?: string;
}

interface DynamicFormFieldProps {
  fieldKey: string;
  field: FormFieldConfig;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  /** Called when a select/radio/gender field is tapped */
  onSelectPress?: (fieldKey: string) => void;
  disabled?: boolean;
  /** Extra content rendered after the input (e.g. visibility selector) */
  extraContent?: React.ReactNode;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function DynamicFormField({
  fieldKey,
  field,
  value,
  onChange,
  error,
  onSelectPress,
  disabled,
  extraContent,
}: DynamicFormFieldProps) {
  const { colors: themeColors } = useTheme();
  const currentValue = value ?? '';

  // Password visibility (local state — each password field manages its own)
  const [passwordVisible, setPasswordVisible] = useState(false);

  // ---------------------------------------------------------------------------
  // Inline Checkbox
  // ---------------------------------------------------------------------------

  if (field.type === 'inline_checkbox') {
    return (
      <View key={fieldKey} style={styles.inputContainer}>
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => { hapticSelection(); onChange(!currentValue); }}
          activeOpacity={0.7}
        >
          <View style={[
            styles.checkbox,
            { borderColor: error ? themeColors.error : themeColors.border },
            currentValue && { backgroundColor: themeColors.primary, borderColor: themeColors.primary },
          ]}>
            {currentValue && <Text style={[styles.checkmark, { color: themeColors.textInverse }]}>✓</Text>}
          </View>
          <Text style={[styles.checkboxLabel, { color: themeColors.text }]}>
            {field.inline_label || field.label}
            {field.required && <Text style={{ color: themeColors.error }}> *</Text>}
          </Text>
        </TouchableOpacity>
        {extraContent}
        {error && <Text style={[styles.fieldError, { color: themeColors.error }]}>{error}</Text>}
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Select / Radio / Gender
  // ---------------------------------------------------------------------------

  if (field.type === 'select' || field.type === 'radio' || field.type === 'gender') {
    return (
      <View key={fieldKey} style={styles.inputContainer}>
        <Text style={[styles.label, { color: themeColors.text }]}>
          {field.label}{field.required && <Text style={{ color: themeColors.error }}> *</Text>}
        </Text>
        {field.instructions ? (
          <Text style={[styles.instructions, { color: themeColors.textTertiary }]}>{field.instructions}</Text>
        ) : null}
        <TouchableOpacity
          style={[
            styles.input,
            styles.selectInput,
            {
              backgroundColor: themeColors.background,
              borderColor: error ? themeColors.error : themeColors.border,
            },
          ]}
          onPress={() => {
            hapticLight();
            onSelectPress?.(fieldKey);
          }}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.selectText,
            { color: currentValue ? themeColors.text : themeColors.textTertiary },
          ]}>
            {currentValue || field.placeholder || `Select ${field.label}`}
          </Text>
          <Ionicons name="chevron-down" size={16} color={themeColors.textSecondary} />
        </TouchableOpacity>
        {extraContent}
        {error && <Text style={[styles.fieldError, { color: themeColors.error }]}>{error}</Text>}
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Textarea
  // ---------------------------------------------------------------------------

  if (field.type === 'textarea') {
    return (
      <View key={fieldKey} style={styles.inputContainer}>
        <Text style={[styles.label, { color: themeColors.text }]}>
          {field.label}{field.required && <Text style={{ color: themeColors.error }}> *</Text>}
        </Text>
        {field.instructions ? (
          <Text style={[styles.instructions, { color: themeColors.textTertiary }]}>{field.instructions}</Text>
        ) : null}
        <TextInput
          style={[
            styles.input,
            styles.textareaInput,
            {
              backgroundColor: themeColors.background,
              borderColor: error ? themeColors.error : themeColors.border,
              color: themeColors.text,
            },
          ]}
          value={currentValue}
          onChangeText={onChange}
          placeholder={field.placeholder || ''}
          placeholderTextColor={themeColors.textTertiary}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          editable={!disabled}
        />
        {extraContent}
        {error && <Text style={[styles.fieldError, { color: themeColors.error }]}>{error}</Text>}
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Multiselect / Checkbox chips
  // ---------------------------------------------------------------------------

  if (field.type === 'checkbox' || field.type === 'multiselect') {
    let selected: string[] = [];
    try {
      selected = typeof currentValue === 'string'
        ? JSON.parse(currentValue || '[]')
        : (Array.isArray(currentValue) ? currentValue : []);
    } catch {
      selected = [];
    }

    const toggleOption = (option: string) => {
      const next = selected.includes(option)
        ? selected.filter(s => s !== option)
        : [...selected, option];
      onChange(JSON.stringify(next));
    };

    return (
      <View key={fieldKey} style={styles.inputContainer}>
        <Text style={[styles.label, { color: themeColors.text }]}>
          {field.label}{field.required && <Text style={{ color: themeColors.error }}> *</Text>}
        </Text>
        {field.instructions ? (
          <Text style={[styles.instructions, { color: themeColors.textTertiary }]}>{field.instructions}</Text>
        ) : null}
        <View style={styles.chipRow}>
          {(field.options || []).map((option) => {
            const isSelected = selected.includes(option);
            return (
              <TouchableOpacity
                key={option}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected ? themeColors.primary : themeColors.background,
                    borderColor: isSelected ? themeColors.primary : themeColors.border,
                  },
                ]}
                onPress={() => toggleOption(option)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, { color: isSelected ? themeColors.textInverse : themeColors.text }]}>
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {extraContent}
        {error && <Text style={[styles.fieldError, { color: themeColors.error }]}>{error}</Text>}
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Password
  // ---------------------------------------------------------------------------

  if (field.type === 'password') {
    return (
      <View key={fieldKey} style={styles.inputContainer}>
        <Text style={[styles.label, { color: themeColors.text }]}>
          {field.label}{field.required && <Text style={{ color: themeColors.error }}> *</Text>}
        </Text>
        <View style={[
          styles.passwordContainer,
          {
            backgroundColor: themeColors.background,
            borderColor: error ? themeColors.error : themeColors.border,
          },
        ]}>
          <TextInput
            style={[styles.passwordInput, { color: themeColors.text }]}
            value={currentValue}
            onChangeText={onChange}
            placeholder={field.placeholder || ''}
            placeholderTextColor={themeColors.textTertiary}
            secureTextEntry={!passwordVisible}
            textContentType="newPassword"
            autoComplete="password-new"
            editable={!disabled}
          />
          <TouchableOpacity
            style={styles.showPasswordButton}
            onPress={() => { hapticLight(); setPasswordVisible(!passwordVisible); }}
          >
            <Text style={styles.showPasswordText}>{passwordVisible ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>
        {extraContent}
        {error && <Text style={[styles.fieldError, { color: themeColors.error }]}>{error}</Text>}
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Default: text, email, phone, number, date, url
  // ---------------------------------------------------------------------------

  let keyboardType: TextInput['props']['keyboardType'] = 'default';
  let autoCapitalize: TextInput['props']['autoCapitalize'] = 'sentences';
  let autoComplete: TextInput['props']['autoComplete'] = 'off';
  let placeholder = field.placeholder || '';

  switch (field.type) {
    case 'email':
      keyboardType = 'email-address';
      autoCapitalize = 'none';
      autoComplete = 'email';
      break;
    case 'phone':
      keyboardType = 'phone-pad';
      autoCapitalize = 'none';
      break;
    case 'number':
      keyboardType = 'numeric';
      break;
    case 'date':
      placeholder = placeholder || 'YYYY-MM-DD';
      autoCapitalize = 'none';
      break;
    case 'url':
      keyboardType = 'url';
      autoCapitalize = 'none';
      break;
    case 'text':
    default:
      if (fieldKey === 'username') {
        autoCapitalize = 'none';
        autoComplete = 'username-new';
      }
      break;
  }

  return (
    <View key={fieldKey} style={styles.inputContainer}>
      <Text style={[styles.label, { color: themeColors.text }]}>
        {field.label}{field.required && <Text style={{ color: themeColors.error }}> *</Text>}
      </Text>
      {field.instructions ? (
        <Text style={[styles.instructions, { color: themeColors.textTertiary }]}>{field.instructions}</Text>
      ) : null}
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: themeColors.background,
            borderColor: error ? themeColors.error : themeColors.border,
            color: themeColors.text,
          },
        ]}
        value={currentValue}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={themeColors.textTertiary}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={false}
        editable={!disabled}
      />
      {extraContent}
      {error && <Text style={[styles.fieldError, { color: themeColors.error }]}>{error}</Text>}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  inputContainer: {
    marginBottom: spacing.lg,
  },

  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.sm,
  },

  instructions: {
    fontSize: typography.size.xs,
    marginBottom: spacing.xs,
  },

  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
  },

  textareaInput: {
    height: 80,
    paddingTop: spacing.md,
  },

  selectInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  selectText: {
    fontSize: typography.size.md,
    flex: 1,
  },

  // Password
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
  },

  passwordInput: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
  },

  showPasswordButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },

  showPasswordText: {
    fontSize: 20,
  },

  // Checkbox
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },

  checkmark: {
    fontSize: 14,
    fontWeight: '700',
  },

  checkboxLabel: {
    fontSize: typography.size.sm,
    flex: 1,
  },

  // Chip toggles (multiselect/checkbox)
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
  },

  chipText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },

  // Error
  fieldError: {
    fontSize: typography.size.xs,
    marginTop: spacing.xs,
  },
});
