// =============================================================================
// NOTIFICATION SETTINGS SCREEN - Unified push + email notification preferences
// =============================================================================
// Fetches push notification types from TBC-CA plugin API and email notification
// preferences from Fluent Community API. Displays both channels together for
// each notification concept, with per-space email settings at the bottom.
// =============================================================================

import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { PageHeader } from '@/components/navigation/PageHeader';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import {
  ChannelType,
  FREQUENCY_OPTIONS,
  SPACE_PREF_OPTIONS,
  SpacePrefValue,
  UnifiedItem,
} from '@/constants/notificationMap';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
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
          disabled && { backgroundColor: themeColors.border },
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

  const settings = useNotificationSettings();

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (settings.loading) {
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
  if (settings.error.push && settings.error.email) {
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
            message={settings.error.email || settings.error.push || 'Something went wrong'}
            onRetry={() => settings.fetchSettings()}
          />
        </View>
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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
              refreshing={settings.refreshing}
              onRefresh={() => settings.fetchSettings(true)}
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
          {!settings.pushEnabled && (
            <View style={[styles.infoBanner, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <Ionicons name="information-circle-outline" size={20} color={themeColors.textSecondary} />
              <Text style={[styles.infoBannerText, { color: themeColors.textSecondary }]}>
                Push notifications are disabled.
              </Text>
            </View>
          )}
          {settings.pushEnabled && !settings.pushAvailable && (
            <View style={[styles.infoBanner, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <Ionicons name="information-circle-outline" size={20} color={themeColors.textSecondary} />
              <Text style={[styles.infoBannerText, { color: themeColors.textSecondary }]}>
                Push notifications require a physical device.
              </Text>
            </View>
          )}
          {settings.pushEnabled && settings.pushAvailable && settings.pushPermission === 'denied' && (
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
          {settings.pushEnabled && settings.pushAvailable && settings.pushPermission === 'undetermined' && (
            <Pressable
              style={[styles.infoBanner, { backgroundColor: themeColors.surface, borderColor: themeColors.primary }]}
              onPress={settings.handleEnablePush}
            >
              <Ionicons name="notifications-outline" size={20} color={themeColors.primary} />
              <Text style={[styles.infoBannerText, { color: themeColors.textSecondary, flex: 1 }]}>
                Enable push notifications to receive alerts.
              </Text>
              <Text style={[styles.bannerAction, { color: themeColors.primary }]}>Enable</Text>
            </Pressable>
          )}

          {/* Partial error banners */}
          {settings.error.push && !settings.error.email && (
            <View style={[styles.infoBanner, { backgroundColor: themeColors.surface, borderColor: themeColors.error }]}>
              <Ionicons name="alert-circle-outline" size={20} color={themeColors.error} />
              <Text style={[styles.infoBannerText, { color: themeColors.error }]}>
                Could not load push settings. Pull to refresh.
              </Text>
            </View>
          )}
          {settings.error.email && !settings.error.push && (
            <View style={[styles.infoBanner, { backgroundColor: themeColors.surface, borderColor: themeColors.error }]}>
              <Ionicons name="alert-circle-outline" size={20} color={themeColors.error} />
              <Text style={[styles.infoBannerText, { color: themeColors.error }]}>
                Could not load email settings. Pull to refresh.
              </Text>
            </View>
          )}

          {/* Unified notification sections */}
          {settings.unifiedSections.map(section => (
            <View key={section.category} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
                {section.title}
              </Text>
              {section.items.map(item => (
                <NotificationCard
                  key={item.key}
                  item={item}
                  onToggle={settings.handleToggle}
                  savingIds={settings.savingIds}
                  showPush={settings.showPush}
                />
              ))}
            </View>
          ))}

          {/* Email-only section: Digest + DM frequency */}
          {settings.emailPrefs && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
                Email
              </Text>

              {/* Weekly Digest */}
              <NotificationCard
                item={{
                  key: 'digest',
                  label: `Weekly Digest${settings.emailPrefs.digestEmailDay ? ` (${settings.emailPrefs.digestEmailDay})` : ''}`,
                  description: 'Receive a weekly summary email with community highlights',
                  channels: [
                    {
                      type: 'email',
                      id: 'digest_mail',
                      label: 'Email notification',
                      enabled: settings.emailPrefs.user_globals.digest_mail === 'yes',
                    },
                  ],
                }}
                onToggle={settings.handleToggle}
                savingIds={settings.savingIds}
                showPush={false}
              />

              {/* DM Email Frequency */}
              <FrequencyPicker
                label="Message Emails"
                description="How often to receive email notifications for direct messages"
                value={settings.emailPrefs.user_globals.message_email_frequency}
                options={settings.hasAdminDefault
                  ? [{ value: 'default', label: `Default (${settings.adminDefaultLabel})` }, ...FREQUENCY_OPTIONS]
                  : FREQUENCY_OPTIONS
                }
                onChange={settings.handleFrequencyChange}
                disabled={settings.savingIds.has('email-message_email_frequency')}
              />
            </View>
          )}

          {/* Per-space email notifications */}
          {settings.emailPrefs && settings.hasSpaces && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
                Space Email Notifications
              </Text>
              <Text style={[styles.sectionSubtitle, { color: themeColors.textTertiary }]}>
                Choose which spaces send you email notifications for new posts
              </Text>

              <View style={[styles.spaceCard, { backgroundColor: themeColors.surface }]}>
                {settings.emailPrefs.spaceGroups.map(group => (
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
                              onChange={(val) => settings.handleSpacePrefChange(space.id, val)}
                              disabled={settings.savingIds.has(`space-${space.id}`)}
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
    fontWeight: typography.weight.bold,
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
    borderRadius: sizing.borderRadius.sm,
    borderWidth: 1,
    gap: spacing.sm,
  },

  infoBannerText: {
    flex: 1,
    fontSize: typography.size.sm,
  },

  bannerAction: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    marginLeft: spacing.sm,
  },

  // Section
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },

  sectionTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
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
    borderRadius: sizing.borderRadius.md,
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
    fontWeight: typography.weight.semibold,
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
    marginLeft: spacing.md + 18 + spacing.sm,
  },

  // Toggle
  toggle: {
    width: 50,
    height: 30,
    borderRadius: sizing.borderRadius.full,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },

  toggleEnabled: {},

  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: sizing.borderRadius.full,
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
    borderRadius: sizing.borderRadius.lg,
    borderWidth: 1,
  },

  frequencyChipText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },

  // Space Email Settings
  spaceCard: {
    borderRadius: sizing.borderRadius.md,
    overflow: 'hidden',
    paddingBottom: spacing.sm,
  },

  spaceGroupTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
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
    borderRadius: sizing.borderRadius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    minWidth: 100,
    justifyContent: 'center',
  },

  spaceSelectorText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
});
