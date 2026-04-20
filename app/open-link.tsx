// =============================================================================
// OPEN LINK - Opens a URL in the system browser and navigates back
// =============================================================================
// Route: /open-link?url={url}
//
// Used by generated launcher/tab items that want "open in system browser"
// instead of in-app WebView.
// =============================================================================

import { useEffect } from 'react';
import { Linking, View } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';

export default function OpenLinkScreen() {
  const router = useRouter();
  const { url } = useLocalSearchParams<{ url?: string }>();

  useEffect(() => {
    if (!url) {
      if (router.canGoBack()) router.back();
      return;
    }

    let mounted = true;
    Linking.openURL(url).finally(() => {
      // Navigate back after the OS processes the URL
      if (mounted && router.canGoBack()) router.back();
    });

    return () => { mounted = false; };
  }, [url, router]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View />
    </>
  );
}
