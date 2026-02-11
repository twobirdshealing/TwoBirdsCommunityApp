// =============================================================================
// REACTION BREAKDOWN MODAL - Shows who reacted with what
// =============================================================================
// Reusable for both feeds and comments. Fetches breakdown data from
// the tbc-multi-reactions plugin endpoint.
// =============================================================================

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Avatar } from '@/components/common/Avatar';
import { BottomSheet } from '@/components/common/BottomSheet';
import { ReactionIcon } from './ReactionIcon';
import { feedsApi } from '@/services/api';
import { BreakdownItem } from '@/services/api/feeds';
import { spacing, typography } from '@/constants/layout';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface ReactionBreakdownModalProps {
  visible: boolean;
  onClose: () => void;
  objectType: 'feed' | 'comment';
  objectId: number;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ReactionBreakdownModal({
  visible,
  onClose,
  objectType,
  objectId,
}: ReactionBreakdownModalProps) {
  const { colors: themeColors } = useTheme();
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');

  useEffect(() => {
    if (visible && objectId) {
      fetchBreakdown();
    }
    if (!visible) {
      setActiveTab('all');
      setBreakdown([]);
      setLoading(true);
    }
  }, [visible, objectId]);

  const fetchBreakdown = async () => {
    setLoading(true);
    try {
      const result = await feedsApi.getReactionBreakdownUsers(objectType, objectId);
      if (result.success) {
        setBreakdown(result.data.breakdown || []);
        setTotal(result.data.total || 0);
      }
    } catch (err) {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  // Get users for active tab
  const activeUsers = activeTab === 'all'
    ? breakdown.flatMap(b => b.users.map(u => ({ ...u, reactionType: b.type, emoji: b.emoji, icon_url: b.icon_url })))
    : (() => {
        const item = breakdown.find(b => b.type === activeTab);
        return item ? item.users.map(u => ({ ...u, reactionType: item.type, emoji: item.emoji, icon_url: item.icon_url })) : [];
      })();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      heightMode="content"
      minHeight={300}
      maxHeight="60%"
      title="Reactions"
    >
      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBar, { borderBottomColor: themeColors.borderLight }]}
        contentContainerStyle={styles.tabBarContent}
      >
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'all' && [styles.tabActive, { borderBottomColor: themeColors.primary }],
          ]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'all' ? themeColors.primary : themeColors.textSecondary },
          ]}>
            All {total}
          </Text>
        </TouchableOpacity>
        {breakdown.map(item => (
          <TouchableOpacity
            key={item.type}
            style={[
              styles.tab,
              activeTab === item.type && [styles.tabActive, { borderBottomColor: item.color }],
            ]}
            onPress={() => setActiveTab(item.type)}
          >
            <View style={styles.tabIcon}>
              <ReactionIcon iconUrl={item.icon_url} emoji={item.emoji} size={22} />
            </View>
            <Text style={[
              styles.tabText,
              { color: activeTab === item.type ? item.color : themeColors.textSecondary },
            ]}>
              {item.count}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={themeColors.primary} />
        </View>
      ) : activeUsers.length === 0 ? (
        <View style={styles.loadingContainer}>
          <Text style={{ color: themeColors.textSecondary }}>No reactions yet</Text>
        </View>
      ) : (
        <FlatList
          data={activeUsers}
          keyExtractor={(item, index) => `${item.user_id}-${index}`}
          style={styles.userList}
          renderItem={({ item }) => (
            <View style={[styles.userRow, { borderBottomColor: themeColors.borderLight }]}>
              <Avatar source={item.avatar} size="sm" />
              <Text style={[styles.userName, { color: themeColors.text }]} numberOfLines={1}>
                {item.display_name}
              </Text>
              {activeTab === 'all' && (
                <ReactionIcon iconUrl={item.icon_url} emoji={item.emoji} size={16} />
              )}
            </View>
          )}
        />
      )}
    </BottomSheet>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  tabBar: {
    borderBottomWidth: 1,
    maxHeight: 44,
  },
  tabBarContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  tabIcon: {},
  tabText: {
    fontSize: typography.size.sm,
    fontWeight: '500',
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  userList: {
    flex: 1,
    minHeight: 200,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  userName: {
    flex: 1,
    fontSize: typography.size.md,
  },
});
