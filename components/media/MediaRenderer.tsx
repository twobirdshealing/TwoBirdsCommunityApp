// =============================================================================
// MEDIA RENDERER - Smart Fluent media detection
// =============================================================================

import { Feed } from '@/types';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ImageMedia } from './ImageMedia';
import { LinkPreview } from './LinkPreview';
import { VideoPlayer } from './VideoPlayer';
import { YouTubeEmbed } from './YouTubeEmbed';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface MediaRendererProps {
  feed: Feed;
  maxHeight?: number;
  onImagePress?: () => void;
  onVideoPlay?: () => void;
}

type MediaType = 'image' | 'youtube' | 'video' | 'link' | 'none';

interface DetectedMedia {
  type: MediaType;
  url?: string;
  videoId?: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  title?: string;
  provider?: string;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function extractYouTubeId(text: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const p of patterns) {
    const match = text.match(p);
    if (match) return match[1];
  }
  return null;
}

function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"]+/);
  return match ? match[0] : null;
}

function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)$/i.test(url);
}

// -----------------------------------------------------------------------------
// Detection
// -----------------------------------------------------------------------------

function detectMedia(feed: Feed): DetectedMedia {
  const message = feed.message || '';
  const rendered = feed.message_rendered || '';
  const meta = feed.meta;

  // 1️⃣ Fluent "Video Post" (YouTube button)
  if (
    meta?.media_preview?.provider === 'youtube' &&
    meta.media_preview.type === 'video'
  ) {
    const videoId = extractYouTubeId(meta.media_preview.url || '');
    if (videoId) {
      return {
        type: 'youtube',
        videoId,
        thumbnail: meta.media_preview.image,
      };
    }
  }

  // 2️⃣ Uploaded image
  if (
    meta?.media_preview?.provider === 'uploader' &&
    meta.media_preview.image
  ) {
    return {
      type: 'image',
      url: meta.media_preview.image,
      width: meta.media_preview.width,
      height: meta.media_preview.height,
    };
  }

  // 3️⃣ Featured image
  if (feed.featured_image) {
    return {
      type: 'image',
      url: feed.featured_image,
    };
  }

  // 4️⃣ YouTube pasted into text
  const ytId =
    extractYouTubeId(message) ||
    extractYouTubeId(rendered);

  if (ytId) {
    return {
      type: 'youtube',
      videoId: ytId,
      thumbnail: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
    };
  }

  // 5️⃣ Direct video URL
  const firstUrl = extractFirstUrl(message);
  if (firstUrl && isDirectVideo(firstUrl)) {
    return {
      type: 'video',
      url: firstUrl,
    };
  }

  // 6️⃣ Other link previews (giphy, external, etc)
  if (meta?.media_preview?.image) {
    return {
      type: 'link',
      url: meta.media_preview.url || firstUrl || '',
      thumbnail: meta.media_preview.image,
      provider: meta.media_preview.provider,
      title: meta.media_preview.title,
    };
  }

  return { type: 'none' };
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function MediaRenderer({
  feed,
  maxHeight = 400,
  onImagePress,
  onVideoPlay,
}: MediaRendererProps) {
  const media = detectMedia(feed);

  if (media.type === 'none') return null;

  return (
    <View style={styles.container}>
      {media.type === 'image' && media.url && (
        <ImageMedia
          url={media.url}
          maxHeight={maxHeight}
          onPress={onImagePress}
        />
      )}

      {media.type === 'youtube' && media.videoId && (
        <YouTubeEmbed
          videoId={media.videoId}
          onPlay={onVideoPlay}
        />
      )}

      {media.type === 'video' && media.url && (
        <VideoPlayer
          url={media.url}
          onPlay={onVideoPlay}
        />
      )}

      {media.type === 'link' && media.url && (
        <LinkPreview
          url={media.url}
          thumbnail={media.thumbnail}
          title={media.title}
          provider={media.provider}
        />
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
});

export default MediaRenderer;
