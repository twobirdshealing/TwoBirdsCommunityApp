// =============================================================================
// USE FOLLOW TOGGLE - Shared hook for follow/unfollow with optimistic updates
// =============================================================================
// Used by: directory.tsx, space/[slug]/members.tsx
// =============================================================================

import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { profilesApi } from '@/services/api/profiles';
import type { MemberCardData } from '@/components/member/MemberCard';

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useFollowToggle() {
  const [followMap, setFollowMap] = useState<Record<number, number>>({});
  const [followLoadingMap, setFollowLoadingMap] = useState<Record<number, boolean>>({});

  const handleFollowPress = useCallback(async (member: MemberCardData) => {
    const memberId = Number(member.xprofile?.user_id || member.user_id);
    const username = member.xprofile?.username || member.username;
    if (!username || !memberId) return;

    const isCurrentlyFollowing = (followMap[memberId] || 0) > 0;

    // Optimistic update
    setFollowMap(prev => ({
      ...prev,
      [memberId]: isCurrentlyFollowing ? 0 : 1,
    }));
    setFollowLoadingMap(prev => ({ ...prev, [memberId]: true }));

    try {
      if (isCurrentlyFollowing) {
        await profilesApi.unfollowUser(username);
      } else {
        await profilesApi.followUser(username);
      }
    } catch (err) {
      if (__DEV__) console.error('[Follow] Toggle error:', err);
      // Revert on failure
      setFollowMap(prev => ({
        ...prev,
        [memberId]: isCurrentlyFollowing ? 1 : 0,
      }));
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setFollowLoadingMap(prev => ({ ...prev, [memberId]: false }));
    }
  }, [followMap]);

  const isFollowing = useCallback(
    (userId: number) => (followMap[userId] || 0) > 0,
    [followMap]
  );

  const isFollowLoading = useCallback(
    (userId: number) => followLoadingMap[userId] || false,
    [followLoadingMap]
  );

  return {
    followMap,
    setFollowMap,
    followLoadingMap,
    handleFollowPress,
    isFollowing,
    isFollowLoading,
  };
}
