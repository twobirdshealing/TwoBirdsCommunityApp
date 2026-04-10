// =============================================================================
// USE FOLLOW TOGGLE - Shared hook for follow/unfollow with optimistic updates
// =============================================================================
// Used by: directory.tsx, space/[slug]/members.tsx
// =============================================================================

import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { profilesApi } from '@/services/api/profiles';
import { optimisticUpdate } from '@/utils/optimisticUpdate';
import { createLogger } from '@/utils/logger';
import type { MemberCardData } from '@/components/member/MemberCard';

const log = createLogger('FollowToggle');

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

    setFollowLoadingMap(prev => ({ ...prev, [memberId]: true }));

    try {
      await optimisticUpdate(
        setFollowMap,
        prev => ({ ...prev, [memberId]: isCurrentlyFollowing ? 0 : 1 }),
        () => isCurrentlyFollowing
          ? profilesApi.unfollowUser(username)
          : profilesApi.followUser(username),
      );
    } catch (err) {
      log.error(err, 'Toggle error');
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setFollowLoadingMap(prev => ({ ...prev, [memberId]: false }));
    }
  }, [followMap]);

  const handleNotifyPress = useCallback(async (member: MemberCardData) => {
    const memberId = Number(member.xprofile?.user_id || member.user_id);
    const username = member.xprofile?.username || member.username;
    if (!username || !memberId) return;

    const currentLevel = followMap[memberId] || 0;
    if (currentLevel < 1) return; // must be following

    const newLevel = currentLevel === 2 ? 1 : 2;

    try {
      await optimisticUpdate(
        setFollowMap,
        prev => ({ ...prev, [memberId]: newLevel }),
        () => profilesApi.toggleFollowNotification(username),
      );
    } catch (err) {
      log.error(err, 'Toggle notification error');
    }
  }, [followMap]);

  const isFollowing = useCallback(
    (userId: number) => (followMap[userId] || 0) > 0,
    [followMap]
  );

  const isNotifyOn = useCallback(
    (userId: number) => followMap[userId] === 2,
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
    handleNotifyPress,
    isFollowing,
    isNotifyOn,
    isFollowLoading,
  };
}
