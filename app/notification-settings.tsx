// =============================================================================
// NOTIFICATION SETTINGS SCREEN - Unified push + email notification preferences
// =============================================================================
// Fetches push notification types from TBC-CA plugin API and email notification
// preferences from Fluent Community API. Displays both channels together for
// each notification concept, with per-space email settings at the bottom.
// =============================================================================

import { LoadingSpinner, ErrorMessage } from '@/components/common';
import { PageHeader } from '@/components/navigation';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { FEATURES } from '@/constants/config';
import { getPushSettings, updatePushSettings, PushPreference } from '@/services/api/push';
import {
  getEmailPrefs,
  updateEmailPrefs,
  EmailPrefsResponse,
  EmailUserGlobals,
} from '@/services/api/emailPrefs';
import { isPushAvailable, getPushPermissionStatus, registerDeviceToken, type PushPermissionStatus } from '@/services/push';
import { getAuthToken } from '@/services/auth';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface CategoryPreferences {
  [category: string]: PushPreference[];
}

type ChannelType = 'push' | 'email';

interface ChannelInfo {
  type: ChannelType;
  id: string;        // push pref id or email key
  label: string;
  enabled: boolean;
}

interface UnifiedItem {
  key: string;
  label: string;
  description: string;
  channels: ChannelInfo[];
  note?: string;
}

interface UnifiedSection {
  category: string;
  title: string;
  items: UnifiedItem[];
}

type SpacePrefValue = '' | 'admin_only_posts' | 'all_member_posts';

// -----------------------------------------------------------------------------
// Notification Mapping — links push type IDs to email pref keys
// -----------------------------------------------------------------------------

interface NotificationMapping {
  key: string;
  label: string;
  description: string;
  category: string;
  pushIds?: string[];
  pushLabels?: string[];
  emailKey?: keyof EmailUserGlobals;
  note?: string;
}

const NOTIFICATION_MAP: NotificationMapping[] = [
  // Community — dual channel
  {
    key: 'comment_on_post',
    label: 'Comment on Your Post',
    description: 'When someone comments on your post',
    category: 'community',
    pushIds: ['comment_on_post'],
    emailKey: 'com_my_post_mail',
  },
  {
    key: 'reply_to_comment',
    label: 'Reply to Your Comment',
    description: 'When someone replies to your comment',
    category: 'community',
    pushIds: ['reply_to_comment'],
    emailKey: 'reply_my_com_mail',
  },
  {
    key: 'mentions',
    label: 'Mentions',
    description: 'When someone mentions you in a post or comment',
    category: 'community',
    pushIds: ['mentioned_in_comment', 'mentioned_in_post'],
    pushLabels: ['In comments', 'In posts'],
    emailKey: 'mention_mail',
    note: 'Email setting also controls announcement emails',
  },
  // Community — push only
  {
    key: 'reactions',
    label: 'Reactions',
    description: 'When someone reacts to your posts or comments',
    category: 'community',
    pushIds: ['reaction_on_post', 'reaction_on_comment'],
    pushLabels: ['On your posts', 'On your comments'],
  },
  {
    key: 'comment_on_followed_post',
    label: 'Comment on Followed Post',
    description: 'When someone comments on a post you follow',
    category: 'community',
    pushIds: ['comment_on_followed_post'],
  },
  {
    key: 'new_space_post',
    label: 'New Post in Your Space',
    description: 'When a new post is created in a space you belong to',
    category: 'community',
    pushIds: ['new_space_post'],
  },
  {
    key: 'space_join',
    label: 'Someone Joined Your Space',
    description: 'When someone joins a space you moderate',
    category: 'community',
    pushIds: ['space_join'],
  },
  {
    key: 'space_role_change',
    label: 'Your Role Changed',
    description: 'When your role is changed in a space',
    category: 'community',
    pushIds: ['space_role_change'],
  },
  {
    key: 'invitation_received',
    label: 'Invitation Received',
    description: 'When you receive an invitation',
    category: 'community',
    pushIds: ['invitation_received'],
  },
  {
    key: 'course_enrolled',
    label: 'Course Enrollment',
    description: 'When you are enrolled in a course',
    category: 'community',
    pushIds: ['course_enrolled'],
  },
  // Social — push only
  {
    key: 'friend_new_post',
    label: 'Friend Posted',
    description: 'When someone you follow creates a new post',
    category: 'social',
    pushIds: ['friend_new_post'],
  },
  {
    key: 'new_follower',
    label: 'New Follower',
    description: 'When someone follows you',
    category: 'social',
    pushIds: ['new_follower'],
  },
  {
    key: 'level_up',
    label: 'You Leveled Up',
    description: 'When you reach a new level',
    category: 'social',
    pushIds: ['level_up'],
  },
  {
    key: 'points_earned',
    label: 'Points Earned',
    description: 'When you earn points',
    category: 'social',
    pushIds: ['points_earned'],
  },
  {
    key: 'quiz_result',
    label: 'Quiz Submitted',
    description: 'When a quiz is submitted',
    category: 'social',
    pushIds: ['quiz_result'],
  },
  // Messaging — push only
  {
    key: 'new_direct_message',
    label: 'Direct Messages',
    description: 'When someone sends you a direct message',
    category: 'messaging',
    pushIds: ['new_direct_message'],
  },
];

