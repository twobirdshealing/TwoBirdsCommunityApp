// =============================================================================
// WELCOME BANNER WIDGET - Self-contained welcome banner for home page
// =============================================================================
// Fetches welcome banner data and renders existing WelcomeBanner component.
// Returns null if banner is disabled, fetch fails, or user dismissed it.
// Dismiss: 7-day expiry (matches Fluent web), re-shows if content changes.
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { spacing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { feedsApi } from '@/services/api/feeds';
import { WelcomeBanner as WelcomeBannerType } from '@/types/feed';
import { WelcomeBanner } from '@/components/feed/WelcomeBanner';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DISMISS_KEY = 'tbc_banner_dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Generate a fingerprint from the banner content so we detect any admin changes */
function getBannerFingerprint(banner: WelcomeBannerType): string {
  return JSON.stringify({
    t: banner.title,
    d: banner.description_rendered,
    m: banner.mediaType,
    i: banner.bannerImage,
    v: banner.bannerVideo,
    b: banner.ctaButtons,
  });
}

interface DismissData {
  expiresAt: number;
  fingerprint: string;
}

async function getDismissData(): Promise<DismissData | null> {
  try {
    const raw = await AsyncStorage.getItem(DISMISS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DismissData;
  } catch {
    return null;
  }
}

async function setDismissData(fingerprint: string): Promise<void> {
  const data: DismissData = {
    expiresAt: Date.now() + DISMISS_DURATION,
    fingerprint,
  };
  await AsyncStorage.setItem(DISMISS_KEY, JSON.stringify(data));
}

async function clearDismissData(): Promise<void> {
  await AsyncStorage.removeItem(DISMISS_KEY);
}

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface WelcomeBannerWidgetProps {
  refreshKey: number;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function WelcomeBannerWidget({ refreshKey }: WelcomeBannerWidgetProps) {
  const { colors: themeColors } = useTheme();
  const [banner, setBanner] = useState<WelcomeBannerType | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch banner + check dismiss state
  // ---------------------------------------------------------------------------

  const fetchBanner = useCallback(async () => {
    try {
      const response = await feedsApi.getWelcomeBanner();
      if (response.success && response.data?.welcome_banner) {
        const fetchedBanner = response.data.welcome_banner;
        setBanner(fetchedBanner);

        // Check dismiss state against current banner content
        if (fetchedBanner.allowClose === 'yes') {
          const dismissData = await getDismissData();
          if (dismissData) {
            const fingerprint = getBannerFingerprint(fetchedBanner);
            const expired = Date.now() >= dismissData.expiresAt;
            const contentChanged = dismissData.fingerprint !== fingerprint;

            if (expired || contentChanged) {
              // Dismiss expired or content changed — clear and show
              await clearDismissData();
              setDismissed(false);
            } else {
              // Still dismissed
              setDismissed(true);
            }
          }
        }
      } else {
        setBanner(null);
      }
    } catch {
      // Silent fail — banner is optional
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanner();
  }, [fetchBanner, refreshKey]);

  // ---------------------------------------------------------------------------
  // Handle close
  // ---------------------------------------------------------------------------

  const handleClose = useCallback(async () => {
    if (!banner) return;
    setDismissed(true);
    await setDismissData(getBannerFingerprint(banner));
  }, [banner]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Loading state on first load only
  if (loading && !banner) {
    return (
      <View style={{ padding: spacing.lg, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={themeColors.primary} />
      </View>
    );
  }

  // No banner, not enabled, or dismissed
  if (!banner || banner.enabled !== 'yes' || dismissed) return null;

  return <WelcomeBanner banner={banner} onClose={handleClose} />;
}

export default WelcomeBannerWidget;
