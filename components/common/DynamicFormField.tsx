// =============================================================================
// DYNAMIC FORM FIELD - Shared field renderer for registration & profile edit
// =============================================================================
// Handles the common field types used in both register.tsx and profile/edit.tsx:
// text, email, phone, number, date, url, textarea, select, gender, radio, password,
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
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { hapticLight, hapticSelection } from '@/utils/haptics';
import { stripHtmlTags, decodeHtmlEntities } from '@/utils/htmlToText';

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
// Helpers
// -----------------------------------------------------------------------------

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDisplayDate(date: Date): string {
  // Use UTC getters — date-only strings ("YYYY-MM-DD") are parsed as UTC midnight
  return `${SHORT_MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const DynamicFormField = React.memo(function DynamicFormField({
  fieldKey,
  field,
  value,
  onChange,
  error,
  onSelectPress,
  disabled,
  extraContent,
}: DynamicFormFieldProps) {
  const { colors: themeColors, isDark } = useTheme();
  const currentValue = value ?? '';

  // Password visibility (local state — each password field manages its own)
  const [passwordVisible, setPasswordVisible] = useState(false);

  // Date picker visibility
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ---------------------------------------------------------------------------
  // Inline Checkbox
  // ---------------------------------------------------------------------------

  if (field.type === 'inline_checkbox') {
    return (
      <View key={fieldKey} style={styles.inputContainer}>
        <Pressable
          style={styles.checkboxRow}
          onPress={() => { hapticSelection(); onChange(!currentValue); }}

        >
          <View style={[
            styles.checkbox,
            { borderColor: error ? themeColors.error : themeColors.border },
            currentValue && { backgroundColor: themeColors.primary, borderColor: themeColors.primary },
          ]}>
            {currentValue && <Text style={[styles.checkmark, { color: themeColors.textInverse }]}>✓</Text>}
          </View>
          <Text style={[styles.checkboxLabel, { color: themeColors.text }]}>
            {decodeHtmlEntities(stripHtmlTags(field.inline_label || field.label))}
            {field.required && <Text style={{ color: themeColors.error }}> *</Text>}
          </Text>
        </Pressable>
        {extraContent}
        {error && <Text style={[styles.fieldError, { color: themeColors.error }]}>{error}</Text>}
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Date (native date picker)
  // ---------------------------------------------------------------------------

  if (field.type === 'date') {
    const dateValue = currentValue ? new Date(currentValue) : undefined;
    const isValidDate = dateValue && !isNaN(dateValue.getTime());

    return (
      <View key={fieldKey} style={styles.inputContainer}>
        <Text style={[styles.label, { color: themeColors.text }]}>
          {field.label}{field.required && <Text style={{ color: themeColors.error }}> *</Text>}
        </Text>
        {field.instructions ? (
          <Text style={[styles.instructions, { color: themeColors.textTertiary }]}>{field.instructions}</Text>
        ) : null}
        <Pressable
          style={[
            styles.input,
            styles.selectInput,
            {
              backgroundColor: themeColors.background,
              borderColor: error ? themeColors.error : themeColors.border,
            },
          ]}
          onPress={() => { hapticLight(); setShowDatePicker(true); }}
          disabled={disabled}
        >
          <Text style={[
            styles.selectText,
            { color: isValidDate ? themeColors.text : themeColors.textTertiary },
          ]}>
            {isValidDate ? formatDisplayDate(dateValue!) : (field.placeholder || 'Select date')}
          </Text>
          <Ionicons name="calendar-outline" size={18} color={themeColors.textSecondary} />
        </Pressable>
        {showDatePicker && (
          <DateTimePicker
            value={isValidDate ? dateValue! : new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            themeVariant={isDark ? 'dark' : 'light'}
            onChange={(_event, selectedDate) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (selectedDate) {
                const yyyy = selectedDate.getFullYear();
                const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                const dd = String(selectedDate.getDate()).padStart(2, '0');
                onChange(`${yyyy}-${mm}-${dd}`);
              }
            }}
          />
        )}
        {extraContent}
        {error && <Text style={[styles.fieldError, { color: themeColors.error }]}>{error}</Text>}
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Radio (inline single-select options)
  // ---------------------------------------------------------------------------

  if (field.type === 'radio') {
    return (
      <View key={fieldKey} style={styles.inputContainer}>
        <Text style={[styles.label, { color: themeColors.text }]}>
          {field.label}{field.required && <Text style={{ color: themeColors.error }}> *</Text>}
        </Text>
        {field.instructions ? (
          <Text style={[styles.instructions, { color: themeColors.textTertiary }]}>{field.instructions}</Text>
        ) : null}
        <View style={styles.radioGroup}>
          {(field.options || []).map((option) => {
            const isSelected = currentValue === option;
            return (
              <Pressable
                key={option}
                style={styles.radioRow}
                onPress={() => { hapticSelection(); onChange(option); }}
              >
                <View style={[
                  styles.radioOuter,
                  { borderColor: isSelected ? themeColors.primary : themeColors.border },
                ]}>
                  {isSelected && (
                    <View style={[styles.radioInner, { backgroundColor: themeColors.primary }]} />
                  )}
                </View>
                <Text style={[styles.radioLabel, { color: themeColors.text }]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
        {extraContent}
        {error && <Text style={[styles.fieldError, { color: themeColors.error }]}>{error}</Text>}
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Select / Gender (dropdown picker)
  // ---------------------------------------------------------------------------

  if (field.type === 'select' || field.type === 'gender') {
    return (
      <View key={fieldKey} style={styles.inputContainer}>
        <Text style={[styles.label, { color: themeColors.text }]}>
          {field.label}{field.required && <Text style={{ color: themeColors.error }}> *</Text>}
        </Text>
        {field.instructions ? (
          <Text style={[styles.instructions, { color: themeColors.textTertiary }]}>{field.instructions}</Text>
        ) : null}
        <Pressable
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
        >
          <Text style={[
            styles.selectText,
            { color: currentValue ? themeColors.text : themeColors.textTertiary },
          ]}>
            {currentValue || field.placeholder || `Select ${field.label}`}
          </Text>
          <Ionicons name="chevron-down" size={16} color={themeColors.textSecondary} />
        </Pressable>
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
              <Pressable
                key={option}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected ? themeColors.primary : themeColors.background,
                    borderColor: isSelected ? themeColors.primary : themeColors.border,
                  },
                ]}
                onPress={() => toggleOption(option)}
      
              >
                <Text style={[styles.chipText, { color: isSelected ? themeColors.textInverse : themeColors.text }]}>
                  {option}
                </Text>
              </Pressable>
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
          <Pressable
            style={styles.showPasswordButton}
            onPress={() => { hapticLight(); setPasswordVisible(!passwordVisible); }}
          >
            <Ionicons name={passwordVisible ? 'eye-off' : 'eye'} size={20} color={themeColors.textSecondary} />
          </Pressable>
        </View>
        {extraContent}
        {error && <Text style={[styles.fieldError, { color: themeColors.error }]}>{error}</Text>}
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Default: text, email, number, url
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
    case 'number':
      keyboardType = 'numeric';
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
      } else if (fieldKey.includes('phone')) {
        keyboardType = 'phone-pad';
        autoComplete = 'tel';
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
});

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
    borderRadius: sizing.borderRadius.md,
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
    borderRadius: sizing.borderRadius.md,
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

  // Checkbox
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: sizing.borderRadius.sm,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },

  checkmark: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },

  checkboxLabel: {
    fontSize: typography.size.sm,
    flex: 1,
  },

  // Radio
  radioGroup: {
    gap: spacing.sm,
  },

  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },

  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },

  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  radioLabel: {
    fontSize: typography.size.md,
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
    borderRadius: sizing.borderRadius.lg,
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
