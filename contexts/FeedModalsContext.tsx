// =============================================================================
// FEED MODALS CONTEXT - Shared modal instances for feed cards
// =============================================================================
// Hoists all FeedCard modals (menu, reaction picker, breakdown, media viewer,
// report) into a single provider so only 1 instance of each exists in the tree.
// Without this, each FeedCard in a FlashList renders its own 5 modals.
// =============================================================================

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feed, ReactionType } from '@/types/feed';
import { SITE_URL } from '@/constants/config';
import { DropdownMenu } from '@/components/common/DropdownMenu';
import type { DropdownMenuItem } from '@/components/common/DropdownMenu';
import { ReactionPicker } from '@/components/feed/ReactionPicker';
import { ReactionBreakdownModal } from '@/components/feed/ReactionBreakdownModal';
import { MediaViewer } from '@/components/media/MediaViewer';
import { ReportModal } from '@/components/common/ReportModal';


// -----------------------------------------------------------------------------
// Param Types
// -----------------------------------------------------------------------------

export interface MenuParams {
  feed: Feed;
  anchor: { top: number; right: number };
  isOwner: boolean;
  canEditOrDelete: boolean;
  canPin: boolean;
  isSticky: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onPin?: () => void;
}

export interface ReactionPickerParams {
  anchor: { top: number; left: number };
  currentType: ReactionType | string | null;
  onSelect: (type: ReactionType) => void;
}

export interface BreakdownParams {
  objectType: 'feed' | 'comment';
  objectId: number;
}

export interface MediaViewerParams {
  images: { url: string }[];
  initialIndex: number;
}

export interface ReportParams {
  contentType: 'post' | 'comment';
  postId: number;
  parentId?: number;
  userId: number;
}

// -----------------------------------------------------------------------------
// Context Value
// -----------------------------------------------------------------------------

interface FeedModalsContextValue {
  openMenu: (params: MenuParams) => void;
  openReactionPicker: (params: ReactionPickerParams) => void;
  openReactionBreakdown: (params: BreakdownParams) => void;
  openMediaViewer: (params: MediaViewerParams) => void;
  openReport: (params: ReportParams) => void;
}

const FeedModalsContext = createContext<FeedModalsContextValue | null>(null);

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useFeedModals(): FeedModalsContextValue {
  const ctx = useContext(FeedModalsContext);
  if (!ctx) {
    throw new Error('useFeedModals must be used within a FeedModalsProvider');
  }
  return ctx;
}

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

export function FeedModalsProvider({ children }: { children: React.ReactNode }) {
  const [menuState, setMenuState] = useState<MenuParams | null>(null);
  const [pickerState, setPickerState] = useState<ReactionPickerParams | null>(null);
  const [breakdownState, setBreakdownState] = useState<BreakdownParams | null>(null);
  const [mediaState, setMediaState] = useState<MediaViewerParams | null>(null);
  const [reportState, setReportState] = useState<ReportParams | null>(null);

  // Stable opener functions (setState refs are stable)
  const openMenu = useCallback((params: MenuParams) => setMenuState(params), []);
  const openReactionPicker = useCallback((params: ReactionPickerParams) => setPickerState(params), []);
  const openReactionBreakdown = useCallback((params: BreakdownParams) => setBreakdownState(params), []);
  const openMediaViewer = useCallback((params: MediaViewerParams) => setMediaState(params), []);
  const openReport = useCallback((params: ReportParams) => setReportState(params), []);

  // Stable context value
  const value = useMemo<FeedModalsContextValue>(() => ({
    openMenu,
    openReactionPicker,
    openReactionBreakdown,
    openMediaViewer,
    openReport,
  }), [openMenu, openReactionPicker, openReactionBreakdown, openMediaViewer, openReport]);

  // ---------------------------------------------------------------------------
  // Menu items (built from menuState when open)
  // ---------------------------------------------------------------------------

  const getMenuItems = (): DropdownMenuItem[] => {
    if (!menuState) return [];
    const { feed, isOwner, canEditOrDelete, canPin, isSticky, onEdit, onDelete, onPin } = menuState;

    const handleCopyLink = async () => {
      const url = `${SITE_URL}/portal/post/${feed.slug}`;
      try {
        await Clipboard.setStringAsync(url);
        Alert.alert('Copied!', 'Link copied to clipboard');
      } catch {
        Alert.alert('Link', url);
      }
    };

    const items: DropdownMenuItem[] = [
      { key: 'copy', label: 'Copy Link', icon: 'link-outline', onPress: () => { setMenuState(null); handleCopyLink(); } },
    ];

    if (canPin) {
      items.push({
        key: 'pin',
        label: isSticky ? 'Unpin from Top' : 'Pin to Top',
        icon: 'pin-outline',
        onPress: () => { setMenuState(null); onPin?.(); },
      });
    }

    if (canEditOrDelete) {
      items.push(
        { key: 'edit', label: 'Edit', icon: 'create-outline', onPress: () => { setMenuState(null); onEdit?.(); } },
        { key: 'delete', label: 'Delete', icon: 'trash-outline', onPress: () => { setMenuState(null); onDelete?.(); }, destructive: true },
      );
    }

    if (!isOwner) {
      items.push({
        key: 'report',
        label: 'Report',
        icon: 'flag-outline',
        onPress: () => {
          setMenuState(null);
          setReportState({
            contentType: 'post',
            postId: feed.id,
            userId: Number(feed.user_id),
          });
        },
        destructive: true,
      });
    }

    return items;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <FeedModalsContext.Provider value={value}>
      {children}

      {/* Post Options Menu */}
      <DropdownMenu
        visible={!!menuState}
        onClose={() => setMenuState(null)}
        items={getMenuItems()}
        anchor={menuState?.anchor}
      />

      {/* Reaction Picker */}
      <ReactionPicker
        visible={!!pickerState}
        onSelect={(type) => { pickerState?.onSelect(type); setPickerState(null); }}
        onClose={() => setPickerState(null)}
        currentType={pickerState?.currentType as ReactionType | null}
        anchor={pickerState?.anchor}
      />

      {/* Reaction Breakdown */}
      <ReactionBreakdownModal
        visible={!!breakdownState}
        onClose={() => setBreakdownState(null)}
        objectType={breakdownState?.objectType || 'feed'}
        objectId={breakdownState?.objectId || 0}
      />

      {/* Media Viewer */}
      <MediaViewer
        visible={!!mediaState}
        images={mediaState?.images ?? []}
        initialIndex={mediaState?.initialIndex ?? 0}
        onClose={() => setMediaState(null)}
      />

      {/* Report Modal */}
      <ReportModal
        visible={!!reportState}
        onClose={() => setReportState(null)}
        contentType={reportState?.contentType || 'post'}
        postId={reportState?.postId || 0}
        parentId={reportState?.parentId}
        userId={reportState?.userId || 0}
      />
    </FeedModalsContext.Provider>
  );
}
