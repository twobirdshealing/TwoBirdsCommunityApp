// =============================================================================
// TAB BAR - Reusable tab bar component
// =============================================================================
// Used by profile screen, connections screen, and any other tabbed view.
// =============================================================================

import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing } from '@/constants/layout';

interface TabBarProps<K extends string = string> {
  tabs: { key: K; title: string }[];
  activeTab: K;
  onTabChange: (key: K) => void;
}

function TabBarInner<K extends string>({ tabs, activeTab, onTabChange }: TabBarProps<K>) {
  const { colors: themeColors } = useTheme();

  if (tabs.length <= 1) return null;

  return (
    <View style={[styles.tabBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            style={styles.tab}
            onPress={() => onTabChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Text
              style={[
                styles.tabText,
                { color: isActive ? themeColors.primary : themeColors.textSecondary },
                isActive && styles.tabTextActive,
              ]}
            >
              {tab.title}
            </Text>
            {isActive && (
              <View style={[styles.tabIndicator, { backgroundColor: themeColors.primary }]} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export const TabBar = memo(TabBarInner) as typeof TabBarInner;

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    justifyContent: 'space-evenly',
  },

  tab: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    position: 'relative',
  },

  tabText: {
    fontSize: typography.size.md,
  },

  tabTextActive: {
    fontWeight: typography.weight.semibold,
  },

  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: spacing.sm,
    right: spacing.sm,
    height: 2,
    borderRadius: sizing.borderRadius.full,
  },
});
