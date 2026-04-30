// =============================================================================
// DEBUG INFO SHEET — Tabbed diagnostics
// =============================================================================
// Hidden developer panel triggered by long-pressing the header logo.
// Tabs: Overview / OTA / Crash Reporting. Add more tabs by appending to TABS.
//
// Note: expo-updates doesn't expose the OTA --message string client-side. To
// identify which OTA is running, cross-reference the Update ID in the OTA tab
// against the dashboard's Update History list.
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { BottomSheet, BottomSheetScrollView } from '@/components/common/BottomSheet';
import { Button } from '@/components/common/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/layout';
import { flushSentry, getSentryStatus, isSentryInitialized } from '@/services/sentry';
import { createLogger } from '@/utils/logger';

const log = createLogger('DebugInfoSheet');

interface DebugInfoSheetProps {
  visible: boolean;
  onClose: () => void;
}

type TabKey = 'overview' | 'ota' | 'crash';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'ota', label: 'OTA / Updates' },
  { key: 'crash', label: 'Crash Reporting' },
];

function formatDate(date: Date | null | undefined): string {
  if (!date) return 'n/a';
  try {
    return date.toLocaleString();
  } catch {
    return String(date);
  }
}

function formatHeaders(headers: Record<string, string> | null | undefined): string {
  if (!headers || Object.keys(headers).length === 0) return '(none)';
  try {
    return JSON.stringify(headers);
  } catch {
    return '(unreadable)';
  }
}