// Category display order and titles
const CATEGORY_CONFIG: Record<string, string> = {
  community: 'Community',
  social: 'Social',
  messaging: 'Messaging',
};

// Frequency options for DM emails
const FREQUENCY_OPTIONS: { value: string; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'disabled', label: 'Off' },
];

// Space email pref options
const SPACE_PREF_OPTIONS: { value: SpacePrefValue; label: string }[] = [
  { value: '', label: 'Off' },
  { value: 'admin_only_posts', label: 'Admin Posts' },
  { value: 'all_member_posts', label: 'All Posts' },
];

// =============================================================================
// Sub-components
// =============================================================================

// -----------------------------------------------------------------------------
// Channel Toggle Row — shows icon (bell/envelope) + label + toggle
// -----------------------------------------------------------------------------

interface ChannelToggleRowProps {
  type: ChannelType;
  label: string;
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

function ChannelToggleRow({ type, label, enabled, onToggle, disabled = false }: ChannelToggleRowProps) {
  const { colors: themeColors } = useTheme();
  const icon = type === 'push' ? 'notifications-outline' : 'mail-outline';

  return (
    <Pressable
      style={[styles.channelRow, disabled && styles.channelRowDisabled]}
      onPress={disabled ? undefined : onToggle}
      disabled={disabled}
    >
      <Ionicons
        name={icon as any}
        size={18}
        color={disabled ? themeColors.textTertiary : themeColors.textSecondary}
        style={styles.channelIcon}
      />
      <Text
        style={[
          styles.channelLabel,
          { color: themeColors.text },
          disabled && { color: themeColors.textTertiary },
        ]}
      >
        {label}
      </Text>
      <View
        style={[
          styles.toggle,
          { backgroundColor: themeColors.border },
          enabled && styles.toggleEnabled,
          enabled && { backgroundColor: themeColors.primary },
          disabled && { backgroundColor: themeColors.skeleton },
        ]}
      >
        <View
          style={[
            styles.toggleThumb,
            { backgroundColor: themeColors.surface },
            enabled && styles.toggleThumbEnabled,
          ]}
        />
      </View>
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
// Notification Card — wraps one notification concept with its channel rows
// -----------------------------------------------------------------------------

interface NotificationCardProps {
  item: UnifiedItem;
  onToggle: (channelType: ChannelType, id: string, currentEnabled: boolean) => void;
  savingIds: Set<string>;
  showPush: boolean;
}

function NotificationCard({ item, onToggle, savingIds, showPush }: NotificationCardProps) {
  const { colors: themeColors } = useTheme();
  const visibleChannels = item.channels.filter(
    ch => ch.type === 'email' || (ch.type === 'push' && showPush)
  );

  if (visibleChannels.length === 0) return null;

  return (
    <View style={[styles.notificationCard, { backgroundColor: themeColors.surface }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: themeColors.text }]}>{item.label}</Text>
        <Text style={[styles.cardDescription, { color: themeColors.textSecondary }]}>
          {item.description}
        </Text>
      </View>
      {visibleChannels.map((channel, index) => (
        <React.Fragment key={`${channel.type}-${channel.id}`}>
          {index > 0 && <View style={[styles.channelDivider, { backgroundColor: themeColors.border }]} />}
          <ChannelToggleRow
            type={channel.type}
            label={channel.label}
            enabled={channel.enabled}
            onToggle={() => onToggle(channel.type, channel.id, channel.enabled)}
            disabled={savingIds.has(`${channel.type}-${channel.id}`)}
          />
        </React.Fragment>
      ))}
      {item.note && (
        <Text style={[styles.infoNote, { color: themeColors.textTertiary }]}>
          {item.note}
        </Text>
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Frequency Picker — row of pressable chips
// -----------------------------------------------------------------------------

interface FrequencyPickerProps {
  label: string;
  description: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
  note?: string;
}

function FrequencyPicker({ label, description, value, options, onChange, disabled, note }: FrequencyPickerProps) {
  const { colors: themeColors } = useTheme();

  return (
    <View style={[styles.notificationCard, { backgroundColor: themeColors.surface }]}>
      <View style={styles.cardHeader}>
        <View style={styles.frequencyTitleRow}>
          <Ionicons name="mail-outline" size={18} color={themeColors.textSecondary} style={styles.channelIcon} />
          <Text style={[styles.cardTitle, { color: themeColors.text }]}>{label}</Text>
        </View>
        <Text style={[styles.cardDescription, { color: themeColors.textSecondary }]}>
          {description}
        </Text>
      </View>
      <View style={styles.frequencyRow}>
        {options.map(option => {
          const isSelected = value === option.value;
          return (
            <Pressable
              key={option.value}
              style={[
                styles.frequencyChip,
                { backgroundColor: themeColors.background, borderColor: themeColors.border },
                isSelected && { backgroundColor: themeColors.primary, borderColor: themeColors.primary },
                disabled && { opacity: 0.5 },
              ]}
              onPress={() => !disabled && onChange(option.value)}
              disabled={disabled}
            >
              <Text
                style={[
                  styles.frequencyChipText,
                  { color: themeColors.textSecondary },
                  isSelected && { color: themeColors.textInverse },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {note && (
        <Text style={[styles.infoNote, { color: themeColors.textTertiary }]}>{note}</Text>
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Space Email Row — space name + cycle-on-tap dropdown selector
// -----------------------------------------------------------------------------

interface SpaceEmailRowProps {
  spaceTitle: string;
  value: SpacePrefValue;
  onChange: (value: SpacePrefValue) => void;
  disabled?: boolean;
}

function SpaceEmailRow({ spaceTitle, value, onChange, disabled }: SpaceEmailRowProps) {
  const { colors: themeColors } = useTheme();

  const currentLabel = SPACE_PREF_OPTIONS.find(o => o.value === value)?.label ?? 'Off';
  const isActive = value !== '';

  // Cycle to next option on tap
  const handleCycle = () => {
    if (disabled) return;
    const currentIndex = SPACE_PREF_OPTIONS.findIndex(o => o.value === value);
    const nextIndex = (currentIndex + 1) % SPACE_PREF_OPTIONS.length;
    onChange(SPACE_PREF_OPTIONS[nextIndex].value);
  };

  return (
    <View style={styles.spaceRow}>
      <Text
        style={[styles.spaceTitle, { color: themeColors.text }]}
        numberOfLines={2}
      >
        {spaceTitle}
      </Text>
      <Pressable
        style={[
          styles.spaceSelector,
          { backgroundColor: themeColors.background, borderColor: themeColors.border },
          isActive && { backgroundColor: themeColors.primary, borderColor: themeColors.primary },
          disabled && { opacity: 0.5 },
        ]}
        onPress={handleCycle}
        disabled={disabled}
      >
        <Text
          style={[
            styles.spaceSelectorText,
            { color: themeColors.textSecondary },
            isActive && { color: themeColors.textInverse },
          ]}
        >
          {currentLabel}
        </Text>
        <Ionicons
          name="chevron-expand-outline"
          size={14}
          color={isActive ? themeColors.textInverse : themeColors.textTertiary}
        />
      </Pressable>
    </View>
  );
}

// =============================================================================
// Main Screen Component
// =============================================================================

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();
  const { user } = useAuth();

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [pushPrefs, setPushPrefs] = useState<CategoryPreferences>({});
  const [emailPrefs, setEmailPrefs] = useState<EmailPrefsResponse | null>(null);
  const emailPrefsRef = useRef<EmailPrefsResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<{ push?: string; email?: string }>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [pushPermission, setPushPermission] = useState<PushPermissionStatus>('undetermined');

  // ---------------------------------------------------------------------------
  // Feature Checks
  // ---------------------------------------------------------------------------

  const pushAvailable = isPushAvailable();
  const pushEnabled = FEATURES.PUSH_NOTIFICATIONS;
  const showPush = pushAvailable && pushEnabled && pushPermission === 'granted';

  // ---------------------------------------------------------------------------
  // Fetch Settings
  // ---------------------------------------------------------------------------

  const fetchSettings = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      setError({});

      // Check OS-level push permission
      const permStatus = await getPushPermissionStatus();
      setPushPermission(permStatus);

      const authToken = await getAuthToken();
      if (!authToken || !user?.username) {
        setError({ push: 'Not authenticated', email: 'Not authenticated' });
        return;
      }

      // Fetch push settings if device is capable AND permission is granted
      const canFetchPush = pushAvailable && pushEnabled && permStatus === 'granted';

      // Fetch both APIs in parallel
      const [pushResult, emailResult] = await Promise.all([
        canFetchPush ? getPushSettings(authToken) : Promise.resolve(null),
        getEmailPrefs(user.username),
      ]);

      const newError: { push?: string; email?: string } = {};

      if (pushResult && pushResult.success && pushResult.data?.preferences) {
        setPushPrefs(pushResult.data.preferences);
      } else if (pushResult && !pushResult.success) {
        newError.push = pushResult.error || 'Failed to load push settings';
      }

      if (emailResult.success && emailResult.data) {
        setEmailPrefs(emailResult.data);
        emailPrefsRef.current = emailResult.data;
      } else if (!emailResult.success) {
        newError.email = typeof emailResult.error === 'object'
          ? emailResult.error.message
          : 'Failed to load email settings';
      }

      if (newError.push || newError.email) {
        setError(newError);
      }
    } catch (err) {
      setError({
        push: err instanceof Error ? err.message : 'Something went wrong',
        email: err instanceof Error ? err.message : 'Something went wrong',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pushAvailable, pushEnabled, user?.username]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // ---------------------------------------------------------------------------
  // Build Unified Model
  // ---------------------------------------------------------------------------

  // Flatten push prefs into a lookup by id
  const pushLookup = useMemo(() => {
    const lookup: Record<string, PushPreference> = {};
    for (const prefs of Object.values(pushPrefs)) {
      for (const pref of prefs) {
        lookup[pref.id] = pref;
      }
    }
    return lookup;
  }, [pushPrefs]);

  const unifiedSections = useMemo(() => {
    const sections: UnifiedSection[] = [];
    const categoryMap: Record<string, UnifiedItem[]> = {};

    for (const mapping of NOTIFICATION_MAP) {
      const channels: ChannelInfo[] = [];

      // Add push channels
      if (mapping.pushIds) {
        for (let i = 0; i < mapping.pushIds.length; i++) {
          const pushId = mapping.pushIds[i];
          const pushPref = pushLookup[pushId];
          if (pushPref) {
            channels.push({
              type: 'push',
              id: pushId,
              label: mapping.pushLabels?.[i]
                ? `Push: ${mapping.pushLabels[i]}`
                : 'Push notification',
              enabled: pushPref.enabled,
            });
          }
        }
      }

      // Add email channel
      if (mapping.emailKey && emailPrefs?.user_globals) {
        const emailValue = emailPrefs.user_globals[mapping.emailKey];
        if (mapping.emailKey !== 'message_email_frequency') {
          channels.push({
            type: 'email',
            id: mapping.emailKey,
            label: 'Email notification',
            enabled: emailValue === 'yes',
          });
        }
      }

      // Only include items that have at least one visible channel
      const hasVisibleChannel = channels.some(
        ch => ch.type === 'email' || (ch.type === 'push' && showPush)
      );
      if (!hasVisibleChannel) continue;

      if (!categoryMap[mapping.category]) {
        categoryMap[mapping.category] = [];
      }

      categoryMap[mapping.category].push({
        key: mapping.key,
        label: mapping.label,
        description: mapping.description,
        channels,
        note: mapping.note,
      });
    }

    // Build sections in display order
    for (const [catKey, catTitle] of Object.entries(CATEGORY_CONFIG)) {
      const items = categoryMap[catKey];
      if (items && items.length > 0) {
        sections.push({ category: catKey, title: catTitle, items });
      }
    }

    return sections;
  }, [pushLookup, emailPrefs, showPush]);

  // ---------------------------------------------------------------------------
  // Toggle Handlers
  // ---------------------------------------------------------------------------

  const addSaving = (key: string) => {
    setSavingIds(prev => new Set(prev).add(key));
  };

  const removeSaving = (key: string) => {
    setSavingIds(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  // Push toggle — partial update
  const handlePushToggle = async (prefId: string, currentEnabled: boolean) => {
    const savingKey = `push-${prefId}`;
    addSaving(savingKey);

    // Optimistic update
    setPushPrefs(prev => {
      const updated = { ...prev };
      for (const category of Object.keys(updated)) {
        updated[category] = updated[category].map(pref =>
          pref.id === prefId ? { ...pref, enabled: !currentEnabled } : pref
        );
      }
      return updated;
    });

    try {
      const authToken = await getAuthToken();
      if (!authToken) throw new Error('Not authenticated');

      const response = await updatePushSettings(authToken, { [prefId]: !currentEnabled });
      if (!response.success) throw new Error('Save failed');
    } catch {
      // Revert
      setPushPrefs(prev => {
        const updated = { ...prev };
        for (const category of Object.keys(updated)) {
          updated[category] = updated[category].map(pref =>
            pref.id === prefId ? { ...pref, enabled: currentEnabled } : pref
          );
        }
        return updated;
      });
    } finally {
      removeSaving(savingKey);
    }
  };

  // Email toggle — full replacement POST
  const handleEmailToggle = async (emailKey: string, currentEnabled: boolean) => {
    if (!emailPrefsRef.current || !user?.username) return;

    const savingKey = `email-${emailKey}`;
    addSaving(savingKey);

    const newValue = currentEnabled ? 'no' : 'yes';
    const oldValue = currentEnabled ? 'yes' : 'no';

    // Optimistic update
    setEmailPrefs(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        user_globals: { ...prev.user_globals, [emailKey]: newValue },
      };
    });

    // Update ref for full-replacement POST
    const prevGlobals = { ...emailPrefsRef.current.user_globals };
    emailPrefsRef.current = {
      ...emailPrefsRef.current,
      user_globals: { ...emailPrefsRef.current.user_globals, [emailKey]: newValue } as EmailUserGlobals,
    };

    try {
      const result = await updateEmailPrefs(user.username, {
        user_globals: emailPrefsRef.current.user_globals,
        space_prefs: buildSpacePrefsPayload(),
      });
      if (!result.success) throw new Error('Save failed');
    } catch {
      // Revert
      setEmailPrefs(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          user_globals: { ...prev.user_globals, [emailKey]: oldValue },
        };
      });
      emailPrefsRef.current = {
        ...emailPrefsRef.current,
        user_globals: prevGlobals as EmailUserGlobals,
      };
    } finally {
      removeSaving(savingKey);
    }
  };

  // DM frequency change — full replacement POST
  const handleFrequencyChange = async (newValue: string) => {
    if (!emailPrefsRef.current || !user?.username) return;

    const savingKey = 'email-message_email_frequency';
    addSaving(savingKey);

    const oldValue = emailPrefsRef.current.user_globals.message_email_frequency;

    // Optimistic update
    setEmailPrefs(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        user_globals: {
          ...prev.user_globals,
          message_email_frequency: newValue as EmailUserGlobals['message_email_frequency'],
        },
      };
    });

    emailPrefsRef.current = {
      ...emailPrefsRef.current,
      user_globals: {
        ...emailPrefsRef.current.user_globals,
        message_email_frequency: newValue as EmailUserGlobals['message_email_frequency'],
      },
    };

    try {
      const result = await updateEmailPrefs(user.username, {
        user_globals: emailPrefsRef.current.user_globals,
        space_prefs: buildSpacePrefsPayload(),
      });
      if (!result.success) throw new Error('Save failed');
    } catch {
      // Revert
      setEmailPrefs(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          user_globals: {
            ...prev.user_globals,
            message_email_frequency: oldValue,
          },
        };
      });
      emailPrefsRef.current = {
        ...emailPrefsRef.current,
        user_globals: {
          ...emailPrefsRef.current.user_globals,
          message_email_frequency: oldValue,
        },
      };
    } finally {
      removeSaving(savingKey);
    }
  };

  // Space email pref change — full replacement POST
  const handleSpacePrefChange = async (spaceId: number, newValue: SpacePrefValue) => {
    if (!emailPrefsRef.current || !user?.username) return;

    const savingKey = `space-${spaceId}`;
    addSaving(savingKey);

    const oldValue = getSpacePref(spaceId);

    // Optimistic update in spaceGroups (for UI)
    setEmailPrefs(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        spaceGroups: prev.spaceGroups.map(group => ({
          ...group,
          spaces: group.spaces.map(space =>
            space.id === spaceId ? { ...space, pref: newValue } : space
          ),
        })),
      };
    });

    // Update ref
    const prevSpaceGroups = emailPrefsRef.current.spaceGroups;
    emailPrefsRef.current = {
      ...emailPrefsRef.current,
      spaceGroups: emailPrefsRef.current.spaceGroups.map(group => ({
        ...group,
        spaces: group.spaces.map(space =>
          space.id === spaceId ? { ...space, pref: newValue } : space
        ),
      })),
    };

    try {
      const result = await updateEmailPrefs(user.username, {
        user_globals: emailPrefsRef.current.user_globals,
        space_prefs: buildSpacePrefsPayload(),
      });
      if (!result.success) throw new Error('Save failed');
    } catch {
      // Revert
      setEmailPrefs(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          spaceGroups: prev.spaceGroups.map(group => ({
            ...group,
            spaces: group.spaces.map(space =>
              space.id === spaceId ? { ...space, pref: oldValue } : space
            ),
          })),
        };
      });
      emailPrefsRef.current = {
        ...emailPrefsRef.current,
        spaceGroups: prevSpaceGroups,
      };
    } finally {
      removeSaving(savingKey);
    }
  };

  // Unified toggle dispatcher
  const handleToggle = (channelType: ChannelType, id: string, currentEnabled: boolean) => {
    if (channelType === 'push') {
      handlePushToggle(id, currentEnabled);
    } else {
      handleEmailToggle(id, currentEnabled);
    }
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Build the space_prefs payload from the ref's spaceGroups */
  const buildSpacePrefsPayload = (): Record<string, SpacePrefValue> => {
    const prefs: Record<string, SpacePrefValue> = {};
    if (!emailPrefsRef.current) return prefs;
    for (const group of emailPrefsRef.current.spaceGroups) {
      for (const space of group.spaces) {
        prefs[String(space.id)] = space.pref;
      }
    }
    return prefs;
  };

  /** Get current space pref from state */
  const getSpacePref = (spaceId: number): SpacePrefValue => {
    if (!emailPrefs) return '';
    for (const group of emailPrefs.spaceGroups) {
      for (const space of group.spaces) {
        if (space.id === spaceId) return space.pref;
      }
    }
    return '';
  };

  /** Check if space groups have any spaces */
  const hasSpaces = emailPrefs?.spaceGroups?.some(g => g.spaces.length > 0) ?? false;

  // Default frequency label for helper text
  const defaultFreqLabel = emailPrefs?.default_messaging_email_frequency
    ? emailPrefs.default_messaging_email_frequency.charAt(0).toUpperCase() +
      emailPrefs.default_messaging_email_frequency.slice(1)
    : '';

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Loading state
  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
          <PageHeader
            leftAction="back"
            onLeftPress={() => router.back()}
            title="Notifications"
          />
          <LoadingSpinner />
        </View>
      </>
    );
  }

  // Full error (both APIs failed)
  if (error.push && error.email) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
          <PageHeader
            leftAction="back"
            onLeftPress={() => router.back()}
            title="Notifications"
          />
          <ErrorMessage
            title="Failed to Load"
            message={error.email || error.push || 'Something went wrong'}
            onRetry={() => { setLoading(true); fetchSettings(); }}
          />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
        <PageHeader
          leftAction="back"
          onLeftPress={() => router.back()}
          title="Notifications"
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchSettings(true)}
              colors={[themeColors.primary]}
              tintColor={themeColors.primary}
            />
          }
        >
          {/* Header Info */}
          <View style={[styles.headerInfo, { backgroundColor: themeColors.surface }]}>
            <Ionicons name="notifications" size={40} color={themeColors.primary} />
            <Text style={[styles.headerTitle, { color: themeColors.text }]}>Notification Settings</Text>
            <Text style={[styles.headerSubtitle, { color: themeColors.textSecondary }]}>
              Manage your push and email notification preferences
            </Text>
          </View>

          {/* Push unavailable / permission banners */}
          {!pushEnabled && (
            <View style={[styles.infoBanner, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <Ionicons name="information-circle-outline" size={20} color={themeColors.textSecondary} />
              <Text style={[styles.infoBannerText, { color: themeColors.textSecondary }]}>
                Push notifications are disabled.
              </Text>
            </View>
          )}
          {pushEnabled && !pushAvailable && (
            <View style={[styles.infoBanner, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <Ionicons name="information-circle-outline" size={20} color={themeColors.textSecondary} />
              <Text style={[styles.infoBannerText, { color: themeColors.textSecondary }]}>
                Push notifications require a physical device.
              </Text>
            </View>
          )}
          {pushEnabled && pushAvailable && pushPermission === 'denied' && (
            <Pressable
              style={[styles.infoBanner, { backgroundColor: themeColors.surface, borderColor: themeColors.error }]}
              onPress={() => Linking.openSettings()}
            >
              <Ionicons name="notifications-off-outline" size={20} color={themeColors.error} />
              <Text style={[styles.infoBannerText, { color: themeColors.error, flex: 1 }]}>
                Push notifications are turned off in your device settings.
              </Text>
              <Text style={[styles.bannerAction, { color: themeColors.primary }]}>Open Settings</Text>
            </Pressable>
          )}
          {pushEnabled && pushAvailable && pushPermission === 'undetermined' && (
            <Pressable
              style={[styles.infoBanner, { backgroundColor: themeColors.surface, borderColor: themeColors.primary }]}
              onPress={async () => {
                const authToken = await getAuthToken();
                if (authToken) {
                  const success = await registerDeviceToken(authToken);
                  if (success) {
                    setPushPermission('granted');
                    fetchSettings(true);
                  } else {
                    // User may have denied — re-check
                    const status = await getPushPermissionStatus();
                    setPushPermission(status);
                  }
                }
              }}
            >
              <Ionicons name="notifications-outline" size={20} color={themeColors.primary} />
              <Text style={[styles.infoBannerText, { color: themeColors.textSecondary, flex: 1 }]}>
                Enable push notifications to receive alerts.
              </Text>
              <Text style={[styles.bannerAction, { color: themeColors.primary }]}>Enable</Text>
            </Pressable>
          )}

          {/* Partial error banners */}
          {error.push && !error.email && (
            <View style={[styles.infoBanner, { backgroundColor: themeColors.surface, borderColor: themeColors.error }]}>
              <Ionicons name="alert-circle-outline" size={20} color={themeColors.error} />
              <Text style={[styles.infoBannerText, { color: themeColors.error }]}>
                Could not load push settings. Pull to refresh.
              </Text>
            </View>
          )}
          {error.email && !error.push && (
            <View style={[styles.infoBanner, { backgroundColor: themeColors.surface, borderColor: themeColors.error }]}>
              <Ionicons name="alert-circle-outline" size={20} color={themeColors.error} />
              <Text style={[styles.infoBannerText, { color: themeColors.error }]}>
                Could not load email settings. Pull to refresh.
              </Text>
            </View>
          )}

          {/* Unified notification sections */}
          {unifiedSections.map(section => (
            <View key={section.category} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
                {section.title}
              </Text>
              {section.items.map(item => (
                <NotificationCard
                  key={item.key}
                  item={item}
                  onToggle={handleToggle}
                  savingIds={savingIds}
                  showPush={showPush}
                />
              ))}
            </View>
          ))}

          {/* Email-only section: Digest + DM frequency */}
          {emailPrefs && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
                Email
              </Text>

              {/* Weekly Digest */}
              <NotificationCard
                item={{
                  key: 'digest',
                  label: `Weekly Digest${emailPrefs.digestEmailDay ? ` (${emailPrefs.digestEmailDay})` : ''}`,
                  description: 'Receive a weekly summary email with community highlights',
                  channels: [
                    {
                      type: 'email',
                      id: 'digest_mail',
                      label: 'Email notification',
                      enabled: emailPrefs.user_globals.digest_mail === 'yes',
                    },
                  ],
                }}
                onToggle={handleToggle}
                savingIds={savingIds}
                showPush={false}
              />

              {/* DM Email Frequency */}
              <FrequencyPicker
                label="Message Emails"
                description="How often to receive email notifications for direct messages"
                value={emailPrefs.user_globals.message_email_frequency}
                options={FREQUENCY_OPTIONS}
                onChange={handleFrequencyChange}
                disabled={savingIds.has('email-message_email_frequency')}
                note={defaultFreqLabel ? `Community default: ${defaultFreqLabel}` : undefined}
              />
            </View>
          )}

          {/* Per-space email notifications */}
          {emailPrefs && hasSpaces && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
                Space Email Notifications
              </Text>
              <Text style={[styles.sectionSubtitle, { color: themeColors.textTertiary }]}>
                Choose which spaces send you email notifications for new posts
              </Text>

              <View style={[styles.spaceCard, { backgroundColor: themeColors.surface }]}>
                {emailPrefs.spaceGroups.map(group => (
                  <React.Fragment key={group.id}>
                    {group.spaces.length > 0 && (
                      <>
                        <Text style={[styles.spaceGroupTitle, { color: themeColors.textSecondary }]}>
                          {group.title}
                        </Text>
                        {group.spaces.map((space, index) => (
                          <React.Fragment key={space.id}>
                            {index > 0 && (
                              <View style={[styles.channelDivider, { backgroundColor: themeColors.border }]} />
                            )}
                            <SpaceEmailRow
                              spaceTitle={space.title}
                              value={space.pref}
                              onChange={(val) => handleSpacePrefChange(space.id, val)}
                              disabled={savingIds.has(`space-${space.id}`)}
                            />
                          </React.Fragment>
                        ))}
                      </>
                    )}
                  </React.Fragment>
                ))}
              </View>
            </View>
          )}

          {/* Bottom padding */}
          <View style={{ height: insets.bottom + spacing.xl }} />
        </ScrollView>
      </View>
    </>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: spacing.xl,
  },

  // Header Info
  headerInfo: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },

  headerTitle: {
    fontSize: typography.size.xl,
    fontWeight: '700',
    marginTop: spacing.md,
  },

  headerSubtitle: {
    fontSize: typography.size.md,
    marginTop: spacing.xs,
    textAlign: 'center',
  },

  // Info / Error banners
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    gap: spacing.sm,
  },

  infoBannerText: {
    flex: 1,
    fontSize: typography.size.sm,
  },

  bannerAction: {
    fontSize: typography.size.sm,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },

  // Section
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },

  sectionTitle: {
    fontSize: typography.size.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },

  sectionSubtitle: {
    fontSize: typography.size.sm,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },

  // Notification Card
  notificationCard: {
    borderRadius: 12,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },

  cardHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },

