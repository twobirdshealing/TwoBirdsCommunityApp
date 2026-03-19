// =============================================================================
// PROFILE INCOMPLETE PROVIDER - Login gate for incomplete profiles
// =============================================================================
// Module-level provider that subscribes to the X-TBC-Profile-Incomplete
// response header and redirects authenticated users to /profile-complete.
// Replaces the old needsProfileCompletion logic from AuthContext + _layout.tsx.
// =============================================================================

import React, { useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { addResponseHeaderListener } from '@/services/api/client';
import { createLogger } from '@/utils/logger';

const log = createLogger('ProfileIncomplete');

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

export function ProfileIncompleteProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);

  // ---------------------------------------------------------------------------
  // Subscribe to response header
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return addResponseHeaderListener((data) => {
      if (data.profileIncomplete !== undefined) {
        setNeedsProfileCompletion(data.profileIncomplete);
      }
    });
  }, []);

  // Clear on logout
  useEffect(() => {
    if (!isAuthenticated) {
      setNeedsProfileCompletion(false);
    }
  }, [isAuthenticated]);

  // ---------------------------------------------------------------------------
  // Navigation guard — redirect to /profile-complete
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isLoading || !isAuthenticated || !needsProfileCompletion) return;

    const currentSegment = segments[0] as string;

    // Don't redirect if already on profile-complete or in the registration flow
    if (currentSegment === 'profile-complete' || currentSegment === 'register') return;

    log('Profile incomplete — redirecting to /profile-complete');
    router.replace('/profile-complete' as any);
  }, [isAuthenticated, isLoading, needsProfileCompletion, segments, router]);

  // ---------------------------------------------------------------------------
  // Provide markProfileComplete for the screen to call
  // ---------------------------------------------------------------------------

  return <>{children}</>;
}