export function DebugInfoSheet({ visible, onClose }: DebugInfoSheetProps) {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [checking, setChecking] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [recentLogs, setRecentLogs] = useState<string>('loading…');

  // ---- Updates / config snapshot ------------------------------------------
  // expo-updates v55 no longer exposes updateUrl/requestHeaders at runtime.
  // The URL is configured at build time via app.json → expo.updates.url, which
  // expoConfig surfaces through Constants. requestHeaders are write-only via
  // setUpdateRequestHeadersOverride; the active value isn't readable.
  const updateUrl =
    (Constants.expoConfig?.updates as { url?: string } | undefined)?.url ?? '(none)';
  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
      ?.projectId ?? 'unknown';
  const slug = Constants.expoConfig?.slug ?? 'unknown';
  const channel = Updates.channel ?? 'unknown';
  const runtimeVersion = Updates.runtimeVersion ?? 'unknown';
  const requestHeaders = '(not exposed by expo-updates v55)';

  // ---- Running update / embedded update -----------------------------------
  const updateId = Updates.updateId ?? null;
  const isEmbedded = Updates.isEmbeddedLaunch;
  const createdAt = Updates.createdAt;
  const embeddedUpdate =
    (Updates as unknown as {
      embeddedUpdate?: { id?: string; createdAt?: Date; runtimeVersion?: string };
    }).embeddedUpdate ?? null;

  // ---- Launch state -------------------------------------------------------
  const isEmergencyLaunch = Updates.isEmergencyLaunch ?? false;
  const emergencyLaunchReason = Updates.emergencyLaunchReason ?? null;
  const launchDuration =
    (Updates as unknown as { launchDuration?: number | null }).launchDuration ?? null;

  // ---- Native identity ----------------------------------------------------
  const appName = Application.applicationName ?? 'unknown';
  const applicationId = Application.applicationId ?? 'unknown';
  const nativeAppVersion = Application.nativeApplicationVersion ?? 'unknown';
  const nativeBuildVersion = Application.nativeBuildVersion ?? 'unknown';

  // ---- Other --------------------------------------------------------------
  const expoVersion = Constants.expoConfig?.version ?? 'unknown';
  const isEnabled = Updates.isEnabled;
  const sentryActive = isSentryInitialized();
  const sentryStatus = getSentryStatus();
  const bundleSource = isEmbedded ? 'Embedded (App Store / direct install)' : 'OTA Update';

  // Load recent log entries when the OTA tab is opened
  useEffect(() => {
    if (activeTab !== 'ota' || !visible) return;
    let cancelled = false;
    (async () => {
      try {
        const entries = await Updates.readLogEntriesAsync(60 * 60 * 1000);
        if (cancelled) return;
        if (entries.length === 0) {
          setRecentLogs('(none in last hour)');
          return;
        }
        const recent = entries.slice(-5).map((e) => `[${e.level}] ${e.code}: ${e.message}`);
        setRecentLogs(recent.join('\n'));
      } catch {
        if (!cancelled) setRecentLogs('(failed to read)');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, visible]);

  const handleCheckForUpdates = useCallback(async () => {
    setChecking(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        Alert.alert('Update available', 'Downloading update now...');
        try {
          await Updates.fetchUpdateAsync();
          Alert.alert(
            'Update downloaded',
            'Tap "Reload app" below to apply it immediately, or it will apply on next app launch.',
          );
        } catch (e: any) {
          Alert.alert('Download failed', e?.message || String(e));
        }
      } else {
        Alert.alert(
          'No update available',
          `This device is already running the latest update for runtime version ${runtimeVersion}.\n\nIf you just pushed an OTA from the dashboard and it isn't showing up, the dashboard's app.json version doesn't match this device's runtime version.`,
        );
      }
    } catch (e: any) {
      // The native UpdatesModule throws a generic wrapper ("Failed to check for update")
      // and swallows the real cause. Unwrap every level we can, and also read the
      // native expo-updates log buffer directly — that contains the underlying error
      // code (e.g. UpdateCodeSigningError, UpdateServerUnreachable, InitializationError)
      // even when the JS-side error object doesn't.
      const parts: string[] = [];
      if (e?.message) parts.push(`Message: ${e.message}`);
      if (e?.code) parts.push(`Code: ${e.code}`);
      if (e?.cause?.message) parts.push(`Cause: ${e.cause.message}`);
      if (e?.cause?.code) parts.push(`Cause code: ${e.cause.code}`);
      if (e?.cause?.cause?.message) parts.push(`Inner: ${e.cause.cause.message}`);
      if (e?.stack) {
        parts.push(`\nStack:\n${String(e.stack).split('\n').slice(0, 6).join('\n')}`);
      }
      try {
        const logs = await Updates.readLogEntriesAsync(60 * 60 * 1000);
        const serious = logs.filter(
          (l) => l.level === 'error' || l.level === 'warn' || l.level === 'fatal',
        );
        if (serious.length > 0) {
          parts.push('\nNative logs (last hour):');
          for (const entry of serious.slice(-5)) {
            parts.push(`[${entry.level}] ${entry.code}: ${entry.message}`);
            if (entry.stacktrace && entry.stacktrace.length > 0) {
              parts.push(`  ${entry.stacktrace.slice(0, 3).join(' | ')}`);
            }
          }
        }
      } catch {
        // readLogEntriesAsync itself can fail; ignore and show what we have.
      }
      const body = parts.length > 0 ? parts.join('\n') : String(e);
      Alert.alert('Check failed', body);
    } finally {
      setChecking(false);
    }
  }, [runtimeVersion]);

  const handleReload = useCallback(async () => {
    setReloading(true);
    try {
      await Updates.reloadAsync();
    } catch (e: any) {
      setReloading(false);
      Alert.alert('Reload failed', e?.message || String(e));
    }
  }, []);

  const handleTestSentryCrash = useCallback(() => {
    if (!sentryActive) {
      Alert.alert(
        'Sentry not initialized',
        'No DSN cached yet. Open the WordPress admin → TBC Community App → Crash Reporting, paste your Sentry DSN, save, then force-quit and relaunch the app twice (once to fetch the config, once to load it on cold start).',
      );
      return;
    }
    Alert.alert(
      'Send test crash?',
      'This will send a synthetic error to your Sentry dashboard so you can verify the integration. The app will not actually crash.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          style: 'destructive',
          onPress: async () => {
            setSendingTest(true);
            try {
              const err = new Error(
                `Sentry test event from DebugInfoSheet at ${new Date().toISOString()}`,
              );
              log.error(err, 'Manual Sentry test from debug menu', {
                triggeredBy: 'DebugInfoSheet',
                appVersion: expoVersion,
                channel,
              });
              // Flush before showing the success alert — without this, the user
              // could background the app before the HTTP request completes and
              // lose the test event entirely.
              const flushed = await flushSentry();
              Alert.alert(
                flushed ? 'Test event sent' : 'Sent (flush timed out)',
                flushed
                  ? 'Check your Sentry dashboard within ~30 seconds. The event will appear in the Issues feed tagged with source: DebugInfoSheet.'
                  : 'The flush call timed out, but Sentry may still deliver the event in the background. Check your dashboard in a minute.',
              );
            } finally {
              setSendingTest(false);
            }
          },
        },
      ],
    );
  }, [sentryActive, expoVersion, channel]);

  const handleCopyAll = async () => {
    const allDebugText = [
      '=== TBC Debug Info ===',
      '',
      '--- OVERVIEW ---',
      `App name: ${appName}`,
      `Bundle / Package: ${applicationId}`,
      `Native version: ${nativeAppVersion}`,
      `Native build code: ${nativeBuildVersion}`,
      `Bundle source: ${bundleSource}`,
      `Updates enabled: ${isEnabled ? 'yes' : 'no'}`,
      `Crash reporting: ${sentryActive ? 'Active' : 'Not configured'}`,
      '',
      '--- OTA / UPDATES ---',
      `Update URL: ${updateUrl}`,
      `Project ID: ${projectId}`,
      `Slug: ${slug}`,
      `Channel: ${channel}`,
      `Runtime version: ${runtimeVersion}`,
      `Request headers: ${requestHeaders}`,
      `Running update ID: ${updateId ?? '(none — embedded bundle)'}`,
      `Running createdAt: ${formatDate(createdAt)}`,
      `Embedded update ID: ${embeddedUpdate?.id ?? '(none)'}`,
      `Embedded createdAt: ${formatDate(embeddedUpdate?.createdAt)}`,
      `Embedded runtime: ${embeddedUpdate?.runtimeVersion ?? '(none)'}`,
      `Is emergency launch: ${isEmergencyLaunch ? 'yes' : 'no'}`,
      `Emergency reason: ${emergencyLaunchReason ?? '(none)'}`,
      `Launch duration (ms): ${launchDuration ?? '(unknown)'}`,
      `Recent log entries: ${recentLogs.replace(/\n/g, ' | ')}`,
      '',
      '--- CRASH REPORTING ---',
      `SDK initialized: ${sentryActive ? 'yes' : 'no'}`,
      `DSN host: ${sentryStatus?.dsnHost ?? '(not configured)'}`,
      `Environment: ${__DEV__ ? 'development' : 'production'}`,
    ].join('\n');

    try {
      await Clipboard.setStringAsync(allDebugText);
      Alert.alert('Copied', 'Debug info copied to clipboard.');
    } catch (e: any) {
      Alert.alert('Copy failed', e?.message || String(e));
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} heightPercentage={85} title="Debug Info">
      {/* Tab bar */}
      <View style={[styles.tabBar, { borderColor: colors.borderLight }]}>
        {TABS.map((t) => {
          const isActive = activeTab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setActiveTab(t.key)}
              style={[
                styles.tab,
                {
                  backgroundColor: isActive ? colors.primary : 'transparent',
                  borderColor: isActive ? colors.primary : colors.borderLight,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive ? colors.textInverse : colors.textSecondary,
                    fontWeight: isActive ? typography.weight.semibold : typography.weight.regular,
                  },
                ]}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Copy-all button — persists across tabs */}
      <View style={styles.copyAllRow}>
        <Button title="Copy all debug info" variant="secondary" onPress={handleCopyAll} />
      </View>

      <BottomSheetScrollView contentContainerStyle={styles.content}>
        {activeTab === 'overview' && (
          <>
            <Section title="App identity">
              <Row label="App name" value={appName} />
              <Row label="Bundle / Package" value={applicationId} mono />
              <Row label="Native version" value={nativeAppVersion} />
              <Row label="Native build code" value={nativeBuildVersion} />
            </Section>
            <Section title="Status">
              <Row label="Bundle source" value={bundleSource} highlight={!isEmbedded} />
              <Row label="Updates enabled" value={isEnabled ? 'yes' : 'no'} />
              <Row
                label="Crash reporting"
                value={sentryActive ? 'Active' : 'Not configured'}
                highlight={sentryActive}
              />
            </Section>
            <Section title="Actions">
              <View style={styles.buttonRow}>
                <Button
                  title={reloading ? 'Reloading...' : 'Reload app'}
                  variant="primary"
                  onPress={handleReload}
                  disabled={checking || reloading}
                />
              </View>
              <Text style={[styles.hint, { color: colors.textTertiary }]}>
                "Reload app" applies any downloaded update immediately, without needing to force-quit.
              </Text>
            </Section>
          </>
        )}

        {activeTab === 'ota' && (
          <>
            <Section title="Updates config">
              <Row label="Update URL" value={updateUrl} mono />
              <Row label="Project ID" value={projectId} mono />
              <Row label="Slug" value={slug} />
              <Row label="Channel" value={channel} />
              <Row label="Runtime version" value={runtimeVersion} />
              <Row label="Request headers" value={requestHeaders} mono />
            </Section>

            <Section title="Running update">
              <Row label="Bundle source" value={bundleSource} highlight={!isEmbedded} />
              <Row label="Update ID" value={updateId ?? '(none — embedded bundle)'} mono />
              <Row label="Published" value={formatDate(createdAt)} />
            </Section>

            <Section title="Embedded update">
              <Row label="Update ID" value={embeddedUpdate?.id ?? '(none)'} mono />
              <Row label="Published" value={formatDate(embeddedUpdate?.createdAt)} />
              <Row label="Runtime" value={embeddedUpdate?.runtimeVersion ?? '(none)'} />
            </Section>

            <Section title="Launch state">
              <Row
                label="Emergency launch"
                value={isEmergencyLaunch ? 'yes' : 'no'}
                highlight={isEmergencyLaunch}
              />
              <Row label="Emergency reason" value={emergencyLaunchReason ?? '(none)'} />
              <Row
                label="Launch duration (ms)"
                value={launchDuration != null ? String(launchDuration) : '(unknown)'}
              />
            </Section>

            <Section title="Recent log entries (last hour)">
              <Text
                style={[
                  styles.helpText,
                  styles.mono,
                  { color: colors.textSecondary },
                ]}
                selectable
              >
                {recentLogs}
              </Text>
            </Section>

            <Section title="Actions">
              <View style={styles.buttonRow}>
                <Button
                  title={checking ? 'Checking...' : 'Check for updates now'}
                  variant="secondary"
                  onPress={handleCheckForUpdates}
                  disabled={checking || reloading || !isEnabled}
                />
              </View>
              <View style={styles.buttonRow}>
                <Button
                  title={reloading ? 'Reloading...' : 'Reload app'}
                  variant="primary"
                  onPress={handleReload}
                  disabled={checking || reloading}
                />
              </View>
            </Section>

            <Section title="How to identify which OTA is running">
              <Text style={[styles.helpText, { color: colors.textSecondary }]}>
                expo-updates does not expose the OTA message string on the device. To identify which update is currently running, copy the <Text style={{ fontWeight: typography.weight.bold }}>Update ID</Text> above and find the matching entry in the dashboard's Update History list.
                {'\n\n'}
                If <Text style={{ fontWeight: typography.weight.bold }}>Bundle source</Text> says "Embedded", no OTA has been applied — the app is running the JS that shipped in the App Store binary.
              </Text>
            </Section>
          </>
        )}

        {activeTab === 'crash' && (
          <>
            <Section title="Sentry">
              <Row
                label="SDK initialized"
                value={sentryActive ? 'yes' : 'no'}
                highlight={sentryActive}
              />
              <Row
                label="DSN host"
                value={sentryStatus?.dsnHost ?? '(not configured)'}
                mono
              />
              <Row label="Environment" value={__DEV__ ? 'development' : 'production'} />
            </Section>
            <Section title="Actions">
              <View style={styles.buttonRow}>
                <Button
                  title={sendingTest ? 'Sending...' : 'Send test event to Sentry'}
                  variant="secondary"
                  onPress={handleTestSentryCrash}
                  disabled={checking || reloading || sendingTest}
                />
              </View>
              <Text style={[styles.hint, { color: colors.textTertiary }]}>
                {sentryActive
                  ? 'Tap to verify the full pipeline (logger → Sentry → dashboard).'
                  : 'Configure a DSN in WP admin → TBC Community App → Crash Reporting, then relaunch.'}
              </Text>
            </Section>
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
      <View
        style={[
          styles.sectionBody,
          { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderLight },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          { color: highlight ? colors.success : colors.text },
          mono && styles.mono,
        ]}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: typography.size.xs,
  },
  copyAllRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  sectionBody: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  row: {
    paddingVertical: spacing.sm,
    gap: 2,
  },
  rowLabel: {
    fontSize: typography.size.xs,
  },
  rowValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: typography.size.xs,
  },
  buttonRow: {
    marginBottom: spacing.sm,
  },
  hint: {
    fontSize: typography.size.xs,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  helpText: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    padding: spacing.xs,
  },
});
