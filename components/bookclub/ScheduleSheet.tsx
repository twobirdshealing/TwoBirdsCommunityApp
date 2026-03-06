// =============================================================================
// SCHEDULE SHEET - Meeting schedule table for bottom sheet display
// =============================================================================

import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { BottomSheetScrollView } from '@/components/common/BottomSheet';
import { Avatar } from '@/components/common/Avatar';
import { UserDisplayName } from '@/components/common/UserDisplayName';
import { spacing, typography, sizing } from '@/constants/layout';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { withOpacity } from '@/constants/colors';
import type { BookModerator, MeetingSchedule } from '@/types/bookclub';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface ScheduleSheetProps {
  schedule: MeetingSchedule[];
  meetingLink?: string;
  meetingId?: string | null;
  meetingPasscode?: string | null;
  moderator?: BookModerator | null;
  onModeratorPress?: () => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ScheduleSheet({ schedule, meetingLink, meetingId, meetingPasscode, moderator, onModeratorPress }: ScheduleSheetProps) {
  const { colors: themeColors } = useTheme();

  const hasMeeting = !!meetingLink;
  const hasSchedule = schedule.length > 0;

  if (!hasMeeting && !hasSchedule) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>
          No schedule available
        </Text>
      </View>
    );
  }

  return (
    <BottomSheetScrollView contentContainerStyle={styles.content}>
      {/* Zoom Meeting Info */}
      {hasMeeting && (
        <View style={[styles.meetingCard, { backgroundColor: withOpacity(themeColors.primary, 0.06) }]}>
          <Pressable
            style={[styles.zoomBtn, { backgroundColor: themeColors.primary }]}
            onPress={() => Linking.openURL(meetingLink!)}
          >
            <Ionicons name="videocam" size={18} color={themeColors.textInverse} />
            <Text style={[styles.zoomBtnText, { color: themeColors.textInverse }]}>Join Zoom Meeting</Text>
          </Pressable>
          {meetingId && (
            <Text style={[styles.meetingDetail, { color: themeColors.textSecondary }]}>
              Meeting ID: {meetingId}
            </Text>
          )}
          {meetingPasscode && (
            <Text style={[styles.meetingDetail, { color: themeColors.textSecondary }]}>
              Passcode: {meetingPasscode}
            </Text>
          )}
        </View>
      )}

      {/* Moderator */}
      {moderator && (
        <AnimatedPressable
          style={[styles.moderatorRow, { backgroundColor: withOpacity(themeColors.primary, 0.06) }]}
          onPress={onModeratorPress}
          disabled={!onModeratorPress}
        >
          <Avatar source={moderator.avatar} size="sm" fallback={moderator.display_name} />
          <View style={styles.moderatorInfo}>
            <Text style={[styles.moderatorLabel, { color: themeColors.textSecondary }]}>Facilitator</Text>
            <UserDisplayName
              name={moderator.display_name}
              verified={moderator.is_verified === 1}
              size="sm"
              numberOfLines={1}
            />
          </View>
          {onModeratorPress && (
            <Ionicons name="chevron-forward" size={18} color={themeColors.textTertiary} />
          )}
        </AnimatedPressable>
      )}

      {/* Schedule Table */}
      {hasSchedule && <View style={[styles.table, { borderColor: themeColors.borderLight }]}>
        {/* Header Row */}
        <View style={[styles.tableRow, styles.tableHeader, { backgroundColor: withOpacity(themeColors.primary, 0.05) }]}>
          <Text style={[styles.tableHeaderText, styles.colDate, { color: themeColors.textSecondary }]}>Date</Text>
          <Text style={[styles.tableHeaderText, styles.colTime, { color: themeColors.textSecondary }]}>Time</Text>
          <Text style={[styles.tableHeaderText, styles.colChapters, { color: themeColors.textSecondary }]}>Chapters</Text>
        </View>

        {/* Data Rows */}
        {schedule.map((meeting, index) => (
          <View
            key={index}
            style={[
              styles.tableRow,
              index < schedule.length - 1 && { borderBottomWidth: 1, borderBottomColor: themeColors.borderLight },
            ]}
          >
            <Text style={[styles.tableCell, styles.colDate, { color: themeColors.text }]}>{meeting.date}</Text>
            <Text style={[styles.tableCell, styles.colTime, { color: themeColors.text }]}>{meeting.time}</Text>
            <Text style={[styles.tableCell, styles.colChapters, { color: themeColors.text }]}>{meeting.chapters}</Text>
          </View>
        ))}
      </View>}
    </BottomSheetScrollView>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
  },

  empty: {
    padding: spacing.xl,
    alignItems: 'center',
  },

  emptyText: {
    fontSize: typography.size.sm,
  },

  meetingCard: {
    padding: spacing.md,
    borderRadius: sizing.borderRadius.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },

  zoomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: sizing.borderRadius.sm,
  },

  zoomBtnText: {
    fontSize: typography.size.md,
    fontWeight: '600',
  },

  meetingDetail: {
    fontSize: typography.size.sm,
    paddingLeft: spacing.sm,
  },

  moderatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: sizing.borderRadius.md,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },

  moderatorInfo: {
    flex: 1,
    gap: 2,
  },

  moderatorLabel: {
    fontSize: typography.size.xs,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  table: {
    borderWidth: 1,
    borderRadius: sizing.borderRadius.sm,
    overflow: 'hidden',
  },

  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },

  tableHeader: {},

  tableHeaderText: {
    fontSize: typography.size.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
  },

  tableCell: {
    fontSize: typography.size.sm,
  },

  colDate: {
    flex: 2,
  },

  colTime: {
    flex: 1,
  },

  colChapters: {
    flex: 1,
    textAlign: 'right',
  },
});

export default ScheduleSheet;
