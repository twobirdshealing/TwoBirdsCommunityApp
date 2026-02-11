// =============================================================================
// PROFILE TABS - Tab navigation for profile sections
// =============================================================================
// UPDATED: Removed Spaces tab (redundant with main Spaces screen)
// Now shows: About, Posts, Comments
// =============================================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/layout';

export type ProfileTab = 'about' | 'posts' | 'comments';

interface ProfileTabsProps {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
}

const TABS: { key: ProfileTab; label: string }[] = [
  { key: 'about', label: 'About' },
  { key: 'posts', label: 'Posts' },
  { key: 'comments', label: 'Comments' },
];

export function ProfileTabs({ activeTab, onTabChange }: ProfileTabsProps) {
  const { colors: themeColors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
      {TABS.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tab, activeTab === tab.key && [styles.tabActive, { borderBottomColor: themeColors.primary }]]}
          onPress={() => onTabChange(tab.key)}
        >
          <Text style={[styles.tabText, { color: themeColors.textSecondary }, activeTab === tab.key && [styles.tabTextActive, { color: themeColors.primary }]]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },

  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },

  tabActive: {
  },

  tabText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },

  tabTextActive: {
    fontWeight: typography.weight.semibold,
  },
});

export default ProfileTabs;
