// =============================================================================
// USE NOTIFICATION SETTINGS - State & logic for notification settings screen
// =============================================================================
// Manages: push prefs, email prefs, permission state, toggle handlers,
// unified model building, frequency changes, and space email prefs.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FEATURES } from '@/constants/config';
import {
  CategoryPreferences,
  ChannelInfo,
  ChannelType,
  NOTIFICATION_MAP,
  CATEGORY_CONFIG,
  SpacePrefValue,
  UnifiedSection,
} from '@/constants/notificationMap';
import { getPushSettings, updatePushSettings, PushPreference } from '@/services/api/push';
import {
  getEmailPrefs,
  updateEmailPrefs,
  EmailPrefsResponse,
  EmailUserGlobals,
} from '@/services/api/emailPrefs';
import {
  isPushAvailable,
  getPushPermissionStatus,
  registerDeviceToken,
  type PushPermissionStatus,
} from '@/services/push';
import { getAuthToken } from '@/services/auth';
import { useAuth } from '@/contexts/AuthContext';

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useNotificationSettings() {
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

      const permStatus = await getPushPermissionStatus();
      setPushPermission(permStatus);

      const authToken = await getAuthToken();
      if (!authToken || !user?.username) {
        setError({ push: 'Not authenticated', email: 'Not authenticated' });
        return;
      }

      const canFetchPush = pushAvailable && pushEnabled && permStatus === 'granted';

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
    const categoryMap: Record<string, { key: string; label: string; description: string; channels: ChannelInfo[]; note?: string }[]> = {};

    for (const mapping of NOTIFICATION_MAP) {
      const channels: ChannelInfo[] = [];

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

    for (const [catKey, catTitle] of Object.entries(CATEGORY_CONFIG)) {
      const items = categoryMap[catKey];
      if (items && items.length > 0) {
        sections.push({ category: catKey, title: catTitle, items });
      }
    }

    return sections;
  }, [pushLookup, emailPrefs, showPush]);

  // ---------------------------------------------------------------------------
  // Saving State Helpers
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

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

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

  const hasSpaces = emailPrefs?.spaceGroups?.some(g => g.spaces.length > 0) ?? false;

  const defaultFreqLabel = emailPrefs?.default_messaging_email_frequency
    ? emailPrefs.default_messaging_email_frequency.charAt(0).toUpperCase() +
      emailPrefs.default_messaging_email_frequency.slice(1)
    : '';

  // ---------------------------------------------------------------------------
  // Toggle Handlers
  // ---------------------------------------------------------------------------

  const handlePushToggle = async (prefId: string, currentEnabled: boolean) => {
    const savingKey = `push-${prefId}`;
    addSaving(savingKey);

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

  const handleEmailToggle = async (emailKey: string, currentEnabled: boolean) => {
    if (!emailPrefsRef.current || !user?.username) return;

    const savingKey = `email-${emailKey}`;
    addSaving(savingKey);

    const newValue = currentEnabled ? 'no' : 'yes';
    const oldValue = currentEnabled ? 'yes' : 'no';

    setEmailPrefs(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        user_globals: { ...prev.user_globals, [emailKey]: newValue },
      };
    });

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

  const handleFrequencyChange = async (newValue: string) => {
    if (!emailPrefsRef.current || !user?.username) return;

    const savingKey = 'email-message_email_frequency';
    addSaving(savingKey);

    const oldValue = emailPrefsRef.current.user_globals.message_email_frequency;

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

  const handleSpacePrefChange = async (spaceId: number, newValue: SpacePrefValue) => {
    if (!emailPrefsRef.current || !user?.username) return;

    const savingKey = `space-${spaceId}`;
    addSaving(savingKey);

    // Find old value
    let oldValue: SpacePrefValue = '';
    if (emailPrefs) {
      for (const group of emailPrefs.spaceGroups) {
        for (const space of group.spaces) {
          if (space.id === spaceId) { oldValue = space.pref; break; }
        }
      }
    }

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

  /** Unified toggle dispatcher */
  const handleToggle = (channelType: ChannelType, id: string, currentEnabled: boolean) => {
    if (channelType === 'push') {
      handlePushToggle(id, currentEnabled);
    } else {
      handleEmailToggle(id, currentEnabled);
    }
  };

  /** Enable push notifications (request permission + register token) */
  const handleEnablePush = async () => {
    const authToken = await getAuthToken();
    if (authToken) {
      const success = await registerDeviceToken(authToken);
      if (success) {
        setPushPermission('granted');
        fetchSettings(true);
      } else {
        const status = await getPushPermissionStatus();
        setPushPermission(status);
      }
    }
  };

  return {
    // State
    loading,
    refreshing,
    error,
    savingIds,
    pushPermission,
    emailPrefs,
    // Feature flags
    pushAvailable,
    pushEnabled,
    showPush,
    // Computed
    unifiedSections,
    hasSpaces,
    defaultFreqLabel,
    // Handlers
    fetchSettings,
    handleToggle,
    handleFrequencyChange,
    handleSpacePrefChange,
    handleEnablePush,
  };
}
