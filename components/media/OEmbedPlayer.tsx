// =============================================================================
// OEMBED PLAYER - WebView-based player for Vimeo, Wistia, and other oEmbed
// =============================================================================
// Renders the oEmbed HTML (iframe) from Fluent Community's media field.
// Used for non-YouTube providers where we don't have a native SDK.
// =============================================================================

import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface OEmbedPlayerProps {
  /** Raw oEmbed HTML (typically an <iframe>) from the API */
  html: string;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function OEmbedPlayer({ html }: OEmbedPlayerProps) {
  const { colors: themeColors } = useTheme();
  const [loading, setLoading] = React.useState(true);

  // Wrap the oEmbed iframe HTML in a responsive container
  const wrappedHtml = useMemo(() => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #000; overflow: hidden; }
        .container {
          position: relative;
          width: 100%;
          padding-bottom: 56.25%; /* 16:9 */
        }
        .container iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border: 0;
        }
      </style>
    </head>
    <body>
      <div class="container">${html}</div>
    </body>
    </html>
  `, [html]);

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={themeColors.textInverse} />
        </View>
      )}
      <WebView
        source={{ html: wrappedHtml }}
        style={styles.webview}
        scrollEnabled={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        onLoadEnd={() => setLoading(false)}
      />
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: sizing.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#000',
  },

  webview: {
    flex: 1,
    backgroundColor: '#000',
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    zIndex: 10,
  },
});
