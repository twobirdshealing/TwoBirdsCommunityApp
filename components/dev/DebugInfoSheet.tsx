// =============================================================================
// DEBUG INFO SHEET — OTA + version diagnostics
// =============================================================================
// Hidden developer panel triggered by long-pressing the header logo.
// Shows enough info to answer "which JS bundle is this device actually
// running?" — useful when verifying that an OTA push reached the device.
//
// Note: expo-updates doesn't expose the OTA --message string client-side.
// To identify which OTA is running, cross-reference the Update ID below
// against the dashboard's Update History list.
// =============================================================================

import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { BottomSheet, BottomSheetScrollView } from '@/components/common/BottomSheet';
import { Button } from '@/components/common/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/layout';

interface DebugInfoSheetProps {
  visible: boolean;
  onClose: () => void;
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return 'n/a';
  try {
    return date.toLocaleString();
  } catch {
    return String(date);
  }
}

export function DebugInfoSheet({ visible, onClose }: DebugInfoSheetProps) {
  const { colors } = useTheme();
  const [checking, setChecking] = useState(false);
  const [reloading, setReloading] = useState(false);

  // All values read fresh on every render so the sheet always reflects current state
  const expoVersion = Constants.expoConfig?.version ?? 'unknown';
  const runtimeVersion = Updates.runtimeVersion ?? 'unknown';
  const updateId = Updates.updateId ?? null;
  const isEmbedded = Updates.isEmbeddedLaunch;
  const createdAt = Updates.createdAt;
  const channel = Updates.channel ?? 'unknown';
  const isEnabled = Updates.isEnabled;

  const bundleSource = isEmbedded
    ? 'Embedded (App Store / direct install)'
    : 'OTA Update';

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
      Alert.alert('Check failed', e?.message || String(e));
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

  return (
    <BottomSheet visible={visible} onClose={onClose} heightPercentage={75} title="Debug Info">
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        <Section title="App / Bundle">
          <Row label="App version" value={expoVersion} />
          <Row label="Runtime version" value={runtimeVersion} />
          <Row label="Channel" value={channel} />
          <Row label="Updates enabled" value={isEnabled ? 'yes' : 'no'} />
        </Section>

        <Section title="Currently running">
          <Row label="Bundle source" value={bundleSource} highlight={!isEmbedded} />
          <Row label="Update ID" value={updateId ?? '(none — embedded bundle)'} mono />
          <Row label="Published" value={formatDate(createdAt)} />
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
          <Text style={[styles.hint, { color: colors.textTertiary }]}>
            "Reload app" applies any downloaded update immediately, without needing to force-quit.
          </Text>
        </Section>

        <Section title="How to identify which OTA is running">
          <Text style={[styles.helpText, { color: colors.textSecondary }]}>
            expo-updates does not expose the OTA message string on the device. To identify which update is currently running, copy the <Text style={{ fontWeight: typography.weight.bold }}>Update ID</Text> above and find the matching entry in the dashboard's Update History list.
            {'\n\n'}
            If <Text style={{ fontWeight: typography.weight.bold }}>Bundle source</Text> says "Embedded", no OTA has been applied — the app is running the JS that shipped in the App Store binary.
          </Text>
        </Section>
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
      <View style={[styles.sectionBody, { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderLight }]}>
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
