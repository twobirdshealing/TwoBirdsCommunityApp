// =============================================================================
// USE NOTIFICATION SETTINGS - State & logic for notification settings screen
// =============================================================================
// Manages: push prefs, email prefs, permission state, toggle handlers,
// unified model building, frequency changes, and space email prefs.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFeatures } from '@/contexts/AppConfigContext';
import {
  CategoryPreferences,
  ChannelInfo,
  ChannelType,
  SpacePrefValue,
  UnifiedItem,
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
  const features = useFeatures();

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [pushPrefs, setPushPrefs] = useState<CategoryPreferences>({});
  const [emailPrefs, setEmailPrefs] = useState<EmailPrefsResponse | null>(null);
  // Ref tracks latest email prefs across concurrent async handlers (avoids stale closures)
  const emailPrefsRef = useRef(emailPrefs);
  emailPrefsRef.current = emailPrefs;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<{ push?: string; email?: string }>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [pushPermission, setPushPermission] = useState<PushPermissionStatus>('undetermined');

  // ---------------------------------------------------------------------------
  // Feature Checks
  // ---------------------------------------------------------------------------

  const pushAvailable = isPushAvailable();
  const pushEnabled = features.push_notifications;
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
        canFetchPush ? getPushSettings() : Promise.resolve(null),
        getEmailPrefs(user.username),
      ]);

      const newError: { push?: string; email?: string } = {};

      if (pushResult && pushResult.success && pushResult.data?.preferences) {
        setPushPrefs(pushResult.data.preferences);
      } else if (pushResult && !pushResult.success) {
        newError.push = pushResult.error.message || 'Failed to load push settings';
      }

      if (emailResult.success && emailResult.data) {
        setEmailPrefs(emailResult.data);
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

  const unifiedSections = useMemo(() => {
    // Flatten all push prefs into a single array
    const allPrefs: PushPreference[] = Object.values(pushPrefs).flat();

    // Split into grouped (share a group slug) vs solo (standalone)
    const groups = new Map<string, PushPreference[]>();
    const soloPrefs: PushPreference[] = [];

    for (const pref of allPrefs) {
      if (pref.group) {
        const existing = groups.get(pref.group) || [];
        existing.push(pref);
        groups.set(pref.group, existing);
      } else {
        soloPrefs.push(pref);
      }
    }

    const categoryMap: Record<string, UnifiedItem[]> = {};
    const addItem = (cat: string, item: UnifiedItem) => {
      if (!categoryMap[cat]) categoryMap[cat] = [];
      categoryMap[cat].push(item);
    };

    // Helper: build email channel from email_key
    const buildEmailChannel = (emailKey: string | undefined): ChannelInfo | null => {
      if (!emailKey || !emailPrefs?.user_globals) return null;
      const val = emailPrefs.user_globals[emailKey];
      if (val === undefined) return null;
      return { type: 'email', id: emailKey, label: 'Email notification', enabled: val === 'yes' };
    };

    // Helper: build a unified item from one or more push members
    const buildItem = (
      key: string, label: string, description: string,
      members: PushPreference[], note?: string,
    ) => {
      const channels: ChannelInfo[] = members.map(m => ({
        type: 'push' as const,
        id: m.id,
        label: m.push_label ? `Push: ${m.push_label}` : 'Push notification',
        enabled: m.enabled,
      }));

      const emailCh = buildEmailChannel(members.find(m => m.email_key)?.email_key);
      if (emailCh) channels.push(emailCh);

      const hasVisible = channels.some(
        ch => ch.type === 'email' || (ch.type === 'push' && showPush),
      );
      if (!hasVisible) return;

      addItem(members[0].category, { key, label, description, channels, note });
    };

    // Process grouped items (e.g. mentions, reactions)
    for (const [groupSlug, members] of groups) {
      const meta = members.find(m => m.group_label) || members[0];
      buildItem(
        groupSlug,
        meta.group_label || meta.label,
        meta.group_description || meta.description,
        members,
        members.find(m => m.note)?.note,
      );
    }

    // Process solo (ungrouped) items
    for (const pref of soloPrefs) {
      buildItem(pref.id, pref.label, pref.description, [pref], pref.note);
    }

    // Build sections in API response order (server controls display order)
    const sections: UnifiedSection[] = [];
    for (const catKey of Object.keys(pushPrefs)) {
      if (categoryMap[catKey]?.length) {
        sections.push({
          category: catKey,
          title: catKey.charAt(0).toUpperCase() + catKey.slice(1),
          items: categoryMap[catKey],
        });
      }
    }

    return sections;
  }, [pushPrefs, emailPrefs, showPush]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const buildSpacePrefsPayload = (prefs: EmailPrefsResponse): Record<string, SpacePrefValue> => {
    const result: Record<string, SpacePrefValue> = {};
    for (const group of prefs.spaceGroups) {
      for (const space of group.spaces) {
        result[String(space.id)] = space.pref;
      }
    }
    return result;
  };

  const hasSpaces = emailPrefs?.spaceGroups?.some(g => g.spaces.length > 0) ?? false;

  // When admin sets a specific frequency (not "Per User Choice" / "disabled"),
  // expose it so the UI can show a "Default (Daily)" option — matching the web.
  const adminDefaultFreq = emailPrefs?.default_messaging_email_frequency;
  const hasAdminDefault = !!adminDefaultFreq && adminDefaultFreq !== 'disabled';
  const adminDefaultLabel = hasAdminDefault
    ? adminDefaultFreq.charAt(0).toUpperCase() + adminDefaultFreq.slice(1)
    : '';

  // ---------------------------------------------------------------------------
  // Optimistic Save Helper
  // ---------------------------------------------------------------------------

  /** Wraps optimistic update → API call → rollback on failure pattern.
   *  Optional stateRef keeps a mutable ref in sync so concurrent handlers
   *  always read the latest optimistic state (prevents stale closures). */
  const optimisticSave = async <S>(
    savingKey: string,
    setter: React.Dispatch<React.SetStateAction<S>>,
    applyUpdate: (prev: S) => S,
    applyRollback: (prev: S) => S,
    apiCall: () => Promise<{ success: boolean }>,
    stateRef?: React.MutableRefObject<S>,
  ) => {
    setSavingIds(prev => new Set(prev).add(savingKey));
    setter(applyUpdate);
    if (stateRef) stateRef.current = applyUpdate(stateRef.current);
    try {
      const result = await apiCall();
      if (!result.success) throw new Error('Save failed');
    } catch {
      setter(applyRollback);
      if (stateRef) stateRef.current = applyRollback(stateRef.current);
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(savingKey);
        return next;
      });
    }
  };

  // ---------------------------------------------------------------------------
  // Toggle Handlers
  // ---------------------------------------------------------------------------

  const handlePushToggle = (prefId: string, currentEnabled: boolean) => {
    const mapPrefs = (enabled: boolean) => (prev: CategoryPreferences) => {
      const updated = { ...prev };
      for (const category of Object.keys(updated)) {
        updated[category] = updated[category].map(pref =>
          pref.id === prefId ? { ...pref, enabled } : pref
        );
      }
      return updated;
    };

    optimisticSave(
      `push-${prefId}`,
      setPushPrefs,
      mapPrefs(!currentEnabled),
      mapPrefs(currentEnabled),
      async () => {
        const authToken = await getAuthToken();
        if (!authToken) throw new Error('Not authenticated');
        return updatePushSettings({ [prefId]: !currentEnabled });
      },
    );
  };

  const handleEmailToggle = (emailKey: string, currentEnabled: boolean) => {
    if (!emailPrefs || !user?.username) return;

    const newValue = currentEnabled ? 'no' : 'yes';
    const oldValue = currentEnabled ? 'yes' : 'no';
    const username = user.username;

    optimisticSave(
      `email-${emailKey}`,
      setEmailPrefs,
      (prev: EmailPrefsResponse | null) => {
        if (!prev) return prev;
        return { ...prev, user_globals: { ...prev.user_globals, [emailKey]: newValue } };
      },
      (prev: EmailPrefsResponse | null) => {
        if (!prev) return prev;
        return { ...prev, user_globals: { ...prev.user_globals, [emailKey]: oldValue } };
      },
      async () => {
        // Read from ref to get latest state (handles concurrent toggles)
        const current = emailPrefsRef.current!;
        return updateEmailPrefs(username, {
          user_globals: { ...current.user_globals, [emailKey]: newValue },
          space_prefs: buildSpacePrefsPayload(current),
        });
      },
      emailPrefsRef,
    );
  };

  const handleFrequencyChange = (newValue: string) => {
    if (!emailPrefs || !user?.username) return;

    const oldValue = emailPrefs.user_globals.message_email_frequency;
    const username = user.username;

    const applyFreq = (freq: string) => (prev: EmailPrefsResponse | null) => {
      if (!prev) return prev;
      return {
        ...prev,
        user_globals: {
          ...prev.user_globals,
          message_email_frequency: freq as EmailUserGlobals['message_email_frequency'],
        },
      };
    };

    optimisticSave(
      'email-message_email_frequency',
      setEmailPrefs,
      applyFreq(newValue),
      applyFreq(oldValue),
      async () => {
        const current = emailPrefsRef.current!;
        return updateEmailPrefs(username, {
          user_globals: {
            ...current.user_globals,
            message_email_frequency: newValue as EmailUserGlobals['message_email_frequency'],
          },
          space_prefs: buildSpacePrefsPayload(current),
        });
      },
      emailPrefsRef,
    );
  };

  const handleSpacePrefChange = (spaceId: number, newValue: SpacePrefValue) => {
    if (!emailPrefs || !user?.username) return;

    // Find old value
    let oldValue: SpacePrefValue = '';
    for (const group of emailPrefs.spaceGroups) {
      for (const space of group.spaces) {
        if (space.id === spaceId) { oldValue = space.pref; break; }
      }
    }

    const username = user.username;

    const applySpacePref = (pref: SpacePrefValue) => (prev: EmailPrefsResponse | null) => {
      if (!prev) return prev;
      return {
        ...prev,
        spaceGroups: prev.spaceGroups.map(group => ({
          ...group,
          spaces: group.spaces.map(space =>
            space.id === spaceId ? { ...space, pref } : space
          ),
        })),
      };
    };

    optimisticSave(
      `space-${spaceId}`,
      setEmailPrefs,
      applySpacePref(newValue),
      applySpacePref(oldValue),
      async () => {
        // Ref already has this space pref applied by optimisticSave
        const current = emailPrefsRef.current!;
        return updateEmailPrefs(username, {
          user_globals: current.user_globals,
          space_prefs: buildSpacePrefsPayload(current),
        });
      },
      emailPrefsRef,
    );
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
    hasAdminDefault,
    adminDefaultLabel,
    // Handlers
    fetchSettings,
    handleToggle,
    handleFrequencyChange,
    handleSpacePrefChange,
    handleEnablePush,
  };
}