  cardTitle: {
    fontSize: typography.size.md,
    fontWeight: '600',
  },

  cardDescription: {
    fontSize: typography.size.sm,
    marginTop: 2,
  },

  // Channel Toggle Row
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },

  channelRowDisabled: {
    opacity: 0.6,
  },

  channelIcon: {
    marginRight: spacing.sm,
  },

  channelLabel: {
    flex: 1,
    fontSize: typography.size.sm,
  },

  channelDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.md + 18 + spacing.sm, // icon width + margin
  },

  // Toggle (reused from original)
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },

  toggleEnabled: {},

  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },

  toggleThumbEnabled: {
    alignSelf: 'flex-end',
  },

  // Info note
  infoNote: {
    fontSize: typography.size.xs,
    fontStyle: 'italic',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    marginTop: 2,
  },

  // Frequency Picker
  frequencyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  frequencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },

  frequencyChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    borderWidth: 1,
  },

  frequencyChipText: {
    fontSize: typography.size.sm,
    fontWeight: '500',
  },

  // Space Email Settings
  spaceCard: {
    borderRadius: 12,
    overflow: 'hidden',
    paddingBottom: spacing.sm,
  },

  spaceGroupTitle: {
    fontSize: typography.size.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },

  spaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },

  spaceTitle: {
    flex: 1,
    fontSize: typography.size.sm,
    marginRight: spacing.md,
  },

  spaceSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    minWidth: 100,
    justifyContent: 'center',
  },

  spaceSelectorText: {
    fontSize: typography.size.xs,
    fontWeight: '500',
  },
});
